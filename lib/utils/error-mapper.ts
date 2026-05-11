/**
 * Supabase / GoTrue Auth hata mesajlarını Hanedan markasının üslubuna
 * uygun Türkçe metinlere dönüştüren merkezi haritalama katmanı.
 *
 * Öncelik sırası: error.code → error.message (substring) → fallback
 */

interface MappableError {
  message?: string;
  code?: string;
  status?: number;
}

type ErrorEntry = {
  /** Kullanıcıya gösterilecek Türkçe metin */
  tr: string;
};

// ─────────────────────────────────────────────
// 1. GoTrue hata kodu sözlüğü  (error.code)
// ─────────────────────────────────────────────
const CODE_MAP: Record<string, ErrorEntry> = {
  invalid_credentials:           { tr: 'E-posta adresi veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.' },
  email_exists:                  { tr: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.' },
  email_not_confirmed:           { tr: 'E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.' },
  over_email_send_rate_limit:    { tr: 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.' },
  over_request_rate_limit:       { tr: 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.' },
  same_password:                 { tr: 'Yeni şifreniz mevcut şifrenizle aynı olamaz.' },
  weak_password:                 { tr: 'Şifreniz en az 6 karakter içermeli ve yeterince güçlü olmalıdır.' },
  password_too_short:            { tr: 'Şifreniz en az 6 karakter içermelidir.' },
  user_banned:                   { tr: 'Hesabınız askıya alınmıştır. Destek için bizimle iletişime geçin.' },
  session_not_found:             { tr: 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.' },
  signup_disabled:               { tr: 'Şu an yeni üyelik alınmamaktadır. Lütfen daha sonra tekrar deneyin.' },
  email_address_not_authorized:  { tr: 'Bu e-posta adresiyle kayıt olma izniniz bulunmamaktadır.' },
  otp_expired:                   { tr: 'Doğrulama kodunun süresi dolmuş. Lütfen yeni bir kod talep edin.' },
  token_expired:                 { tr: 'Bağlantının süresi dolmuş. Lütfen yeni bir bağlantı talep edin.' },
};

// ─────────────────────────────────────────────
// 2. GoTrue mesaj metni eşleştirme tablosu
//    Her girdi: [substring (küçük harf), Türkçe mesaj]
// ─────────────────────────────────────────────
const MESSAGE_MAP: Array<[string, string]> = [
  ['invalid login credentials',                  'E-posta adresi veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.'],
  ['user already registered',                    'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.'],
  ['email not confirmed',                        'E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.'],
  ['email link is invalid or has expired',       'Bağlantının süresi dolmuş veya geçersiz. Lütfen yeni bir bağlantı talep edin.'],
  ['email rate limit exceeded',                  'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.'],
  ['for security purposes, you can only request', 'Güvenlik nedeniyle çok sık istek gönderildi. Lütfen bekleyip tekrar deneyin.'],
  ['rate limit',                                 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.'],
  ['password should be at least',                'Şifreniz en az 6 karakter içermelidir.'],
  ['unable to validate email address',           'Geçerli bir e-posta adresi girin.'],
  ['invalid email',                              'Geçerli bir e-posta adresi girin.'],
  ['signup is disabled',                         'Şu an yeni üyelik alınmamaktadır. Lütfen daha sonra tekrar deneyin.'],
  ['signups not allowed',                        'Şu an yeni üyelik alınmamaktadır. Lütfen daha sonra tekrar deneyin.'],
  ['email address not authorized',               'Bu e-posta adresiyle kayıt olma izniniz bulunmamaktadır.'],
  ['new password should be different',           'Yeni şifreniz mevcut şifrenizle aynı olamaz.'],
  ['token has expired or is invalid',            'Bağlantının süresi dolmuş veya geçersiz. Lütfen yeni bir bağlantı talep edin.'],
  ['auth session missing',                       'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.'],
  ['user not found',                             'E-posta adresi veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.'],
  ['invalid token',                              'Doğrulama bağlantısı geçersiz. Lütfen yeni bir bağlantı talep edin.'],
  ['network',                                    'Bağlantı hatası oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.'],
];

const GENERIC_FALLBACK =
  'İşleminiz sırasında bir hata oluştu. Lütfen tekrar deneyin ya da destek ekibimizle iletişime geçin.';

// ─────────────────────────────────────────────
// 3. Ana haritalama fonksiyonu
// ─────────────────────────────────────────────
export function mapAuthError(error: MappableError | null | undefined): string {
  if (!error) return GENERIC_FALLBACK;

  // 3a. Kod eşleştirmesi (en kesin yol)
  if (error.code) {
    const codeKey = error.code.toLowerCase();
    if (CODE_MAP[codeKey]) return CODE_MAP[codeKey].tr;
  }

  // 3b. HTTP 429 — rate limit güvencesi
  if (error.status === 429) {
    return 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.';
  }

  // 3c. Mesaj metni substring eşleştirmesi
  if (error.message) {
    const lc = error.message.toLowerCase();
    for (const [fragment, tr] of MESSAGE_MAP) {
      if (lc.includes(fragment)) return tr;
    }
  }

  // 3d. Fallback — sözlükte karşılığı olmayan yeni hata
  console.warn(
    '[error-mapper] Bilinmeyen auth hatası — sözlüğe eklenmeli:',
    { code: error.code, message: error.message, status: error.status }
  );
  return GENERIC_FALLBACK;
}
