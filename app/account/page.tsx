'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Loader2, Check, Trash2, AlertTriangle, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getProfile, updateProfile, updatePassword } from '@/lib/actions/user';
import { deleteMyAccount } from '@/lib/actions/account';

export default function AccountPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Şifre formu
  const [pwPassword, setPwPassword]   = useState('');
  const [pwConfirm, setPwConfirm]     = useState('');
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwError, setPwError]         = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]     = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const pwSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const result = await getProfile();
      if (result.success && result.data) {
        const nameParts = (result.data.full_name || '').trim().split(/\s+/);
        setFirstName(nameParts[0] || '');
        setLastName(nameParts.slice(1).join(' ') || '');
        setPhone(result.data.phone || '');
        setEmail(result.data.email || '');
      }
      setIsLoading(false);
    }
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const result = await updateProfile({
      full_name: fullName,
      phone: phone.trim(),
    });

    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Profil güncellenemedi');
    }

    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'HESABIMI SİL') return;
    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteMyAccount();

    if (!result.success) {
      setDeleteError(result.error || 'Hesap silinemedi.');
      setIsDeleting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    setPwSaving(true);

    const result = await updatePassword({ password: pwPassword, confirm: pwConfirm });

    if (result.success) {
      setPwSuccess(true);
      setPwPassword('');
      setPwConfirm('');
      if (pwSuccessTimer.current) clearTimeout(pwSuccessTimer.current);
      pwSuccessTimer.current = setTimeout(() => setPwSuccess(false), 4000);
    } else {
      setPwError(result.error || 'Şifre güncellenemedi');
    }

    setPwSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#B89947] animate-spin" />
      </div>
    );
  }

  const inputClass = "h-input";
  const labelClass = "flex items-center gap-2 text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-[#F3F4F6] p-6 bg-white">
        <h1 className="font-serif text-black text-xl tracking-[0.05em]">
          Kişisel Bilgilerim
        </h1>
        <p className="text-[#9CA3AF] text-[9px] tracking-[0.15em] mt-2">
          Hesap bilgilerinizi görüntüleyin ve güncelleyin.
        </p>
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-center gap-3 border border-[#B89947]/30 bg-[#FAFAFA] p-4">
          <Check className="w-4 h-4 text-[#B89947]/70 shrink-0" />
          <span className="text-[#B89947]/70 text-[9px] tracking-[0.2em] uppercase">
            Bilgileriniz başarıyla güncellendi.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-300 bg-red-50 p-4 text-red-600 text-[10px] tracking-[0.1em]">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="border border-[#F3F4F6] p-6 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ad */}
          <div>
            <label className={labelClass}>
              <User className="w-3 h-3 text-[#B89947]/50" />
              Ad *
            </label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} placeholder="Adınız" />
          </div>

          {/* Soyad */}
          <div>
            <label className={labelClass}>
              <User className="w-3 h-3 text-[#B89947]/50" />
              Soyad *
            </label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} placeholder="Soyadınız" />
          </div>

          {/* Telefon */}
          <div>
            <label className={labelClass}>
              <Phone className="w-3 h-3 text-[#B89947]/50" />
              Telefon
            </label>
            <div className="flex">
              <div className="flex items-center px-4 py-3 bg-[#F3F4F6] border border-r-0 border-[#F3F4F6] text-[#9CA3AF] text-[10px] tracking-[0.1em] shrink-0">
                TR +90
              </div>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} flex-1`} placeholder="555 555 55 55" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>
              <Mail className="w-3 h-3 text-[#B89947]/50" />
              E-posta
            </label>
            <input type="email" value={email} disabled className="w-full px-4 py-3 bg-[#F3F4F6] border border-[#F3F4F6] text-[#9CA3AF] text-[11px] tracking-[0.1em] cursor-not-allowed" />
            <p className="text-[#9CA3AF] text-[8px] tracking-[0.1em] mt-1.5">
              E-posta adresi değiştirilemez.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-8 pt-6 border-t border-[#F3F4F6]">
          <button
            type="submit"
            disabled={isSaving}
            className="h-btn disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              'Bilgilerimi Güncelle'
            )}
          </button>
        </div>
      </form>

      {/* Şifre Değiştir */}
      <form onSubmit={handlePasswordSubmit} className="border border-[#F3F4F6] p-6 bg-white space-y-6">
        {/* Başlık */}
        <div className="flex items-center gap-3 pb-5 border-b border-[#F3F4F6]">
          <div className="w-8 h-8 border border-[#B89947]/40 flex items-center justify-center shrink-0">
            <KeyRound className="w-3.5 h-3.5 text-[#B89947]" />
          </div>
          <div>
            <h2 className="font-serif text-black text-[13px] tracking-[0.08em]">
              Şifre Değiştir
            </h2>
            <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] mt-0.5">
              Google ile giriş yapan hesaplarda bu bölüm kullanılamaz.
            </p>
          </div>
        </div>

        {/* Başarı */}
        {pwSuccess && (
          <div className="flex items-center gap-3 border border-[#B89947]/30 bg-[#FAFAFA] p-4">
            <ShieldCheck className="w-4 h-4 text-[#B89947]/70 shrink-0" />
            <span className="text-[#B89947]/80 text-[9px] tracking-[0.2em] uppercase">
              Şifreniz başarıyla güncellendi.
            </span>
          </div>
        )}

        {/* Hata */}
        {pwError && (
          <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <span className="text-red-600 text-[9px] tracking-[0.1em]">{pwError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Yeni Şifre */}
          <div>
            <label className={labelClass}>
              <KeyRound className="w-3 h-3 text-[#B89947]/50" />
              Yeni Şifre *
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={pwPassword}
                onChange={(e) => setPwPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={`${inputClass} pr-10`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#B89947] transition-colors duration-200"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Kurallar */}
            {pwPassword.length > 0 && (
              <ul className="mt-2 space-y-1">
                {[
                  { ok: pwPassword.length >= 8,   text: 'En az 8 karakter' },
                  { ok: /[A-Z]/.test(pwPassword), text: 'En az bir büyük harf' },
                  { ok: /[0-9]/.test(pwPassword), text: 'En az bir rakam' },
                ].map(({ ok, text }) => (
                  <li key={text} className={`flex items-center gap-1.5 text-[8px] tracking-[0.1em] transition-colors duration-200 ${ok ? 'text-[#B89947]/80' : 'text-[#9CA3AF]'}`}>
                    <span className={`w-1 h-1 rounded-full shrink-0 ${ok ? 'bg-[#B89947]' : 'bg-[#CCCCCC]'}`} />
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Şifre Tekrar */}
          <div>
            <label className={labelClass}>
              <KeyRound className="w-3 h-3 text-[#B89947]/50" />
              Yeni Şifre (Tekrar) *
            </label>
            <div className="relative">
              <input
                type={showPwConfirm ? 'text' : 'password'}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className={`${inputClass} pr-10 ${pwConfirm && pwConfirm !== pwPassword ? 'border-red-300' : ''}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#B89947] transition-colors duration-200"
                tabIndex={-1}
              >
                {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwConfirm && pwConfirm !== pwPassword && (
              <p className="mt-1.5 text-red-500 text-[8px] tracking-[0.1em]">Şifreler eşleşmiyor</p>
            )}
            {pwConfirm && pwConfirm === pwPassword && pwPassword.length >= 8 && (
              <p className="mt-1.5 text-[#B89947]/70 text-[8px] tracking-[0.1em] flex items-center gap-1">
                <Check className="w-3 h-3" /> Şifreler eşleşiyor
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[#F3F4F6]">
          <button
            type="submit"
            disabled={pwSaving || pwPassword !== pwConfirm || pwPassword.length < 8}
            className="h-btn disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {pwSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
            ) : (
              'Şifremi Güncelle'
            )}
          </button>
        </div>
      </form>

      {/* Hesap Silme */}
      <div className="border border-red-200 p-6 bg-white">
        <h2 className="font-serif text-red-500/80 text-[11px] tracking-[0.2em] uppercase mb-2">
          Tehlikeli Bölge
        </h2>
        <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed mb-6">
          Hesabınızı kalıcı olarak silmek istiyorsanız aşağıdaki butona tıklayın.
          Bu işlem geri alınamaz. Kişisel verileriniz KVKK kapsamında işlenecektir.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowDeleteModal(true);
            setDeleteConfirmText('');
            setDeleteError(null);
          }}
          className="flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-500
                     hover:border-red-400 hover:bg-red-50 transition-colors duration-300
                     text-[9px] tracking-[0.2em] uppercase"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hesabımı Sil
        </button>
      </div>

      {/* Hesap Silme Onay Modalı */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-[#F3F4F6] w-full max-w-md p-6">
            {/* Başlık */}
            <div className="flex items-start gap-4 mb-6">
              <div className="shrink-0 w-9 h-9 border border-red-300 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="font-serif text-black text-[13px] tracking-[0.1em]">
                  Hesabı Kalıcı Olarak Sil
                </h3>
                <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] mt-1">
                  Bu işlem geri alınamaz.
                </p>
              </div>
            </div>

            {/* Açıklama */}
            <div className="border border-red-200 bg-red-50 p-4 mb-6 space-y-1.5">
              {[
                'Kişisel bilgileriniz (ad, telefon) silinecektir.',
                'Sipariş geçmişiniz anonim olarak saklanmaya devam edecektir.',
                'Aktif siparişiniz varsa hesabınız silinemez.',
              ].map((item, i) => (
                <p key={i} className="text-red-600/70 text-[9px] tracking-[0.1em]">• {item}</p>
              ))}
            </div>

            {/* Onay Girişi */}
            <div className="mb-4">
              <label className="block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2">
                Onaylamak için <span className="text-red-500">HESABIMI SİL</span> yazın:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="HESABIMI SİL"
                className="h-input font-mono"
              />
            </div>

            {/* Hata */}
            {deleteError && (
              <div className="border border-red-200 bg-red-50 p-3 mb-4 text-red-600 text-[10px] tracking-[0.1em]">
                {deleteError}
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 h-btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'HESABIMI SİL'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                           border border-red-300 text-red-500 text-[10px] tracking-[0.2em] uppercase
                           hover:bg-red-50 transition-colors duration-300
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Siliniyor...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Hesabı Sil
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
