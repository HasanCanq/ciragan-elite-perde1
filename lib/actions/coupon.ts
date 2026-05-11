'use server';

// ============================================================
// COUPON SERVER ACTIONS
// UI → Server Action köprüsü.
// Tüm kullanıcı girdisi burada sanitize edilir.
// ============================================================

import { headers }            from 'next/headers';
import { createClient }       from '@/lib/supabase/server';
import { validateCoupon }     from '@/lib/promotions/coupon-service';
import type { ApiResponse }   from '@/types';
import type { CouponValidationResult } from '@/lib/promotions/types';

// Kupon kodu için güvenli normalizasyon:
//   - Baştaki/sondaki boşluklar kırpılır
//   - Büyük harfe çevrilir
//   - Yalnızca alfanümerik + tire + alt çizgi kabul edilir
function normalizeCouponCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
  if (code.length < 3 || code.length > 50) return null;
  return code;
}

/**
 * Sepet sayfasında "Kuponu Uygula" butonuna basıldığında çağrılır.
 * DB WRITE YOK — yalnızca önizleme/doğrulama.
 * Gerçek indirim uygulama checkout sırasında atomic RPC ile yapılır.
 *
 * @param rawCode  Kullanıcının girdiği ham kupon kodu
 * @param subtotal Server-side hesaplanmış sepet ara toplamı (TRY)
 */
export async function applyCouponAction(
  rawCode:  string,
  subtotal: number,
): Promise<ApiResponse<CouponValidationResult>> {
  try {
    // ── 1. Girdi doğrulama ─────────────────────────────────
    if (!rawCode || typeof rawCode !== 'string') {
      return { data: null, error: 'Geçersiz kupon kodu', success: false };
    }

    const code = normalizeCouponCode(rawCode);
    if (!code) {
      return { data: null, error: 'Kupon kodu 3-50 karakter, yalnızca harf/rakam/tire içerebilir', success: false };
    }

    if (typeof subtotal !== 'number' || subtotal <= 0 || !isFinite(subtotal)) {
      return { data: null, error: 'Geçersiz sepet tutarı', success: false };
    }

    // ── 2. Oturum kontrolü ────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Kupon uygulamak için giriş yapmalısınız', success: false };
    }

    // ── 3. Request metadata ───────────────────────────────
    const reqHeaders = await headers();
    const ipAddress  = (
      reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      reqHeaders.get('x-real-ip') ??
      '127.0.0.1'
    );

    // ── 4. Kullanıcı profilini çek (segment + sipariş geçmişi) ──
    const [profileResult, orderCountResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('segment')
        .eq('id', user.id)
        .single(),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'CANCELLED'),
    ]);

    const userSegment  = (profileResult.data as any)?.segment ?? null;
    const isFirstOrder = (orderCountResult.count ?? 0) === 0;

    // ── 5. Kupon doğrulama ────────────────────────────────
    const result = await validateCoupon({
      code,
      subtotal,
      userId:      user.id,
      userSegment,
      ipAddress,
      isFirstOrder,
    });

    return { data: result, error: null, success: true };

  } catch (error) {
    console.error('[applyCouponAction] Beklenmedik hata:', error);
    return { data: null, error: 'Kupon doğrulanamadı', success: false };
  }
}

/**
 * Admin paneli: Kupon geçerliliğini kullanıcı bağımsız kontrol et.
 * Sadece adminler çağırabilir.
 */
export async function adminValidateCouponAction(
  rawCode: string,
): Promise<ApiResponse<{ exists: boolean; active: boolean; usageCount: number; usageLimit: number | null }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Yetkisiz', success: false };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as any)?.role !== 'ADMIN') {
      return { data: null, error: 'Yetkisiz', success: false };
    }

    const code = normalizeCouponCode(rawCode);
    if (!code) return { data: null, error: 'Geçersiz kupon kodu', success: false };

    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, is_active, usage_count, usage_limit')
      .ilike('code', code)
      .single();

    if (!coupon) {
      return { data: { exists: false, active: false, usageCount: 0, usageLimit: null }, error: null, success: true };
    }

    return {
      data: {
        exists:     true,
        active:     coupon.is_active,
        usageCount: coupon.usage_count,
        usageLimit: coupon.usage_limit,
      },
      error:   null,
      success: true,
    };
  } catch (error) {
    console.error('[adminValidateCouponAction] error:', error);
    return { data: null, error: 'İşlem başarısız', success: false };
  }
}
