'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  Trash2,
} from 'lucide-react';
import { getProductById, updateProduct, getCategories } from '@/lib/actions/product';
import { Category, ProductWithCategory } from '@/types';

export default function EditProductPage() {
  const params = useParams();
  const productId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [inStock, setInStock] = useState(true);

  // Image handling
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsFetching(true);

      const [productResult, categoriesResult] = await Promise.all([
        getProductById(productId),
        getCategories(),
      ]);

      if (productResult.success && productResult.data) {
        const p = productResult.data;
        setProduct(p);
        setName(p.name);
        setDescription(p.description || '');
        setShortDescription(p.short_description || '');
        setBasePrice(p.base_price.toString());
        setCategoryId(p.category_id || '');
        setIsPublished(p.is_published);
        setInStock(p.in_stock);
        setCurrentImage(p.images?.[0] || null);
      } else {
        setError('Ürün bulunamadı');
      }

      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data);
      }

      setIsFetching(false);
    }

    loadData();
  }, [productId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setRemoveImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setCurrentImage(null);
    setRemoveImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('short_description', shortDescription);
      formData.append('base_price', basePrice);
      formData.append('category_id', categoryId);
      formData.append('is_published', isPublished.toString());
      formData.append('in_stock', inStock.toString());
      formData.append('remove_image', removeImage.toString());

      if (imageFile) {
        formData.append('image', imageFile);
      }

      const result = await updateProduct(productId, formData);

      if (!result.success) {
        throw new Error(result.error || 'Ürün güncellenemedi');
      }

      setSuccess('Ürün başarıyla güncellendi!');

      // Update current image if new one was uploaded
      if (result.data?.images?.[0]) {
        setCurrentImage(result.data.images[0]);
        setImageFile(null);
        setImagePreview(null);
      }
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

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Ürün bulunamadı</p>
        <Link href="/admin/products" className="text-elite-gold hover:underline mt-4 inline-block">
          Ürün listesine dön
        </Link>
      </div>
    );
  }

  const displayImage = imagePreview || currentImage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ürün Düzenle</h1>
          <p className="text-gray-500 mt-1">Ürün bilgilerini güncelleyin</p>
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
                  />
                </div>

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
                  />
                </div>

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
                  />
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Ürün Görseli
              </h2>

              {displayImage ? (
                <div className="relative w-48 h-48 rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={displayImage}
                    alt="Ürün görseli"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-48 h-48 rounded-lg border-2 border-dashed border-gray-300
                           hover:border-elite-gold hover:bg-elite-gold/5 transition-colors
                           flex flex-col items-center justify-center gap-2 text-gray-400
                           hover:text-elite-gold"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Görsel Yükle</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {displayImage && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 text-sm text-elite-gold hover:underline"
                >
                  Görseli Değiştir
                </button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Fiyatlandırma
              </h2>

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
                    className="w-5 h-5 text-elite-gold border-gray-300 rounded focus:ring-elite-gold"
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
                    className="w-5 h-5 text-elite-gold border-gray-300 rounded focus:ring-elite-gold"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Stokta</p>
                    <p className="text-sm text-gray-500">Satışa açık</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit */}
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
                  Güncelle
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
