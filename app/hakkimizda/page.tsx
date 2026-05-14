import Link from "next/link";

import { ChevronRight, Scissors, Ruler, Award, Heart } from "lucide-react";

export const metadata = {
  title: "Hakkımızda | Çırağan Elite Perde",
  description: "1985'ten bu yana terzilik geleneğinden gelen ustalıkla, evinize özel lüks perde çözümleri sunuyoruz.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section with Breadcrumb */}
      <section className="bg-black py-16 lg:py-24">
        <div className="h-container">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link
              href="/hakkimizda"
              className="text-white/70 hover:text-[#B89947] transition-colors"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-white/70" />
            <span className="text-[#B89947]">Hakkımızda</span>
          </nav>

          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-white">
            Hakkımızda
          </h1>
          <p className="mt-4 text-white/70 text-lg max-w-2xl">
            Terzilik geleneğinden gelen ustalık, modern lüks ev tekstiline dönüştü.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 lg:py-24">
        <div className="h-container">
          <div className="max-w-2xl">
            <span className="text-[#B89947] font-medium tracking-wider uppercase text-sm">
              Hikayemiz
            </span>
            <h2 className="font-serif text-3xl lg:text-4xl font-semibold text-black mt-3 mb-6">
              Terzilik Ustalığından Lüks Ev Tekstiline
            </h2>
            <div className="space-y-4 text-[#9CA3AF] leading-relaxed">
              <p>
                1985 yılında, İstanbul&apos;un kalbinde küçük bir terzi atölyesinde başlayan
                yolculuğumuz, bugün Türkiye&apos;nin en seçkin perde markalarından biri haline
                geldi. Kurucu ustamızın &quot;Her dikiş bir imza, her kumaş bir hikaye&quot;
                felsefesi, nesiller boyu aktarılarak günümüze ulaştı.
              </p>
              <p>
                Geleneksel terzilik sanatının inceliğini, modern tasarım anlayışıyla
                harmanlayarak benzersiz bir koleksiyon oluşturduk. Her perdemiz, yıllara
                dayanan deneyim ve tutkuyla şekillenir.
              </p>
              <p>
                Çırağan Elite olarak, sadece perde satmıyoruz; evlerinize zarafet,
                konfor ve karakter katıyoruz. Kişiye özel ölçü ve tasarım anlayışımız,
                her müşterimize eşsiz bir deneyim sunmamızı sağlıyor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Values Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="h-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-[#B89947] font-medium tracking-wider uppercase text-sm">
              Misyonumuz
            </span>
            <h2 className="font-serif text-3xl lg:text-4xl font-semibold text-black mt-3">
              Mükemmellik Tutkumuz
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Value 1 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Ruler className="w-8 h-8 text-[#B89947]" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-black mb-3">
                Kişiye Özel Ölçü
              </h3>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">
                Her pencere benzersizdir. Uzman ekibimiz evinize gelerek hassas ölçümler
                yapar ve mükemmel uyumu garanti eder.
              </p>
            </div>

            {/* Value 2 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Scissors className="w-8 h-8 text-[#B89947]" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-black mb-3">
                Premium İşçilik
              </h3>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">
                Terzilik geleneğinden gelen ustalıkla, her dikişi özenle yapıyor ve
                en kaliteli malzemeleri kullanıyoruz.
              </p>
            </div>

            {/* Value 3 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Award className="w-8 h-8 text-[#B89947]" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-black mb-3">
                Kalite Garantisi
              </h3>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">
                Tüm ürünlerimiz kalite kontrolünden geçer ve müşteri memnuniyeti
                garantisi ile sunulur.
              </p>
            </div>

            {/* Value 4 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Heart className="w-8 h-8 text-[#B89947]" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-black mb-3">
                Müşteri Odaklılık
              </h3>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">
                Satış öncesi danışmanlıktan montaj sonrası desteğe kadar,
                her adımda yanınızdayız.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-black">
        <div className="h-container text-center">
          <h2 className="font-serif text-3xl lg:text-4xl font-semibold text-white mb-4">
            Hayalinizdeki Perdelere Kavuşun
          </h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Uzman ekibimizle ücretsiz danışmanlık için hemen iletişime geçin.
            Evinize özel çözümler sunalım.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/iletisim" className="h-btn">
              İletisime Geç
            </Link>
            <Link href="/kategori/tum-urunler" className="h-btn-outline">
              Ürünleri Keşfet
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
