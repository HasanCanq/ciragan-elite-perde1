// ============================================================
// PROMOTION ENGINE — Type Definitions
// ============================================================

export type DiscountKind     = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CampaignStatus   = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
export type RedemptionStatus = 'RESERVED' | 'CONFIRMED' | 'RELEASED';

/** Kullanıcı segmentleri — profiles.segment kolonuyla eşleşir */
export type UserSegment = 'B2B_ARCHITECTS' | 'VIP_RETAIL' | string;

// ── DB Row Types ─────────────────────────────────────────────

export interface Campaign {
  id:          string;
  name:        string;
  description: string | null;
  status:      CampaignStatus;
  starts_at:   string;
  ends_at:     string | null;
  metadata:    Record<string, unknown>;
}

/**
 * Kupon kuralları JSONB alanı.
 * Tüm alanlar opsiyonel — unset = kural yok.
 */
export interface CouponRules {
  /** Yalnızca ilk siparişte geçerli */
  first_order_only?: boolean;
  /** Bu kategori ID'leri indirimden hariç */
  excluded_category_ids?: string[];
  /** Yalnızca bu kategori ID'leri indirime dahil (null/boş = tümü) */
  included_category_ids?: string[];
  /** Bu ürün ID'leri indirimden hariç */
  excluded_product_ids?: string[];
}

export interface Coupon {
  id:                   string;
  campaign_id:          string;
  code:                 string;
  discount_kind:        DiscountKind;
  /**
   * PERCENTAGE: 0.0001 – 1.0000  (0.2000 = %20)
   * FIXED_AMOUNT: TRY cinsinden tutar
   */
  discount_value:       number;
  max_discount_amount:  number | null;
  min_order_amount:     number;
  usage_limit:          number | null;
  usage_limit_per_user: number;
  usage_count:          number;
  eligible_segments:    string[] | null;
  is_active:            boolean;
  expires_at:           string | null;
  rules:                CouponRules;
  created_at:           string;
  updated_at:           string;
}

export interface CouponSegmentRule {
  id:                  string;
  coupon_id:           string;
  segment:             string;
  discount_kind:       DiscountKind;
  discount_value:      number;
  max_discount_amount: number | null;
}

// ── Service Layer Types ───────────────────────────────────────

/**
 * validateCoupon() dönüş değerinde olası hata kodları.
 * Her kod için lokalize mesaj coupon-service.ts içindedir.
 */
export type CouponValidationError =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'CAMPAIGN_NOT_ACTIVE'
  | 'COUPON_EXHAUSTED'
  | 'USER_LIMIT_EXCEEDED'
  | 'MIN_ORDER_NOT_MET'
  | 'SEGMENT_NOT_ELIGIBLE'
  | 'RATE_LIMITED'
  | 'FIRST_ORDER_REQUIRED';

/** DB write içermeyen önizleme doğrulama sonucu */
export type CouponValidationResult =
  | {
      valid:          true;
      couponId:       string;
      discountAmount: number;       // TRY, 2 ondalık basamak
      discountKind:   DiscountKind;
      discountRate:   number | null; // PERCENTAGE için 0–1; FIXED için null
      appliedSegment: string | null;
    }
  | {
      valid:        false;
      error:        CouponValidationError;
      errorMessage: string;
    };

/** Checkout state'inde saklanan uygulanan kupon */
export interface AppliedCoupon {
  code:           string;
  couponId:       string;
  discountAmount: number;
  discountKind:   DiscountKind;
  discountRate:   number | null;
  appliedSegment: string | null;
}

/** redeemCoupon() dönüş değeri */
export type RedemptionResult =
  | { success: true;  redemptionId: string }
  | { success: false; error: string };
