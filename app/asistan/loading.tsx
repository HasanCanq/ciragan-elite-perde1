/* ──────────────────────────────────────────────────────────────
   /asistan sayfası için Next.js route-level yükleme ekranı.
   Sayfa ilk kez ziyaret edildiğinde veya hard-navigate edildiğinde
   gösterilir. Suspense fallback'leri (page.tsx içindeki) streaming
   için kullanılırken, bu dosya tam sayfa yüklemesi için çalışır.
   ────────────────────────────────────────────────────────────── */
export default function AssistantLoading() {
  return (
    <main className="min-h-[calc(100vh-64px)]" aria-busy="true" aria-label="Yükleniyor">
      {/* Üst bar iskeleti */}
      <div className="border-b border-[#F3F4F6]">
        <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-5 flex items-center justify-between animate-pulse">
          <div className="h-2 w-40 bg-[#F3F4F6]" />
          <div className="h-2 w-16 bg-[#F3F4F6]" />
        </div>
      </div>

      {/* İçerik iskeleti */}
      <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-14 lg:py-20 animate-pulse">
        {/* Başlık */}
        <div className="mb-10 space-y-4">
          <div className="h-2.5 w-24 bg-[#F3F4F6]" />
          <div className="h-10 w-80 bg-[#F3F4F6]" />
          <div className="h-10 w-56 bg-[#F3F4F6]" />
          <div className="h-px w-10 bg-[#EBEBEB] mt-2" />
        </div>

        {/* Kart grid — oda seçimi görünümü */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-[1px]">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-[180px] sm:h-[200px] bg-[#F9F9F9]"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
