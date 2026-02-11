"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, Search, User } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

const categories = [
  { id: "1", name: "Tül Perdeler", slug: "tul-perdeler" },
  { id: "2", name: "Fon Perdeler", slug: "fon-perdeler" },
  { id: "3", name: "Stor Perdeler", slug: "stor-perdeler" },
  { id: "4", name: "Zebra Perdeler", slug: "zebra-perdeler" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const totalItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const setCartOpen = useCartStore((state) => state.setCartOpen);

  // --- MANTIK KATMANI ---
  const isHiddenPage = pathname.startsWith('/admin') || 
                       pathname.startsWith('/giris') || 
                       pathname.startsWith('/auth');

  const isHomePage = pathname === "/";

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isHiddenPage) return null;

  return (
    <header className="fixed top-0 left-0 w-full z-50 transition-all duration-500">
      {/* Top Bar — Sadece Anasayfada ve henüz kaydırılmamışken görünür */}
      {isHomePage && !scrolled && (
        <div className="bg-black/20 backdrop-blur-sm text-white border-b border-white/10 transition-all duration-300">
          <div className="elite-container py-2">
            <div className="flex items-center justify-between text-xs font-light tracking-wide">
              <span className="hidden sm:block text-white/70">
                Ücretsiz Kargo &nbsp;|&nbsp; 5.000 TL ve Üzeri Siparişlerde
              </span>
              <a href="tel:05322959586" className="text-white/80 hover:text-white transition-colors">
                0532 295 95 86
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <nav
        className={`transition-all duration-500 ${
          (!isHomePage || scrolled) 
            ? "bg-elite-brown shadow-xl py-3" 
            : "bg-transparent py-5"
        }`}
      >
        <div className="elite-container">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex-shrink-0">
              <Image
                src="https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/logo.png"
                alt="Çırağan Elite Perde"
                width={160}
                height={40}
                priority
                className={`h-10 sm:h-12 w-auto transition-all duration-300 `}
              />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/kategori/${category.slug}`}
                  className="text-white font-medium text-[15px] hover:text-elite-gold transition-colors relative group py-2"
                >
                  {category.name}
                  <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-white transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-1 sm:gap-3 text-white">
              <Link href="/kategori/tum-urunler" className="p-2 hover:text-elite-gold transition-colors"><Search className="w-5 h-5" /></Link>
              <Link href="/account" className="p-2 hover:text-elite-gold transition-colors"><User className="w-5 h-5" /></Link>
              <button onClick={() => setCartOpen(true)} className="relative p-2 hover:text-elite-gold transition-colors">
                <ShoppingBag className="w-5 h-5" />
                {mounted && totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-white text-elite-brown text-[11px] rounded-full flex items-center justify-center font-bold">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 hover:text-elite-gold transition-colors">
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 top-full shadow-lg text-black">
            <div className="elite-container py-4 flex flex-col">
              {categories.map((category) => (
                <Link key={category.id} href={`/kategori/${category.slug}`} className="text-elite-black font-medium py-3 px-4 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}