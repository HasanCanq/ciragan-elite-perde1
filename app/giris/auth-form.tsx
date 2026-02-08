'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  LogIn,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'register';

export default function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push(redirectTo);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        setSuccess(
          'Kayıt başarılı! Lütfen e-posta adresinizi kontrol edin ve hesabınızı doğrulayın.'
        );
        setMode('login');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-elite-bone via-white to-elite-bone/50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="block text-center mb-8">
          <span className="font-serif text-3xl font-semibold text-elite-black">
            Çırağan Elite
          </span>
          <p className="text-elite-gray mt-1 text-sm">Premium Perde Koleksiyonu</p>
        </Link>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-elite overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${
                mode === 'login'
                  ? 'text-elite-gold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Giriş Yap
              {mode === 'login' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-elite-gold" />
              )}
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${
                mode === 'register'
                  ? 'text-elite-gold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Kayıt Ol
              {mode === 'register' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-elite-gold" />
              )}
            </button>
          </div>

          {/* Form Content */}
          <div className="p-8">
            <h1 className="font-serif text-2xl font-semibold text-elite-black text-center mb-2">
              {mode === 'login' ? 'Hoş Geldiniz' : 'Hesap Oluşturun'}
            </h1>
            <p className="text-elite-gray text-center mb-8">
              {mode === 'login'
                ? 'Hesabınıza giriş yapın'
                : 'Yeni bir hesap oluşturun'}
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-500 text-xs font-bold">!</span>
                </div>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name (Register only) */}
              {mode === 'register' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Soyad
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                               focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                               transition-all outline-none"
                      placeholder="Ad Soyad"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-all outline-none"
                    placeholder="ornek@email.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-all outline-none"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs text-gray-500 mt-1">
                    En az 6 karakter olmalıdır
                  </p>
                )}
              </div>

              {/* Forgot Password (Login only) */}
              {mode === 'login' && (
                <div className="text-right">
                  <Link
                    href="/sifremi-unuttum"
                    className="text-sm text-elite-gold hover:underline"
                  >
                    Şifremi Unuttum
                  </Link>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3
                         bg-elite-gold text-white rounded-lg hover:bg-elite-gold/90
                         transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-elite-gold/25"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Register Benefits (Register only) */}
            {mode === 'register' && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 text-center mb-4">
                  Üyelik avantajları
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-elite-gold" />
                    <span>Sipariş takibi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-elite-gold" />
                    <span>Özel indirimler</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-elite-gold" />
                    <span>Hızlı ödeme</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-elite-gold" />
                    <span>Favori listeleri</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-elite-gold transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
