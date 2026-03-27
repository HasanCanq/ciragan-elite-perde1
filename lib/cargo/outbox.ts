/**
 * Kargo Outbox Servisi
 *
 * Transactional Outbox Pattern:
 * - Sipariş READY_TO_SHIP olduğunda kargo API isteği doğrudan atılmaz
 * - Önce cargo_outbox tablosuna yazılır (orders güncellemesiyle aynı transaction'da)
 * - Cron worker bu kayıtları okuyarak kargo API'sine iletir
 * - Başarısız istekler exponential backoff ile otomatik tekrar denenir
 *
 * Bu pattern şunu garanti eder:
 * ✓ Sipariş güncellendi ama kargo API çöktü → barkod kaybedilmez
 * ✓ Network hatası → otomatik retry
 * ✓ Max retry aşıldı → admin alarmı + manuel müdahale queue'su
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

export interface CargoOutboxJob {
  id: string;
  order_id: string;
  payload: CargoShipmentPayload;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  last_error: string | null;
  barcode: string | null;
  created_at: string;
}

/** Kargo API'sine gönderilecek standart payload */
export interface CargoShipmentPayload {
  orderId: string;
  carrierCode: string;        // 'yurtici' | 'mng' | 'ptt'
  senderInfo: {
    name: string;
    address: string;
    city: string;
    phone: string;
  };
  recipientInfo: {
    name: string;
    address: string;
    city: string;
    district: string;
    phone: string;
    postalCode?: string;
  };
  packageInfo: {
    weight: number;           // kg
    desi: number;             // hacimsel ağırlık
    pieceCount: number;
    description: string;
  };
  referenceNo: string;        // Bizim sipariş ID'miz
}

/** Kargo API yanıtı */
interface CarrierApiResult {
  success: boolean;
  barcode?: string;
  error?: string;
}

// ============================================================
// EXPONENTIAL BACKOFF
// ============================================================

/**
 * Bir sonraki deneme zamanını hesaplar.
 * Formül: base * 2^retryCount + jitter
 *
 * retry 0 → 1 dk
 * retry 1 → 2 dk
 * retry 2 → 4 dk
 * retry 3 → 8 dk
 * retry 4 → 16 dk (son deneme)
 */
export function calculateNextRetryAt(retryCount: number, baseMinutes = 1): Date {
  const jitterMs = Math.random() * 30_000; // 0-30 sn rastgele jitter (thundering herd önler)
  const delayMs  = baseMinutes * 60_000 * Math.pow(2, retryCount) + jitterMs;
  return new Date(Date.now() + delayMs);
}

// ============================================================
// KARGO API ADAPTÖRLER
// ============================================================

/**
 * Yurtiçi Kargo API çağrısı.
 * Gerçek implementasyonda Yurtiçi'nin resmi API'sini kullanın:
 * https://www.yurticikargo.com/tr/kurumsal-cozumler/entegrasyon
 */
async function callYurticiApi(payload: CargoShipmentPayload): Promise<CarrierApiResult> {
  const apiUrl = process.env.YURTICI_API_URL;
  const apiKey = process.env.YURTICI_API_KEY;
  const apiPassword = process.env.YURTICI_API_PASSWORD;

  if (!apiUrl || !apiKey) {
    return { success: false, error: 'Yurtiçi API credentials eksik' };
  }

  const response = await fetch(`${apiUrl}/CreateShipment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiPassword}`).toString('base64')}`,
    },
    body: JSON.stringify({
      InvoiceKey:      apiKey,
      Password:        apiPassword,
      ShipmentNumber:  payload.referenceNo,
      ReceiverName:    payload.recipientInfo.name,
      ReceiverAddress: payload.recipientInfo.address,
      ReceiverPhone:   payload.recipientInfo.phone,
      ReceiverCityCode: payload.recipientInfo.city,
      Weight:          payload.packageInfo.weight,
    }),
    signal: AbortSignal.timeout(10_000), // 10 sn timeout
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
  }

  const data = await response.json();

  if (data.result?.barcode) {
    return { success: true, barcode: String(data.result.barcode) };
  }

  return { success: false, error: data.errorMessage ?? 'Barkod alınamadı' };
}

/**
 * MNG Kargo API çağrısı.
 */
async function callMNGApi(payload: CargoShipmentPayload): Promise<CarrierApiResult> {
  const apiUrl = process.env.MNG_API_URL;
  const apiKey = process.env.MNG_API_KEY;

  if (!apiUrl || !apiKey) {
    return { success: false, error: 'MNG API credentials eksik' };
  }

  const response = await fetch(`${apiUrl}/shipment/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      referenceNo:   payload.referenceNo,
      receiverName:  payload.recipientInfo.name,
      receiverPhone: payload.recipientInfo.phone,
      receiverCity:  payload.recipientInfo.city,
      address:       payload.recipientInfo.address,
      weight:        payload.packageInfo.weight,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  return data.barcode
    ? { success: true, barcode: String(data.barcode) }
    : { success: false, error: data.message ?? 'Barkod alınamadı' };
}

/** Carrier kodu → API çağrısı yönlendirici */
async function callCarrierApi(payload: CargoShipmentPayload): Promise<CarrierApiResult> {
  switch (payload.carrierCode) {
    case 'yurtici': return callYurticiApi(payload);
    case 'mng':     return callMNGApi(payload);
    default:        return { success: false, error: `Desteklenmeyen kargo: ${payload.carrierCode}` };
  }
}

// ============================================================
// OUTBOX SERVİSİ
// ============================================================

function getAdminSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Sipariş READY_TO_SHIP olduğunda çağrılır.
 * Kargo API isteğini outbox kuyruğuna ekler.
 */
export async function enqueueCargoShipment(payload: CargoShipmentPayload): Promise<void> {
  const supabase = getAdminSupabase();

  const { error } = await supabase
    .from('cargo_outbox')
    .insert({
      order_id: payload.orderId,
      payload,
      status:         'PENDING',
      retry_count:    0,
      next_retry_at:  new Date().toISOString(),
    });

  if (error) {
    console.error('[CargoOutbox] Enqueue hatası:', error);
    throw new Error(`Kargo kuyruğuna eklenemedi: ${error.message}`);
  }

  console.info('[CargoOutbox] Kargo isteği kuyruğa eklendi', { orderId: payload.orderId });
}

/**
 * Cron worker'ın çağırdığı işlem fonksiyonu.
 * Bekleyen kargo işlerini atomik olarak claim eder ve kargo API'sine iletir.
 *
 * @param batchSize - Tek seferde işlenecek maksimum iş sayısı
 * @returns İşlenen iş sayıları {success, failed, skipped}
 */
export async function processCargoOutbox(batchSize = 10): Promise<{
  success: number;
  failed: number;
  skipped: number;
}> {
  const supabase = getAdminSupabase();
  const stats = { success: 0, failed: 0, skipped: 0 };

  // Atomik claim: PENDING → PROCESSING (PostgreSQL fonksiyonu)
  const { data: jobs, error: claimError } = await supabase
    .rpc('claim_pending_cargo_jobs', { p_limit: batchSize });

  if (claimError) {
    console.error('[CargoOutbox] Claim hatası:', claimError);
    return stats;
  }

  if (!jobs || jobs.length === 0) return stats;

  console.info(`[CargoOutbox] ${jobs.length} iş işleniyor`);

  // Her iş için paralel işlem (Promise.allSettled — birinin hatası diğerini etkilemez)
  const results = await Promise.allSettled(
    (jobs as CargoOutboxJob[]).map((job) => processSingleJob(supabase, job))
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      if (result.value === 'success') stats.success++;
      else                            stats.failed++;
    } else {
      console.error(`[CargoOutbox] Job ${jobs[i].id} beklenmedik hata:`, result.reason);
      stats.skipped++;
    }
  });

  console.info('[CargoOutbox] Batch tamamlandı', stats);
  return stats;
}

async function processSingleJob(
  supabase: SupabaseClient,
  job: CargoOutboxJob
): Promise<'success' | 'failed'> {
  try {
    const result = await callCarrierApi(job.payload);

    if (result.success && result.barcode) {
      // ── Başarı: COMPLETED olarak işaretle + barkodu orders'a yaz ─────────
      await Promise.all([
        supabase
          .from('cargo_outbox')
          .update({
            status:       'COMPLETED',
            barcode:      result.barcode,
            completed_at: new Date().toISOString(),
            updated_at:   new Date().toISOString(),
          })
          .eq('id', job.id),

        supabase
          .from('orders')
          .update({
            tracking_number: result.barcode,
            cargo_company:   job.payload.carrierCode,
          })
          .eq('id', job.order_id),
      ]);

      console.info('[CargoOutbox] Barkod alındı', {
        orderId: job.order_id,
        barcode: result.barcode,
      });

      return 'success';
    }

    // ── Başarısız: retry veya FAILED ─────────────────────────────────────
    const newRetryCount = job.retry_count + 1;
    const isMaxRetry    = newRetryCount >= job.max_retries;

    await supabase
      .from('cargo_outbox')
      .update({
        status:        isMaxRetry ? 'FAILED' : 'PENDING',
        retry_count:   newRetryCount,
        next_retry_at: isMaxRetry
          ? null
          : calculateNextRetryAt(newRetryCount).toISOString(),
        last_error:  result.error ?? 'Bilinmeyen hata',
        updated_at:  new Date().toISOString(),
      })
      .eq('id', job.id);

    if (isMaxRetry) {
      // Admin bildirimi — prodüksiyonda Slack/email gönderin
      console.error('[CargoOutbox] MAX RETRY AŞILDI — manuel müdahale gerekli', {
        jobId:   job.id,
        orderId: job.order_id,
        error:   result.error,
      });
    } else {
      console.warn('[CargoOutbox] Yeniden denenecek', {
        jobId:      job.id,
        orderId:    job.order_id,
        retryCount: newRetryCount,
        nextRetry:  calculateNextRetryAt(newRetryCount).toISOString(),
        error:      result.error,
      });
    }

    return 'failed';
  } catch (err) {
    // İşlem sırasında unexpected exception: PENDING'e geri al (lock'ı serbest bırak)
    await supabase
      .from('cargo_outbox')
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
