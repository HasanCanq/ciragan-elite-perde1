'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

// ── Validasyon şeması ────────────────────────────────────────────────────────

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Şifre en az 8 karakter olmalıdır')
      .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermelidir')
      .regex(/[0-9]/, 'Şifre en az bir rakam içermelidir'),
    confirm: z.string().min(1, 'Şifreyi tekrar girin'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Şifreler eşleşmiyor',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

// ── Şifre gücü göstergesi ────────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 12,
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Çok Zayıf', 'Zayıf', 'Orta', 'Güçlü', 'Çok Güçlü'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 transition-all duration-300"
            style={{ backgroundColor: i < score ? colors[score] : '#e5e7eb' }}
          />
        ))}
      </div>
      <p className="text-[8px] tracking-[0.15em]" style={{ color: colors[score] }}>
        {labels[score]}
      </p>
    </div>
  );
}

// ── Ana bileşen ──────────────────────────────────────────────────────────────

export default function SifreYenilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession]         = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [serverError, setServerError]       = useState<string | null>(null);
  const [success, setSuccess]               = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const passwordValue = watch('password', '');

  // ── Oturum kontrolü ────────────────────────────────────────────────────────
  // Callback route zaten exchangeCodeForSession yaptı; burada sadece
  // gerçekten bir session var mı diye doğruluyoruz.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
      } else {
        // Session yok → giriş sayfasına yönlendir
        router.replace('/giris?error=session_expired');
      }
      setSessionChecked(true);
    });
  }, []);

  // ── Form submit ────────────────────────────────────────────────────────────
  const onSubmit = async ({ password }: FormValues) => {
    setServerError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setServerError(error.message || 'Şifre güncellenemedi. Lütfen tekrar deneyin.');
      return;
    }

    setSuccess(true);

    // Session'ı temizle (güvenlik: sıfırlama tokenı artık geçersiz)
    await supabase.auth.signOut();

    setTimeout(() => router.replace('/giris'), 3000);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#B89947] animate-spin" />
      </div>
    );
  }

  if (!hasSession) return null; // redirect zaten tetiklendi

  const labelClass = 'block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2';
  const inputClass = 'h-input';

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center py-12 px-4">
      {/* Logo */}
      <Link
        href="/"
        className="font-serif text-2xl text-black tracking-[0.15em] mb-10 hover:text-[#B89947] transition-colors duration-300"
      >
        Hanedan
      </Link>

      <div className="bg-white border border-[#F3F4F6] p-8 w-full max-w-md">

        {/* Başlık */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#F3F4F6]">
          <div className="w-9 h-9 border border-[#B89947]/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#B89947]" />
          </div>
          <div>
            <h1 className="font-serif text-black text-[14px] tracking-[0.1em]">
              Yeni Şifre Belirle
            </h1>
            <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] mt-0.5">
              Hesabınız için güçlü bir şifre oluşturun.
            </p>
          </div>
        </div>

        {/* Başarı durumu */}
        {success ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 border border-[#B89947]/30 bg-[#FAFAFA] p-4">
              <CheckCircle className="w-4 h-4 text-[#B89947] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#B89947]/90 text-[9px] tracking-[0.15em] uppercase font-medium mb-1">
                  Şifreniz Güncellendi
                </p>
                <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                  3 saniye içinde giriş sayfasına yönlendirileceksiniz.
                </p>
              </div>
            </div>
            <Link
              href="/giris"
              className="h-btn w-full flex items-center justify-center gap-2 text-center"
            >
              Giriş Yap
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Sunucu hatası */}
            {serverError && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 text-red-500 text-[9px] tracking-[0.1em] px-4 py-3">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Yeni Şifre */}
            <div>
              <label className={labelClass}>Yeni Şifre *</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputClass} pr-10 ${errors.password ? 'border-red-300 focus:border-red-400' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#B89947] transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-red-500 text-[8px] tracking-[0.1em]">
                  {errors.password.message}
                </p>
              )}
              <StrengthBar password={passwordValue} />
            </div>

            {/* Şifre Tekrar */}
            <div>
              <label className={labelClass}>Yeni Şifre (Tekrar) *</label>
              <div className="relative">
                <input
                  {...register('confirm')}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputClass} pr-10 ${errors.confirm ? 'border-red-300 focus:border-red-400' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#B89947] transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm && (
                <p className="mt-1.5 text-red-500 text-[8px] tracking-[0.1em]">
                  {errors.confirm.message}
                </p>
              )}
            </div>

            {/* Şifre kuralları */}
            <ul className="space-y-1 pt-1">
              {[
                { ok: passwordValue.length >= 8,     text: 'En az 8 karakter' },
                { ok: /[A-Z]/.test(passwordValue),   text: 'En az bir büyük harf' },
                { ok: /[0-9]/.test(passwordValue),   text: 'En az bir rakam' },
              ].map(({ ok, text }) => (
                <li key={text} className={`flex items-center gap-2 text-[8px] tracking-[0.1em] transition-colors duration-200 ${
                  ok ? 'text-[#B89947]/80' : 'text-[#9CA3AF]'
                }`}>
                  <span className={`w-1 h-1 rounded-full shrink-0 transition-colors duration-200 ${ok ? 'bg-[#B89947]' : 'bg-[#CCCCCC]'}`} />
                  {text}
                </li>
              ))}
            </ul>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-btn w-full mt-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
              ) : (
                'Şifremi Güncelle'
              )}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
