'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { authLimiter } from '@/lib/rate-limit';
import { type ApiResponse } from '@/types';

// ── Dönüş tipi ────────────────────────────────────────────────────────────────

export interface GuestOrderResult {
  order_number:            string;
  status:                  string;
  created_at:              string;
  total_amount:            number;
  shipping_cost:           number | null;
  shipping_tracking_code:  string | null;
  invoice_url:             string | null;
  customer_name:           string;
}

// ── Validasyon şeması ─────────────────────────────────────────────────────────

const schema = z.object({
  orderNumber:   z
    .string()
    .regex(
      /^HND-\d{8}-[A-F0-9]{8}$/,
      'Sipariş numarası geçersiz (örn: HND-20250319-A1B2C3D4)'
    ),
  customerEmail: z
    .string()
    .email('Geçerli bir e-posta adresi girin')
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
});

// ── Jenerik hata (hangi alanın yanlış olduğunu sızdırmaz) ─────────────────────

const NOT_FOUND_ERROR =
  'Sipariş bulunamadı. Lütfen sipariş numaranızı ve e-posta adresinizi kontrol edin.';

const RATE_LIMIT_ERROR =
  'Çok fazla deneme yapıldı. Lütfen bir dakika bekleyip tekrar deneyin.';

// ── IP yardımcısı ─────────────────────────────────────────────────────────────

async function getClientIP(): Promise<string> {
  const hdrs = await headers();
  return (
    hdrs.get('x-real-ip') ??
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  );
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function trackGuestOrder(
  formData: FormData
): Promise<ApiResponse<GuestOrderResult>> {
  // 1. Rate limiting — kimlik tespiti: IP + e-posta birleşimi
  //    Aynı IP farklı e-postalarla, ya da farklı IP'ler aynı e-postayla
  //    deneme yapsa da her kombinasyon ayrı sayaçla sınırlanır.
  const ip    = await getClientIP();
  const rawEmail = (formData.get('customerEmail') ?? '').toString().toLowerCase().trim();
  const rlKey = `guest-track:${ip}:${rawEmail}`;

  const { success: allowed } = await authLimiter.limit(rlKey);

  if (!allowed) {
    return { success: false, data: null, error: RATE_LIMIT_ERROR };
  }

  // 2. Zod validasyonu
  const parsed = schema.safeParse({
    orderNumber:   formData.get('orderNumber'),
    customerEmail: formData.get('customerEmail'),
  });

  if (!parsed.success) {
    // Validation hataları doğrudan UI'a iletilir (format hataları gizlenmez)
    const msg = parsed.error.issues[0]?.message ?? 'Geçersiz form verisi';
    return { success: false, data: null, error: msg };
  }

  const { orderNumber, customerEmail } = parsed.data;

  // 3. Supabase RPC çağrısı
  //    get_order_for_guest: SECURITY DEFINER, sadece güvenli alanları döner.
  //    Kayıt yoksa veya deleted_at IS NOT NULL ise NULL döner.
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_order_for_guest', {
      p_order_number:   orderNumber,
      p_customer_email: customerEmail,
    });

    if (error) {
      console.error('[GuestTracking] RPC hatası:', error.message);
      // DB hata detayı kullanıcıya sızdırılmaz
      return { success: false, data: null, error: NOT_FOUND_ERROR };
    }

    // RPC NULL döndürdü → sipariş yok veya e-posta eşleşmedi
    if (!data) {
      return { success: false, data: null, error: NOT_FOUND_ERROR };
    }

    return { success: true, data: data as GuestOrderResult, error: null };
  } catch (err) {
    console.error('[GuestTracking] Beklenmedik hata:', err);
    return { success: false, data: null, error: NOT_FOUND_ERROR };
  }
}
