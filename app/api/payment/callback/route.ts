// =====================================================
// IYZICO CHECKOUT FORM CALLBACK — ZERO-TRUST
//
// Güvenlik modeli:
//   POST body'den SADECE `token` ve `conversationId` alınır.
//   Ödeme bilgileri (tutar, paymentId, durum) asla POST body'den okunmaz.
//   Tek gerçek kaynak: Iyzico sunucusuna yapılan checkoutFormRetrieve çağrısı.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkoutFormRetrieve } from '@/lib/iyzico';
import { logPaymentEvent } from '@/lib/payment-logger';
import { sendGA4PurchaseEvent, parseGaClientId } from '@/lib/analytics/ga4-server';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const supabase = getAdminSupabase();

  // ==========================================
  // 1. POST BODY'DEN SADECE TOKEN AL
  //    Diğer alanlara (status, paymentId, mdStatus) güvenme —
  //    bunlar bankadan/client'tan gelir ve manipüle edilebilir.
  // ==========================================
  let token: string | null = null;
  let rawConversationId: string | null = null; // retrieve imzası için gerekli, güvenilir değil

  try {
    const body = await request.formData();
    token = body.get('token') as string | null;
    rawConversationId = body.get('conversationId') as string | null;
  } catch {
    console.error('[Callback] FormData parse hatası — olası kötü istek');
    return new Response('Bad Request', { status: 400 });
  }

  if (!token) {
    console.warn('[Callback] FRAUD ALARM: token alanı eksik POST isteği');
    logPaymentEvent(supabase, {
      event_type: 'FRAUD_ATTEMPT',
      error_message: 'Callback POST isteğinde token alanı eksik',
      raw_response: { rawConversationId },
    });
    return new Response('Bad Request', { status: 400 });
  }

  // ==========================================
  // 2. ZERO-TRUST DOĞRULAMA: İYZİCO SUNUCUSUNA SOR
  //    Token Iyzico'nun API secret'ı ile imzalıdır — taklit edilemez.
  //    Ödeme tutarı, durumu ve sipariş ID'si yalnızca bu yanıttan okunur.
  // ==========================================
  let retrieveResult;

  try {
    retrieveResult = await checkoutFormRetrieve({
      locale: 'tr',
      // rawConversationId imza hesabı için Iyzico'ya gönderilir;
      // güvenilir veri olarak KULLANILMAZ — aşağıda retrieveResult.conversationId kullanılır.
      conversationId: rawConversationId ?? '',
      token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
    console.error('[Callback] Iyzico retrieve ağ hatası:', msg);
    logPaymentEvent(supabase, {
      event_type: 'PAYMENT_FAILED',
      error_message: `checkoutFormRetrieve ağ hatası: ${msg}`,
    });
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarisiz?reason=verification_failed`
    );
  }

  // LOG: Iyzico'dan gelen yanıt — ham kayıt
  logPaymentEvent(supabase, {
    event_type: 'CALLBACK_RECEIVED',
    payment_id: retrieveResult.paymentId,
    conversation_id: retrieveResult.conversationId,
    raw_response: retrieveResult as unknown as Record<string, unknown>,
  });

  // ==========================================
  // 3. SİPARİŞİ BUL — Iyzico'nun conversationId'si ile
  //    POST body'deki rawConversationId artık kullanılmıyor.
  // ==========================================
  const orderId = retrieveResult.conversationId;

  if (!orderId) {
    console.error('[Callback] Retrieve yanıtında conversationId yok — token geçersiz?');
    return NextResponse.redirect(`${siteUrl}/odeme/basarisiz?reason=unknown`);
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('[Callback] Sipariş bulunamadı:', orderId);
    return NextResponse.redirect(`${siteUrl}/odeme/basarisiz?reason=unknown`);
  }

  // ==========================================
  // 4. IDEMPOTENCY — Sipariş zaten ödendi mi?
  //    Iyzico retry'larında veya çift tıklamada mükerrer işlem önler.
  // ==========================================
  if (order.status === 'PAID') {
    console.log('[Callback] Idempotent hit — sipariş zaten PAID:', order.order_number);
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarili?order=${order.order_number}`
    );
  }

  // ==========================================
  // 5. IYZICO API YANIT DURUMU
  //    status !== 'success' → Iyzico API seviyesinde hata (config, token süresi vb.)
  // ==========================================
  if (retrieveResult.status !== 'success') {
    console.error('[Callback] Iyzico retrieve başarısız:', {
      errorCode: retrieveResult.errorCode,
      errorMessage: retrieveResult.errorMessage,
      orderId,
    });

    logPaymentEvent(supabase, {
      order_id: order.id,
      user_id: order.user_id,
      event_type: 'PAYMENT_FAILED',
      payment_id: retrieveResult.paymentId,
      conversation_id: orderId,
      error_code: retrieveResult.errorCode,
      error_message: retrieveResult.errorMessage,
      raw_response: retrieveResult as unknown as Record<string, unknown>,
    });

    await restoreStockAndCancel(
      supabase,
      order,
      `Iyzico retrieve başarısız: ${retrieveResult.errorMessage}`
    );
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarisiz?order=${order.order_number}&reason=payment_failed`
    );
  }

  // ==========================================
  // 6. FRAUD STATUS — Ödeme kartı onayladı mı?
  //    fraudStatus: 1 = Onaylandı  |  -1 = Reddedildi / Fraud
  //    Bu alan Iyzico'nun risk motorundan gelir — POST body'den değil.
  // ==========================================
  if (retrieveResult.fraudStatus !== 1) {
    console.warn('[Callback] FRAUD/RED:', {
      fraudStatus: retrieveResult.fraudStatus,
      orderId,
      paymentId: retrieveResult.paymentId,
    });

    logPaymentEvent(supabase, {
      order_id: order.id,
      user_id: order.user_id,
      event_type: 'FRAUD_ATTEMPT',
      payment_id: retrieveResult.paymentId,
      conversation_id: orderId,
      error_message: `Ödeme reddedildi — fraudStatus: ${retrieveResult.fraudStatus}`,
      raw_response: retrieveResult as unknown as Record<string, unknown>,
    });

    await restoreStockAndCancel(
      supabase,
      order,
      `Ödeme reddedildi (fraudStatus: ${retrieveResult.fraudStatus})`
    );
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarisiz?order=${order.order_number}&reason=payment_declined`
    );
  }

  // ==========================================
  // 7. TUTAR DOĞRULAMA — KRİTİK GÜVENLİK ADIMı
  //    retrieveResult.paidPrice Iyzico sunucusundan geliyor → güvenilir.
  //    Fiyat manipülasyon saldırılarını önler (örn: 1 TL gönderip onay almak).
  // ==========================================
  const expectedAmount = order.total_amount;
  const paidAmount = retrieveResult.paidPrice;

  if (Math.abs(expectedAmount - paidAmount) > 0.01) {
    console.error('[Callback] TUTAR UYUŞMAZLIĞI — FRAUD ALARMI:', {
      expected: expectedAmount,
      paid: paidAmount,
      orderId,
      paymentId: retrieveResult.paymentId,
    });

    logPaymentEvent(supabase, {
      order_id: order.id,
      user_id: order.user_id,
      event_type: 'AMOUNT_MISMATCH',
      payment_id: retrieveResult.paymentId,
      conversation_id: orderId,
      expected_amount: expectedAmount,
      paid_amount: paidAmount,
      error_message: `FRAUD: Beklenen ${expectedAmount} TL, ödenen ${paidAmount} TL`,
      raw_response: retrieveResult as unknown as Record<string, unknown>,
    });

    await restoreStockAndCancel(
      supabase,
      order,
      `Tutar uyuşmazlığı (FRAUD): beklenen ${expectedAmount} TL, ödenen ${paidAmount} TL`
    );
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarisiz?order=${order.order_number}&reason=amount_mismatch`
    );
  }

  // ==========================================
  // 8. BAŞARILI — SİPARİŞİ GÜNCELLE
  //    .eq('status', 'PENDING') → race condition koruması.
  //    Aynı anda iki callback gelirse sadece biri günceller.
  // ==========================================
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
      payment_reference: retrieveResult.paymentId,
    })
    .eq('id', order.id)
    .eq('status', 'PENDING');

  if (updateError) {
    // Güncelleme başarısız → muhtemelen başka bir istek daha önce PAID yaptı (race)
    console.warn('[Callback] Order update başarısız (race condition?):', updateError.message);
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarili?order=${order.order_number}`
    );
  }

  // ==========================================
  // 9. SEPETİ TEMİZLE
  // ==========================================
  if (order.user_id) {
    await supabase.rpc('clear_user_cart', { p_user_id: order.user_id });
  }

  // LOG: Başarılı ödeme
  logPaymentEvent(supabase, {
    order_id: order.id,
    user_id: order.user_id,
    event_type: 'PAYMENT_SUCCESS',
    payment_id: retrieveResult.paymentId,
    conversation_id: orderId,
    auth_code: retrieveResult.authCode,
    expected_amount: expectedAmount,
    paid_amount: paidAmount,
  });

  // ==========================================
  // 10. GA4 SERVER-SIDE TRACKING (fire-and-forget)
  //     _ga cookie'den clientId parse et; yoksa anonim UUID gönder.
  //     Hata olursa ödeme akışını asla engelleme.
  // ==========================================
  void (async () => {
    try {
      const gaCookie   = request.cookies.get('_ga')?.value;
      const clientId   = parseGaClientId(gaCookie);
      const orderItems = (order.order_items ?? []) as Array<{
        product_id:   string | null;
        product_name: string;
        total_price:  number;
        quantity:     number;
      }>;

      await sendGA4PurchaseEvent(
        {
          orderId:     order.id,
          orderNumber: order.order_number,
          revenue:     paidAmount,
          shipping:    order.shipping_cost ?? 0,
          currency:    'TRY',
          items:       orderItems.map((item) => ({
            item_id:       item.product_id ?? 'unknown',
            item_name:     item.product_name,
            item_category: 'Perde',
            quantity:      item.quantity,
            price:         item.total_price,
          })),
        },
        clientId
      );
    } catch {
      // GA4 hatası ödeme akışını engellemesin
    }
  })();

  console.log('[Callback] Ödeme başarılı:', order.order_number);

  return NextResponse.redirect(
    `${siteUrl}/odeme/basarili?order=${order.order_number}&method=credit_card`
  );
}

// =====================================================
// YARDIMCI: Stok geri yükle + sipariş iptal
// =====================================================
async function restoreStockAndCancel(
  supabase: ReturnType<typeof getAdminSupabase>,
  order: { id: string; order_items?: Array<{ product_id: string; quantity: number }> },
  reason: string
) {
  for (const item of order.order_items ?? []) {
    if (item.product_id) {
      await (supabase as any).rpc('restore_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
    }
  }

  await (supabase as any)
    .from('orders')
    .update({ status: 'CANCELLED', admin_note: reason })
    .eq('id', order.id)
    .eq('status', 'PENDING'); // Sadece hâlâ PENDING ise iptal et
}
