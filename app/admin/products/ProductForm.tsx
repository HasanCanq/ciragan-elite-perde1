'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, X, Loader2, Save, ArrowLeft } from 'lucide-react';
import { createProduct, updateProduct, getCategories } from '@/lib/actions/products';
import { ProductWithCategory, Category } from '@/types';

const MAX_IMAGES = 3;

interface ProductFormProps {
  initialData?: ProductWithCategory | null;
}

export default function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    short_description: initialData?.short_description || '',
    description: initialData?.description || '',
    base_price: initialData?.base_price || 0,
    category_id: initialData?.category_id || '',
    in_stock: initialData?.in_stock ?? true,
    is_published: initialData?.is_published ?? false,
  });

  // Çoklu Resim State'i (3 slot)
  const existingUrls = initialData?.images || [];
  const [slots, setSlots] = useState<Array<{ type: 'existing'; url: string } | { type: 'new'; file: File; preview: string } | null>>(() => {
    const initial: Array<{ type: 'existing'; url: string } | { type: 'new'; file: File; preview: string } | null> = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      if (existingUrls[i]) {
        initial.push({ type: 'existing', url: existingUrls[i] });
      } else {
        initial.push(null);
      }
    }
    return initial;
  });

  useEffect(() => {
    const loadCategories = async () => {
      const res = await getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    };
    loadCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleImageSelect = (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır.');
      e.target.value = '';
      return;
    }

    const preview = URL.createObjectURL(file);
    setSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { type: 'new', file, preview };
      return next;
    });
  };

  const handleRemoveImage = (slotIndex: number) => {
    setSlots(prev => {
      const next = [...prev];
      const slot = next[slotIndex];
      if (slot?.type === 'new') {
        URL.revokeObjectURL(slot.preview);
      }
      next[slotIndex] = null;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('short_description', formData.short_description);
      data.append('description', formData.description);
      data.append('base_price', formData.base_price.toString());
      data.append('category_id', formData.category_id);
      data.append('in_stock', String(formData.in_stock));
      data.append('is_published', String(formData.is_published));

      // Çoklu resim: her slot için yeni dosya veya mevcut URL gönder
      const keptExistingUrls: string[] = [];
      let newImageIndex = 0;

      for (let i = 0; i < MAX_IMAGES; i++) {
        const slot = slots[i];
        if (!slot) continue;

        if (slot.type === 'existing') {
          keptExistingUrls.push(slot.url);
        } else if (slot.type === 'new') {
          data.append(`image_${newImageIndex}`, slot.file);
          data.append(`image_${newImageIndex}_slot`, String(keptExistingUrls.length + newImageIndex));
          newImageIndex++;
        }
      }

      data.append('existing_images', JSON.stringify(keptExistingUrls));

      let result;
      if (initialData) {
        result = await updateProduct(initialData.id, data);
      } else {
        result = await createProduct(data);
      }

      if (result.success) {
        alert(initialData ? 'Ürün güncellendi!' : 'Ürün oluşturuldu!');
        router.push('/admin/products');
        router.refresh();
      } else {
        alert('Hata: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Beklenmedik bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Başlık */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {initialData ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* SOL TARAF (Görseller ve Durum) */}
          <div className="lg:col-span-1 space-y-6">

            {/* Çoklu Görsel Yükleme (3 Slot) */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Ürün Görselleri ({slots.filter(Boolean).length}/{MAX_IMAGES})
              </label>

              <div className="space-y-3">
                {slots.map((slot, index) => (
                  <div key={index} className="relative">
                    {/* Slot numarası */}
                    <span className="absolute -top-2 -left-2 z-10 w-6 h-6 bg-elite-brown text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </span>

                    {slot ? (
                      <div className="relative aspect-[4/3] bg-gray-50 rounded-lg overflow-hidden group border border-gray-200">
                        <Image
                          src={slot.type === 'existing' ? slot.url : slot.preview}
                          alt={`Görsel ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        {/* Overlay: Sil butonu */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        {index === 0 && (
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-elite-brown text-white text-[10px] rounded font-medium">
                            Ana Görsel
                          </span>
                        )}
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-[4/3] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-elite-brown hover:bg-gray-100 transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">
                          {index === 0 ? 'Ana Görsel Yükle' : `Görsel ${index + 1} Yükle`}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageSelect(index, e)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Durumlar */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Yayın Durumu</h3>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <span className="text-sm text-gray-700">Yayında</span>
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => handleToggle('is_published', e.target.checked)}
                  className="w-4 h-4 text-elite-brown rounded border-gray-300 focus:ring-elite-brown"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <span className="text-sm text-gray-700">Stokta Var</span>
                <input
                  type="checkbox"
                  checked={formData.in_stock}
                  onChange={(e) => handleToggle('in_stock', e.target.checked)}
                  className="w-4 h-4 text-elite-brown rounded border-gray-300 focus:ring-elite-brown"
                />
              </label>
            </div>
          </div>

          {/* SAĞ TARAF (Detaylar) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

              {/* Ürün Adı */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Adı</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Örn: Kadife Fon Perde"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown"
                />
              </div>

              {/* Kısa Açıklama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kısa Açıklama</label>
                <input
                  type="text"
                  name="short_description"
                  value={formData.short_description}
                  onChange={handleChange}
                  placeholder="Ürün kartlarında görünecek kısa açıklama"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown"
                />
              </div>

              {/* Fiyat ve Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fiyat (TL)</label>
                  <input
                    type="number"
                    name="base_price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.base_price}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <select
                    name="category_id"
                    required
                    value={formData.category_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown bg-white"
                  >
                    <option value="">Seçiniz</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                <textarea
                  name="description"
                  rows={6}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Ürün özelliklerini buraya yazın..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown resize-none"
                />
              </div>

            </div>

            {/* Kaydet Butonu */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-elite-brown text-white px-8 py-3 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {initialData ? 'Değişiklikleri Kaydet' : 'Ürünü Oluştur'}
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
