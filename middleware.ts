import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { authLimiter, apiLimiter, generalLimiter } from '@/lib/rate-limit';

// IP adresini al
// Vercel'de request.ip, edge altyapısı tarafından güvenilir biçimde doldurulur.
// x-forwarded-for istemci tarafından manipüle edilebildiğinden son çare olarak kullanılır.
function getIP(request: NextRequest): string {
  return (
    request.ip ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  );
}

// Rate limit kontrolu
async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const ip = getIP(request);
  const path = request.nextUrl.pathname;

  try {
    let result;

    // Auth rotaları: Sıkı limit (brute force koruması) — 5 istek / 60 saniye
    if (path.startsWith('/giris') || path.startsWith('/auth')) {
      result = await authLimiter.limit(ip);
    }
    // Sipariş/ödeme rotaları: Orta düzey limit — 10 istek / 10 saniye
    else if (path.startsWith('/odeme') || path.startsWith('/sepet')) {
      result = await apiLimiter.limit(ip);
    }
    // Public sayfalar: Genel limit — 30 istek / 10 saniye (bot koruması)
    else {
      result = await generalLimiter.limit(ip);
    }

    if (!result.success) {
      const limiterName = path.startsWith('/giris') || path.startsWith('/auth')
        ? 'authLimiter'
        : path.startsWith('/odeme') || path.startsWith('/sepet')
        ? 'apiLimiter'
        : 'generalLimiter';
      console.warn(`[RateLimit] Engellendi | ip=${ip} path=${path} limiter=${limiterName} reset=${result.reset}`);

      return NextResponse.json(
        { error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
  } catch (err) {
    // Production'da Redis crash → isteği engelle (fail-closed).
    // Development'ta ise pass et ki geliştirme akışı bozulmasın.
    console.error('[RateLimit] Redis bağlantı hatası:', err);
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Servis geçici olarak kullanım dışı. Lütfen kısa süre sonra tekrar deneyin.' },
        { status: 503 }
      );
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // API rotaları middleware'den muaf (kargo webhook, cron, payment callback)
  if (
    path === '/api/payment/callback' ||
    path.startsWith('/api/webhooks/') ||
    path.startsWith('/api/cron/')
  ) {
    return NextResponse.next();
  }

  // ============================================
  // Public sayfalar → session sorgusu YAPMA ama rate limit uygula
  // /, /kategori/*, /urun/*, /hakkimizda, /iletisim, /robots.txt, /sitemap.xml
  // ============================================
  const isProtectedRoute =
    path.startsWith('/admin') ||
    path.startsWith('/account') ||
    path.startsWith('/giris') ||
    path.startsWith('/auth') ||
    path.startsWith('/odeme') ||
    path.startsWith('/sepet') ||
    path === '/siparis-takip';

  // Rate limit tüm rotalar için (public dahil)
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Supabase session yönetimi + rota koruması (sadece korumalı rotalar)
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Statik dosyaları ve asset'leri kesinlikle hariç tut.
     * Middleware sadece sayfa gezinimlerinde çalışır.
     */
    '/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$).*)',
  ],
};
