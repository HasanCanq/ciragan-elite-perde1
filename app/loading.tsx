// Ana sayfa skeleton — Hero + Öne Çıkan Ürünler
export default function HomeLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero Skeleton */}
      <div className="relative mx-2 md:mx-4 mt-2 mb-6 h-[75vh] md:h-[85vh] bg-gray-200 rounded-t-[1.5rem] rounded-b-[4rem]">
        {/* Başlık bloğu */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
          <div className="h-10 md:h-16 bg-gray-300 rounded-xl w-2/3" />
          <div className="h-5 bg-gray-300 rounded-lg w-1/2" />
          <div className="h-12 bg-gray-300 rounded-full w-36 mt-4" />
        </div>
      </div>

      {/* Öne Çıkan Ürünler Skeleton */}
      <div className="h-container py-16">
        {/* Başlık */}
        <div className="text-center mb-12 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
          <div className="h-8 bg-gray-200 rounded-lg w-64 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-80 mx-auto" />
        </div>

        {/* Ürün grid — 4 kart */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="aspect-[2/3] bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
