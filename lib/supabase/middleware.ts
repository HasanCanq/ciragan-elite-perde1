import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 1. Kullanıcıyı getir
  const { data: { user } } = await supabase.auth.getUser()

  // 2. GİZLİ ADMIN KORUMASI 🛡️
  if (request.nextUrl.pathname.startsWith('/admin')) {
    
    let isAdmin = false;

    // Eğer kullanıcı giriş yapmışsa, veritabanından rolüne bak
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      isAdmin = profile?.role === 'ADMIN';
    }

    // KRİTİK NOKTA: Kullanıcı yoksa VEYA Admin değilse -> 404'e gönder (Rewrite)
    if (!user || !isAdmin) {
      // Rewrite kullanıyoruz: URL değişmez (/admin kalır) ama içerik 404 olur.
      return NextResponse.rewrite(new URL('/404', request.url));
    }
  }

  // 3. Sipariş Takip → Giriş yapmış kullanıcıyı hesabına yönlendir
  if (request.nextUrl.pathname === '/siparis-takip' && user) {
    return NextResponse.redirect(new URL('/account/orders', request.url));
  }

  // 4. Admin Login Sayfası Koruması
  // Eğer zaten giriş yapmışsa ve login sayfasına gitmeye çalışıyorsa panele at
  if (request.nextUrl.pathname === '/admin/login' && user) {
     return NextResponse.redirect(new URL('/admin/products', request.url));
  }

  return response
}