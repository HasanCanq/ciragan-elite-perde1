'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, User, ShoppingBag, Menu, X } from 'lucide-react';
import { useCartTotalItems } from '@/store/cartStore';

export interface NavItem {
  label: string;
  href:  string;
}

function DesktopNavLink({ label, href }: NavItem) {
  return (
    <Link
      href={href}
      className={[
        'relative inline-block pb-[3px]',
        'text-[10px] tracking-[0.19em] uppercase text-black',
        'hover:text-[#B89947] transition-colors duration-200',
        'after:absolute after:bottom-0 after:left-0',
        'after:h-[1px] after:w-0 after:bg-[#B89947]',
        'after:transition-[width] after:duration-[350ms] after:ease-out',
        'hover:after:w-full',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

export default function HeaderClient({ navItems }: { navItems: NavItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled]  = useState(false);
  const cartCount = useCartTotalItems();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header
      className={[
        'sticky top-0 z-50 bg-white',
        'transition-[box-shadow] duration-300',
        scrolled ? 'shadow-[0_1px_0_0_#F3F4F6]' : '',
      ].join(' ')}
    >
      {/* ── Main bar ─────────────────────────────────────────── */}
      <div className="h-container">
        <div className="flex items-center h-16 gap-4">

          {/* Logo */}
          <div className="w-40 xl:w-48 shrink-0">
            <Link
              href="/"
              className="font-serif text-[19px] tracking-[0.32em] uppercase text-black hover:text-[#B89947] transition-colors duration-200"
            >
              Hanedan
            </Link>
          </div>

          {/* Desktop nav */}
          <nav
            aria-label="Ana navigasyon"
            className="flex-1 hidden xl:flex items-center justify-center gap-[22px]"
          >
            {navItems.map((item) => (
              <DesktopNavLink key={item.href} {...item} />
            ))}
          </nav>

          {/* Icon group */}
          <div className="w-40 xl:w-48 shrink-0 flex items-center justify-end gap-0.5">
            <button
              type="button"
              aria-label="Ara"
              className="p-2.5 text-black hover:text-[#B89947] transition-colors duration-200"
            >
              <Search size={17} strokeWidth={1.4} aria-hidden="true" />
            </button>

            <Link
              href="/account"
              aria-label="Hesabım"
              className="hidden sm:flex p-2.5 text-black hover:text-[#B89947] transition-colors duration-200"
            >
              <User size={17} strokeWidth={1.4} aria-hidden="true" />
            </Link>

            {/* Cart with live badge */}
            <Link
              href="/sepet"
              aria-label={cartCount > 0 ? `Sepet, ${cartCount} ürün` : 'Sepet'}
              className="relative p-2.5 text-black hover:text-[#B89947] transition-colors duration-200"
            >
              <ShoppingBag size={17} strokeWidth={1.4} aria-hidden="true" />
              {cartCount > 0 && (
                <span
                  aria-hidden="true"
                  className={[
                    'absolute top-[6px] right-[6px]',
                    'flex items-center justify-center',
                    'min-w-[14px] h-[14px] px-[3px]',
                    'bg-black text-white',
                    'text-[8px] font-medium leading-none rounded-full',
                  ].join(' ')}
                >
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Hamburger */}
            <button
              type="button"
              aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="xl:hidden p-2.5 ml-1 text-black hover:text-[#B89947] transition-colors duration-200"
            >
              {menuOpen
                ? <X    size={19} strokeWidth={1.4} aria-hidden="true" />
                : <Menu size={19} strokeWidth={1.4} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ─────────────────────────────────────── */}
      <div
        id="mobile-menu"
        role="navigation"
        aria-label="Mobil navigasyon"
        aria-hidden={!menuOpen}
        className={[
          'xl:hidden bg-white overflow-hidden',
          'transition-[max-height,opacity] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          menuOpen
            ? 'max-h-[520px] opacity-100 border-t border-[#F3F4F6]'
            : 'max-h-0 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <div className="h-container pb-8 pt-1">
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={[
                'flex items-center justify-between',
                'py-[14px] border-b border-[#F3F4F6] last:border-0',
                'text-[11px] tracking-[0.25em] uppercase text-black',
                'hover:text-[#B89947] transition-colors duration-200',
                'transition-opacity duration-300',
                menuOpen ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{ transitionDelay: menuOpen ? `${80 + i * 40}ms` : '0ms' }}
            >
              <span>{item.label}</span>
              <span className="text-[#B89947] text-[11px]" aria-hidden="true">↗</span>
            </Link>
          ))}

          <div
            className={[
              'flex gap-8 pt-6 transition-opacity duration-300',
              menuOpen ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            style={{ transitionDelay: menuOpen ? `${80 + navItems.length * 40}ms` : '0ms' }}
          >
            <Link href="/hesabim" onClick={() => setMenuOpen(false)} className="text-[10px] tracking-[0.22em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200">
              Hesabım
            </Link>
            <Link href="/giris" onClick={() => setMenuOpen(false)} className="text-[10px] tracking-[0.22em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200">
              Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
