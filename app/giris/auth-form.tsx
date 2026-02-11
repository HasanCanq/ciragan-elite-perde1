'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, X } from 'lucide-react';

// --- ALT BİLEŞEN: AÇILIR PENCERE (MODAL) ---
const LegalModal = ({ title, content, isOpen, onClose }: { title: string, content: React.ReactNode, isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Başlık */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        {/* İçerik */}
        <div className="p-6 max-h-[60vh] overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-4">
          {content}
        </div>
        {/* Alt Kısım */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-elite-brown text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium">
            Okudum, Anladım
          </button>
        </div>
      </div>
    </div>
  );
};

// --- TASLAK METİNLER (İleride güncelleyebilirsin) ---
const LEGAL_TEXTS = {
  kvkk: (
    <>
      <p><strong>1. Veri Sorumlusu:</strong> Çırağan Elite Perde olarak kişisel verilerinizin güvenliğine önem veriyoruz.</p>
      <p><strong>2. İşlenen Veriler:</strong> Ad, soyad, e-posta, telefon ve adres bilgileriniz hizmet kalitesini artırmak amacıyla işlenmektedir.</p>
      <p><strong>3. Veri Aktarımı:</strong> Verileriniz, yasal zorunluluklar haricinde ve açık rızanız olmaksızın üçüncü kişilerle paylaşılmamaktadır.</p>
      <p>Ticari elektronik ileti izni kapsamında; kampanyalar, indirimler ve yeni ürünler hakkında size e-posta veya SMS yoluyla ulaşmamıza izin vermiş olursunuz.</p>
    </>
  ),
  terms: (
    <>
      <p><strong>Madde 1 - Taraflar:</strong> İşbu sözleşme Çırağan Elite Perde ile üye olan kullanıcı arasındadır.</p>
      <p><strong>Madde 2 - Konu:</strong> İşbu sözleşmenin konusu, kullanıcının internet sitesinden faydalanma şartlarının belirlenmesidir.</p>
      <p><strong>Madde 3 - Üyenin Yükümlülükleri:</strong> Üye, kayıt olurken verdiği bilgilerin doğruluğunu taahhüt eder. Yanlış bilgi verilmesi durumunda doğacak zararlardan üye sorumludur.</p>
      <p><strong>Madde 4 - Gizlilik:</strong> Üyenin şifre güvenliği kendi sorumluluğundadır.</p>
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
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Hangi modal açık?
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
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        router.refresh();
        router.push('/');
      } else {
        if (!formData.termsAccepted) {
          alert('Lütfen Üyelik Sözleşmesi\'ni kabul ediniz.');
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

        alert('Kayıt başarılı! Lütfen e-posta adresinize gelen onay linkine tıklayın.');
        setMode('login');
      }
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md mx-auto">
        {/* Üst Sekmeler */}
        <div className="flex mb-8 border-b border-gray-100">
          <button onClick={() => setMode('login')} className={`flex-1 pb-4 text-sm font-semibold transition-colors relative ${mode === 'login' ? 'text-elite-brown' : 'text-gray-400 hover:text-gray-600'}`}>
            Giriş Yap
            {mode === 'login' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-elite-brown rounded-t-full" />}
          </button>
          <button onClick={() => setMode('register')} className={`flex-1 pb-4 text-sm font-semibold transition-colors relative ${mode === 'register' ? 'text-elite-brown' : 'text-gray-400 hover:text-gray-600'}`}>
            Üye Ol
            {mode === 'register' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-elite-brown rounded-t-full" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ad *</label>
                  <input name="firstName" required value={formData.firstName} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Soyad *</label>
                  <input name="lastName" required value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cep Telefonu *</label>
                  <input name="phone" type="tel" required placeholder="05..." value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Doğum Tarihi *</label>
                  <input name="birthDate" type="date" required value={formData.birthDate} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown outline-none" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">E-posta *</label>
            <input name="email" type="email" required value={formData.email} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown outline-none" />
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">Şifre *</label>
            <input name="password" type={showPassword ? "text" : "password"} required minLength={6} value={formData.password} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown outline-none" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* ONAY KUTULARI (PROFESYONEL VERSİYON) */}
          {mode === 'register' && (
            <div className="space-y-3 pt-2">
              
              {/* 1. KVKK ve Ticari İleti */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center pt-0.5">
                  <input type="checkbox" name="kvkkConsent" checked={formData.kvkkConsent} onChange={handleChange} className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 shadow checked:border-elite-brown checked:bg-elite-brown" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 leading-tight">
                  Kişisel verilerimin <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('kvkk'); }} className="text-elite-brown underline hover:text-elite-gold font-medium">Aydınlatma Metni</button> kapsamında işlenmesine ve Çırağan Elite Perde'nin kampanya vb. konularda şahsıma ticari ileti göndermesine izin veriyorum.
                </span>
              </label>

              {/* 2. Sözleşme Onayı */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center pt-0.5">
                  <input type="checkbox" name="termsAccepted" checked={formData.termsAccepted} onChange={handleChange} required className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 shadow checked:border-elite-brown checked:bg-elite-brown" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 leading-tight">
                  <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('terms'); }} className="text-elite-brown underline hover:text-elite-gold font-medium">Kullanım Koşulları ve Üyelik Sözleşmesi</button>'ni okudum ve kabul ediyorum.
                </span>
              </label>

              {/* 3. WhatsApp Onayı */}
              <label className="flex items-start gap-3 cursor-pointer group">
                 <div className="relative flex items-center pt-0.5">
                  <input type="checkbox" name="whatsappConsent" checked={formData.whatsappConsent} onChange={handleChange} className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 shadow checked:border-elite-brown checked:bg-elite-brown" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 leading-tight">
                  <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('whatsapp'); }} className="text-elite-brown underline hover:text-elite-gold font-medium">WhatsApp Bilgilendirme</button> metnini okudum, açık rıza veriyorum.
                </span>
              </label>

            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-elite-brown text-white py-3 rounded-lg hover:bg-opacity-90 transition-all font-medium flex items-center justify-center gap-2 mt-4">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Giriş Yap' : 'Üye Ol'}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">veya</span></div>
          </div>

          <button type="button" onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-all font-medium">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Google ile {mode === 'login' ? 'Giriş Yap' : 'Devam Et'}
          </button>
        </form>
      </div>

      {/* MODALLAR */}
      <LegalModal 
        isOpen={activeModal === 'kvkk'} 
        onClose={() => setActiveModal(null)} 
        title="KVKK ve Ticari İleti İzni" 
        content={LEGAL_TEXTS.kvkk} 
      />
      <LegalModal 
        isOpen={activeModal === 'terms'} 
        onClose={() => setActiveModal(null)} 
        title="Kullanım Koşulları ve Üyelik Sözleşmesi" 
        content={LEGAL_TEXTS.terms} 
      />
      <LegalModal 
        isOpen={activeModal === 'whatsapp'} 
        onClose={() => setActiveModal(null)} 
        title="WhatsApp Bilgilendirme Rızası" 
        content={LEGAL_TEXTS.whatsapp} 
      />
    </>
  );
}