'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Star,
  Loader2,
  X,
  Phone,
  User,
  Home,
  Building,
} from 'lucide-react';
import {
  getAddresses,
  addAddress,
  deleteAddress,
  setDefaultAddress,
  Address,
  AddressInsert,
} from '@/lib/actions/user';

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<AddressInsert>({
    title: '',
    full_name: '',
    phone: '',
    address_line: '',
    city: '',
    district: '',
    postal_code: '',
    is_default: false,
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    setIsLoading(true);
    const result = await getAddresses();

    if (result.success && result.data) {
      setAddresses(result.data);
    } else {
      setError(result.error || 'Adresler yüklenemedi');
    }

    setIsLoading(false);
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await addAddress(formData);

    if (result.success && result.data) {
      setAddresses((prev) => [result.data!, ...prev]);
      setShowModal(false);
      resetForm();
    } else {
      setError(result.error || 'Adres eklenemedi');
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (addressId: string) => {
    setActionLoading(addressId);
    const result = await deleteAddress(addressId);

    if (result.success) {
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      setDeleteConfirm(null);
    } else {
      alert(result.error || 'Adres silinemedi');
    }

    setActionLoading(null);
  };

  const handleSetDefault = async (addressId: string) => {
    setActionLoading(addressId);
    const result = await setDefaultAddress(addressId);

    if (result.success) {
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: a.id === addressId,
        }))
      );
    } else {
      alert(result.error || 'Varsayılan adres ayarlanamadı');
    }

    setActionLoading(null);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      full_name: '',
      phone: '',
      address_line: '',
      city: '',
      district: '',
      postal_code: '',
      is_default: false,
    });
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
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-elite-black">
            Adreslerim
          </h1>
          <p className="text-elite-gray mt-1">
            Kayıtlı adreslerinizi yönetin.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-elite-gold text-white rounded-lg
                   hover:bg-elite-gold/90 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Yeni Adres Ekle
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Addresses List */}
      {addresses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <MapPin className="w-16 h-16 text-elite-gray/30 mx-auto mb-4" />
          <h2 className="font-serif text-xl font-semibold text-elite-black mb-2">
            Henüz Adres Yok
          </h2>
          <p className="text-elite-gray mb-6">
            Siparişlerinizde kullanmak için adres ekleyin.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-elite-gold text-white rounded-lg
                     hover:bg-elite-gold/90 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            İlk Adresinizi Ekleyin
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`bg-white rounded-xl shadow-sm p-6 relative ${
                address.is_default ? 'ring-2 ring-elite-gold' : ''
              }`}
            >
              {/* Default Badge */}
              {address.is_default && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-elite-gold/10 text-elite-gold text-xs font-medium rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    Varsayılan
                  </span>
                </div>
              )}

              {/* Address Title */}
              <div className="flex items-center gap-2 mb-3">
                {address.title.toLowerCase().includes('ev') ? (
                  <Home className="w-5 h-5 text-elite-gold" />
                ) : (
                  <Building className="w-5 h-5 text-elite-gold" />
                )}
                <h3 className="font-semibold text-elite-black">{address.title}</h3>
              </div>

              {/* Address Details */}
              <div className="space-y-2 text-sm text-elite-gray mb-4">
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {address.full_name}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {address.phone}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {address.address_line}, {address.district}/{address.city}
                    {address.postal_code && ` - ${address.postal_code}`}
                  </span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                {!address.is_default && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    disabled={actionLoading === address.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-elite-gold
                             hover:bg-elite-gold/10 rounded-lg transition-colors"
                  >
                    {actionLoading === address.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )}
                    Varsayılan Yap
                  </button>
                )}

                {deleteConfirm === address.id ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => handleDelete(address.id)}
                      disabled={actionLoading === address.id}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg
                               hover:bg-red-600 transition-colors"
                    >
                      {actionLoading === address.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Sil'
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-600 rounded-lg
                               hover:bg-gray-300 transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(address.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600
                             hover:bg-red-50 rounded-lg transition-colors ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Sil
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Address Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-serif text-xl font-semibold text-elite-black">
                Yeni Adres Ekle
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres Başlığı *
                </label>
                <select
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg
                           focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                           transition-colors outline-none"
                >
                  <option value="">Seçiniz</option>
                  <option value="Ev">Ev</option>
                  <option value="İş">İş</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alıcı Adı Soyadı *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg
                           focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                           transition-colors outline-none"
                  placeholder="Ad Soyad"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Numarası *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg
                           focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                           transition-colors outline-none"
                  placeholder="0555 555 55 55"
                />
              </div>

              {/* City & District */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İl *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                    placeholder="İstanbul"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İlçe *
                  </label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                    placeholder="Kadıköy"
                  />
                </div>
              </div>

              {/* Address Line */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açık Adres *
                </label>
                <textarea
                  name="address_line"
                  value={formData.address_line}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg
                           focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                           transition-colors outline-none resize-none"
                  placeholder="Mahalle, Sokak, Bina No, Daire No"
                />
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Posta Kodu
                </label>
                <input
                  type="text"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg
                           focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                           transition-colors outline-none"
                  placeholder="34000"
                />
              </div>

              {/* Default Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_default"
                  checked={formData.is_default}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-elite-gold border-gray-300 rounded focus:ring-elite-gold"
                />
                <span className="text-sm text-gray-700">
                  Varsayılan adres olarak kaydet
                </span>
              </label>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-elite-gold text-white rounded-lg
                           hover:bg-elite-gold/90 transition-colors font-medium
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Adres Ekle
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
