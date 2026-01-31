import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-elite-gold">
      <div className="elite-container py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <h3 className="font-serif text-2xl font-semibold text-elite-black mb-4">
              Çırağan Elite
            </h3>
            <p className="text-elite-black/80 text-sm leading-relaxed">
              1985&apos;ten bu yana Türkiye&apos;nin en seçkin perde koleksiyonlarını
              sunuyoruz. Kalite ve zarafetin adresi.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-lg font-semibold text-elite-black mb-4">
              Hızlı Linkler
            </h4>
            <ul className="space-y-2">
              {[
                { name: "Ana Sayfa", href: "/" },
                { name: "Ürünler", href: "/urunler" },
                { name: "Hakkımızda", href: "/hakkimizda" },
                { name: "İletişim", href: "/iletisim" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-elite-black/80 hover:text-elite-black transition-colors duration-300 text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-serif text-lg font-semibold text-elite-black mb-4">
              Kategoriler
            </h4>
            <ul className="space-y-2">
              {[
                { name: "Tül Perdeler", href: "/kategori/tul-perdeler" },
                { name: "Fon Perdeler", href: "/kategori/fon-perdeler" },
                { name: "Stor Perdeler", href: "/kategori/stor-perdeler" },
                { name: "Zebra Perdeler", href: "/kategori/zebra-perdeler" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-elite-black/80 hover:text-elite-black transition-colors duration-300 text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif text-lg font-semibold text-elite-black mb-4">
              İletişim
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-elite-black/80">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Ümraniye, İstanbul</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-elite-black/80">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a
                  href="tel:+902121234567"
                  className="hover:text-elite-black transition-colors duration-300"
                >
                  0532 295 9586
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-elite-black/80">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <a
                  href="mailto:info@ciraganelite.com"
                  className="hover:text-elite-black transition-colors duration-300"
                >
                  info@ciraganelite.com
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-elite-black/80">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Pzt-Cmt: 09:00 - 19:00</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-elite-black/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-elite-black/70 text-sm">
              &copy; {currentYear} Çırağan Elite Perde. Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/gizlilik"
                className="text-elite-black/70 hover:text-elite-black text-sm transition-colors duration-300"
              >
                Gizlilik Politikası
              </Link>
              <Link
                href="/kosullar"
                className="text-elite-black/70 hover:text-elite-black text-sm transition-colors duration-300"
              >
                Kullanım Koşulları
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
