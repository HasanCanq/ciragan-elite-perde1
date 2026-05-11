// ============================================================
// PROMOTION ENGINE — Coupon Service
//
// Katman sorumlulukları:
//   validateCoupon  → DB write YOK; önizleme + UI feedback
//   redeemCoupon    → DB write VAR; atomic RPC (pessimistic lock)
//   releaseCoupon   → DB write VAR; ödeme başarısız rollback
//   confirmCoupon   → DB write VAR; ödeme başarılı finalize
//
// Güvenlik katmanları (derinlemesine savunma):
//   1. Redis sliding window rate limit (IP + userId çift anahtar)
//   2. Redis önbelleği (brute-force yükünü azaltır)
//   3. TypeScript optimistic checks (kullanıcıya hızlı feedback)
//   4. PostgreSQL FOR UPDATE (gerçek race condition koruması)
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { Redis }        from '@upstash/redis';
import { Ratelimit }    from '@upstash/ratelimit';
import type {
  Coupon,
  CouponSegmentRule,
  CouponValidationResult,
  CouponValidationError,
  RedemptionResult,
} from './types';
import {
  calculateDiscountAmount,
  resolveDiscountParams,
  findSegmentRule,
  isSegmentEligible,
  isCouponTemporallyValid,
} from './rule-engine';

// ── Redis Setup ───────────────────────────────────────────────

function createRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      // Mevcut rate-limit.ts ile aynı davranış: prod'da zorunlu
      throw new Error('[coupon-service] Redis env var eksik (production)');
    }
    return null;
  }
  return new Redis({ url, token });
}

// Modül yüklendiğinde bir kez oluşturulur; request başına değil
const _redis = createRedis();

// ── Rate Limiters (brute-force kupon tahminine karşı) ────────
//
// İki katmanlı:
//   IP bazlı  : 5 deneme / 60 saniye  (farklı hesapları dene stratejisine karşı)
//   User bazlı: 10 deneme / 300 saniye (oturum başına)
//
// İkisi paralel kontrol edilir; herhangi biri başarısız → limit aşıldı.

function createCouponLimiters() {
  if (!_redis) return null;
  return {
    ip:   new Ratelimit({ redis: _redis, limiter: Ratelimit.slidingWindow(5, '60 s'),  prefix: 'rl:coupon:ip' }),
    user: new Ratelimit({ redis: _redis, limiter: Ratelimit.slidingWindow(10, '300 s'), prefix: 'rl:coupon:user' }),
  };
}

const _limiters = createCouponLimiters();

// ── Cache Helpers ─────────────────────────────────────────────
// TTL: 60 saniye. Yüksek trafik altında DB sorgu sayısını düşürür.
// usage_count hızla değiştiği için kısa TTL kasıtlıdır.
// Kesin limit kontrolü her durumda atomic RPC'de (PostgreSQL) yapılır.

const COUPON_CACHE_TTL_SEC = 60;

type CouponCacheEntry = {
  coupon:       Coupon & { campaign: { status: string; starts_at: string; ends_at: string | null } };
  segmentRules: CouponSegmentRule[];
};

function cacheKey(code: string): string {
  return `coupon:v1:${code.toUpperCase()}`;
}

async function getCachedCoupon(code: string): Promise<CouponCacheEntry | null> {
  if (!_redis) return null;
  try {
    return await _redis.get<CouponCacheEntry>(cacheKey(code));
  } catch {
    // Redis erişim hatası → graceful degradation, DB'den çekilecek
    return null;
  }
}

async function setCachedCoupon(code: string, entry: CouponCacheEntry): Promise<void> {
  if (!_redis) return;
  try {
    await _redis.setex(cacheKey(code), COUPON_CACHE_TTL_SEC, JSON.stringify(entry));
  } catch { /* graceful degradation */ }
}

// ── DB Fetch ──────────────────────────────────────────────────

async function fetchCouponFromDb(
  code:     string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CouponCacheEntry | null> {
  const { data, error } = await supabase
    .from('coupons')
    .select(`
      *,
      campaign:campaigns (status, starts_at, ends_at),
      coupon_segment_rules (*)
    `)
    .eq('is_active', true)
    .ilike('code', code)   // case-insensitive eşleşme
    .single();

  if (error || !data) return null;

  return {
    coupon:       data as unknown as CouponCacheEntry['coupon'],
    segmentRules: (data as any).coupon_segment_rules ?? [],
  };
}

// ── Error Mesaj Haritası ──────────────────────────────────────

const ERROR_MESSAGES: Record<CouponValidationError, string> = {
  COUPON_NOT_FOUND:     'Kupon kodu bulunamadı.',
  COUPON_INACTIVE:      'Bu kupon artık aktif değil.',
  COUPON_EXPIRED:       'Bu kuponun süresi dolmuştur.',
  CAMPAIGN_NOT_ACTIVE:  'Bu kampanya şu anda aktif değil.',
  COUPON_EXHAUSTED:     'Bu kuponun kullanım limiti dolmuştur.',
  USER_LIMIT_EXCEEDED:  'Bu kuponu daha önce kullandınız.',
  MIN_ORDER_NOT_MET:    'Minimum sipariş tutarına ulaşılmadı.',
  SEGMENT_NOT_ELIGIBLE: 'Bu kupon sizin üyelik grubunuz için geçerli değil.',
  RATE_LIMITED:         'Çok fazla deneme. Lütfen 1 dakika bekleyin.',
  FIRST_ORDER_REQUIRED: 'Bu kupon yalnızca ilk siparişlerde geçerlidir.',
};

function errResult(
  error: CouponValidationError,
  overrideMessage?: string,
): CouponValidationResult {
  return {
    valid:        false,
    error,
    errorMessage: overrideMessage ?? ERROR_MESSAGES[error],
  };
}

// ── validateCoupon ────────────────────────────────────────────
//
// DB WRITE YOK — önizleme ve UI feedback amacıyla.
// Sonuç deterministik değildir: usage_count sürekli değişir.
// Kesin geçerlilik redeemCoupon (atomic RPC) ile sağlanır.

export async function validateCoupon({
  code,
  subtotal,
  userId,
  userSegment,
  ipAddress,
  isFirstOrder = false,
}: {
  code:         string;
  subtotal:     number;
  userId:       string;
  userSegment:  string | null;
  ipAddress:    string;
  isFirstOrder?: boolean;
}): Promise<CouponValidationResult> {

  // ── 1. Rate Limit ─────────────────────────────────────────
  if (_limiters) {
    const [ipRes, userRes] = await Promise.all([
      _limiters.ip.limit(ipAddress),
      _limiters.user.limit(userId),
    ]);
    if (!ipRes.success || !userRes.success) {
      return errResult('RATE_LIMITED');
    }
  }

  const supabase = await createClient();

  // ── 2. Cache-first lookup ─────────────────────────────────
  let entry = await getCachedCoupon(code);
  if (!entry) {
    entry = await fetchCouponFromDb(code.trim(), supabase);
    if (entry) await setCachedCoupon(code, entry);
  }

  if (!entry) return errResult('COUPON_NOT_FOUND');

  const { coupon, segmentRules } = entry;

  // ── 3. Zamanlama + kampanya geçerliliği ───────────────────
  const temporal = isCouponTemporallyValid(coupon, coupon.campaign);
  if (!temporal.valid) {
    return errResult(temporal.error as CouponValidationError);
  }

  // ── 4. Segment uygunluğu ──────────────────────────────────
  if (!isSegmentEligible(coupon.eligible_segments, userSegment)) {
    return errResult('SEGMENT_NOT_ELIGIBLE');
  }

  // ── 5. First-order-only kuralı ────────────────────────────
  if (coupon.rules.first_order_only && !isFirstOrder) {
    return errResult('FIRST_ORDER_REQUIRED');
  }

  // ── 6. Minimum sipariş tutarı ─────────────────────────────
  if (subtotal < coupon.min_order_amount) {
    return errResult(
      'MIN_ORDER_NOT_MET',
      `Bu kupon için minimum sepet tutarı ₺${coupon.min_order_amount.toFixed(2)}'dir.`,
    );
  }

  // ── 7. Global kullanım limiti (optimistic) ────────────────
  // Kesin kontrol DB'de yapılır; burada hızlı early-exit
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return errResult('COUPON_EXHAUSTED');
  }

  // ── 8. Kullanıcı başına limit (DB sorgusu) ────────────────
  const { count: activeRedemptions, error: countError } = await supabase
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId)
    .neq('status', 'RELEASED');

  if (countError) {
    console.error('[validateCoupon] redemption count error:', countError);
    return errResult('COUPON_NOT_FOUND'); // fail-closed
  }

  if ((activeRedemptions ?? 0) >= coupon.usage_limit_per_user) {
    return errResult('USER_LIMIT_EXCEEDED');
  }

  // ── 9. İndirim hesabı ─────────────────────────────────────
  const segmentRule    = findSegmentRule(segmentRules, userSegment);
  const discountParams = resolveDiscountParams(coupon, segmentRule);
  const discountAmount = calculateDiscountAmount(subtotal, discountParams);

  return {
    valid:          true,
    couponId:       coupon.id,
    discountAmount,
    discountKind:   discountParams.discountKind,
    discountRate:   discountParams.discountKind === 'PERCENTAGE'
                      ? discountParams.discountValue
                      : null,
    appliedSegment: discountParams.appliedSegment,
  };
}

// ── redeemCoupon ──────────────────────────────────────────────
//
// PostgreSQL atomic RPC çağrısı.
// FOR UPDATE lock → tüm kontroller tek transaction içinde → race condition yok.
// Başarısız olursa sipariş akışı bu hatayı yakalar ve order'ı rollback eder.

export async function redeemCoupon({
  couponId,
  userId,
  orderId,
  subtotal,
  discountAmount,
  appliedSegment,
  ipAddress,
}: {
  couponId:       string;
  userId:         string;
  orderId:        string;
  subtotal:       number;
  discountAmount: number;
  appliedSegment: string | null;
  ipAddress:      string;
}): Promise<RedemptionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('redeem_coupon_atomic', {
    p_coupon_id:    couponId,
    p_user_id:      userId,
    p_order_id:     orderId,
    p_subtotal:     subtotal,
    p_discount_amt: discountAmount,
    p_segment:      appliedSegment,
    p_ip_address:   ipAddress,
  });

  if (error) {
    console.error('[redeemCoupon] RPC transport error:', error);
    return { success: false, error: 'REDEMPTION_FAILED' };
  }

  if (!data?.success) {
    const errCode = (data?.error as string) ?? 'REDEMPTION_FAILED';
    console.warn('[redeemCoupon] Business rule rejection:', errCode, data?.detail);
    return { success: false, error: errCode };
  }

  return { success: true, redemptionId: data.redemption_id as string };
}

// ── releaseCouponReservation ──────────────────────────────────
//
// Ödeme başarısız olduğunda veya sipariş expire olduğunda çağrılır.
// expire_pending_orders RPC'siyle entegre çalışır.
// Idempotent: RELEASED olan redemption için success:true döner.

export async function releaseCouponReservation(
  redemptionId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('release_coupon_atomic', {
    p_redemption_id: redemptionId,
  });

  if (error) {
    console.error('[releaseCouponReservation] RPC error:', error);
    return { success: false, error: 'RELEASE_FAILED' };
  }

  if (!data?.success) {
    const errCode = data?.error as string;
    // ALREADY_RELEASED → idempotent başarı
    if (errCode === 'ALREADY_RELEASED') return { success: true };
    console.error('[releaseCouponReservation] Failed:', errCode);
    return { success: false, error: errCode };
  }

  return { success: true };
}

// ── confirmCouponRedemption ───────────────────────────────────
//
// Iyzico callback başarılı olduğunda çağrılır.
// RESERVED → CONFIRMED geçişi; usage_count değişmez (zaten sayılıyor).

export async function confirmCouponRedemption(
  redemptionId: string,
  orderId?:     string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('confirm_coupon_redemption', {
    p_redemption_id: redemptionId,
    p_order_id:      orderId ?? null,
  });

  if (error) {
    console.error('[confirmCouponRedemption] RPC error:', error);
    return { success: false, error: 'CONFIRM_FAILED' };
  }

  if (!data?.success) {
    console.error('[confirmCouponRedemption] Failed:', data?.error);
    return { success: false, error: data?.error ?? 'CONFIRM_FAILED' };
  }

  return { success: true };
}
