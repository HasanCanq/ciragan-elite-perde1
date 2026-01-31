import Link from "next/link";

import { ChevronRight, Scissors, Ruler, Award, Heart } from "lucide-react";

export const metadata = {
  title: "Hakkımızda | Çırağan Elite Perde",
  description: "1985'ten bu yana terzilik geleneğinden gelen ustalıkla, evinize özel lüks perde çözümleri sunuyoruz.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-elite-bone">
      {/* Hero Section with Breadcrumb */}
      <section className="bg-elite-black py-16 lg:py-24">
        <div className="elite-container">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link
              href="/hakkimizda"
              className="text-elite-bone/70 hover:text-elite-gold transition-colors"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-bone/50" />
            <span className="text-elite-gold">Hakkımızda</span>
          </nav>

          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-elite-bone">
            Hakkımızda
          </h1>
          <p className="mt-4 text-elite-bone/80 text-lg max-w-2xl">
            Terzilik geleneğinden gelen ustalık, modern lüks ev tekstiline dönüştü.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 lg:py-24">
        <div className="elite-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Content */}
            <div>
              <span className="text-elite-gold font-medium tracking-wider uppercase text-sm">
                Hikayemiz
              </span>
              <h2 className="font-serif text-3xl lg:text-4xl font-semibold text-elite-black mt-3 mb-6">
                Terzilik Ustalığından Lüks Ev Tekstiline
              </h2>
              <div className="space-y-4 text-elite-gray leading-relaxed">
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

            {/* Image Placeholder */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="aspect-[4/5] bg-gradient-to-br from-elite-gold/20 to-elite-gold/5 rounded-2xl flex items-center justify-center border border-elite-gold/20">
                    <div className="text-center p-6">
                      <Scissors className="w-12 h-12 text-elite-gold mx-auto mb-3" />
                      <p className="text-elite-gray text-sm">Atölye Görüntüsü</p>
                    </div>
                  </div>
                  <div className="aspect-square bg-gradient-to-br from-elite-black/10 to-elite-black/5 rounded-2xl flex items-center justify-center border border-elite-black/10">
                    <div className="text-center p-6">
                      <Award className="w-12 h-12 text-elite-black/60 mx-auto mb-3" />
                      <p className="text-elite-gray text-sm">Ödüllerimiz</p>
                    </div>
                  </div>
                </div>
                <div className="pt-8">
                  <div className="aspect-[3/4] bg-gradient-to-br from-elite-gold/30 to-elite-gold/10 rounded-2xl flex items-center justify-center border border-elite-gold/30">
                    <div className="text-center p-6">
                      <span className="font-serif text-6xl font-bold text-elite-gold">39</span>
                      <p className="text-elite-gray mt-2">Yıllık Tecrübe</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Values Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="elite-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-elite-gold font-medium tracking-wider uppercase text-sm">
              Misyonumuz
            </span>
            <h2 className="font-serif text-3xl lg:text-4xl font-semibold text-elite-black mt-3">
              Mükemmellik Tutkumuz
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Value 1 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-elite-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Ruler className="w-8 h-8 text-elite-gold" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-elite-black mb-3">
                Kişiye Özel Ölçü
              </h3>
              <p className="text-elite-gray text-sm leading-relaxed">
                Her pencere benzersizdir. Uzman ekibimiz evinize gelerek hassas ölçümler
                yapar ve mükemmel uyumu garanti eder.
              </p>
            </div>

            {/* Value 2 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-elite-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Scissors className="w-8 h-8 text-elite-gold" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-elite-black mb-3">
                Premium İşçilik
              </h3>
              <p className="text-elite-gray text-sm leading-relaxed">
                Terzilik geleneğinden gelen ustalıkla, her dikişi özenle yapıyor ve
                en kaliteli malzemeleri kullanıyoruz.
              </p>
            </div>

            {/* Value 3 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-elite-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Award className="w-8 h-8 text-elite-gold" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-elite-black mb-3">
                Kalite Garantisi
              </h3>
              <p className="text-elite-gray text-sm leading-relaxed">
                Tüm ürünlerimiz kalite kontrolünden geçer ve müşteri memnuniyeti
                garantisi ile sunulur.
              </p>
            </div>

            {/* Value 4 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-elite-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Heart className="w-8 h-8 text-elite-gold" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-elite-black mb-3">
                Müşteri Odaklılık
              </h3>
              <p className="text-elite-gray text-sm leading-relaxed">
                Satış öncesi danışmanlıktan montaj sonrası desteğe kadar,
                her adımda yanınızdayız.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-elite-black">
        <div className="elite-container text-center">
          <h2 className="font-serif text-3xl lg:text-4xl font-semibold text-elite-bone mb-4">
            Hayalinizdeki Perdelere Kavuşun
          </h2>
          <p className="text-elite-bone/80 mb-8 max-w-2xl mx-auto">
            Uzman ekibimizle ücretsiz danışmanlık için hemen iletişime geçin.
            Evinize özel çözümler sunalım.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/iletisim" className="elite-button">
              İletişime Geç
            </Link>
            <Link href="/kategori/tum-urunler" className="elite-button-outline">
              Ürünleri Keşfet
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
