import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    // bg-elite-brown: Resim yüklenene kadar veya arkada boşluk kalırsa kahverengi görünür
    <div className="relative min-h-screen flex items-center justify-center bg-elite-brown overflow-hidden">
      
      {/* Arkaplan Resmi - Supabase */}
      <div className="absolute inset-0 opacity-20"> {/* opacity-20: Resmi karartır ki yazı okunsun */}
        <Image
          src="https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/3.jpg" // <-- BURAYA SUPABASE LINKINI YAPIŞTIR
          alt="Sayfa Bulunamadı"
          fill
          className="object-cover"
          priority // Bu resim hemen yüklensin diye öncelik veriyoruz
        />
      </div>

      {/* İçerik */}
      <div className="relative z-10 text-center px-4">
        {/* Dev 404 Yazısı */}
        <h1 className="text-[120px] md:text-[180px] font-thin text-white/10 leading-none select-none">
          404
        </h1>
        
        <div className="space-y-6 -mt-8 md:-mt-16">
          <h2 className="text-2xl md:text-4xl font-light text-white tracking-[0.2em] uppercase">
            Sayfa Bulunamadı
          </h2>
          
          <p className="text-gray-300 max-w-md mx-auto font-light text-sm md:text-base leading-relaxed">
            Aradığınız sayfa taşınmış, silinmiş veya perdenin diğer tarafında kalmış olabilir.
          </p>
          
          <div className="pt-8">
            <Link 
              href="/"
              className="inline-block px-8 py-3 border border-white/20 text-white hover:bg-white hover:text-elite-brown transition-all duration-300 rounded-full font-medium tracking-wide"
            >
              ANASAYFAYA DÖN
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}