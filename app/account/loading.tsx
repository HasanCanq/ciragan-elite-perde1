// Müşteri hesap paneli skeleton — Sidebar + İçerik
export default function AccountLoading() {
  return (
    <div className="bg-white min-h-screen animate-pulse">
      {/* Sayfa başlığı */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-container py-6 space-y-2">
          <div className="h-7 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-200 rounded w-60" />
        </div>
      </div>

      <div className="h-container py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar — Kullanıcı kartı + Navigasyon */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
            {/* Kullanıcı kartı */}
            <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            </div>

            {/* Navigasyon linkleri */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                  <div className="w-5 h-5 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                </div>
              ))}
            </div>
          </aside>

          {/* Ana içerik */}
          <main className="flex-1 space-y-4">
            {/* Başlık kartı */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-2">
              <div className="h-7 bg-gray-200 rounded w-40" />
              <div className="h-4 bg-gray-200 rounded w-64" />
            </div>

            {/* Sipariş kartları */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Accordion header */}
                <div className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="flex gap-3">
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="h-4 bg-gray-200 rounded w-20" />
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-48" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="h-7 bg-gray-200 rounded w-24" />
                    <div className="w-5 h-5 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}
