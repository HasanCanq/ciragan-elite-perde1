// ============================================================
// PROMOTION ENGINE — Pure Rule Engine
//
// Bu modül yan etki içermez (no DB / no Redis calls).
// Tüm fonksiyonlar deterministik ve test edilebilir.
// ============================================================

import type { Coupon, CouponSegmentRule, DiscountKind } from './types';

export interface DiscountParams {
  discountKind:      DiscountKind;
  discountValue:     number;
  maxDiscountAmount: number | null;
}

/**
 * İndirim tutarını tam sayı (kuruş) aritmetiğiyle hesaplar.
 *
 * NEDEN INTEGER ARİTMETİĞİ:
 *   0.1 + 0.2 = 0.30000000000000004  → floating-point hatası
 *   JavaScript'te para birimi hesaplamalarında kuruşa (integer) çevirip
 *   işlem yapıp tekrar TRY'ye döndürmek standart yaklaşımdır.
 *
 * PERCENTAGE örneği:
 *   subtotal=₺1234.56, rate=0.2000 (%20)
 *   → subtotalCents = 123456
 *   → discountCents = round(123456 × 0.2000) = round(24691.2) = 24691
 *   → ₺246.91
 *
 * FIXED_AMOUNT örneği:
 *   discountValue=₺50, subtotal=₺30 → indirim sepeti aşamaz → ₺30
 */
export function calculateDiscountAmount(
  subtotalTRY: number,
  params: DiscountParams,
): number {
  const subtotalCents = Math.round(subtotalTRY * 100);

  let discountCents: number;

  if (params.discountKind === 'PERCENTAGE') {
    // discountValue örneğin 0.2000 (= %20)
    // Tam sayı taşmasını önlemek için önce rate'i tamsayıya çeviriyoruz:
    // discountCents = round(subtotalCents × discountValue)
    discountCents = Math.round(subtotalCents * params.discountValue);
  } else {
    // FIXED_AMOUNT: sepet tutarını aşamaz
    const fixedCents = Math.round(params.discountValue * 100);
    discountCents    = Math.min(fixedCents, subtotalCents);
  }

  // Tavan uygula (PERCENTAGE için max_discount_amount)
  if (params.maxDiscountAmount != null) {
    const capCents = Math.round(params.maxDiscountAmount * 100);
    discountCents  = Math.min(discountCents, capCents);
  }

  // Negatif indirim olamaz
  discountCents = Math.max(discountCents, 0);

  // Kuruştan TRY'ye: 2 ondalık hassasiyet
  return discountCents / 100;
}

/**
 * Kullanıcı segmentine göre indirim parametrelerini seç.
 * Segment rule varsa onu uygular; yoksa kuponun base değerini döner.
 */
export function resolveDiscountParams(
  coupon: Pick<Coupon, 'discount_kind' | 'discount_value' | 'max_discount_amount'>,
  segmentRule: CouponSegmentRule | null,
): DiscountParams & { appliedSegment: string | null } {
  if (segmentRule) {
    return {
      discountKind:      segmentRule.discount_kind,
      discountValue:     segmentRule.discount_value,
      maxDiscountAmount: segmentRule.max_discount_amount,
      appliedSegment:    segmentRule.segment,
    };
  }
  return {
    discountKind:      coupon.discount_kind,
    discountValue:     coupon.discount_value,
    maxDiscountAmount: coupon.max_discount_amount,
    appliedSegment:    null,
  };
}

/**
 * Kullanıcı segmentine uygun segment rule'u bul.
 * Eşleşme yoksa null döner → base discount uygulanır.
 */
export function findSegmentRule(
  rules: CouponSegmentRule[],
  userSegment: string | null,
): CouponSegmentRule | null {
  if (!userSegment || rules.length === 0) return null;
  return rules.find((r) => r.segment === userSegment) ?? null;
}

/**
 * Kuponu kullanabilmek için segmentin uygun olup olmadığını kontrol et.
 *
 * Mantık:
 *   - eligible_segments NULL veya boş → herkes kullanabilir
 *   - eligible_segments doluysa kullanıcı segmenti listede olmalı
 *   - Segment rule olmak ≠ segment uygunluğu (rule override için gerekli,
 *     uygunluk için eligible_segments kontrolü yeterli)
 */
export function isSegmentEligible(
  eligibleSegments: string[] | null,
  userSegment: string | null,
): boolean {
  if (!eligibleSegments || eligibleSegments.length === 0) return true;
  if (!userSegment) return false;
  return eligibleSegments.includes(userSegment);
}

/**
 * Kuponun zamanlama geçerliliğini kontrol et (saf fonksiyon, DB yok).
 * `now` parametresi test edilebilirlik için inject edilebilir.
 */
export function isCouponTemporallyValid(
  coupon:   Pick<Coupon, 'is_active' | 'expires_at'>,
  campaign: Pick<{ status: string; starts_at: string; ends_at: string | null },
                 'status' | 'starts_at' | 'ends_at'>,
  now: Date = new Date(),
): { valid: boolean; error?: string } {
  if (!coupon.is_active) {
    return { valid: false, error: 'COUPON_INACTIVE' };
  }
  if (campaign.status !== 'ACTIVE') {
    return { valid: false, error: 'CAMPAIGN_NOT_ACTIVE' };
  }
  if (new Date(campaign.starts_at) > now) {
    return { valid: false, error: 'CAMPAIGN_NOT_ACTIVE' };
  }
  if (campaign.ends_at && new Date(campaign.ends_at) < now) {
    return { valid: false, error: 'CAMPAIGN_NOT_ACTIVE' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return { valid: false, error: 'COUPON_EXPIRED' };
  }
  return { valid: true };
}
