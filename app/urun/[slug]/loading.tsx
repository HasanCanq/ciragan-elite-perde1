// Ürün detay sayfası skeleton — Galeri + Fiyat Hesaplayıcı
export default function ProductLoading() {
  return (
    <div className="bg-white min-h-screen animate-pulse">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-container py-4 flex gap-2">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-4" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-4" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
      </div>

      <div className="h-container py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-16">

          {/* Sol — Görsel Galerisi */}
          <div className="space-y-3">
            {/* Ana görsel */}
            <div className="aspect-[4/5] bg-gray-200 rounded-lg" />
            {/* Thumbnail'lar */}
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Sağ — Ürün bilgisi + Fiyat Hesaplayıcı */}
          <div className="space-y-6">
            {/* Kategori etiketi */}
            <div className="h-4 bg-gray-200 rounded w-28" />
            {/* Başlık */}
            <div className="space-y-2">
              <div className="h-9 bg-gray-200 rounded w-4/5" />
              <div className="h-9 bg-gray-200 rounded w-3/5" />
            </div>
            {/* Açıklama */}
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-4/6" />
            </div>

            {/* Fiyat Hesaplayıcı kutusu */}
            <div className="bg-white rounded-2xl shadow-elite p-6 space-y-5">
              <div className="h-6 bg-gray-200 rounded w-40" />
              {/* Ölçü inputları */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-12 bg-gray-200 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-12 bg-gray-200 rounded-lg" />
                </div>
              </div>
              {/* Sık seçenekleri */}
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-full w-24" />
                ))}
              </div>
              {/* Toplam fiyat */}
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <div className="h-5 bg-gray-200 rounded w-24" />
                <div className="h-9 bg-gray-200 rounded w-32" />
              </div>
              {/* Sepete ekle */}
              <div className="h-14 bg-gray-300 rounded-xl" />
            </div>

            {/* Özellik rozetleri */}
            <div className="flex gap-3 flex-wrap">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded-lg w-32" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
