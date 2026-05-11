'use server';

// ============================================================
// CAMPAIGN & COUPON ADMIN SERVER ACTIONS
// Tüm mutasyon operasyonları admin yetkisi gerektirir.
// ============================================================

import { createClient }   from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ApiResponse } from '@/types';

// ── Yetki Kontrolü ───────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Yetkisiz');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if ((profile as any)?.role !== 'ADMIN') throw new Error('Yetkisiz');
  return supabase;
}

// ── Types ─────────────────────────────────────────────────────

export interface CampaignRow {
  id:          string;
  name:        string;
  description: string | null;
  status:      'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  starts_at:   string;
  ends_at:     string | null;
  created_at:  string;
  coupon_count:       number;
  total_redemptions:  number;
  confirmed_discount: number;
}

export interface CouponRow {
  id:                   string;
  campaign_id:          string;
  code:                 string;
  discount_kind:        'PERCENTAGE' | 'FIXED_AMOUNT';
  discount_value:       number;
  max_discount_amount:  number | null;
  min_order_amount:     number;
  usage_limit:          number | null;
  usage_limit_per_user: number;
  usage_count:          number;
  eligible_segments:    string[] | null;
  is_active:            boolean;
  expires_at:           string | null;
  rules:                Record<string, unknown>;
  created_at:           string;
  segment_rules: Array<{
    id:                  string;
    segment:             string;
    discount_kind:       'PERCENTAGE' | 'FIXED_AMOUNT';
    discount_value:      number;
    max_discount_amount: number | null;
  }>;
}

export interface CreateCampaignInput {
  name:        string;
  description?: string;
  status:      'DRAFT' | 'ACTIVE';
  starts_at:   string; // ISO datetime
  ends_at?:    string; // ISO datetime veya boş
}

export interface CreateCouponInput {
  campaign_id:          string;
  code:                 string;
  discount_kind:        'PERCENTAGE' | 'FIXED_AMOUNT';
  discount_value:       number;
  max_discount_amount?: number | null;
  min_order_amount:     number;
  usage_limit?:         number | null;
  usage_limit_per_user: number;
  eligible_segments?:   string[] | null;
  expires_at?:          string | null;
  first_order_only?:    boolean;
  segment_rules?: Array<{
    segment:             string;
    discount_kind:       'PERCENTAGE' | 'FIXED_AMOUNT';
    discount_value:      number;
    max_discount_amount?: number | null;
  }>;
}

// ── CAMPAIGN READ ─────────────────────────────────────────────

export async function getCampaigns(): Promise<ApiResponse<CampaignRow[]>> {
  try {
    const supabase = await requireAdmin();

    const { data, error } = await supabase
      .from('v_campaign_summary')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: (data ?? []) as CampaignRow[], error: null, success: true };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Kampanyalar yüklenemedi', success: false };
  }
}

export async function getCouponsForCampaign(
  campaignId: string,
): Promise<ApiResponse<CouponRow[]>> {
  try {
    const supabase = await requireAdmin();

    const { data, error } = await supabase
      .from('coupons')
      .select(`
        *,
        segment_rules:coupon_segment_rules (*)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: (data ?? []) as unknown as CouponRow[], error: null, success: true };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Kuponlar yüklenemedi', success: false };
  }
}

// ── CAMPAIGN WRITE ────────────────────────────────────────────

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<ApiResponse<{ id: string }>> {
  try {
    const supabase = await requireAdmin();

    if (!input.name?.trim()) {
      return { data: null, error: 'Kampanya adı zorunludur', success: false };
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name:        input.name.trim(),
        description: input.description?.trim() || null,
        status:      input.status,
        starts_at:   input.starts_at,
        ends_at:     input.ends_at || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    revalidatePath('/admin/campaigns');
    return { data: { id: data.id }, error: null, success: true };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Kampanya oluşturulamadı', success: false };
  }
}

export async function updateCampaignStatus(
  campaignId: string,
  status:     'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED',
): Promise<ApiResponse<void>> {
  try {
    const supabase = await requireAdmin();

    const { error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId);

    if (error) throw error;

    revalidatePath('/admin/campaigns');
    return { data: undefined, error: null, success: true };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Durum güncellenemedi', success: false };
  }
}

// ── COUPON WRITE ──────────────────────────────────────────────

export async function createCoupon(
  input: CreateCouponInput,
): Promise<ApiResponse<{ id: string }>> {
  try {
    const supabase = await requireAdmin();

    // Validasyon
    const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
    if (code.length < 3 || code.length > 50) {
      return { data: null, error: 'Kupon kodu 3-50 karakter olmalı (harf, rakam, tire)', success: false };
    }

    if (input.discount_kind === 'PERCENTAGE' &&
        (input.discount_value <= 0 || input.discount_value > 1)) {
      return { data: null, error: 'Yüzde indirimi 0-1 aralığında olmalı (örn: 0.20 = %20)', success: false };
    }

    if (input.discount_kind === 'FIXED_AMOUNT' && input.discount_value <= 0) {
      return { data: null, error: 'Sabit indirim tutarı 0\'dan büyük olmalı', success: false };
    }

    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .insert({
        campaign_id:          input.campaign_id,
        code,
        discount_kind:        input.discount_kind,
        discount_value:       input.discount_value,
        max_discount_amount:  input.max_discount_amount ?? null,
        min_order_amount:     input.min_order_amount,
        usage_limit:          input.usage_limit ?? null,
        usage_limit_per_user: input.usage_limit_per_user,
        eligible_segments:    input.eligible_segments?.length
                               ? input.eligible_segments
                               : null,
        expires_at:           input.expires_at || null,
        rules:                { first_order_only: input.first_order_only ?? false },
      })
      .select('id')
      .single();

    if (couponError) {
      // Unique constraint ihlali → kod zaten var
      if (couponError.code === '23505') {
        return { data: null, error: `"${code}" kodu zaten kullanımda`, success: false };
      }
      throw couponError;
    }

    // Segment rule'ları ekle
    if (input.segment_rules?.length) {
      const { error: segError } = await supabase
        .from('coupon_segment_rules')
        .insert(
          input.segment_rules.map((r) => ({
            coupon_id:           coupon.id,
            segment:             r.segment,
            discount_kind:       r.discount_kind,
            discount_value:      r.discount_value,
            max_discount_amount: r.max_discount_amount ?? null,
          }))
        );

      if (segError) {
        // Kupon oluşturuldu ama segment rule eklenemedi — yine de başarı say,
        // kullanıcıya uyarı göster
        console.error('[createCoupon] Segment rule hatası:', segError);
        revalidatePath('/admin/campaigns');
        return {
          data:    { id: coupon.id },
          error:   'Kupon oluşturuldu ancak segment kuralları kaydedilemedi.',
          success: true,
        };
      }
    }

    revalidatePath('/admin/campaigns');
    return { data: { id: coupon.id }, error: null, success: true };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Kupon oluşturulamadı', success: false };
  }
}

export async function toggleCouponActive(
  couponId: string,
  isActive: boolean,
): Promise<ApiResponse<void>> {
  try {
    const supabase = await requireAdmin();

    const { error } = await supabase
      .from('coupons')
      .update({ is_active: isActive })
      .eq('id', couponId);

    if (error) throw error;

    revalidatePath('/admin/campaigns');
    return { data: undefined, error: null, success: true };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Güncelleme başarısız', success: false };
  }
}
