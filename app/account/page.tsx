'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, Loader2, Check } from 'lucide-react';
import { getProfile, updateProfile } from '@/lib/actions/user';

export default function AccountPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Kişisel Bilgilerim
        </h1>
        <p className="text-elite-gray mt-1">
          Hesap bilgilerinizi görüntüleyin ve güncelleyin.
        </p>
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
          <Check className="w-5 h-5 flex-shrink-0" />
          Bilgileriniz başarıyla güncellendi.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ad */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 text-elite-gold" />
              Ad *
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg
                       focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                       transition-colors outline-none"
              placeholder="Adınız"
            />
          </div>

          {/* Soyad */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 text-elite-gold" />
              Soyad *
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg
                       focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                       transition-colors outline-none"
              placeholder="Soyadınız"
            />
          </div>

          {/* Telefon */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 text-elite-gold" />
              Telefon
            </label>
            <div className="flex">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg text-sm text-gray-600">
                <span>TR +90</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-r-lg
                         focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                         transition-colors outline-none"
                placeholder="555 555 55 55"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 text-elite-gold" />
              E-posta
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-3 border border-gray-200 rounded-lg
                       bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              E-posta adresi değiştirilemez.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-8 pt-6 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-elite-gold text-white rounded-lg
                     hover:bg-elite-gold/90 transition-colors font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              'Bilgilerimi Güncelle'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
