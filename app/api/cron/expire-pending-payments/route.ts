/**
 * Bekleyen Ödeme Süre Aşımı Cron Worker
 * GET /api/cron/expire-pending-payments
 *
 * Vercel Cron Jobs tarafından her 5 dakikada bir çağrılır.
 * Iyzico iframe'inde terk edilen (30 dk+ eski PENDING + credit_card)
 * siparişleri atomik olarak CANCELLED'a çeker ve stoklarını iade eder.
 *
 * Mimari:
 *   - Sipariş ID'leri BATCH_SIZE'lık gruplara bölünür (deadlock önleme)
 *   - Her batch tek bir PostgreSQL transaction'ında çalışır (ACID)
 *   - expire_pending_orders() RPC: FOR UPDATE SKIP LOCKED + per-order savepoint
 *   - Stok iadesi + durum güncellemesi + tarihçe kaydı atomik
 *
 * Güvenlik: CRON_SECRET Bearer token ile korunur.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic';

const EXPIRY_MINUTES = 30;
const BATCH_SIZE     = 50;

interface OrderExpireResult {
  order_id:     string;
  order_number: string;
  success:      boolean;
  error?:       string;
}

export async function GET(request: NextRequest) {
  // ── Cron secret doğrulama ─────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!cronSecret || token !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = Date.now();
  const summary = {
    total:     0,
    cancelled: 0,
    skipped:   0, // eş zamanlı ödeme nedeniyle atlanılan
    errors:    0,
    batches:   0,
  };

  try {
    const supabase = await createClient();

    // ── Süresi dolmuş sipariş ID'lerini bul ──────────────────────────────────
    const cutoffTime = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { data: expiredOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('status', 'PENDING')
      .eq('payment_method', 'credit_card')
      .lt('created_at', cutoffTime);

    if (fetchError) {
      console.error('[expire-pending-payments] Sipariş sorgulama hatası:', fetchError);
      return NextResponse.json({ error: 'Sipariş sorgulanamadı' }, { status: 500 });
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({
        message:  'Süresi dolmuş sipariş bulunamadı',
        duration: Date.now() - startTime,
      });
    }

    summary.total = expiredOrders.length;
    console.log(`[expire-pending-payments] ${summary.total} sipariş işlenecek.`);

    // ── Batch processing ──────────────────────────────────────────────────────
    // 50'şer gruplar → her grup = tek DB transaction (deadlock riski minimize)
    const orderIds = expiredOrders.map((o) => o.id);

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch    = orderIds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      summary.batches++;

      try {
        // expire_pending_orders: atomik PostgreSQL fonksiyonu
        //   - FOR UPDATE SKIP LOCKED (deadlock koruması)
        //   - per-order implicit savepoint (EXCEPTION bloğu)
        //   - stok iadesi + CANCELLED güncelleme + tarihçe tek transaction'da
        const { data: batchResults, error: batchError } = await supabase.rpc(
          'expire_pending_orders',
          { p_order_ids: batch }
        );

        if (batchError) {
          console.error(
            `[expire-pending-payments] Batch #${batchNum} RPC hatası:`,
            batchError
          );
          summary.errors += batch.length;
          continue;
        }

        // RPC jsonb[] → JS dizisi
        const results: OrderExpireResult[] = Array.isArray(batchResults)
          ? batchResults
          : [];

        for (const result of results) {
          if (result.success) {
            summary.cancelled++;
            console.log(
              `[expire-pending-payments] İptal edildi: ${result.order_number}`
            );
          } else if (result.error === 'concurrent_payment_detected') {
            // Eş zamanlı ödeme callback'i bu siparişi PAID yaptı → normal durum
            summary.skipped++;
            console.log(
              `[expire-pending-payments] Eş zamanlı ödeme, atlandı: ${result.order_number}`
            );
          } else {
            summary.errors++;
            console.error(
              `[expire-pending-payments] İşlem başarısız: ${result.order_number}`,
              { error: result.error, order_id: result.order_id }
            );
          }
        }

        // Batch'te hiç sonuç yoksa (tümü SKIP LOCKED ile atlandı) hata değil
        if (results.length === 0 && batch.length > 0) {
          console.log(
            `[expire-pending-payments] Batch #${batchNum}: tüm siparişler kilitliydi, atlandı.`
          );
        }
      } catch (batchErr) {
        console.error(
          `[expire-pending-payments] Batch #${batchNum} beklenmedik hata:`,
          batchErr
        );
        summary.errors += batch.length;
      }
    }

    // ── Sonuç ─────────────────────────────────────────────────────────────────
    const duration = Date.now() - startTime;

    if (summary.errors > 0) {
      console.error(
        `[expire-pending-payments] HATA: ${summary.errors} sipariş işlenemedi — stok tutarsızlığı için Supabase loglarını kontrol edin.`,
        summary
      );
    }

    console.log(
      `[expire-pending-payments] Tamamlandı | ${JSON.stringify({ ...summary, duration: `${duration}ms` })}`
    );

    return NextResponse.json({ success: true, ...summary, duration });
  } catch (err) {
    console.error('[expire-pending-payments] Kritik hata:', err);
    return NextResponse.json(
      { error: 'İşlem başarısız', duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}
