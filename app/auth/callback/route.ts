import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');       // 'recovery' | 'signup' | null
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Şifre sıfırlama: session kuruldu, kullanıcıyı yeni şifre formuna gönder
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/sifre-yenile`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Token geçersiz / süresi dolmuş
    if (type === 'recovery') {
      return NextResponse.redirect(
        `${origin}/giris?error=recovery_link_expired`
      );
    }
  }

  return NextResponse.redirect(`${origin}/giris?error=auth_callback_error`);
}
