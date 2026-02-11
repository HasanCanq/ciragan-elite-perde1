// =====================================================
// IYZICO 3D SECURE CALLBACK HANDLER
// Banka 3DS doğrulaması sonrası POST callback
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { threedsPayment } from '@/lib/iyzico';

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

    // ==========================================
    // 9. BAŞARILI SAYFASINA YÖNLENDİR
    // ==========================================
    return NextResponse.redirect(
      `${siteUrl}/odeme/basarili?order=${order.order_number}&method=credit_card`
    );
  } catch (error) {
    console.error('[Payment Callback] Beklenmedik hata:', error);
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
