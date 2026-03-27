/**
 * PUBLIC SUPABASE CLIENT
 * ─────────────────────────────────────────────────────────────
 * Cookie'ye DOKUNMAYAN Supabase client'ı.
 *
 * Neden gerekli?
 *   @supabase/ssr'nin createServerClient'ı cookies() çağırır.
 *   cookies() bir Next.js Dynamic API'sidir ve sayfayı dinamik
 *   render'a sokar — revalidate yazsanız bile ISR cache çalışmaz.
 *   Bu client o sorunu ortadan kaldırır.
 *
 * Ne zaman kullan?
 *   ✅ Herkese açık veri: ürünler, kategoriler, ana sayfa
 *   ✅ generateStaticParams (build zamanı — cookies() yoktur)
 *   ✅ ISR sayfaları (app/page.tsx, app/urun, app/kategori)
 *
 * Ne zaman KULLANMA?
 *   ❌ Kullanıcı profili, sepet, sipariş, ödeme
 *   ❌ Admin işlemleri
 *   (bunlar için lib/supabase/server.ts kullan)
 */

import { createClient } from '@supabase/supabase-js';

export function getPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession:   false,  // Sunucuda oturum saklanmaz
        autoRefreshToken: false,  // Token yenileme denemesi yapılmaz
        detectSessionInUrl: false,
      },
    }
  );
}
