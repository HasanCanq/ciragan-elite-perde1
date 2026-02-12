// =====================================================
// IYZICO 3D SECURE CALLBACK HANDLER
// Banka 3DS doğrulaması sonrası POST callback
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { threedsPayment } from '@/lib/iyzico';
import { logPaymentEvent } from '@/lib/payment-logger';

// Supabase admin client (cookie context yok - banka redirect'i)
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const supabase = getAdminSupabase();

  try {
    // ==========================================
    // 1. BANKA REDIRECT VERİLERİNİ AL
    // ==========================================
    const body = await request.formData();
    const status = body.get('status') as string;
    const paymentId = body.get('paymentId') as string;
    const conversationData = body.get('conversationData') as string | null;
    const conversationId = body.get('conversationId') as string; // = order.id
    const mdStatus = body.get('mdStatus') as string;

    console.log('[Payment Callback]', {
      status,
      paymentId,
      conversationId,
      mdStatus,
    });

    // LOG: Callback alındı
    logPaymentEvent(supabase, {
      order_id: conversationId || undefined,
      event_type: 'CALLBACK_RECEIVED',
      payment_id: paymentId,
      conversation_id: conversationId,
      md_status: mdStatus,
      raw_response: { status, paymentId, conversationId, mdStatus },
    });

    // ==========================================
    // 2. SİPARİŞİ BUL
    // ==========================================
    if (!conversationId) {
      console.error('[Payment Callback] conversationId eksik');
      return NextResponse.redirect(
        `${siteUrl}/odeme/basarisiz?reason=unknown`
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', conversationId)
      .single();

    if (orderError || !order) {
      console.error('[Payment Callback] Sipariş bulunamadı:', conversationId);
      return NextResponse.redirect(
        `${siteUrl}/odeme/basarisiz?reason=unknown`
      );
    }

    // ==========================================
    // 3. IDEMPOTENCY - Zaten ödendi mi?
    // ==========================================
    if (order.status === 'PAID') {
      return NextResponse.redirect(
        `${siteUrl}/odeme/basarili?order=${order.order_number}`
      );
    }

    // ==========================================
    // 4. 3DS DOĞRULAMA KONTROLÜ
    // ==========================================
    if (mdStatus !== '1') {
      console.error('[Payment Callback] 3DS başarısız, mdStatus:', mdStatus);

      // LOG: 3DS doğrulama başarısız
      logPaymentEvent(supabase, {
        order_id: order.id,
        user_id: order.user_id,
        event_type: 'THREEDS_AUTH_FAILED',
        payment_id: paymentId,
        conversation_id: conversationId,
        md_status: mdStatus,
        error_message: `3D Secure doğrulama başarısız (mdStatus: ${mdStatus})`,
        expected_amount: order.total_amount,
      });

      await restoreStockAndCancel(supabase, order, '3D Secure doğrulama başarısız');
      return NextResponse.redirect(
        `${siteUrl}/odeme/basarisiz?order=${order.order_number}&reason=3ds_failed`
      );
    }

    // ==========================================
    // 5. ÖDEME ONAYLAMA (Auth)
    // ==========================================
    const authResult = await threedsPayment({
      locale: 'tr',
      conversationId: order.id,
      paymentId,
      conversationData: conversationData || undefined,
    });

    if (authResult.status !== 'success') {
      console.error('[Payment Callback] Auth başarısız:', authResult.errorMessage);

      // LOG: Auth başarısız
      logPaymentEvent(supabase, {
        order_id: order.id,
        user_id: order.user_id,
        event_type: 'THREEDS_AUTH_FAILED',
        payment_id: paymentId,
        conversation_id: conversationId,
        md_status: mdStatus,
        error_code: authResult.errorCode,
        error_message: authResult.errorMessage,
        expected_amount: order.total_amount,
        raw_response: authResult as unknown as Record<string, unknown>,
      });

      await restoreStockAndCancel(supabase, order, `Ödeme auth başarısız: ${authResult.errorMessage}`);
      return NextResponse.redirect(
        `${siteUrl}/odeme/basarisiz?order=${order.order_number}&reason=payment_failed`
      );
    }

    // ==========================================
    // 6. TUTAR DOĞRULAMA (GÜVENLİK)
    // ==========================================
    const expectedAmount = order.total_amount;
    const paidAmount = authResult.paidPrice;

    if (Math.abs(expectedAmount - paidAmount) > 0.01) {
      console.error('[Payment Callback] TUTAR UYUŞMAZLIĞI:', {
        expected: expectedAmount,
        paid: paidAmount,
      });

      // LOG: Tutar uyuşmazlığı (güvenlik olayı)
      logPaymentEvent(supabase, {
        order_id: order.id,
        user_id: order.user_id,
        event_type: 'AMOUNT_MISMATCH',
        payment_id: paymentId,
        conversation_id: conversationId,
        expected_amount: expectedAmount,
        paid_amount: paidAmount,
        error_message: `Beklenen: ${expectedAmount} TL, Ödenen: ${paidAmount} TL`,
        auth_code: authResult.authCode,
        raw_response: authResult as unknown as Record<string, unknown>,
      });

      await restoreStockAndCancel(supabase, order, `Tutar uyuşmazlığı: beklenen ${expectedAmount}, ödenen ${paidAmount}`);
      return NextResponse.redirect(
        `${siteUrl}/odeme/basarisiz?order=${order.order_number}&reason=amount_mismatch`
      );
    }

    // ==========================================
    // 7. BAŞARILI - SİPARİŞİ GÜNCELLE
    // ==========================================
    await supabase
      .from('orders')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        payment_reference: paymentId,
      })
      .eq('id', order.id)
      .eq('status', 'PENDING');

    // ==========================================
    // 8. SEPETİ TEMİZLE
    // ==========================================
    if (order.user_id) {
      await supabase.rpc('clear_user_cart', { p_user_id: order.user_id });
    }

    console.log('[Payment Callback] Ödeme başarılı:', order.order_number);

    // LOG: Ödeme başarılı
    logPaymentEvent(supabase, {
      order_id: order.id,
      user_id: order.user_id,
      event_type: 'PAYMENT_SUCCESS',
      payment_id: paymentId,
      conversation_id: conversationId,
      md_status: mdStatus,
      auth_code: authResult.authCode,
      expected_amount: expectedAmount,
      paid_amount: paidAmount,
    });

    // ==========================================
    // 9. BAŞARILI SAYFASINA YÖNLENDİR
    // ==========================================
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarili?order=${order.order_number}&method=credit_card`
    );
  } catch (error) {
    console.error('[Payment Callback] Beklenmedik hata:', error);

    // LOG: Beklenmedik hata
    try {
      logPaymentEvent(supabase, {
        event_type: 'PAYMENT_FAILED',
        error_message: error instanceof Error ? error.message : 'Beklenmedik callback hatası',
      });
    } catch { /* logger hatası yutulur */ }

    return NextResponse.redirect(
      `${siteUrl}/odeme/basarisiz?reason=unknown`
    );
  }
}

// =====================================================
// YARDIMCI: Stok geri yükle + sipariş iptal
// =====================================================
async function restoreStockAndCancel(
  supabase: ReturnType<typeof createClient>,
  order: any,
  reason: string
) {
  // Stokları geri yükle
  for (const item of order.order_items || []) {
    if (item.product_id) {
      await supabase.rpc('restore_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
    }
  }

  // Siparişi iptal et (sadece PENDING ise)
  await supabase
    .from('orders')
    .update({
      status: 'CANCELLED',
      admin_note: reason,
    })
    .eq('id', order.id)
    .eq('status', 'PENDING');
}
