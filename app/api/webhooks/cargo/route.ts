/**
 * Kargo Webhook Endpoint
 * POST /api/webhooks/cargo
 *
 * Desteklenen kargo firmaları: Yurtiçi, MNG, PTT, UPS
 *
 * Güvenlik (Zero-Trust):
 *   Per-carrier HMAC-SHA256 secret: CARGO_WEBHOOK_SECRET_<CARRIER>
 *   Genel fallback: CARGO_WEBHOOK_SECRET
 *   Secret tanımlı değilse istek kesinlikle reddedilir.
 *   Timing-safe imza karşılaştırması (timing attack koruması).
 *   Bearer token desteği (HMAC kullanmayan firmalar için).
 *
 * Carrier tespiti (öncelik sırasına göre):
 *   1. x-cargo-carrier header
 *   2. ?carrier=<carrier> query param
 *   3. Varsayılan: generic
 *
 * Akış:
 *   Carrier tespiti → Secret doğrulama → Raw body imza kontrolü
 *   → JSON parse → Payload normalizasyon → Sipariş sorgulama
 *   → İdempotency kontrolü → State machine doğrulama
 *   → Atomik DB güncelleme (ACID) → Tracking number sync
 *   → Bildirim (fire-and-forget) → E-fatura kuyruğu (fire-and-forget)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import {
  validateHmacSignature,
  validateBearerToken,
  normalizeCargoWebhook,
  type SupportedCarrier,
  type NormalizedCargoWebhook,
} from '@/lib/cargo/webhook';
import { canTransition } from '@/lib/order-state-machine';
import { type OrderStatus } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const ALLOWED_CARRIERS: SupportedCarrier[] = ['yurtici', 'mng', 'ptt', 'ups', 'generic'];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Yardımcılar ───────────────────────────────────────────────────────────────

/** RLS'yi bypass eden service_role istemcisi — kullanıcı oturumu yok */
function adminSupabase() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Kargo firmasına özgü HMAC secret'ı döner.
 * Önce CARGO_WEBHOOK_SECRET_YURTICI gibi spesifik env aranır,
 * bulunamazsa genel CARGO_WEBHOOK_SECRET kullanılır.
 * İkisi de yoksa undefined döner → istek 500 ile reddedilir (Zero-Trust).
 */
function getCarrierSecret(carrier: SupportedCarrier): string | undefined {
  return (
    process.env[`CARGO_WEBHOOK_SECRET_${carrier.toUpperCase()}`] ??
    process.env.CARGO_WEBHOOK_SECRET
  );
}

/**
 * Sipariş arama önceliği:
 *   1. UUID ise → orders.id
 *   2. Değilse → orders.order_number (kısa referans)
 *   3. Fallback → orders.tracking_number (bazı firmalar sadece barkod gönderir)
 */
async function findOrder(
  supabase: ReturnType<typeof adminSupabase>,
  normalized: NormalizedCargoWebhook
): Promise<{ id: string; status: string; tracking_number: string | null } | null> {
  if (normalized.orderId) {
    if (UUID_REGEX.test(normalized.orderId)) {
      const { data } = await supabase
        .from('orders')
        .select('id, status, tracking_number')
        .eq('id', normalized.orderId)
        .maybeSingle();
      if (data) return data;
    } else {
      const { data } = await supabase
        .from('orders')
        .select('id, status, tracking_number')
        .eq('order_number', normalized.orderId)
        .maybeSingle();
      if (data) return data;
    }
  }

  if (normalized.trackingNumber) {
    const { data } = await supabase
      .from('orders')
      .select('id, status, tracking_number')
      .eq('tracking_number', normalized.trackingNumber)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

/** Durum geçmişine yazılacak human-readable reason string'i oluşturur */
function buildReason(normalized: NormalizedCargoWebhook): string {
  const parts = [
    `Kargo firması: ${normalized.carrier}`,
    `Ham statü: ${normalized.rawStatus}`,
    `Barkod: ${normalized.trackingNumber || '-'}`,
  ];
  if (normalized.deliveryDetails?.failureReason) {
    parts.push(`Teslim edilememe sebebi: ${normalized.deliveryDetails.failureReason}`);
  }
  if (normalized.deliveryDetails?.recipientName) {
    parts.push(`Teslim alıcı: ${normalized.deliveryDetails.recipientName}`);
  }
  if (normalized.deliveryDetails?.branchName) {
    parts.push(`Şube: ${normalized.deliveryDetails.branchName}`);
  }
  return parts.join(' | ');
}

// ── Ana Handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {

  // ── 1. Carrier tespiti ────────────────────────────────────────────────────
  const carrierRaw = (
    request.headers.get('x-cargo-carrier') ??
    request.nextUrl.searchParams.get('carrier') ??
    'generic'
  ).toLowerCase() as SupportedCarrier;

  if (!ALLOWED_CARRIERS.includes(carrierRaw)) {
    return NextResponse.json(
      { error: `Desteklenmeyen kargo firması: ${carrierRaw}` },
      { status: 400 }
    );
  }

  // ── 2. Secret varlığını doğrula (Zero-Trust — secret yoksa kesinlikle reddet)
  const secret = getCarrierSecret(carrierRaw);
  if (!secret) {
    console.error(
      `[cargo-webhook] ${carrierRaw} için webhook secret tanımlı değil — ` +
      `CARGO_WEBHOOK_SECRET_${carrierRaw.toUpperCase()} veya CARGO_WEBHOOK_SECRET env eksik`
    );
    return NextResponse.json(
      { error: 'Webhook yapılandırma hatası' },
      { status: 500 }
    );
  }

  // ── 3. Raw body — HMAC doğrulama için JSON parse'dan önce okunmalı ────────
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Request body okunamadı' }, { status: 400 });
  }

  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json({ error: 'Boş request body' }, { status: 400 });
  }

  // ── 4. HMAC veya Bearer token doğrulama ──────────────────────────────────
  // Farklı kargo firmaları farklı header isimleri kullanır
  const signatureHeader =
    request.headers.get('x-signature') ??
    request.headers.get('x-hub-signature-256') ??
    request.headers.get('x-hmac-signature') ??
    request.headers.get('x-webhook-signature') ??
    '';

  const authHeader = request.headers.get('authorization') ??
                     request.headers.get('x-cargo-token');

  const isHmacValid   = signatureHeader.length > 0
    ? validateHmacSignature(rawBody, signatureHeader, secret)
    : false;
  const isBearerValid = !isHmacValid && !!authHeader
    ? validateBearerToken(authHeader, secret)
    : false;

  if (!isHmacValid && !isBearerValid) {
    console.warn('[cargo-webhook] İmza doğrulaması başarısız', {
      carrier:         carrierRaw,
      hasSignature:    signatureHeader.length > 0,
      hasAuth:         !!authHeader,
    });
    return NextResponse.json({ error: 'İmza geçersiz' }, { status: 401 });
  }

  // ── 5. JSON parse ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON payload' }, { status: 400 });
  }

  // ── 6. Payload normalizasyon ──────────────────────────────────────────────
  let normalized: NormalizedCargoWebhook;
  try {
    normalized = normalizeCargoWebhook(carrierRaw, body);
  } catch (err) {
    console.error('[cargo-webhook] Normalizasyon hatası:', err, { carrier: carrierRaw });
    return NextResponse.json({ error: 'Payload normalizasyon hatası' }, { status: 422 });
  }

  // ── 7. Eşleşmeyen statü — logla, 200 dön (kargo retry'ını engelle) ────────
  if (!normalized.mappedStatus) {
    console.info('[cargo-webhook] Tanımlanamayan kargo statüsü — atlandı', {
      carrier:   normalized.carrier,
      rawStatus: normalized.rawStatus,
      orderId:   normalized.orderId,
    });
    return NextResponse.json({
      received:  true,
      action:    'ignored',
      reason:    'unmapped_status',
      rawStatus: normalized.rawStatus,
    });
  }

  if (!normalized.orderId && !normalized.trackingNumber) {
    console.warn('[cargo-webhook] orderId ve trackingNumber her ikisi de eksik', { body });
    return NextResponse.json({ error: 'Sipariş tanımlayıcı eksik' }, { status: 400 });
  }

  // ── 8. Sipariş sorgulama ──────────────────────────────────────────────────
  const supabase = adminSupabase();
  const order    = await findOrder(supabase, normalized);

  if (!order) {
    console.error('[cargo-webhook] Sipariş bulunamadı', {
      orderId:        normalized.orderId,
      trackingNumber: normalized.trackingNumber,
      carrier:        normalized.carrier,
    });
    return NextResponse.json(
      { error: 'Sipariş bulunamadı', ref: normalized.orderId },
      { status: 404 }
    );
  }

  const currentStatus = order.status as OrderStatus;
  const newStatus     = normalized.mappedStatus;

  // ── 9. İdempotency — zaten aynı statüdeyse tekrar işleme ─────────────────
  if (currentStatus === newStatus) {
    return NextResponse.json({ received: true, action: 'no_change', status: newStatus });
  }

  // ── 10. State machine geçiş doğrulaması ───────────────────────────────────
  if (!canTransition(currentStatus, newStatus)) {
    console.warn('[cargo-webhook] Geçersiz durum geçişi — atlandı', {
      orderId:       order.id,
      currentStatus,
      newStatus,
      carrier:       normalized.carrier,
    });
    // 200 dön — geçersiz geçiş kargo firması tarafında bir hata; retry anlamsız
    return NextResponse.json({
      received: true,
      action:   'rejected',
      reason:   `invalid_transition: ${currentStatus} → ${newStatus}`,
    });
  }

  // ── 11. Atomik DB güncellemesi (ACID) ─────────────────────────────────────
  //  update_order_status_with_history:
  //    → orders.status güncelleme + order_status_history INSERT tek transaction'da
  //    → p_changed_by_user_id = null (sistem çağrısı, oturum yok)
  //    → p_changed_by_role = 'system' (migration 008'deki CHECK constraint'e uygun)
  const reason = buildReason(normalized);

  const { error: rpcError } = await supabase.rpc('update_order_status_with_history', {
    p_order_id:           order.id,
    p_new_status:         newStatus,
    p_changed_by_user_id: null,
    p_changed_by_role:    'system',
    p_reason:             reason,
  });

  if (rpcError) {
    console.error('[cargo-webhook] DB güncelleme hatası', {
      orderId: order.id,
      newStatus,
      rpcError,
    });
    return NextResponse.json(
      { error: 'Veritabanı güncelleme başarısız' },
      { status: 500 }
    );
  }

  // ── 12. Tracking number sync ──────────────────────────────────────────────
  // Barkod değişmişse veya ilk kez yazılıyorsa güncelle
  if (
    normalized.trackingNumber &&
    order.tracking_number !== normalized.trackingNumber
  ) {
    const { error: trackingErr } = await supabase
      .from('orders')
      .update({
        tracking_number: normalized.trackingNumber,
        cargo_company:   carrierRaw,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', order.id);

    if (trackingErr) {
      // Non-critical — sipariş güncellendi, sadece barkod yazılamadı
      console.error(
        '[cargo-webhook] Tracking number güncellenemedi (non-critical):',
        trackingErr
      );
    }
  }

  // ── 13. Müşteri bildirimi — fire-and-forget ───────────────────────────────
  void import('@/lib/notifications/sender')
    .then(({ dispatchOrderStatusNotification }) =>
      dispatchOrderStatusNotification(order.id, newStatus)
    )
    .catch((err) =>
      console.error('[cargo-webhook] Bildirim tetiklenemedi (non-blocking):', err)
    );

  // ── 14. E-Fatura kuyruğu — sadece DELIVERED ───────────────────────────────
  if (newStatus === 'DELIVERED') {
    void import('@/lib/einvoice/outbox')
      .then(({ enqueueInvoiceForOrder }) =>
        enqueueInvoiceForOrder(order.id, 'E_ARSIV')
      )
      .catch((err) =>
        console.error('[cargo-webhook] Fatura kuyruğu hatası (non-blocking):', err)
      );
  }

  console.log('[cargo-webhook] Başarılı', {
    orderId:    order.id,
    transition: `${currentStatus} → ${newStatus}`,
    carrier:    normalized.carrier,
    barcode:    normalized.trackingNumber,
    eventTime:  normalized.eventTime,
  });

  return NextResponse.json({
    received:       true,
    action:         'updated',
    previousStatus: currentStatus,
    newStatus,
  });
}
