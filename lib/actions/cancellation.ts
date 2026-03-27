'use server';

/**
 * Sipariş İptal Politikası
 *
 * Hukuki + operasyonel koruma:
 * - Müşteri kendi siparişini iptal edebilir (sadece belirli durumlarda)
 * - Üretim başlamışsa iptal kod seviyesinde reddedilir
 * - İptal onaylandığında iade akışı başlatılır
 * - Her adım order_status_history'ye loglanır
 */

import { createClient } from '@/lib/supabase/server';
import { ApiResponse, OrderStatus, CANCEL_REASON_CATEGORIES, CancelReasonCategory } from '@/types';

// ============================================================
// İPTAL POLİTİKASI KURALLARI
// ============================================================

/**
 * Müşterinin iptal talebini kabul ettiğimiz durumlar.
 * Bu durumlar: ödeme henüz işlemlenmemiş veya sipariş sadece onaylanmış.
 * Otomatik iade akışı başlatılabilir.
 */
const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
  'PENDING',    // Ödeme bekleniyor
  'PAID',       // Ödeme alındı ama üretim başlamadı
  'CONFIRMED',  // Admin onayladı ama üretime alınmadı
];

/**
 * Üretim sürecine girmiş durumlar — müşteri iptali REDDEDILIR.
 * Kumaş kesilmiş, mekanizma sipariş edilmiş olabilir.
 */
const NON_CANCELLABLE_STATUSES: OrderStatus[] = [
  'IN_PRODUCTION',
  'PROCESSING',    // legacy
  'ON_HOLD',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
];

// ============================================================
// TYPES
// ============================================================

export interface CancellationResult {
  success: boolean;
  cancelled: boolean;     // true → iptal işlemi gerçekleşti
  refundInitiated: boolean;
  message: string;        // Müşteriye gösterilecek mesaj
  error?: string;
}

// ============================================================
// HELPER: İptal hata mesajı üret
// ============================================================

function getCancellationRejectionMessage(status: OrderStatus): string {
  switch (status) {
    case 'IN_PRODUCTION':
    case 'PROCESSING':
      return 'Siparişiniz üretim aşamasına alındığı için iptal edilemez. Siparişiniz tamamlandıktan sonra iade talebinde bulunabilirsiniz.';
    case 'ON_HOLD':
      return 'Siparişiniz üretim sürecinde askıya alınmış durumda olduğu için iptal edilemez.';
    case 'READY_TO_SHIP':
      return 'Siparişiniz kargoya hazır durumda olduğu için iptal edilemez.';
    case 'SHIPPED':
    case 'IN_TRANSIT':
      return 'Siparişiniz kargoya verildiği için iptal edilemez. Teslim aldıktan sonra iade talebinde bulunabilirsiniz.';
    case 'DELIVERED':
      return 'Teslim edilmiş siparişler iptal edilemez. İade talebi oluşturabilirsiniz.';
    case 'CANCELLED':
      return 'Bu sipariş zaten iptal edilmiş.';
    case 'REFUNDED':
      return 'Bu sipariş zaten iade edilmiş.';
    default:
      return 'Bu sipariş şu an iptal edilemez.';
  }
}

// ============================================================
// ANA SERVER ACTION
// ============================================================

/**
 * Müşteri sipariş iptali.
 *
 * Akış:
 * 1. Kullanıcı kimlik doğrulama
 * 2. Siparişin kullanıcıya ait olduğunu doğrula
 * 3. State machine + politika kontrolü
 * 4. Uygunsa CANCELLED durumuna geçir + iade akışını başlat
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<CancellationResult> {
  try {
    const supabase = await createClient();

    // ── 1. Kullanıcı doğrulama ───────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        cancelled: false,
        refundInitiated: false,
        message: 'Lütfen giriş yapın.',
        error: 'Unauthorized',
      };
    }

    // ── 2. Siparişi al + sahiplik kontrolü ──────────────────────────────
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, user_id, total_amount, payment_intent_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return {
        success: false,
        cancelled: false,
        refundInitiated: false,
        message: 'Sipariş bulunamadı.',
        error: 'Not found',
      };
    }

    if (order.user_id !== user.id) {
      return {
        success: false,
        cancelled: false,
        refundInitiated: false,
        message: 'Bu siparişe erişim yetkiniz yok.',
        error: 'Forbidden',
      };
    }

    const currentStatus = order.status as OrderStatus;

    // ── 3a. Zaten terminal durumda mı? ──────────────────────────────────
    if (currentStatus === 'CANCELLED') {
      return {
        success: true,
        cancelled: false,
        refundInitiated: false,
        message: 'Bu sipariş zaten iptal edilmiş.',
      };
    }

    // ── 3b. Üretim sürecindeyse → REDDET ────────────────────────────────
    if (NON_CANCELLABLE_STATUSES.includes(currentStatus)) {
      return {
        success: false,
        cancelled: false,
        refundInitiated: false,
        message: getCancellationRejectionMessage(currentStatus),
        error: `NON_CANCELLABLE_STATUS:${currentStatus}`,
      };
    }

    // ── 3c. Teslimat sonrası → REDDET (iade akışına yönlendir) ──────────
    if (currentStatus === 'DELIVERED' || currentStatus === 'RETURN_REQUESTED') {
      return {
        success: false,
        cancelled: false,
        refundInitiated: false,
        message: getCancellationRejectionMessage(currentStatus),
        error: `USE_RETURN_FLOW:${currentStatus}`,
      };
    }

    // ── 3d. İptal edilebilir durum kontrolü ─────────────────────────────
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(currentStatus)) {
      return {
        success: false,
        cancelled: false,
        refundInitiated: false,
        message: 'Bu sipariş şu an iptal edilemez. Lütfen müşteri hizmetleriyle iletişime geçin.',
        error: `INVALID_STATUS:${currentStatus}`,
      };
    }

    // ── 4. Atomik güncelleme: CANCELLED + history log ───────────────────
    const cancellationReason = reason ?? 'Müşteri talebiyle iptal edildi';

    const { error: rpcError } = await supabase.rpc('update_order_status_with_history', {
      p_order_id:           orderId,
      p_new_status:         'CANCELLED',
      p_changed_by_user_id: user.id,
      p_changed_by_role:    'customer',
      p_reason:             cancellationReason,
    });

    if (rpcError) throw rpcError;

    // ── 5. Ödeme iadesi başlat ───────────────────────────────────────────
    let refundInitiated = false;

    if (currentStatus === 'PAID' || currentStatus === 'CONFIRMED') {
      refundInitiated = await initiateRefund(orderId, order.payment_intent_id, supabase);
    }

    // ── 6. Müşteri bildirimi (fire-and-forget) ───────────────────────────
    void import('@/lib/notifications/sender').then(({ dispatchOrderStatusNotification }) =>
      dispatchOrderStatusNotification(orderId, 'CANCELLED')
    );

    return {
      success: true,
      cancelled: true,
      refundInitiated,
      message: refundInitiated
        ? 'Siparişiniz iptal edildi. Ödemeniz en geç 5-7 iş günü içinde iadesini alacaktır.'
        : 'Siparişiniz başarıyla iptal edildi.',
    };
  } catch (error) {
    console.error('cancelOrder error:', error);
    return {
      success: false,
      cancelled: false,
      refundInitiated: false,
      message: 'İptal işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// İADE BAŞLATMA (Iyzico)
// ============================================================

/**
 * Iyzico üzerinden iade işlemini başlatır.
 * Başarısız olsa dahi sipariş CANCELLED olarak kalır —
 * iade admin panelinden manuel olarak tetiklenebilir.
 */
async function initiateRefund(
  orderId: string,
  paymentId: string | null | undefined,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  if (!paymentId) {
    console.warn('[Cancellation] payment_intent_id yok, iade atlandı', { orderId });
    return false;
  }

  try {
    // Iyzico cancel/refund API çağrısı
    // Gerçek implementasyonda lib/iyzico.ts'deki getIyzipay() kullanılır
    const iyzicoUrl    = process.env.IYZICO_BASE_URL ?? 'https://sandbox-api.iyzipay.com';
    const apiKey       = process.env.IYZICO_API_KEY ?? '';
    const secretKey    = process.env.IYZICO_SECRET_KEY ?? '';

    if (!apiKey || !secretKey) {
      console.warn('[Cancellation] Iyzico credentials eksik, iade atlandı');
      return false;
    }

    // Iyzico Cancel API — ödeme iptal (henüz kesilmemişse)
    // Gerçekte Iyzipay SDK kullanılır; burada fetch ile gösteriyoruz
    const cancelResponse = await fetch(`${iyzicoUrl}/payment/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale:         'tr',
        conversationId: orderId,
        paymentId,
        ip:             '127.0.0.1',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const result = await cancelResponse.json();

    if (result.status === 'success') {
      // İade kaydını order_status_history'e yaz
      await supabase.rpc('update_order_status_with_history', {
        p_order_id:           orderId,
        p_new_status:         'REFUNDED',
        p_changed_by_user_id: null,
        p_changed_by_role:    'system',
        p_reason:             `Iyzico iade onaylandı. PaymentId: ${paymentId}`,
      });
      return true;
    }

    console.error('[Cancellation] Iyzico iade başarısız', { result, orderId });
    return false;
  } catch (err) {
    // İade hatası siparişi bloke etmemeli — logla ve devam et
    console.error('[Cancellation] İade hatası (non-blocking):', err);
    return false;
  }
}

// ============================================================
// ADMIN: Force Cancel (State Machine'i atlayarak)
// ============================================================

/**
 * Admin'in herhangi bir durumdan CANCELLED'a zorla geçirebileceği fonksiyon.
 * Operasyonel acil durumlarda kullanılır (ör: müşteri anlaşmazlığı).
 */
export async function adminForceCancelOrder(
  orderId: string,
  reasonCategory: CancelReasonCategory,
  reasonNote?: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Yetkisiz erişim');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      throw new Error('Yetkisiz erişim');
    }

    // Admin CANCELLED'a her durumdan geçirebilir (State Machine bypass)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;

    const fullReason = reasonNote?.trim()
      ? `[FORCE] Kategori: ${reasonCategory} — ${reasonNote.trim()}`
      : `[FORCE] Kategori: ${reasonCategory}`;

    // History log
    await supabase.rpc('update_order_status_with_history', {
      p_order_id:           orderId,
      p_new_status:         'CANCELLED',
      p_changed_by_user_id: user.id,
      p_changed_by_role:    'admin',
      p_reason:             fullReason,
    });

    return { data: null, error: null, success: true };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Zorunlu iptal başarısız',
      success: false,
    };
  }
}
