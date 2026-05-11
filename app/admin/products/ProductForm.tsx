'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, X, Loader2, Save, ArrowLeft } from 'lucide-react';
import { createProduct, updateProduct, getCategories, getCurtainModels } from '@/lib/actions/products';
import { ProductWithCategory, Category } from '@/types';
import { compressImage } from '@/lib/utils/image-compress';

const MAX_IMAGES = 3;

interface ProductFormProps {
  initialData?: ProductWithCategory | null;
}

export default function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [curtainModels, setCurtainModels] = useState<{ id: string; name: string; slug: string }[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    short_description: initialData?.short_description || '',
    description: initialData?.description || '',
    base_price: initialData?.base_price || 0,
    category_id: initialData?.category_id || '',
    in_stock: initialData?.in_stock ?? true,
    is_published: initialData?.is_published ?? false,
    // Metretül cinsinden stok (ondalıklı)
    stock_quantity: (initialData as any)?.stock_quantity ?? 0,
    low_stock_threshold: (initialData as any)?.low_stock_threshold ?? 5,
    // Birim maliyet ₺/m² — DB'de henüz yok (base_cost sütunu ileride eklenecek)
    base_cost: (initialData as any)?.base_cost ?? 0,
    model_id: (initialData as any)?.model_id || '',
    calculation_type: (initialData as any)?.calculation_type || 'adet',
  });

  const [fabricProperties, setFabricProperties] = useState<string[]>(
    (initialData as any)?.fabric_properties ?? []
  );
  const [fabricInput, setFabricInput] = useState('');

  const addFabricProperty = () => {
    const val = fabricInput.trim();
    if (val && !fabricProperties.includes(val)) {
      setFabricProperties(prev => [...prev, val]);
    }
    setFabricInput('');
  };

  const removeFabricProperty = (index: number) => {
    setFabricProperties(prev => prev.filter((_, i) => i !== index));
  };

  const handleFabricKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFabricProperty();
    }
  };

  const [compressing, setCompressing] = useState(false);

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
    const loadData = async () => {
      const [catRes, modelRes] = await Promise.all([getCategories(), getCurtainModels()]);
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (modelRes.success && modelRes.data) setCurtainModels(modelRes.data);
    };
    loadData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleImageSelect = async (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10 MB üzeri hard limit — compress fonksiyonu da kontrol eder ama erken uyar
    if (file.size > 10 * 1024 * 1024) {
      alert('Dosya çok büyük. Maksimum 10 MB yüklenebilir.');
      e.target.value = '';
      return;
    }

    setCompressing(true);
    try {
      // Canvas API ile WebP'e dönüştür, max 1200×900, %80 kalite
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);

      setSlots(prev => {
        const next = [...prev];
        next[slotIndex] = { type: 'new', file: compressed, preview };
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Görsel işlenemedi.');
      e.target.value = '';
    } finally {
      setCompressing(false);
    }
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
      data.append('calculation_type', formData.calculation_type);
      data.append('stock_quantity', parseFloat(String(formData.stock_quantity)).toFixed(2));
      if (formData.model_id) data.append('model_id', formData.model_id);
      data.append('low_stock_threshold', parseFloat(String(formData.low_stock_threshold)).toFixed(2));
      data.append('fabric_properties', JSON.stringify(fabricProperties));
      // base_cost: DB sütunu henüz yok — şimdilik sadece loglanır, backend yoksayar
      const baseCost = parseFloat(String(formData.base_cost));
      if (!isNaN(baseCost) && baseCost > 0) {
        data.append('base_cost', baseCost.toFixed(2));
        console.log('[ProductForm] base_cost gönderildi (DB ready olmayınca logda kalır):', baseCost);
      }

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
          className="p-2 hover:bg-gray-100 text-gray-600 transition-colors"
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
            <div className="bg-white p-6 rounded-xl border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Ürün Görselleri ({slots.filter(Boolean).length}/{MAX_IMAGES})
              </label>

              <div className="space-y-3">
                {slots.map((slot, index) => (
                  <div key={index} className="relative">
                    {/* Slot numarası */}
                    <span className="absolute -top-2 -left-2 z-10 w-6 h-6 bg-[#B89947] text-white text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </span>

                    {slot ? (
                      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden group border border-gray-200">
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
                            className="p-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        {index === 0 && (
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-[#B89947] text-white text-[10px] rounded font-medium">
                            Ana Görsel
                          </span>
                        )}
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-300 cursor-pointer hover:border-[#B89947] hover:bg-gray-100 transition-colors">
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
            <div className="bg-white p-6 rounded-xl border border-gray-100 space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Yayın Durumu</h3>

              <label className="flex items-center justify-between p-3 border border-gray-200 cursor-pointer hover:bg-gray-50">
                <span className="text-sm text-gray-700">Yayında</span>
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => handleToggle('is_published', e.target.checked)}
                  className="w-4 h-4 text-[#B89947] rounded border-gray-300 focus:ring-[#B89947]"
                />
              </label>

              <label className="flex items-center justify-between p-3 border border-gray-200 cursor-pointer hover:bg-gray-50">
                <span className="text-sm text-gray-700">Stokta Var</span>
                <input
                  type="checkbox"
                  checked={formData.in_stock}
                  onChange={(e) => handleToggle('in_stock', e.target.checked)}
                  className="w-4 h-4 text-[#B89947] rounded border-gray-300 focus:ring-[#B89947]"
                />
              </label>
            </div>
          </div>

          {/* SAĞ TARAF (Detaylar) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 space-y-6">

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
                  className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]"
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
                  className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]"
                />
              </div>

              {/* Fiyat ve Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                  Satış Fiyatı ({formData.calculation_type === 'mt' ? '₺/m' : formData.calculation_type === 'm2' ? '₺/m²' : '₺/adet'})
                </label>
                  <input
                    type="number"
                    name="base_price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.base_price}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <select
                    name="category_id"
                    required
                    value={formData.category_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947] bg-white"
                  >
                    <option value="">Seçiniz</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hesaplama Türü */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hesaplama Türü</label>
                <select
                  name="calculation_type"
                  value={formData.calculation_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947] bg-white"
                >
                  <option value="mt">mt — Metre işi (Tül, Fon perde)</option>
                  <option value="m2">m² — Metrekare (Zebra, Stor, Jaluzi)</option>
                  <option value="adet">Adet — Sabit fiyat (Aksesuar)</option>
                </select>
                {formData.calculation_type === 'mt' && (
                  <p className="mt-1 text-xs text-[#B89947]">
                    Seyrek (×2.0), Orta (×2.5) ve Sık (×3.0) pile seçenekleri otomatik oluşturulur.
                  </p>
                )}
              </div>

              {/* Perde Modeli */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Perde Modeli
                  <span className="ml-2 text-xs font-normal text-gray-400">(Asistan için)</span>
                </label>
                <select
                  name="model_id"
                  value={formData.model_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947] bg-white"
                >
                  <option value="">Model seçilmedi</option>
                  {curtainModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Perde Seçim Asistanı bu ürünü ilgili modelde gösterir
                </p>
              </div>

              {/* Birim Maliyet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birim Maliyet (₺/m²)
                  <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Yakında DB&apos;ye eklenecek
                  </span>
                </label>
                <input
                  type="number"
                  name="base_cost"
                  min="0"
                  step="0.01"
                  value={formData.base_cost}
                  onChange={handleChange}
                  placeholder="Örn: 85.00"
                  className="w-full px-4 py-2 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 bg-amber-50/30"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Kumaş + işçilik maliyeti. Kâr marjı hesabında kullanılır.
                  {formData.base_cost > 0 && formData.base_price > 0 && (
                    <span className="ml-1 font-medium text-emerald-600">
                      Marj: %{(((Number(formData.base_price) - Number(formData.base_cost)) / Number(formData.base_price)) * 100).toFixed(1)}
                    </span>
                  )}
                </p>
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
                  className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947] resize-none"
                />
              </div>

              {/* Kumaş Özellikleri */}
              <div className="border-t border-gray-100 pt-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kumaş Özellikleri
                  <span className="ml-2 text-xs font-normal text-gray-400">Ürün sayfasında etiket olarak görünür</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {fabricProperties.map((prop, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 text-sm text-gray-700"
                    >
                      {prop}
                      <button
                        type="button"
                        onClick={() => removeFabricProperty(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors leading-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fabricInput}
                    onChange={(e) => setFabricInput(e.target.value)}
                    onKeyDown={handleFabricKeyDown}
                    placeholder="Örn: Linen %60 · Pamuk %40"
                    className="flex-1 px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947] text-sm"
                  />
                  <button
                    type="button"
                    onClick={addFabricProperty}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors border border-gray-200"
                  >
                    Ekle
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  Enter veya virgülle ekleyin. Örn: &quot;30°C Yıkanabilir&quot;, &quot;OEKO-TEX Sertifikalı&quot;
                </p>
              </div>

              {/* Stok Yönetimi (Metretül) */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Stok Yönetimi
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    ({formData.calculation_type === 'mt' ? 'Metre cinsinden' : formData.calculation_type === 'm2' ? 'Metrekare cinsinden' : 'Adet cinsinden'})
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stok (m²)
                    </label>
                    <input
                      type="number"
                      name="stock_quantity"
                      min="0"
                      step="0.5"
                      value={formData.stock_quantity}
                      onChange={handleChange}
                      placeholder="Örn: 150.5"
                      className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Depodaki toplam kumaş miktarı
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Düşük Stok Eşiği (m²)
                    </label>
                    <input
                      type="number"
                      name="low_stock_threshold"
                      min="0"
                      step="0.5"
                      value={formData.low_stock_threshold}
                      onChange={handleChange}
                      placeholder="Örn: 5"
                      className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Bu değerin altına düşünce uyarı verilir
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Kaydet Butonu */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || compressing}
                className="flex items-center gap-2 bg-[#B89947] text-white px-8 py-3 hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {compressing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Görsel sıkıştırılıyor...
                  </>
                ) : loading ? (
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
