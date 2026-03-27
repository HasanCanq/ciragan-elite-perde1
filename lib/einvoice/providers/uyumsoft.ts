/**
 * Uyumsoft e-Fatura Provider
 *
 * API: Uyumsoft Entegrasyon REST API
 * Auth: JWT session token (POST /api/auth/login → {token, expires})
 *       Token 8 saatte bir yenilenir, 30 sn erken yenileme.
 *
 * Akış (e-Arşiv):
 *   1. Session token al (memory cache)
 *   2. UBL-TR 2.1 XML üret (GIB standardı)
 *   3. e_archive/create → UUID + GIB fatura numarası döner
 *   4. PDF URL al (doğrudan yanıtta veya ayrı endpoint)
 *
 * Akış (e-Fatura):
 *   1-2. Aynı
 *   3. einvoice/send → alıcı GIB posta kutusuna gider
 *   4. PDF URL al
 *
 * Rate Limit: 429 → Retry-After header'ına uy (max 120 sn).
 * 5xx → retryable. 4xx (422 iş kuralı) → non-retryable.
 *
 * Env değişkenleri:
 *   UYUMSOFT_API_URL      (örn: https://efatura.uyumsoft.com.tr)
 *   UYUMSOFT_USERNAME
 *   UYUMSOFT_PASSWORD
 *   UYUMSOFT_VKN          (firmanın 10 haneli vergi kimlik numarası)
 *   UYUMSOFT_ALIAS        (GIB e-fatura posta kutusu alias, opsiyonel)
 *   UYUMSOFT_COMPANY_NAME (fatura başlığında gösterilen ticaret unvanı)
 */

import { InvoiceProvider, InvoiceData, InvoiceResult } from '@/lib/einvoice/types';

// ── Token Cache ───────────────────────────────────────────────────────────────

interface SessionCache {
  token:     string;
  expiresAt: number;
}

let _session: SessionCache | null = null;
const SESSION_BUFFER_MS = 30_000; // 30 sn erken yenile

// ── Fetch Yardımcısı ──────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url:      string,
  init:     RequestInit,
  timeoutMs = 20_000
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Session Yönetimi ──────────────────────────────────────────────────────────

async function getSessionToken(): Promise<string> {
  if (_session && Date.now() < _session.expiresAt - SESSION_BUFFER_MS) {
    return _session.token;
  }

  const base = process.env.UYUMSOFT_API_URL!;

  const res = await fetchWithTimeout(
    `${base}/api/auth/login`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: process.env.UYUMSOFT_USERNAME,
        password: process.env.UYUMSOFT_PASSWORD,
        vkn:      process.env.UYUMSOFT_VKN,
      }),
    },
    12_000
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Uyumsoft auth ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    token:     string;
    expiresIn: number; // saniye cinsinden (genellikle 28800 = 8 saat)
  };

  if (!data.token) {
    throw new Error('Uyumsoft auth: yanıtta token yok');
  }

  _session = {
    token:     data.token,
    expiresAt: Date.now() + (data.expiresIn ?? 28800) * 1000,
  };

  return _session.token;
}

/**
 * Uyumsoft API isteği atar.
 * 401 → session sıfırla, bir kez retry yap.
 * 429 → Retry-After bekle, bir kez retry yap.
 */
async function uyumsoftFetch(
  path:      string,
  init:      RequestInit,
  timeoutMs = 25_000
): Promise<Response> {
  const base = process.env.UYUMSOFT_API_URL!;

  let token = await getSessionToken();

  const makeRequest = () =>
    fetchWithTimeout(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
    }, timeoutMs);

  let res = await makeRequest();

  if (res.status === 401) {
    _session = null;
    token    = await getSessionToken();
    res      = await makeRequest();
  }

  if (res.status === 429) {
    const retryAfter = Math.min(
      parseInt(res.headers.get('Retry-After') ?? '15', 10),
      120
    );
    await sleep(retryAfter * 1000);
    res = await makeRequest();
  }

  return res;
}

// ── UBL-TR 2.1 XML Builder ────────────────────────────────────────────────────

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * GIB UBL-TR 2.1 fatura XML'i üretir.
 * invoiceNo: GIB tarafından atanır (submit öncesi placeholder kullanılır,
 * gerçek numara API yanıtında döner ve outbox'ta invoice_number alanına yazılır).
 *
 * ProfileID:
 *  e-Arşiv → EARSIVFATURA
 *  e-Fatura → TICARIFATURA (B2B standart) veya TEMELFATURA (basit)
 */
function buildUblXml(data: InvoiceData, placeholderNo: string): string {
  const isEFatura  = data.invoiceType === 'E_FATURA';
  const profileId  = isEFatura ? 'TICARIFATURA' : 'EARSIVFATURA';
  const schemeId   = data.customer.taxNumber?.length === 10 ? 'VKN' : 'TCKN';
  const taxNumber  = data.customer.taxNumber ?? '11111111111';
  const companyVkn = process.env.UYUMSOFT_VKN!;
  const companyName = escXml(
    process.env.UYUMSOFT_COMPANY_NAME ?? 'Çırağan Elite Perde'
  );

  // Her kalem için KDV + tutar hesaplamaları
  const lineXml = data.lineItems.map((item, idx) => {
    const lineTotal  = +(item.unitPrice * item.quantity).toFixed(2);
    const vatAmount  = +(lineTotal * item.vatRate / 100).toFixed(2);
    const discount   = item.discountRate
      ? `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>İskonto</cbc:AllowanceChargeReason>
      <cbc:MultiplierFactorNumeric>${(item.discountRate / 100).toFixed(4)}</cbc:MultiplierFactorNumeric>
      <cbc:Amount currencyID="TRY">${(lineTotal * item.discountRate / 100).toFixed(2)}</cbc:Amount>
      <cbc:BaseAmount currencyID="TRY">${lineTotal.toFixed(2)}</cbc:BaseAmount>
    </cac:AllowanceCharge>`
      : '';

    return `
  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${item.unitCode}">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>${discount}
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="TRY">${vatAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="TRY">${lineTotal.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="TRY">${vatAmount.toFixed(2)}</cbc:TaxAmount>
        <cbc:Percent>${item.vatRate}</cbc:Percent>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:Name>KDV</cbc:Name>
            <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${escXml(item.name)}</cbc:Name>
      ${item.description ? `<cbc:Description>${escXml(item.description)}</cbc:Description>` : ''}
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="TRY">${item.unitPrice.toFixed(4)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ccts="urn:un:unece:uncefact:documentation:2"
         xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"
         xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${profileId}</cbc:ProfileID>
  <cbc:ID>${escXml(placeholderNo)}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:IssueDate>${data.invoiceDate}</cbc:IssueDate>
  <cbc:IssueTime>00:00:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${data.lineItems.length}</cbc:LineCountNumeric>
  <cbc:Note>Sipariş No: ${escXml(data.orderNumber)}</cbc:Note>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${companyVkn}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${companyName}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:CityName>İstanbul</cbc:CityName>
        <cbc:Country><cbc:Name>Türkiye</cbc:Name></cbc:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${schemeId}">${escXml(taxNumber)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escXml(data.customer.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escXml(data.customer.address)}</cbc:StreetName>
        <cbc:CityName>${escXml(data.customer.city)}</cbc:CityName>
        <cbc:Country><cbc:Name>Türkiye</cbc:Name></cbc:Country>
      </cac:PostalAddress>
      <cac:Contact>
        <cbc:ElectronicMail>${escXml(data.customer.email)}</cbc:ElectronicMail>
        ${data.customer.phone ? `<cbc:Telephone>${escXml(data.customer.phone)}</cbc:Telephone>` : ''}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>ZZZ</cbc:PaymentMeansCode>
  </cac:PaymentMeans>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TRY">${data.vatAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="TRY">${data.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="TRY">${data.vatAmount.toFixed(2)}</cbc:TaxAmount>
      <cbc:Percent>20</cbc:Percent>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:Name>KDV</cbc:Name>
          <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">${data.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">${data.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">${data.totalAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">${data.totalAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lineXml}
</Invoice>`.trim();
}

// ── Placeholder Fatura Numarası ───────────────────────────────────────────────
// GIB nihai numarayı atar; bu sadece XML'de bir referans olarak kullanılır.
// Uyumsoft yanıtındaki gerçek numara invoice_number alanına yazılır.

function makePlaceholder(type: string): string {
  const prefix = type === 'E_FATURA' ? 'EFT' : 'EAR';
  const year   = new Date().getFullYear();
  const seq    = String(Date.now()).slice(-9).padStart(9, '0');
  return `${prefix}${year}${seq}`;
}

// ── Hata Sınıflandırma ────────────────────────────────────────────────────────

function classifyError(
  status: number,
  body:   string
): Pick<InvoiceResult, 'error' | 'errorCode' | 'retryable'> {
  // 422 → GIB iş kuralı / veri hatası → retry anlamsız
  const nonRetryable = status === 422 || (status >= 400 && status < 500 && status !== 429);
  return {
    error:     `Uyumsoft HTTP ${status}: ${body.slice(0, 400)}`,
    errorCode: `HTTP_${status}`,
    retryable: !nonRetryable,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class UyumsoftProvider implements InvoiceProvider {
  readonly name = 'uyumsoft';

  isConfigured(): boolean {
    return !!(
      process.env.UYUMSOFT_API_URL  &&
      process.env.UYUMSOFT_USERNAME &&
      process.env.UYUMSOFT_PASSWORD &&
      process.env.UYUMSOFT_VKN
    );
  }

  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    try {
      const placeholder = makePlaceholder(data.invoiceType);
      const xmlContent  = buildUblXml(data, placeholder);
      const xmlBase64   = Buffer.from(xmlContent, 'utf8').toString('base64');

      if (data.invoiceType === 'E_FATURA') {
        return await this._sendEInvoice(data, xmlBase64, placeholder);
      }
      return await this._sendEArchive(data, xmlBase64, placeholder);

    } catch (err) {
      const msg       = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('signal');
      return {
        success:   false,
        error:     `Uyumsoft exception: ${msg}`,
        errorCode: isTimeout ? 'TIMEOUT' : 'EXCEPTION',
        retryable: true,
      };
    }
  }

  // ── e-Arşiv ────────────────────────────────────────────────────────────────

  private async _sendEArchive(
    data:        InvoiceData,
    xmlBase64:   string,
    placeholder: string
  ): Promise<InvoiceResult> {
    const res = await uyumsoftFetch('/api/earchive/create', {
      method: 'POST',
      body: JSON.stringify({
        invoiceContent: xmlBase64,          // UTF-8 → Base64 UBL-TR XML
        referenceId:    data.orderId,       // Bizim sipariş UUID'imiz
        invoiceType:    'EARSIV',
        vkn:            process.env.UYUMSOFT_VKN,
        sendEmail:      false,              // E-postayı kendi sistemimiz gönderir
        emailAddress:   data.customer.email,
      }),
    }, 30_000);

    if (!res.ok) {
      return { success: false, ...classifyError(res.status, await res.text()) };
    }

    const result = await res.json() as {
      success:       boolean;
      invoiceNo?:    string;   // GIB tarafından atanan fatura numarası
      uuid?:         string;   // GIB UUID
      pdfUrl?:       string;   // Doğrudan PDF URL (opsiyonel)
      message?:      string;
      errorCode?:    string;
    };

    if (!result.success) {
      return {
        success:   false,
        error:     result.message ?? 'Uyumsoft: e-Arşiv reddedildi',
        errorCode: result.errorCode,
        retryable: false, // API success:false → iş kuralı hatası
      };
    }

    // PDF URL: yanıtta varsa doğrudan kullan, yoksa ayrı endpoint'ten al
    const pdfUrl = result.pdfUrl ?? await this._fetchPdfUrl(result.uuid);

    return {
      success:       true,
      invoiceNumber: result.invoiceNo ?? placeholder,
      invoiceUuid:   result.uuid,
      pdfUrl,
      issuedAt:      new Date().toISOString(),
    };
  }

  // ── e-Fatura ───────────────────────────────────────────────────────────────

  private async _sendEInvoice(
    data:        InvoiceData,
    xmlBase64:   string,
    placeholder: string
  ): Promise<InvoiceResult> {
    const alias = process.env.UYUMSOFT_ALIAS;

    const res = await uyumsoftFetch('/api/einvoice/send', {
      method: 'POST',
      body: JSON.stringify({
        invoiceContent:   xmlBase64,
        referenceId:      data.orderId,
        invoiceType:      'EFATURA',
        receiverAlias:    alias,            // Alıcı GIB alias (B2B)
        receiverVkn:      data.customer.taxNumber ?? '',
        vkn:              process.env.UYUMSOFT_VKN,
        profileId:        'TICARIFATURA',
      }),
    }, 35_000);

    if (!res.ok) {
      return { success: false, ...classifyError(res.status, await res.text()) };
    }

    const result = await res.json() as {
      success:    boolean;
      invoiceNo?: string;
      uuid?:      string;
      pdfUrl?:    string;
      message?:   string;
      errorCode?: string;
    };

    if (!result.success) {
      return {
        success:   false,
        error:     result.message ?? 'Uyumsoft: e-Fatura reddedildi',
        errorCode: result.errorCode,
        retryable: false,
      };
    }

    const pdfUrl = result.pdfUrl ?? await this._fetchPdfUrl(result.uuid);

    return {
      success:       true,
      invoiceNumber: result.invoiceNo ?? placeholder,
      invoiceUuid:   result.uuid,
      pdfUrl,
      issuedAt:      new Date().toISOString(),
    };
  }

  // ── PDF URL ────────────────────────────────────────────────────────────────

  private async _fetchPdfUrl(uuid?: string): Promise<string | undefined> {
    if (!uuid) return undefined;
    try {
      const res = await uyumsoftFetch(
        `/api/invoice/pdf/${encodeURIComponent(uuid)}`,
        { method: 'GET' },
        12_000
      );
      if (!res.ok) return undefined;

      // Bazı Uyumsoft kurulumları PDF'i binary döner, bazıları URL döner
      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('application/pdf')) {
        // Binary PDF → Base64 (outbox pdfUrl alanına data URI olarak sakla)
        const buf = await res.arrayBuffer();
        return `data:application/pdf;base64,${Buffer.from(buf).toString('base64')}`;
      }

      // JSON URL yanıtı
      const json = await res.json() as { url?: string; pdfUrl?: string };
      return json.url ?? json.pdfUrl;
    } catch {
      return undefined;
    }
  }
}
