/**
 * Paraşüt e-Fatura Provider
 *
 * API: https://apidocs.parasut.com/ (v4, JSON:API)
 * Auth: OAuth2 Resource Owner Password Credentials (ROPC)
 *
 * Akış (e-Arşiv):
 *   1. Token al (memory cache, 2dk erken yenile)
 *   2. sales_invoice oluştur (contact inline, kalemler inline)
 *   3. e_archive oluştur (sales_invoice'a bağla) → GIB'e iletilir
 *   4. e_archive PDF URL'i al
 *
 * Akış (e-Fatura):
 *   1-2. Aynı
 *   3. send_to_recipient → alıcı GIB posta kutusuna gönderilir
 *   4. sales_invoice PDF URL'i al
 *
 * Rate Limit: Paraşüt 429 döndüğünde Retry-After header'ına uyulur.
 * Network/5xx → retryable:true (outbox exponential backoff devralır)
 * 4xx (müşteri/veri hatası) → retryable:false
 *
 * Env değişkenleri:
 *   PARASUT_CLIENT_ID, PARASUT_CLIENT_SECRET
 *   PARASUT_USERNAME, PARASUT_PASSWORD
 *   PARASUT_COMPANY_ID
 */

import { InvoiceProvider, InvoiceData, InvoiceResult } from '@/lib/einvoice/types';

// ── Token Cache ───────────────────────────────────────────────────────────────
// Serverless ortamda: warm instance paylaşır, cold start'ta yenilenir.

interface TokenCache {
  token:     string;
  expiresAt: number;  // ms since epoch
}

let _cache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const BUFFER_MS = 120_000; // token'ı 2dk erken yenile

  if (_cache && Date.now() < _cache.expiresAt - BUFFER_MS) {
    return _cache.token;
  }

  const res = await fetchWithTimeout('https://api.parasut.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'password',
      client_id:     process.env.PARASUT_CLIENT_ID,
      client_secret: process.env.PARASUT_CLIENT_SECRET,
      username:      process.env.PARASUT_USERNAME,
      password:      process.env.PARASUT_PASSWORD,
      redirect_uri:  'urn:ietf:wg:oauth:2.0:oob',
    }),
  }, 12_000);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Paraşüt OAuth ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };

  _cache = {
    token:     data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return _cache.token;
}

// ── Fetch Yardımcıları ────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url:     string,
  init:    RequestInit,
  timeoutMs = 20_000
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Paraşüt API isteği atar.
 * 401 → token cache'i sıfırla, bir kez retry yap (expired token).
 * 429 → Retry-After'a uy (max 60 sn bekleme).
 * 5xx → retryable hata fırlat.
 * 4xx → non-retryable hata fırlat.
 */
async function parasutFetch(
  url:      string,
  init:     RequestInit,
  timeoutMs = 20_000
): Promise<Response> {
  let token = await getAccessToken();

  const makeRequest = () =>
    fetchWithTimeout(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
    }, timeoutMs);

  let res = await makeRequest();

  // 401: token muhtemelen iptal edildi → cache'i sıfırla ve bir kez daha dene
  if (res.status === 401) {
    _cache = null;
    token  = await getAccessToken();
    res    = await makeRequest();
  }

  // 429: rate limit — Retry-After header'ına uy (max 60 sn)
  if (res.status === 429) {
    const retryAfter = Math.min(
      parseInt(res.headers.get('Retry-After') ?? '10', 10),
      60
    );
    await sleep(retryAfter * 1000);
    res = await makeRequest();
  }

  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Payload Builder ───────────────────────────────────────────────────────────

/**
 * InvoiceData → Paraşüt JSON:API payload
 *
 * JSON:API included array:
 *  - contacts (müşteri) → temp-id "contact-0"
 *  - sales_invoice_details (her kalem) → temp-id "detail-{idx}"
 *
 * relationships içinde temp-id ile bağlantı kurulur.
 * Paraşüt bu yapıyı tek atomik işlemde kaydeder.
 */
function buildSalesInvoicePayload(data: InvoiceData): Record<string, unknown> {
  const detailTempIds = data.lineItems.map((_, idx) => ({
    type:      'sales_invoice_details',
    'temp-id': `detail-${idx}`,
  }));

  return {
    data: {
      type: 'sales_invoices',
      attributes: {
        item_type:            data.invoiceType === 'E_FATURA'
                                ? 'invoice'
                                : 'e_archive_invoice',
        description:          `Sipariş #${data.orderNumber}`,
        issue_date:           data.invoiceDate,
        due_date:             data.invoiceDate,
        currency:             'TRL',
        invoice_series:       process.env.PARASUT_INVOICE_SERIES ?? 'A',
        invoice_id:           0,                // Paraşüt otomatik sıra numarası atar
        is_abroad:            false,
        shipment_included:    false,
        credit_sales_invoice: false,
        payment_account_type: 'cash',           // Ön ödemeli e-ticaret siparişi
        payment_date:         data.invoiceDate,
        withholding_rate:     0,
        vat_withholding_rate: 0,
        // e-Arşiv: ayrı e_archives kaynağı kullanılır, bu alan ignored
        e_invoice_type:       data.invoiceType === 'E_FATURA' ? 'basic' : null,
      },
      relationships: {
        contact: {
          data: { type: 'contacts', 'temp-id': 'contact-0' },
        },
        details: {
          data: detailTempIds,
        },
      },
    },
    included: [
      // ── Müşteri ──────────────────────────────────────────────────────────
      {
        type:      'contacts',
        'temp-id': 'contact-0',
        attributes: {
          name:         data.customer.name,
          email:        data.customer.email,
          phone:        data.customer.phone ?? '',
          contact_type: data.customer.taxNumber?.length === 10
                          ? 'company'
                          : 'person',
          account_type: 'customer',
          tax_number:   data.customer.taxNumber ?? '',
          tax_office:   data.customer.taxOffice ?? '',
          city:         data.customer.city,
          country:      'Turkey',
          zip:          '',
        },
      },
      // ── Fatura Kalemleri ─────────────────────────────────────────────────
      ...data.lineItems.map((item, idx) => ({
        type:      'sales_invoice_details',
        'temp-id': `detail-${idx}`,
        attributes: {
          quantity:                 item.quantity,
          unit_price:               Number(item.unitPrice.toFixed(4)),
          vat_rate:                 item.vatRate,
          description:              item.description
                                      ? `${item.name} — ${item.description}`
                                      : item.name,
          discount_type:            'percentage',
          discount_value:           item.discountRate ?? 0,
          excise_duty_type:         'percentage',
          excise_duty_value:        0,
          communications_tax_rate:  0,
          unit:                     item.unitCode,
        },
        relationships: {
          product: { data: null },  // Ürün kataloğu opsiyonel
        },
      })),
    ],
  };
}

// ── E-Arşiv Payload Builder ───────────────────────────────────────────────────

function buildEArchivePayload(invoiceId: string): Record<string, unknown> {
  return {
    data: {
      type: 'e_archives',
      attributes: {
        vat_withholding_code:       '',
        vat_exemption_reason_code:  '',
        vat_exemption_reason:       '',
      },
      relationships: {
        sales_invoice: {
          data: { type: 'sales_invoices', id: invoiceId },
        },
      },
    },
  };
}

// ── Hata Sınıflandırma ────────────────────────────────────────────────────────

function classifyError(status: number, body: string): Pick<InvoiceResult, 'error' | 'errorCode' | 'retryable'> {
  return {
    error:     `Paraşüt HTTP ${status}: ${body.slice(0, 400)}`,
    errorCode: `HTTP_${status}`,
    // 5xx ve 429 → retry (geçici); 4xx → veri/konfigürasyon hatası, retry yapma
    retryable: status >= 500 || status === 429,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class ParasutProvider implements InvoiceProvider {
  readonly name = 'parasut';

  isConfigured(): boolean {
    return !!(
      process.env.PARASUT_CLIENT_ID     &&
      process.env.PARASUT_CLIENT_SECRET &&
      process.env.PARASUT_USERNAME      &&
      process.env.PARASUT_PASSWORD      &&
      process.env.PARASUT_COMPANY_ID
    );
  }

  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    const company = process.env.PARASUT_COMPANY_ID!;
    const base    = `https://api.parasut.com/v4/${company}`;

    try {
      // ── 1. Taslak fatura oluştur ──────────────────────────────────────────
      const createRes = await parasutFetch(
        `${base}/sales_invoices`,
        { method: 'POST', body: JSON.stringify(buildSalesInvoicePayload(data)) }
      );

      if (!createRes.ok) {
        return { success: false, ...classifyError(createRes.status, await createRes.text()) };
      }

      const created    = await createRes.json() as { data: { id: string } };
      const invoiceId  = created.data?.id;

      if (!invoiceId) {
        return { success: false, error: 'Paraşüt: fatura ID yanıtta yok', retryable: false };
      }

      // ── 2a. e-Arşiv: GIB'e ilet ──────────────────────────────────────────
      if (data.invoiceType !== 'E_FATURA') {
        return await this._submitEArchive(base, invoiceId, data);
      }

      // ── 2b. e-Fatura: alıcıya gönder ─────────────────────────────────────
      return await this._submitEInvoice(base, invoiceId);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // AbortError (timeout) → retryable
      const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('signal');
      return {
        success:   false,
        error:     `Paraşüt exception: ${msg}`,
        retryable: true,
        ...(isTimeout ? { errorCode: 'TIMEOUT' } : {}),
      };
    }
  }

  // ── e-Arşiv akışı ──────────────────────────────────────────────────────────

  private async _submitEArchive(
    base:      string,
    invoiceId: string,
    data:      InvoiceData
  ): Promise<InvoiceResult> {
    const archiveRes = await parasutFetch(
      `${base}/e_archives`,
      { method: 'POST', body: JSON.stringify(buildEArchivePayload(invoiceId)) },
      25_000
    );

    if (!archiveRes.ok) {
      const txt = await archiveRes.text();
      // Fatura zaten GIB'e iletilmişse (conflict) başarılı say
      if (archiveRes.status === 422 && txt.includes('already')) {
        return await this._fetchEArchivePdf(base, invoiceId);
      }
      return { success: false, ...classifyError(archiveRes.status, txt) };
    }

    const archive = await archiveRes.json() as {
      data: { id: string; attributes: { invoice_no?: string; uuid?: string } }
    };

    const eArchiveId    = archive.data?.id;
    const invoiceNumber = archive.data?.attributes?.invoice_no;
    const invoiceUuid   = archive.data?.attributes?.uuid;

    // ── PDF URL al ────────────────────────────────────────────────────────────
    let pdfUrl: string | undefined;
    if (eArchiveId) {
      pdfUrl = await this._getEArchivePdfUrl(base, eArchiveId);
    }

    return {
      success:       true,
      invoiceNumber: invoiceNumber ?? `PAR-${invoiceId}`,
      invoiceUuid,
      pdfUrl,
      htmlUrl:       `https://app.parasut.com/${process.env.PARASUT_COMPANY_ID}/sales-invoices/${invoiceId}`,
      issuedAt:      new Date().toISOString(),
    };
  }

  // ── e-Fatura akışı ─────────────────────────────────────────────────────────

  private async _submitEInvoice(
    base:      string,
    invoiceId: string
  ): Promise<InvoiceResult> {
    const sendRes = await parasutFetch(
      `${base}/sales_invoices/${invoiceId}/send_to_recipient`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: { type: 'sales_invoice_send_to_recipient' },
        }),
      },
      25_000
    );

    if (!sendRes.ok) {
      return { success: false, ...classifyError(sendRes.status, await sendRes.text()) };
    }

    // PDF
    const pdfUrl = await this._getSalesInvoicePdfUrl(base, invoiceId);

    // Fatura numarasını sales_invoice'dan çek
    const detailRes = await parasutFetch(
      `${base}/sales_invoices/${invoiceId}`,
      { method: 'GET' }
    );
    let invoiceNumber: string | undefined;
    if (detailRes.ok) {
      const detail = await detailRes.json() as {
        data: { attributes: { invoice_no?: string; uuid?: string } }
      };
      invoiceNumber = detail.data?.attributes?.invoice_no;
    }

    return {
      success:       true,
      invoiceNumber: invoiceNumber ?? `PAR-${invoiceId}`,
      pdfUrl,
      htmlUrl:       `https://app.parasut.com/${process.env.PARASUT_COMPANY_ID}/sales-invoices/${invoiceId}`,
      issuedAt:      new Date().toISOString(),
    };
  }

  // ── PDF URL Yardımcıları ───────────────────────────────────────────────────

  private async _getEArchivePdfUrl(
    base:       string,
    eArchiveId: string
  ): Promise<string | undefined> {
    try {
      const res = await parasutFetch(
        `${base}/e_archives/${eArchiveId}/pdf`,
        { method: 'GET' },
        12_000
      );
      if (!res.ok) return undefined;
      const json = await res.json() as { data: { attributes: { url?: string } } };
      return json.data?.attributes?.url;
    } catch {
      return undefined;
    }
  }

  private async _fetchEArchivePdf(
    base:      string,
    invoiceId: string
  ): Promise<InvoiceResult> {
    // Sipariş zaten e_archive'a sahipse tekrar yaratmaya gerek yok —
    // mevcut e_archive listesinden bul.
    try {
      const listRes = await parasutFetch(
        `${base}/e_archives?filter[sales_invoice_id]=${invoiceId}`,
        { method: 'GET' }
      );
      if (listRes.ok) {
        const list = await listRes.json() as {
          data: Array<{ id: string; attributes: { invoice_no?: string; uuid?: string } }>
        };
        const first = list.data?.[0];
        if (first) {
          const pdfUrl = await this._getEArchivePdfUrl(base, first.id);
          return {
            success:       true,
            invoiceNumber: first.attributes?.invoice_no ?? `PAR-${invoiceId}`,
            invoiceUuid:   first.attributes?.uuid,
            pdfUrl,
            htmlUrl:       `https://app.parasut.com/${process.env.PARASUT_COMPANY_ID}/sales-invoices/${invoiceId}`,
            issuedAt:      new Date().toISOString(),
          };
        }
      }
    } catch { /* ignore */ }
    return { success: false, error: 'Mevcut e-arşiv kaydı alınamadı', retryable: true };
  }

  private async _getSalesInvoicePdfUrl(
    base:      string,
    invoiceId: string
  ): Promise<string | undefined> {
    try {
      const res = await parasutFetch(
        `${base}/sales_invoices/${invoiceId}/pdf`,
        { method: 'GET' },
        12_000
      );
      if (!res.ok) return undefined;
      const json = await res.json() as { data: { attributes: { url?: string } } };
      return json.data?.attributes?.url;
    } catch {
      return undefined;
    }
  }
}
