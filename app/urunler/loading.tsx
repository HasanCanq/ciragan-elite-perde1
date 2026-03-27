/* ──────────────────────────────────────────────────────────────
   /urunler sayfası için Next.js route-level yükleme ekranı.
   Hard-navigate veya ilk ziyarette gösterilir.
   ────────────────────────────────────────────────────────────── */
export default function AdvisorPLPLoading() {
  return (
    <main
      className="min-h-[calc(100vh-64px)]"
      aria-busy="true"
      aria-label="Ürünler yükleniyor"
    >
      {/* Üst bar iskeleti */}
      <div className="border-b border-[#F3F4F6]">
        <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-5 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-2 w-12 bg-[#F3F4F6]" />
            <div className="h-2 w-2 bg-[#F3F4F6]" />
            <div className="h-2 w-16 bg-[#F3F4F6]" />
            <div className="h-2 w-2 bg-[#F3F4F6]" />
            <div className="h-2 w-20 bg-[#EBEBEB]" />
          </div>
          <div className="h-2 w-24 bg-[#F3F4F6]" />
        </div>
      </div>

      {/* İçerik iskeleti */}
      <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-14 lg:py-20 animate-pulse">
        {/* Model başlık bandı */}
        <div className="flex flex-col lg:flex-row lg:items-end gap-8 mb-14">
          <div className="flex-1 space-y-4">
            <div className="h-2 w-36 bg-[#F3F4F6]" />
            <div className="h-12 w-56 bg-[#F3F4F6]" />
            <div className="h-px w-10 bg-[#EBEBEB]" />
            <div className="h-3 w-80 bg-[#F3F4F6]" />
            <div className="h-3 w-64 bg-[#F3F4F6]" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 bg-[#F3F4F6]" />
              <div className="h-2 w-2 bg-[#F3F4F6]" />
              <div className="h-10 w-28 bg-[#F3F4F6]" />
            </div>
          </div>
          {/* Sağ: illüstrasyon alanı */}
          <div className="flex-shrink-0">
            <div className="w-[120px] h-[148px] bg-[#F9F9F9]" />
          </div>
        </div>

        {/* Ürün sayısı */}
        <div className="h-2 w-16 bg-[#F3F4F6] mb-6" />

        {/* Ürün grid iskeleti */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[1px]">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="bg-[#F9F9F9] flex flex-col"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Görsel */}
              <div className="aspect-[4/3] bg-[#F3F4F6]" />
              {/* Metin */}
              <div className="px-5 py-5 space-y-3">
                <div className="h-1.5 w-16 bg-[#F3F4F6]" />
                <div className="h-5 w-40 bg-[#F3F4F6]" />
                <div className="h-2 w-full bg-[#F3F4F6]" />
                <div className="h-2 w-3/4 bg-[#F3F4F6]" />
                <div className="pt-3 border-t border-[#F3F4F6] space-y-1">
                  <div className="h-5 w-28 bg-[#F3F4F6]" />
                  <div className="h-1.5 w-36 bg-[#F3F4F6]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
