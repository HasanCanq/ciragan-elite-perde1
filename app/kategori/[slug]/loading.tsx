// Kategori sayfası skeleton — Sidebar Filtre + Ürün Grid
export default function CategoryLoading() {
  return (
    <div className="bg-white min-h-screen animate-pulse">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-container py-4 flex gap-2">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-4" />
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-4" />
          <div className="h-4 bg-gray-200 rounded w-28" />
        </div>
      </div>

      {/* Kategori Başlığı */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-container py-8 lg:py-12 space-y-3">
          <div className="h-10 bg-gray-200 rounded-lg w-64" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="h-4 bg-gray-200 rounded w-72" />
        </div>
      </div>

      <div className="h-container py-8">
        {/* Mobil filtre çubuğu */}
        <div className="lg:hidden mb-6 flex gap-3">
          <div className="flex-1 h-12 bg-white rounded-xl border border-gray-200" />
          <div className="flex-1 h-12 bg-white rounded-xl border border-gray-200" />
        </div>

        <div className="flex gap-8">
          {/* Sidebar — Masaüstü */}
          <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
              <div className="h-6 bg-gray-200 rounded w-24" />
              {/* Fiyat filtresi */}
              <div className="space-y-3 pt-2">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-10 bg-gray-200 rounded-lg" />
                  <div className="h-10 bg-gray-200 rounded-lg" />
                </div>
                <div className="h-10 bg-gray-200 rounded-lg" />
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-7 bg-gray-200 rounded-full w-20" />
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-28" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-9 bg-gray-100 rounded-lg" />
                ))}
              </div>
            </div>
          </aside>

          {/* Ana içerik — Ürün Grid */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* Sonuç sayısı / Sıralama */}
            <div className="hidden lg:flex justify-between items-center bg-white rounded-xl px-6 py-4 shadow-sm">
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-9 bg-gray-200 rounded-lg w-48" />
            </div>

            {/* Grid — 6 ürün kartı */}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-3 sm:p-5 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="hidden sm:block h-4 bg-gray-200 rounded w-full" />
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <div className="h-6 bg-gray-200 rounded w-20" />
                      <div className="h-8 w-8 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
