'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Bu Next.js Resmi
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  MoreVertical,
  Loader2,
  Image as ImageIcon // İkon olanı 'ImageIcon' olarak değiştirdik
} from 'lucide-react';
import { 
  getProducts, 
  deleteProduct, 
  toggleProductStatus 
} from '@/lib/actions/products'; 
import { ProductWithCategory } from '@/types';
import { useRouter } from 'next/navigation';

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Verileri Çek
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts(page, 20, searchTerm);
      if (res.success && res.data) {
        setProducts(res.data.data);
        setTotalPages(res.data.totalPages);
      }
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, page]);

  // Silme İşlemi
  const handleDelete = async (id: string) => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await deleteProduct(id);
      if (res.success) {
        fetchProducts();
      } else {
        alert('Silinemedi: ' + res.error);
      }
    } catch (error) {
      alert('Bir hata oluştu');
    }
  };

  // Durum Değiştirme
  const handleToggleStatus = async (id: string, field: 'is_published' | 'in_stock', currentValue: boolean) => {
    try {
      setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, [field]: !currentValue } : p
      ));

      const res = await toggleProductStatus(id, field, !currentValue);
      
      if (!res.success) {
        fetchProducts();
        alert('Güncellenemedi');
      }
    } catch (error) {
      fetchProducts();
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ürün Yönetimi</h1>
          <p className="text-gray-500">Mağazanızdaki tüm ürünleri buradan yönetebilirsiniz.</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-elite-brown text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
        >
          <Plus size={20} />
          Yeni Ürün Ekle
        </Link>
      </div>

      {/* Arama */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Ürün adı, kod veya kategori ara..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-elite-brown/20 focus:border-elite-brown transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-4 px-6 font-medium text-gray-500">Ürün</th>
                <th className="py-4 px-6 font-medium text-gray-500">Kategori</th>
                <th className="py-4 px-6 font-medium text-gray-500">Fiyat</th>
                <th className="py-4 px-6 font-medium text-gray-500 text-center">Stok</th>
                <th className="py-4 px-6 font-medium text-gray-500 text-center">Durum</th>
                <th className="py-4 px-6 font-medium text-gray-500 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-elite-brown" />
                    <span className="text-gray-400 mt-2 block">Yükleniyor...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    Ürün bulunamadı.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {product.images?.[0] ? (
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <ImageIcon size={20} /> {/* İŞTE BURASI DÜZELDİ */}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">
                            {product.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {product.category?.name || '-'}
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-900">
                      ₺{product.base_price.toLocaleString('tr-TR')}
                    </td>
                    
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleToggleStatus(product.id, 'in_stock', product.in_stock)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                          product.in_stock 
                            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        {product.in_stock ? <Check size={16} /> : <X size={16} />}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleToggleStatus(product.id, 'is_published', product.is_published)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          product.is_published
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {product.is_published ? 'Yayında' : 'Taslak'}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="p-2 text-gray-400 hover:text-elite-brown hover:bg-elite-brown/10 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex justify-center p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border disabled:opacity-50"
              >
                Önceki
              </button>
              <span className="px-3 py-1">
                Sayfa {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}