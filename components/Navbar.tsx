"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Menu, X, ChevronDown, User } from "lucide-react";
import { useCartStore } from "@/store/cartStore";


const categories = [
  { id: "1", name: "Tül Perdeler", slug: "tul-perdeler" },
  { id: "2", name: "Fon Perdeler", slug: "fon-perdeler" },
  { id: "3", name: "Stor Perdeler", slug: "stor-perdeler" },
  { id: "4", name: "Zebra Perdeler", slug: "zebra-perdeler" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const totalItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  // Hydration fix - SSR'da sepet sayısı 0 göster
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* Top Header - Koyu Siyah */}
      <div className="bg-elite-black text-white">
        <div className="elite-container py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="hidden sm:block text-gray-300">
              Ücretsiz Kargo | 5.000 TL ve Üzeri Siparişlerde
            </span>
            <div className="flex items-center gap-4 ml-auto">
              <a
                href="tel:+902121234567"
                className="text-gray-300 hover:text-elite-gold transition-colors duration-300"
              >
                0532 295 95 86
              </a>
              <Link
                href="/giris"
                className="hidden sm:flex items-center gap-1 text-gray-300 hover:text-elite-gold transition-colors duration-300"
              >
                <User className="w-4 h-4" />
                Giriş Yap
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header - Gold */}
      <nav className="bg-elite-gold">
        <div className="elite-container">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <span className="font-serif text-xl sm:text-2xl font-semibold text-elite-black tracking-tight">
                Çırağan Elite Perde
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              <Link
                href="/"
                className="text-elite-black font-medium hover:opacity-70 transition-opacity duration-300"
              >
                Ana Sayfa
              </Link>

              {/* Categories Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                  onBlur={() => setTimeout(() => setIsCategoriesOpen(false), 150)}
                  className="flex items-center gap-1 text-elite-black font-medium hover:opacity-70 transition-opacity duration-300"
                >
                  Kategoriler
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-300 ${
                      isCategoriesOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isCategoriesOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-elite-hover py-2">
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/kategori/${category.slug}`}
                        className="block px-4 py-2 text-elite-black hover:bg-elite-bone transition-colors duration-300"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/hakkimizda"
                className="text-elite-black font-medium hover:opacity-70 transition-opacity duration-300"
              >
                Hakkımızda
              </Link>

              <Link
                href="/iletisim"
                className="text-elite-black font-medium hover:opacity-70 transition-opacity duration-300"
              >
                İletisim
              </Link>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              {/* Cart */}
              <Link
                href="/sepet"
                className="relative p-2 text-elite-black hover:opacity-70 transition-opacity duration-300"
              >
                <ShoppingBag className="w-6 h-6" />
                {mounted && totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-elite-black text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 text-elite-black"
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-elite-gold border-t border-elite-black/10">
            <div className="elite-container py-4">
              <div className="flex flex-col gap-4">
                <Link
                  href="/"
                  className="text-elite-black font-medium py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Ana Sayfa
                </Link>

                <div>
                  <span className="text-elite-black/60 text-sm uppercase tracking-wider">
                    Kategoriler
                  </span>
                  <div className="mt-2 flex flex-col gap-2">
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/kategori/${category.slug}`}
                        className="text-elite-black font-medium py-1 pl-4"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <Link href="/hakkimizda" className="hover:text-elite-gold transition-colors">
  Hakkımızda
</Link>

                <Link href="/iletişim" className="hover:text-elite-gold transition-colors">
  İletişim
</Link>

                <div className="border-t border-elite-black/10 pt-4">
                  <Link
                    href="/giris"
                    className="flex items-center gap-2 text-elite-black font-medium py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    Giriş Yap / Kayıt Ol
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
