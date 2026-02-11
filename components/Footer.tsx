"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  // Admin ve Auth sayfalarında Footer'ı gizle
  const isHiddenPage = pathname.startsWith('/admin') || 
                       pathname.startsWith('/giris') || 
                       pathname.startsWith('/auth');

  if (isHiddenPage) return null;

  return (
    <footer className="bg-elite-brown border-t border-white/10">
      <div className="elite-container py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 text-white">
          {/* Brand */}
          <div className="lg:col-span-1">
            <h3 className="font-serif text-2xl font-semibold mb-4">Çırağan Elite</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              1985&apos;ten bu yana Türkiye&apos;nin en seçkin perde koleksiyonlarını sunuyoruz. Kalite ve zarafetin adresi.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-lg font-semibold mb-4 text-white">Hızlı Linkler</h4>
            <ul className="space-y-2">
              {[
                { name: "Ana Sayfa", href: "/" },
                { name: "Ürünler", href: "/kategori/tum-urunler" },
                { name: "Hakkımızda", href: "/hakkimizda" },
                { name: "İletişim", href: "/iletisim" },
              ].map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-white/80 hover:text-white transition-colors text-sm font-light">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-serif text-lg font-semibold mb-4 text-white">Kategoriler</h4>
            <ul className="space-y-2">
              {[
                { name: "Tül Perdeler", href: "/kategori/tul-perdeler" },
                { name: "Fon Perdeler", href: "/kategori/fon-perdeler" },
                { name: "Stor Perdeler", href: "/kategori/stor-perdeler" },
                { name: "Zebra Perdeler", href: "/kategori/zebra-perdeler" },
              ].map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-white/80 hover:text-white transition-colors text-sm font-light">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif text-lg font-semibold mb-4 text-white">İletişim</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-white/80 font-light">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Ümraniye, İstanbul</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80 font-light">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a href="tel:05322959586" className="hover:text-white transition-colors font-medium">0532 295 9586</a>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80 font-light">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <a href="mailto:info@ciraganelite.com" className="hover:text-white transition-colors">info@ciraganelite.com</a>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80 font-light">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Pzt-Cmt: 09:00 - 19:00</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/60 text-xs">
              &copy; {currentYear} Çırağan Elite Perde. Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/gizlilik" className="text-white/60 hover:text-white text-xs transition-colors">Gizlilik Politikası</Link>
              <Link href="/kosullar" className="text-white/60 hover:text-white text-xs transition-colors">Kullanım Koşulları</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}