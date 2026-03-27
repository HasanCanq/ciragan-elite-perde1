'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff, X, AlertCircle, CheckCircle, ArrowLeft, Mail } from 'lucide-react';

const LegalModal = ({ title, content, isOpen, onClose }: { title: string, content: React.ReactNode, isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[#F3F4F6] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 ">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="font-serif text-[#1A1A1A] text-[11px] tracking-[0.2em] uppercase">{title}</h3>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#B89947] transition-colors duration-300">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto text-[#4A4A4A] text-[10px] leading-relaxed space-y-4 tracking-[0.05em]">
          {content}
        </div>
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-end">
          <button onClick={onClose} className="h-btn">
            Okudum, Anladım
          </button>
        </div>
      </div>
    </div>
  );
};

const LEGAL_TEXTS = {
  kvkk: (
    <>
      <p><strong className="text-[#1A1A1A]">1. Veri Sorumlusu:</strong> Hanedan Perde olarak kişisel verilerinizin güvenliğine önem veriyoruz.</p>
      <p><strong className="text-[#1A1A1A]">2. İşlenen Veriler:</strong> Ad, soyad, e-posta, telefon ve adres bilgileriniz hizmet kalitesini artırmak amacıyla işlenmektedir.</p>
      <p><strong className="text-[#1A1A1A]">3. Veri Aktarımı:</strong> Verileriniz, yasal zorunluluklar haricinde ve açık rızanız olmaksızın üçüncü kişilerle paylaşılmamaktadır.</p>
      <p>Ticari elektronik ileti izni kapsamında; kampanyalar, indirimler ve yeni ürünler hakkında size e-posta veya SMS yoluyla ulaşmamıza izin vermiş olursunuz.</p>
    </>
  ),
  terms: (
    <>
      <p><strong className="text-[#1A1A1A]">Madde 1 - Taraflar:</strong> İşbu sözleşme Hanedan Perde ile üye olan kullanıcı arasındadır.</p>
      <p><strong className="text-[#1A1A1A]">Madde 2 - Konu:</strong> İşbu sözleşmenin konusu, kullanıcının internet sitesinden faydalanma şartlarının belirlenmesidir.</p>
      <p><strong className="text-[#1A1A1A]">Madde 3 - Üyenin Yükümlülükleri:</strong> Üye, kayıt olurken verdiği bilgilerin doğruluğunu taahhüt eder.</p>
      <p><strong className="text-[#1A1A1A]">Madde 4 - Gizlilik:</strong> Üyenin şifre güvenliği kendi sorumluluğundadır.</p>
    </>
  ),
  whatsapp: (
    <>
      <p>WhatsApp iletişim hattımız üzerinden sipariş durumu, kargo takibi ve sadece size özel fırsatlar hakkında bilgilendirme yapılacaktır.</p>
      <p>Bu onay ile telefon numaranızın WhatsApp Business API üzerinden işlenmesine ve size mesaj gönderilmesine izin vermiş sayılırsınız.</p>
      <p>İstediğiniz zaman "DUR" yazarak bu listeden çıkabilirsiniz.</p>
    </>
  )
};

export default function AuthForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');

  // Callback URL'den gelen hataları göster
  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'recovery_link_expired') {
      setErrorMsg('Şifre sıfırlama linki geçersiz veya süresi dolmuş. Lütfen tekrar talep edin.');
      setMode('forgot-password');
    } else if (err === 'auth_callback_error') {
      setErrorMsg('Giriş linki geçersiz. Lütfen tekrar deneyin.');
    }
  }, [searchParams]);

  // Mode değişince mesajları temizle
  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [mode]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    retryTimer.current = setInterval(() => {
      setRetryAfter((s) => {
        if (s <= 1) {
          clearInterval(retryTimer.current!);
          setErrorMsg(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(retryTimer.current!);
  }, [retryAfter]);

  const [activeModal, setActiveModal] = useState<'kvkk' | 'terms' | 'whatsapp' | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    kvkkConsent: false,
    termsAccepted: false,
    whatsappConsent: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryAfter > 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        if (!formData.termsAccepted) {
          setErrorMsg('Lütfen Üyelik Sözleşmesi\'ni kabul ediniz.');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: { full_name: `${formData.firstName} ${formData.lastName}` },
          },
        });

        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').update({
            phone: formData.phone,
            birth_date: formData.birthDate,
            is_commercial_allowed: formData.kvkkConsent,
            is_terms_accepted: formData.termsAccepted,
            is_whatsapp_allowed: formData.whatsappConsent,
            full_name: `${formData.firstName} ${formData.lastName}`
          }).eq('id', data.user.id);
        }

        setSuccessMsg('Kayıt başarılı! Lütfen e-posta adresinize gelen onay linkine tıklayın.');
        setMode('login');
      }
    } catch (error: any) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        const wait = 60;
        setRetryAfter(wait);
        setErrorMsg(`Çok fazla deneme yapıldı. ${wait} saniye sonra tekrar deneyin.`);
      } else {
        setErrorMsg(error.message || 'Bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryAfter > 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim(),
        {
          redirectTo: `${location.origin}/auth/callback?type=recovery`,
        }
      );
      if (error) throw error;
      setSuccessMsg(
        'Şifre sıfırlama e-postası gönderildi. Gelen kutunuzu (ve spam klasörünüzü) kontrol edin.'
      );
    } catch (error: any) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        const wait = 60;
        setRetryAfter(wait);
        setErrorMsg(`Çok fazla deneme yapıldı. ${wait} saniye sonra tekrar deneyin.`);
      } else {
        // Güvenlik: var olmayan e-posta da başarı göster (enumeration koruması)
        setSuccessMsg(
          'Şifre sıfırlama e-postası gönderildi. Gelen kutunuzu (ve spam klasörünüzü) kontrol edin.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "h-input";
  const labelClass = "h-label";

  const CheckboxCustom = ({ name, checked }: { name: string; checked: boolean }) => (
    <div className="relative flex items-center pt-0.5 shrink-0">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={handleChange}
        className="peer h-4 w-4 cursor-pointer appearance-none border border-[#B89947]/30 bg-white checked:border-[#B89947] checked:bg-[#B89947]"
      />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none">
        <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    </div>
  );

  return (
    <>
      <div className="bg-white border border-[#F3F4F6] p-8 w-full max-w-md mx-auto">

        {/* ── Şifremi Unuttum modu ── */}
        {mode === 'forgot-password' ? (
          <>
            {/* Başlık */}
            <div className="mb-8">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-[#9A9A9A] hover:text-[#B89947] transition-colors duration-200 mb-6 text-[8px] tracking-[0.2em] uppercase"
              >
                <ArrowLeft className="w-3 h-3" />
                Giriş Yap
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 border border-[#B89947]/40 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[#B89947]" />
                </div>
                <h2 className="font-serif text-[#1A1A1A] text-[13px] tracking-[0.1em]">
                  Şifremi Sıfırla
                </h2>
              </div>
              <p className="text-[#9A9A9A] text-[9px] tracking-[0.1em] leading-relaxed ml-11">
                Kayıtlı e-posta adresinizi girin. Şifre sıfırlama bağlantısı göndereceğiz.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className={labelClass}>E-posta *</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={inputClass}
                  placeholder="ornek@email.com"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 border border-red-200 bg-red-50 text-red-500 text-[9px] tracking-[0.1em] px-4 py-3">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{errorMsg}{retryAfter > 0 && ` (${retryAfter}s)`}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2 border border-[#B89947]/30 bg-[#B89947]/5 text-[#B89947]/80 text-[9px] tracking-[0.1em] px-4 py-3">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || retryAfter > 0 || !!successMsg}
                className="h-btn w-full mt-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {retryAfter > 0
                  ? `Bekleyin (${retryAfter}s)`
                  : successMsg
                  ? 'Gönderildi'
                  : 'Sıfırlama Bağlantısı Gönder'}
              </button>
            </form>
          </>
        ) : (
          <>
        {/* ── Giriş / Üye Ol sekmeleri ── */}
        <div className="flex mb-8 border-b border-[#F3F4F6]">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 pb-4 text-[9px] tracking-[0.3em] uppercase relative transition-colors duration-300 ${
              mode === 'login' ? 'text-[#B89947]' : 'text-[#9A9A9A] hover:text-[#4A4A4A]'
            }`}
          >
            Giriş Yap
            {mode === 'login' && <div className="absolute bottom-0 left-0 w-full h-px bg-[#B89947]" />}
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 pb-4 text-[9px] tracking-[0.3em] uppercase relative transition-colors duration-300 ${
              mode === 'register' ? 'text-[#B89947]' : 'text-[#9A9A9A] hover:text-[#4A4A4A]'
            }`}
          >
            Üye Ol
            {mode === 'register' && <div className="absolute bottom-0 left-0 w-full h-px bg-[#B89947]" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Ad *</label>
                  <input name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Soyad *</label>
                  <input name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cep Telefonu *</label>
                  <input name="phone" type="tel" required placeholder="05..." value={formData.phone} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Doğum Tarihi *</label>
                  <input name="birthDate" type="date" required value={formData.birthDate} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>E-posta *</label>
            <input name="email" type="email" required value={formData.email} onChange={handleChange} className={inputClass} />
          </div>

          <div className="relative">
            <label className={labelClass}>Şifre *</label>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={formData.password}
              onChange={handleChange}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-[#9A9A9A] hover:text-[#B89947] transition-colors duration-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Onay Kutuları */}
          {mode === 'register' && (
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <CheckboxCustom name="kvkkConsent" checked={formData.kvkkConsent} />
                <span className="text-[10px] text-[#767676] leading-relaxed">
                  Kişisel verilerimin{' '}
                  <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('kvkk'); }} className="text-[#B89947]/80 underline hover:text-[#B89947] transition-colors duration-200">
                    Aydınlatma Metni
                  </button>{' '}
                  kapsamında işlenmesine ve ticari ileti gönderilmesine izin veriyorum.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <CheckboxCustom name="termsAccepted" checked={formData.termsAccepted} />
                <span className="text-[10px] text-[#767676] leading-relaxed">
                  <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('terms'); }} className="text-[#B89947]/80 underline hover:text-[#B89947] transition-colors duration-200">
                    Kullanım Koşulları ve Üyelik Sözleşmesi
                  </button>'ni okudum ve kabul ediyorum.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <CheckboxCustom name="whatsappConsent" checked={formData.whatsappConsent} />
                <span className="text-[10px] text-[#767676] leading-relaxed">
                  <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('whatsapp'); }} className="text-[#B89947]/80 underline hover:text-[#B89947] transition-colors duration-200">
                    WhatsApp Bilgilendirme
                  </button>{' '}
                  metnini okudum, açık rıza veriyorum.
                </span>
              </label>
            </div>
          )}

          {/* Hata mesajı */}
          {errorMsg && (
            <div className="flex items-start gap-2 border border-red-200 bg-red-50 text-red-500 text-[9px] tracking-[0.1em] px-4 py-3">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{errorMsg}{retryAfter > 0 && ` (${retryAfter}s)`}</span>
            </div>
          )}

          {/* Başarı mesajı */}
          {successMsg && (
            <div className="flex items-start gap-2 border border-[#B89947]/30 bg-[#B89947]/5 text-[#B89947]/70 text-[9px] tracking-[0.1em] px-4 py-3">
              <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Şifremi Unuttum linki — sadece login modunda */}
          {mode === 'login' && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => setMode('forgot-password')}
                className="text-[8px] tracking-[0.15em] uppercase text-[#9A9A9A] hover:text-[#B89947] transition-colors duration-200"
              >
                Şifremi Unuttum
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || retryAfter > 0}
            className="h-btn w-full mt-4 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {retryAfter > 0 ? `Bekleyin (${retryAfter}s)` : mode === 'login' ? 'Giriş Yap' : 'Üye Ol'}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#F3F4F6]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[8px] text-[#9A9A9A] tracking-[0.3em] uppercase">veya</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-[#E5E7EB]
                       text-[#9CA3AF] text-[9px] tracking-[0.2em] uppercase py-3 bg-white
                       hover:border-black hover:text-black transition-colors duration-200"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
            Google ile {mode === 'login' ? 'Giriş Yap' : 'Devam Et'}
          </button>
        </form>
          </>
        )}
      </div>

      <LegalModal isOpen={activeModal === 'kvkk'} onClose={() => setActiveModal(null)} title="KVKK ve Ticari İleti İzni" content={LEGAL_TEXTS.kvkk} />
      <LegalModal isOpen={activeModal === 'terms'} onClose={() => setActiveModal(null)} title="Kullanım Koşulları ve Üyelik Sözleşmesi" content={LEGAL_TEXTS.terms} />
      <LegalModal isOpen={activeModal === 'whatsapp'} onClose={() => setActiveModal(null)} title="WhatsApp Bilgilendirme Rızası" content={LEGAL_TEXTS.whatsapp} />
    </>
  );
}
