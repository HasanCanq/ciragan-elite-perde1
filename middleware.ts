import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { generalLimiter, authLimiter, apiLimiter } from '@/lib/rate-limit';

// IP adresini al
function getIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

// Rate limit kontrolu
async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  // Upstash env yoksa rate limiting'i atla (gelistirme ortaminda)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const ip = getIP(request);
  const path = request.nextUrl.pathname;

  try {
    let result;

    // Auth rotaları: Sıkı limit (brute force koruması)
    if (path.startsWith('/giris') || path.startsWith('/auth')) {
      result = await authLimiter.limit(ip);
    }
    // Sipariş/ödeme rotaları: Orta düzey limit
    else if (path.startsWith('/odeme') || path.startsWith('/sepet')) {
      result = await apiLimiter.limit(ip);
    }
    // Diğer tüm rotalar: Genel limit
    else {
      result = await generalLimiter.limit(ip);
    }

    if (!result.success) {
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
  } catch {
    // Redis bağlantı hatası olursa trafiği engelleme, devam et
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Ödeme callback'i middleware'den muaf (banka POST redirect'i)
  if (path === '/api/payment/callback') {
    return NextResponse.next();
  }

  // 1. Rate Limit kontrolü
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Supabase session yönetimi + rota koruması
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Admin ve hesap rotalarını koru
    '/admin/:path*',
    '/account/:path*',
    // Auth callback'i hariç tut
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
