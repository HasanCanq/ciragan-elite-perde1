'use server';

import { createClient } from '@/lib/supabase/server';
import { mapAuthError } from '@/lib/utils/error-mapper';

export type AuthResult = {
  error: string | null;
};

// ─────────────────────────────────────────────
// Giriş Yap
// ─────────────────────────────────────────────
export async function signInAction(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: mapAuthError(error) };
  return { error: null };
}

// ─────────────────────────────────────────────
// Üye Ol
// ─────────────────────────────────────────────
export type SignUpPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: string;
  kvkkConsent: boolean;
  termsAccepted: boolean;
  whatsappConsent: boolean;
};

export async function signUpAction(payload: SignUpPayload): Promise<AuthResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: { full_name: `${payload.firstName} ${payload.lastName}` },
    },
  });

  if (error) return { error: mapAuthError(error) };

  // Profil güncelleme — auth başarılıysa ve user dönmüşse
  if (data.user) {
    await supabase
      .from('profiles')
      .update({
        phone: payload.phone,
        birth_date: payload.birthDate,
        is_commercial_allowed: payload.kvkkConsent,
        is_terms_accepted: payload.termsAccepted,
        is_whatsapp_allowed: payload.whatsappConsent,
        full_name: `${payload.firstName} ${payload.lastName}`,
      })
      .eq('id', data.user.id);
    // Profil güncellemesi ikincil — hata olsa bile kayıt başarılı sayılır
  }

  return { error: null };
}

// ─────────────────────────────────────────────
// Şifre Sıfırlama Talebi
// ─────────────────────────────────────────────
export async function requestPasswordResetAction(
  email: string,
  redirectTo: string
): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  // Güvenlik: enumeration koruması — var olmayan e-posta da başarı döner.
  // Yalnızca gerçek rate-limit veya servis hatalarını kullanıcıya ilet.
  if (error && (error.status === 429 || error.message?.toLowerCase().includes('rate limit'))) {
    return { error: mapAuthError(error) };
  }

  return { error: null };
}

// ─────────────────────────────────────────────
// Şifre Güncelleme (authenticated oturum içinde)
// ─────────────────────────────────────────────
export async function updatePasswordAction(
  newPassword: string
): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: mapAuthError(error) };
  return { error: null };
}
