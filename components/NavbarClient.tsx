"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, User as UserIcon, ShoppingBag, Menu, X, ArrowRight } from "lucide-react";
import type { CategoryWithChildren } from "@/types";
import UserMenu from "@/components/UserMenu";

interface NavbarClientProps {
  categories: CategoryWithChildren[];
}

export default function NavbarClient({ categories }: NavbarClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobil menü açıkken body scroll kilit
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const handleMouseEnter = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveDropdown(id);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setActiveDropdown(null), 120);
  };

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 h-16 lg:h-20 bg-[#111111] border-b border-[#B89947]/20">
        <div className="h-full grid grid-cols-3 items-center px-6 lg:px-12">

          {/* Logo */}
          <Link
            href="/"
            className="font-['Cinzel',_serif] text-white text-[13px] tracking-[0.3em] uppercase"
          >
            Hanedan
          </Link>

          {/* Masaüstü Kategori Menüsü */}
          <ul className="hidden lg:flex items-center justify-center gap-8 xl:gap-12">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="relative py-6 -my-6"
                onMouseEnter={() => handleMouseEnter(cat.id)}
                onMouseLeave={handleMouseLeave}
              >
                {/* [1] Ana kategori — artık tıklanabilir Link */}
                <Link
                  href={`/kategori/${cat.slug}`}
                  className="text-white/60 text-[10px] tracking-[0.28em] uppercase hover:text-[#B89947] transition-colors duration-300"
                >
                  {cat.name}
                </Link>

                {/* [3] Hover köprüsü: py-6 / -my-6 ile <li> hover alanı genişletildi.
                    Dropdown pt-2 ile üstte görünmez padding alır — fare geçişi kopmuyor. */}
                {cat.children.length > 0 && activeDropdown === cat.id && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-2 min-w-[200px]"
                    onMouseEnter={() => handleMouseEnter(cat.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="relative bg-[#111111] border border-[#B89947]/20 py-3">
                      {/* İnce üst çizgi vurgusu */}
                      <div className="absolute top-0 left-4 right-4 h-px bg-[#B89947]/40" />

                      {/* [2] Alt kategoriler */}
                      {cat.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/kategori/${sub.slug}`}
                          className="block px-6 py-2 text-white/60 text-[9px] tracking-[0.28em] uppercase hover:text-[#B89947] hover:bg-[#B89947]/5 transition-colors duration-200"
                        >
                          {sub.name}
                        </Link>
                      ))}

                      {/* [2] Tümünü Gör */}
                      <div className="border-t border-white/10 mt-1 mx-4" />
                      <Link
                        href={`/kategori/${cat.slug}`}
                        className="group flex items-center justify-between px-6 pt-3 pb-1 text-white/40 text-[9px] tracking-[0.28em] uppercase hover:text-[#B89947] hover:bg-[#B89947]/5 transition-colors duration-200"
                      >
                        Tümünü Gör
                        <ArrowRight
                          size={10}
                          strokeWidth={1.5}
                          className="transition-transform duration-200 group-hover:translate-x-1"
                        />
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* İkon Grubu */}
          <div className="flex items-center justify-end gap-5 text-white/60">
            <Search
              size={17}
              strokeWidth={1.5}
              className="hidden lg:block hover:text-[#B89947] transition-colors duration-300 cursor-pointer"
            />
            <UserMenu />
            <Link href="/sepet" aria-label="Sepet">
              <ShoppingBag
                size={17}
                strokeWidth={1.5}
                className="hover:text-[#B89947] transition-colors duration-300"
              />
            </Link>

            {/* Hamburger — sadece mobil */}
            <button
              className="lg:hidden hover:text-[#B89947] transition-colors duration-300"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Menüyü aç"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </div>

        </div>
      </nav>

      {/* ── Mobil Drawer Overlay ─────────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Mobil Drawer Panel ───────────────────────────────────────────────── */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-full w-72 bg-[#111111] border-l border-[#B89947]/20
          flex flex-col
          transition-transform duration-300 ease-in-out lg:hidden
          ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Drawer Başlık */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-[#B89947]/20 shrink-0">
          <span className="font-['Cinzel',_serif] text-white text-[12px] tracking-[0.3em] uppercase">
            Menü
          </span>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-white/60 hover:text-[#B89947] transition-colors duration-300"
            aria-label="Menüyü kapat"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Drawer Kategori Listesi */}
        <nav className="flex-1 overflow-y-auto py-6 px-6 space-y-1">
          {categories.map((cat) => (
            <div key={cat.id} className="mb-4">
              {/* [1] Ana kategori başlığı — artık tıklanabilir Link */}
              <Link
                href={`/kategori/${cat.slug}`}
                className="block text-[#B89947] text-[9px] tracking-[0.35em] uppercase mb-2 hover:text-[#B89947]/70 transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {cat.name}
              </Link>

              {/* Alt kategoriler */}
              {cat.children.length > 0 ? (
                <ul className="space-y-1 pl-2 border-l border-[#B89947]/20">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/kategori/${sub.slug}`}
                        className="block text-white/60 text-[10px] tracking-[0.25em] uppercase py-1.5 hover:text-[#B89947] transition-colors duration-200"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}

                  {/* [2] Tümünü Gör — alt kategori listesinin sonunda */}
                  <li className="border-t border-white/10 mt-1 pt-1">
                    <Link
                      href={`/kategori/${cat.slug}`}
                      className="group flex items-center gap-1.5 text-white/40 text-[9px] tracking-[0.25em] uppercase py-1.5 hover:text-[#B89947] transition-colors duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Tümünü Gör
                      <ArrowRight
                        size={9}
                        strokeWidth={1.5}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                </ul>
              ) : (
                <Link
                  href={`/kategori/${cat.slug}`}
                  className="block text-white/60 text-[10px] tracking-[0.25em] uppercase py-1.5 pl-2 border-l border-[#B89947]/20 hover:text-[#B89947] transition-colors duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Tümünü Gör
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Drawer Alt İkonlar */}
        <div className="shrink-0 px-6 py-5 border-t border-[#B89947]/20 flex items-center gap-6 text-white/50">
          <Link
            href="/account"
            className="flex items-center gap-2 text-[9px] tracking-[0.25em] uppercase hover:text-[#B89947] transition-colors duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <UserIcon size={15} strokeWidth={1.5} />
            Hesabım
          </Link>
          <Link
            href="/sepet"
            className="flex items-center gap-2 text-[9px] tracking-[0.25em] uppercase hover:text-[#B89947] transition-colors duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <ShoppingBag size={15} strokeWidth={1.5} />
            Sepet
          </Link>
        </div>
      </div>
    </>
  );
}
