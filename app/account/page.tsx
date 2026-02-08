'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, Save, Loader2, CheckCircle } from 'lucide-react';
import { getProfile, updateProfile, UserProfile } from '@/lib/actions/user';

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      const result = await getProfile();

      if (result.success && result.data) {
        setProfile(result.data);
        setFullName(result.data.full_name || '');
        setPhone(result.data.phone || '');
      } else {
        setError(result.error || 'Profil yüklenemedi');
      }

      setIsLoading(false);
    }

    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const result = await updateProfile({
      full_name: fullName,
      phone: phone,
    });

    if (result.success) {
      setSuccess('Profiliniz başarıyla güncellendi!');
      setProfile(result.data);
    } else {
      setError(result.error || 'Profil güncellenemedi');
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-elite-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="font-serif text-2xl font-semibold text-elite-black">
          Profilim
        </h1>
        <p className="text-elite-gray mt-1">
          Kişisel bilgilerinizi buradan güncelleyebilirsiniz.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-600">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email (Read Only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              E-posta Adresi
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={profile?.email || ''}
                readOnly
                disabled
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                         bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              E-posta adresi değiştirilemez.
            </p>
          </div>

          {/* Full Name */}
          <div>
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
                         transition-colors outline-none"
                placeholder="Ad Soyad"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefon Numarası
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                         focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                         transition-colors outline-none"
                placeholder="0555 555 55 55"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-elite-gold text-white rounded-lg
                       hover:bg-elite-gold/90 transition-colors font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Değişiklikleri Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-elite-black mb-4">Hesap Bilgileri</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-elite-gray">Hesap Oluşturma</span>
            <span className="text-elite-black">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-elite-gray">Hesap Türü</span>
            <span className="text-elite-black">
              {profile?.role === 'ADMIN' ? 'Yönetici' : 'Müşteri'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
