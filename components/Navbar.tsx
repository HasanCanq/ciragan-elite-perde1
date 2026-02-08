"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Menu, X, Search, User } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

const categories = [
  { id: "1", name: "Tül Perdeler", slug: "tul-perdeler" },
  { id: "2", name: "Fon Perdeler", slug: "fon-perdeler" },
  { id: "3", name: "Stor Perdeler", slug: "stor-perdeler" },
  { id: "4", name: "Zebra Perdeler", slug: "zebra-perdeler" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const totalItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const setCartOpen = useCartStore((state) => state.setCartOpen);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Top Bar — scrolls away with the page */}
      <div className="bg-black text-white">
        <div className="elite-container py-2">
          <div className="flex items-center justify-between text-xs font-light tracking-wide">
            <span className="hidden sm:block text-white/70">
              Ücretsiz Kargo &nbsp;|&nbsp; 5.000 TL ve Üzeri Siparişlerde
            </span>
            <a
              href="tel:05322959586"
              className="text-white/80 hover:text-white transition-colors duration-300 ml-auto sm:ml-0"
            >
              0532 295 95 86
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar — sticky white bar */}
      <nav
        className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${
          scrolled ? "shadow-md" : "shadow-none"
        }`}
      >
        <div className="elite-container">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/logo.png"
                alt="Çırağan Elite Perde"
                width={160}
                height={40}
                priority
                className="h-10 sm:h-12 w-auto"
              />
            </Link>

            {/* Desktop Categories */}
            <div className="hidden md:flex items-center gap-8">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/kategori/${category.slug}`}
                  className="text-elite-black font-medium text-[15px] hover:text-elite-gold transition-colors duration-300 relative group py-2"
                >
                  {category.name}
                  <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-elite-gold transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-1 sm:gap-3">
              {/* Search */}
              <Link
                href="/kategori/tum-urunler"
                className="p-2 text-elite-black hover:text-elite-gold transition-colors duration-300"
                aria-label="Ürün Ara"
              >
                <Search className="w-5 h-5" />
              </Link>

              {/* Account */}
              <Link
                href="/hesabim"
                className="p-2 text-elite-black hover:text-elite-gold transition-colors duration-300"
                aria-label="Hesabım"
              >
                <User className="w-5 h-5" />
              </Link>

              {/* Cart */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 text-elite-black hover:text-elite-gold transition-colors duration-300"
                aria-label="Sepeti Aç"
              >
                <ShoppingBag className="w-5 h-5" />
                {mounted && totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-elite-gold text-white text-[11px] rounded-full flex items-center justify-center font-bold">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>

              {/* Mobile Toggle */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-elite-black hover:text-elite-gold transition-colors"
                aria-label="Menüyü Aç/Kapat"
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

        {/* Bottom border — subtle separator */}
        <div className="border-b border-gray-100" />

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 top-full shadow-lg">
            <div className="elite-container py-4">
              <div className="flex flex-col">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/kategori/${category.slug}`}
                    className="text-elite-black font-medium py-3 px-4 border-l-2 border-transparent hover:border-elite-gold hover:bg-gray-50 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {category.name}
                  </Link>
                ))}
                <div className="h-px bg-gray-100 my-3 mx-4" />
                <Link
                  href="/hakkimizda"
                  className="text-gray-500 hover:text-elite-black py-2 px-4 text-sm transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Hakkımızda
                </Link>
                <Link
                  href="/iletisim"
                  className="text-gray-500 hover:text-elite-black py-2 px-4 text-sm transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  İletişim
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
