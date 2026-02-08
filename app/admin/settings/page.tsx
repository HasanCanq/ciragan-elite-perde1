'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Loader2, AlertTriangle } from 'lucide-react';
import { getSettings, updateSettings, StoreSettings } from '@/lib/actions/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [siteName, setSiteName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsFetching(true);
    const result = await getSettings();

    if (result.success && result.data) {
      const s = result.data;
      setSettings(s);
      setSiteName(s.site_name);
      setSupportEmail(s.support_email);
      setSupportPhone(s.support_phone);
      setFreeShippingThreshold(s.free_shipping_threshold.toString());
      setShippingCost(s.shipping_cost.toString());
      setMaintenanceMode(s.maintenance_mode);
      setMaintenanceMessage(s.maintenance_message || '');
    } else {
      setError('Ayarlar yüklenemedi');
    }

    setIsFetching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateSettings({
        site_name: siteName,
        support_email: supportEmail,
        support_phone: supportPhone,
        free_shipping_threshold: parseFloat(freeShippingThreshold),
        shipping_cost: parseFloat(shippingCost),
        maintenance_mode: maintenanceMode,
        maintenance_message: maintenanceMessage || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Ayarlar güncellenemedi');
      }

      setSuccess('Ayarlar başarıyla güncellendi!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-elite-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-elite-gold/20 rounded-xl flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-elite-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mağaza Ayarları</h1>
          <p className="text-gray-500 mt-1">Genel mağaza ayarlarını yönetin</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600">
          {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Temel Bilgiler
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Adı *
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destek E-postası *
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destek Telefonu *
                  </label>
                  <input
                    type="tel"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Kargo Ayarları
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ücretsiz Kargo Eşiği (TL) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={freeShippingThreshold}
                      onChange={(e) => setFreeShippingThreshold(e.target.value)}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-lg
                               focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                               transition-colors outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      TL
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Bu tutarın üzerindeki siparişler için kargo ücretsiz olacaktır
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Standart Kargo Ücreti (TL) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-lg
                               focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                               transition-colors outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      TL
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Maintenance Mode */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Bakım Modu
              </h2>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="mt-1 w-5 h-5 text-elite-gold border-gray-300 rounded focus:ring-elite-gold"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">Bakım Modunu Etkinleştir</p>
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Etkinleştirildiğinde site ziyaretçilere kapalı olacaktır
                    </p>
                  </div>
                </label>

                {maintenanceMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bakım Mesajı
                    </label>
                    <textarea
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      rows={3}
                      placeholder="Ziyaretçilere gösterilecek mesaj..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg
                               focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                               transition-colors outline-none resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Settings Info */}
            <div className="bg-elite-bone rounded-xl p-6">
              <h3 className="font-medium text-gray-900 mb-4">Mevcut Ayarlar</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Son Güncelleme</p>
                  <p className="font-medium text-gray-900">
                    {settings?.updated_at
                      ? new Date(settings.updated_at).toLocaleString('tr-TR')
                      : '-'}
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-gray-500">Durum</p>
                  <p className="font-medium text-gray-900">
                    {maintenanceMode ? (
                      <span className="text-orange-600">Bakım Modunda</span>
                    ) : (
                      <span className="text-green-600">Aktif</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3
                       bg-elite-gold text-white rounded-lg hover:bg-elite-gold/90
                       transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Ayarları Kaydet
                </>
              )}
            </button>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-900">Dikkat</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Bu ayarlar tüm mağazayı etkiler. Değişiklik yapmadan önce emin olun.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
