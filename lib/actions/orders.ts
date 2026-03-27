'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { canTransition } from '@/lib/order-state-machine';
import { ApiResponse, Order, OrderStatus } from '@/types';

// E-fatura tetiklenecek statüler
// DELIVERED: Türk hukuku B2C için standart (e-Arşiv Fatura)
// SHIPPED: Erken fatura isteyenler için opsiyonel
const INVOICE_TRIGGER_STATUSES: OrderStatus[] = ['DELIVERED'];

/**
 * Admin: Sipariş durumunu güncelle
 *
 * - Sadece admin kullanabilir
 * - State machine ile geçiş doğrulaması yapılır
 * - PostgreSQL fonksiyonu aracılığıyla atomik DB transaction:
 *   orders tablosu güncellemesi + order_status_history kaydı tek seferde
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
): Promise<ApiResponse<Order>> {
  try {
    const supabase = await createClient();

    // 1. Admin doğrulama
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

    // 2. Mevcut durumu al
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError || !currentOrder) {
      throw new Error('Sipariş bulunamadı');
    }

    const currentStatus = currentOrder.status as OrderStatus;

    // 3. State machine geçiş doğrulaması
    if (!canTransition(currentStatus, newStatus)) {
      throw new Error(
        `Geçersiz durum geçişi: ${currentStatus} → ${newStatus}. Bu geçiş izin verilmiyor.`
      );
    }

    // 4. Atomik güncelleme: PostgreSQL fonksiyonu (DB transaction içinde çalışır)
    //    Hem orders tablosunu hem order_status_history tablosunu günceller.
    const { data: updatedOrder, error: rpcError } = await supabase
      .rpc('update_order_status_with_history', {
        p_order_id:           orderId,
        p_new_status:         newStatus,
        p_changed_by_user_id: user.id,
        p_changed_by_role:    'admin',
        p_reason:             reason ?? null,
      });

    if (rpcError) throw rpcError;

    // 5. E-Fatura tetikleyici (fire-and-forget — main thread'i bloke etmez)
    //    DELIVERED statüsüne geçince fatura kuyruğuna eklenir.
    if (INVOICE_TRIGGER_STATUSES.includes(newStatus)) {
      void import('@/lib/einvoice/outbox').then(({ enqueueInvoiceForOrder }) =>
        enqueueInvoiceForOrder(orderId, 'E_ARSIV').catch((err) =>
          console.error('[updateOrderStatus] Fatura kuyruğuna eklenemedi (non-blocking):', err)
        )
      );
    }

    // 6. Müşteri bildirimi (fire-and-forget)
    void import('@/lib/notifications/sender').then(({ dispatchOrderStatusNotification }) =>
      dispatchOrderStatusNotification(orderId, newStatus)
    );

    // 7. Cache yenile
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/account/orders/${orderId}`);

    return {
      data: updatedOrder as Order,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sipariş güncellenemedi',
      success: false,
    };
  }
}

// ── setOrderShipping ──────────────────────────────────────────────────────────

const ShippingSchema = z.object({
  cargoCompany:   z.enum(['yurtici', 'mng', 'ptt', 'ups', 'other']),
  trackingNumber: z
    .string()
    .min(3, 'Takip numarası en az 3 karakter olmalıdır')
    .max(100, 'Takip numarası en fazla 100 karakter olabilir')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Takip numarası yalnızca harf, rakam, tire ve alt çizgi içerebilir'),
});

export type ShippingFormData = z.infer<typeof ShippingSchema>;

/**
 * Admin: Kargo bilgisi gir (manuel kargo fallback)
 *
 * Kargo entegrasyonu olmadığı durumlarda admin panelinden
 * takip numarası + firma girilerek sipariş SHIPPED durumuna alınır.
 *
 * - Sipariş READY_TO_SHIP ise → SHIPPED'e otomatik geçiş yapılır
 * - Zaten SHIPPED/IN_TRANSIT ise → sadece takip bilgisi güncellenir
 */
export async function setOrderShipping(
  orderId: string,
  formData: { cargoCompany: string; trackingNumber: string }
): Promise<ApiResponse<null>> {
  try {
    const validated = ShippingSchema.safeParse(formData);
    if (!validated.success) {
      const msg = validated.error.issues[0]?.message ?? 'Geçersiz form verisi';
      return { data: null, error: msg, success: false };
    }

    const supabase = await createClient();

    // Admin doğrulama
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

    // Mevcut durumu al
    const { data: currentOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchErr || !currentOrder) throw new Error('Sipariş bulunamadı');

    const currentStatus = currentOrder.status as OrderStatus;

    // Takip bilgisini güncelle
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        cargo_company:          validated.data.cargoCompany,
        tracking_number:        validated.data.trackingNumber,
        shipping_tracking_code: validated.data.trackingNumber,
        updated_at:             new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateErr) throw updateErr;

    // READY_TO_SHIP → SHIPPED otomatik geçiş
    if (currentStatus === 'READY_TO_SHIP') {
      const { error: rpcErr } = await supabase.rpc('update_order_status_with_history', {
        p_order_id:           orderId,
        p_new_status:         'SHIPPED',
        p_changed_by_user_id: user.id,
        p_changed_by_role:    'admin',
        p_reason:             `Manuel kargo girişi: ${validated.data.cargoCompany} — Takip No: ${validated.data.trackingNumber}`,
      });
      if (rpcErr) throw rpcErr;
    }

    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('setOrderShipping error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Kargo bilgisi kaydedilemedi',
      success: false,
    };
  }
}
