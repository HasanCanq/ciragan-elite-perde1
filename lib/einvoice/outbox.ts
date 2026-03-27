/**
 * E-Fatura Outbox Servisi
 *
 * Transactional Outbox Pattern:
 * - Sipariş DELIVERED/SHIPPED olduğunda fatura kuyruğuna eklenir
 * - Cron worker kuyruğu okuyup entegratöre gönderir
 * - Başarısız istekler exponential backoff ile retry'lanır
 * - Başarıda PDF URL müşteriye e-posta ile gönderilir
 *
 * Neden bu pattern?
 * - Kargo API'si çökmüşse fatura kaybedilmez
 * - Fatura oluşturulurken sipariş işlemi bloke edilmez
 * - Max retry sonrası admin alarmı tetiklenir
 */

import { createClient } from '@supabase/supabase-js';
import { InvoiceType, InvoiceData, buildInvoiceData } from '@/lib/einvoice/types';
import { getInvoiceProvider } from '@/lib/einvoice/providers';

// ============================================================
// TYPES
// ============================================================

export interface InvoiceOutboxJob {
  id:             string;
  order_id:       string;
  invoice_type:   InvoiceType;
  provider:       string;
  invoice_data:   InvoiceData;
  status:         'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retry_count:    number;
  max_retries:    number;
  next_retry_at:  string;
  last_error:     string | null;
  invoice_number: string | null;
  invoice_uuid:   string | null;
  invoice_pdf_url: string | null;
  email_sent_at:  string | null;
}

// ============================================================
// EXPONENTIAL BACKOFF
// ============================================================

/**
 * retry 0→1: ~2dk · 1→2: ~4dk · 2→3: ~8dk · 3→4: ~16dk (son deneme)
 */
function calculateNextRetryAt(retryCount: number): Date {
  const jitterMs = Math.random() * 60_000;
  const delayMs  = 2 * 60_000 * Math.pow(2, retryCount) + jitterMs;
  return new Date(Date.now() + delayMs);
}

// ============================================================
// ADMIN SUPABASE
// ============================================================

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ============================================================
// FATURA KUYRUĞA EKLE (Sipariş durumu değişince çağrılır)
// ============================================================

/**
 * Sipariş DELIVERED (veya SHIPPED) statüsüne geçtiğinde çağrılır.
 * Müşteri bilgilerini ve sipariş kalemlerini DB'den çekip fatura verisini hazırlar.
 * Faturayı atmak yerine sadece kuyruğa yazar (outbox guarantee).
 */
export async function enqueueInvoiceForOrder(
  orderId:     string,
  invoiceType: InvoiceType = 'E_ARSIV',
  provider?:   string
): Promise<void> {
  const supabase = getAdminSupabase();

  // Daha önce bu sipariş için kuyrukta kayıt var mı? (duplicate prevention)
  const { data: existing } = await supabase
    .from('invoice_outbox')
    .select('id, status')
    .eq('order_id', orderId)
    .eq('invoice_type', invoiceType)
    .maybeSingle();

  if (existing) {
    console.info('[InvoiceOutbox] Zaten kuyruğa eklenmiş, atlandı', {
      orderId,
      status: existing.status,
    });
    return;
  }

  // Sipariş + kalemleri DB'den çek
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, order_number, customer_name, customer_email, customer_phone,
      shipping_address, subtotal, total_amount,
      order_items (
        product_name, quantity, area_m2, unit_price, total_price,
        width_cm, height_cm, pile_factor
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('[InvoiceOutbox] Sipariş verisi alınamadı:', orderError);
    throw new Error(`Sipariş fatura kuyruğuna eklenemedi: ${orderError?.message}`);
  }

  const invoiceData = buildInvoiceData(order, order.order_items ?? [], invoiceType);

  // Konfigüre edilmiş provider adını al
  let resolvedProvider = provider;
  if (!resolvedProvider) {
    try {
      resolvedProvider = getInvoiceProvider().name;
    } catch {
      resolvedProvider = process.env.EINVOICE_PROVIDER ?? 'parasut';
    }
  }

  const { error: insertError } = await supabase
    .from('invoice_outbox')
    .insert({
      order_id:       orderId,
      invoice_type:   invoiceType,
      provider:       resolvedProvider,
      invoice_data:   invoiceData,
      status:         'PENDING',
      retry_count:    0,
      next_retry_at:  new Date().toISOString(),
    });

  if (insertError) {
    console.error('[InvoiceOutbox] Kuyruğa ekleme hatası:', insertError);
    throw new Error(`Fatura kuyruğuna eklenemedi: ${insertError.message}`);
  }

  console.info('[InvoiceOutbox] Fatura kuyruğa eklendi', { orderId, invoiceType });
}

// ============================================================
// FATURA OUTBOX İŞLEMCİSİ (Cron worker tarafından çağrılır)
// ============================================================

export async function processInvoiceOutbox(batchSize = 5): Promise<{
  success: number;
  failed: number;
}> {
  const supabase = getAdminSupabase();
  const stats    = { success: 0, failed: 0 };

  // Atomik claim: PENDING → PROCESSING
  const { data: jobs, error: claimError } = await supabase
    .rpc('claim_pending_invoice_jobs', { p_limit: batchSize });

  if (claimError) {
    console.error('[InvoiceOutbox] Claim hatası:', claimError);
    return stats;
  }

  if (!jobs || jobs.length === 0) return stats;

  console.info(`[InvoiceOutbox] ${jobs.length} fatura işleniyor`);

  const results = await Promise.allSettled(
    (jobs as InvoiceOutboxJob[]).map((job) => processSingleInvoice(supabase, job))
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      if (r.value === 'success') stats.success++;
      else                       stats.failed++;
    } else {
      stats.failed++;
    }
  });

  return stats;
}

async function processSingleInvoice(
  supabase: ReturnType<typeof getAdminSupabase>,
  job: InvoiceOutboxJob
): Promise<'success' | 'failed'> {
  try {
    const provider = getInvoiceProvider();
    const result   = await provider.createInvoice(job.invoice_data);

    if (result.success) {
      // ── Başarı: COMPLETED ─────────────────────────────────────────────
      await supabase
        .from('invoice_outbox')
        .update({
          status:          'COMPLETED',
          invoice_number:  result.invoiceNumber,
          invoice_uuid:    result.invoiceUuid,
          invoice_pdf_url: result.pdfUrl,
          invoice_html_url: result.htmlUrl,
          issued_at:       result.issuedAt,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', job.id);

      // Müşteriye PDF e-posta gönder (fire-and-forget)
      void sendInvoiceEmail(
        job.order_id,
        job.invoice_data.customer.email,
        job.invoice_data.customer.name,
        result.pdfUrl,
        result.htmlUrl,
        result.invoiceNumber,
        supabase,
        job.id
      );

      console.info('[InvoiceOutbox] Fatura oluşturuldu', {
        orderId:       job.order_id,
        invoiceNumber: result.invoiceNumber,
      });

      return 'success';
    }

    // ── Başarısız: retry veya FAILED ──────────────────────────────────
    const newRetryCount = job.retry_count + 1;
    const isMaxRetry    = newRetryCount >= job.max_retries;
    const shouldRetry   = !isMaxRetry && (result.retryable !== false);

    await supabase
      .from('invoice_outbox')
      .update({
        status:        shouldRetry ? 'PENDING' : 'FAILED',
        retry_count:   newRetryCount,
        next_retry_at: shouldRetry
          ? calculateNextRetryAt(newRetryCount).toISOString()
          : null,
        last_error:  result.error ?? 'Bilinmeyen hata',
        updated_at:  new Date().toISOString(),
      })
      .eq('id', job.id);

    if (isMaxRetry || result.retryable === false) {
      console.error('[InvoiceOutbox] FATURA OLUŞTURULAMADI — manuel müdahale', {
        jobId:   job.id,
        orderId: job.order_id,
        error:   result.error,
        retryable: result.retryable,
      });
      // Prod'da burada admin'e Slack/email gönderin
    }

    return 'failed';
  } catch (err) {
    // Lock'ı serbest bırak
    await supabase
      .from('invoice_outbox')
      .update({
        status:        'PENDING',
        last_error:    err instanceof Error ? err.message : 'Unexpected error',
        next_retry_at: calculateNextRetryAt(job.retry_count).toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', job.id);

    throw err;
  }
}

// ============================================================
// MÜŞTERİYE FATURA E-POSTASI GÖNDER
// ============================================================

async function sendInvoiceEmail(
  orderId:       string,
  email:         string,
  name:          string,
  pdfUrl:        string | undefined,
  htmlUrl:       string | undefined,
  invoiceNumber: string | undefined,
  supabase:      ReturnType<typeof getAdminSupabase>,
  jobId:         string
): Promise<void> {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL ?? 'fatura@ciragan-elite.com';
  const siteName = 'Çırağan Elite Perde';
  const orderRef = orderId.slice(-8).toUpperCase();

  if (!apiKey) return;

  const pdfSection = pdfUrl
    ? `<p><a href="${pdfUrl}" style="background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Faturamı İndir (PDF)</a></p>`
    : htmlUrl
    ? `<p><a href="${htmlUrl}" style="background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Faturamı Görüntüle</a></p>`
    : '<p>Faturanız hazırlanmıştır. Fatura no ile muhasebe departmanımızdan temin edebilirsiniz.</p>';

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:0;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#1a1a1a;padding:24px 32px;text-align:center;">
    <span style="color:#fff;font-size:20px;font-weight:700;">${siteName}</span>
  </div>
  <div style="padding:32px;">
    <p style="color:#374151;">Sayın ${name},</p>
    <p style="color:#6b7280;font-size:14px;">
      <strong>#${orderRef}</strong> numaralı siparişinize ait e-fatura düzenlenmiştir.
      ${invoiceNumber ? `<br/>Fatura No: <strong>${invoiceNumber}</strong>` : ''}
    </p>
    <div style="margin:24px 0;">${pdfSection}</div>
    <p style="color:#9ca3af;font-size:12px;">
      7 yıl süreyle fatura arşivlerinizi e-Devlet Kapısı üzerinden de görüntüleyebilirsiniz.
    </p>
  </div>
</div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    fromAddr,
      to:      email,
      subject: `${siteName} — Faturanız Hazır (#${orderRef})`,
      html,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (res.ok) {
    await supabase
      .from('invoice_outbox')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', jobId);
  } else {
    console.error('[InvoiceOutbox] Fatura emaili gönderilemedi:', res.status);
  }
}
