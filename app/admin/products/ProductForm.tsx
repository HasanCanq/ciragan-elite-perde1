'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  X,
  Package,
  ImageIcon,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import {
  createProduct,
  updateProduct,
  uploadProductImage,
  deleteProductImage,
} from '@/lib/actions/products';
import { ProductWithCategory, Category } from '@/types';

interface ProductFormProps {
  product?: ProductWithCategory | null;
  categories: Category[];
}

export default function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [shortDescription, setShortDescription] = useState(product?.short_description || '');
  const [basePrice, setBasePrice] = useState(product?.base_price?.toString() || '');
  const [categoryId, setCategoryId] = useState(product?.category_id || '');
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [isPublished, setIsPublished] = useState(product?.is_published ?? true);
  const [inStock, setInStock] = useState(product?.in_stock ?? true);
  const [metaTitle, setMetaTitle] = useState(product?.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(product?.meta_description || '');
  const [ozellikler, setOzellikler] = useState(product?.ozellikler || '');

  const isEditMode = !!product;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadProductImage(formData);

      if (result.success && result.data) {
        setImages((prev) => [...prev, result.data!.url]);
      } else {
        setError(result.error || 'Görsel yüklenemedi');
      }
    } catch (err) {
      setError('Görsel yüklenirken bir hata oluştu');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (imageUrl: string) => {
    // Önce UI'dan kaldır
    setImages((prev) => prev.filter((img) => img !== imageUrl));

    // Storage'dan sil (arka planda)
    await deleteProductImage(imageUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validasyon
      if (!name.trim()) {
        throw new Error('Ürün adı gereklidir');
      }

      const price = parseFloat(basePrice);
      if (isNaN(price) || price <= 0) {
        throw new Error('Geçerli bir fiyat giriniz');
      }

      const productData = {
        name: name.trim(),
        description: description.trim() || null,
        short_description: shortDescription.trim() || null,
        base_price: price,
        category_id: categoryId || null,
        images,
        is_published: isPublished,
        in_stock: inStock,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        ozellikler: ozellikler.trim() || null,
      };

      if (isEditMode && product) {
        const result = await updateProduct(product.id, productData);
        if (!result.success) {
          throw new Error(result.error || 'Ürün güncellenemedi');
        }
        setSuccess('Ürün başarıyla güncellendi!');
      } else {
        const result = await createProduct(productData);
        if (!result.success) {
          throw new Error(result.error || 'Ürün oluşturulamadı');
        }
        setSuccess('Ürün başarıyla oluşturuldu!');
        setTimeout(() => {
          router.push('/admin/products');
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditMode ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
            </h1>
            <p className="text-gray-500 mt-1">
              {isEditMode
                ? 'Ürün bilgilerini güncelleyin'
                : 'Yeni bir ürün oluşturun'}
            </p>
          </div>
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
              <h2 className="text-lg font-medium text-gray-900 mb-4">Temel Bilgiler</h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ürün Adı *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                    placeholder="Ürün adını girin"
                  />
                </div>

                {/* Short Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kısa Açıklama
                  </label>
                  <input
                    type="text"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                    placeholder="Ürün kartlarında görünecek kısa açıklama"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none resize-none"
                    placeholder="Ürün açıklaması"
                  />
                </div>

                {/* Ozellikler */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Özellikler (JSON formatında)
                  </label>
                  <textarea
                    value={ozellikler}
                    onChange={(e) => setOzellikler(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg font-mono text-sm
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none resize-none"
                    placeholder='{"Kumaş": "Polyester", "Renk": "Beyaz"}'
                  />
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Görseller</h2>

              {/* Image Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                {images.map((image, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                  >
                    <Image
                      src={image}
                      alt={`Ürün görseli ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(image)}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 px-2 py-1 bg-elite-gold text-white text-xs rounded">
                        Ana Görsel
                      </span>
                    )}
                  </div>
                ))}

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300
                           hover:border-elite-gold hover:bg-elite-gold/5 transition-colors
                           flex flex-col items-center justify-center gap-2 text-gray-400
                           hover:text-elite-gold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8" />
                      <span className="text-xs">Görsel Ekle</span>
                    </>
                  )}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <p className="text-sm text-gray-500">
                JPEG, PNG, WebP veya GIF formatında, maksimum 5MB boyutunda görseller yükleyebilirsiniz.
              </p>
            </div>

            {/* SEO */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">SEO</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Başlık
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                    placeholder="Arama motorlarında görünecek başlık"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Açıklama
                  </label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none resize-none"
                    placeholder="Arama motorlarında görünecek açıklama"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Fiyatlandırma</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  m² Fiyatı (TL) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-lg
                             focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                             transition-colors outline-none"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    TL
                  </span>
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Kategori</h2>

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg
                         focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                         transition-colors outline-none"
              >
                <option value="">Kategori Seçin</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Durum</h2>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-5 h-5 text-elite-gold border-gray-300 rounded
                             focus:ring-elite-gold"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Yayında</p>
                    <p className="text-sm text-gray-500">Ürün sitede görünür</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={(e) => setInStock(e.target.checked)}
                    className="w-5 h-5 text-elite-gold border-gray-300 rounded
                             focus:ring-elite-gold"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Stokta</p>
                    <p className="text-sm text-gray-500">Satışa açık</p>
                  </div>
                </label>
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
                  {isEditMode ? 'Güncelle' : 'Oluştur'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
