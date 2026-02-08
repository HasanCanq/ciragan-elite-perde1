'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User as UserIcon, LogOut, Package, ChevronDown, UserCircle, MapPin } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menü dışına tıklayınca kapatma
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // KULLANICI GİRİŞ YAPMAMIŞSA
  if (!user) {
    return (
      <Link
        href="/giris"
        className="relative p-2 text-elite-black hover:opacity-70 transition-opacity duration-300"
      >
        <UserIcon className="w-5 h-5" />
      </Link>
    );
  }

  // KULLANICI GİRİŞ YAPMIŞSA
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-elite-black transition-colors focus:outline-none group"
      >
        {/* Profil Yuvarlağı */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-elite-gold text-white transition-colors">
          {user.user_metadata.full_name ? (
            user.user_metadata.full_name[0].toUpperCase()
          ) : (
            <UserCircle className="w-5 h-5" />
          )}
        </div>

        {/* İsim */}
        <span className="hidden md:block max-w-[100px] truncate text-elite-gold">
          {user.user_metadata.full_name || 'Hesabım'}
        </span>

        {/* Ok İkonu */}
        <ChevronDown
          className={`w-4 h-4 text-elite-gold transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Açılır Menü */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-elite border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
          {/* Kullanıcı Bilgi Alanı */}
          <div className="px-4 py-3 border-b border-gray-100 mb-2 bg-elite-bone/30">
            <p className="text-sm font-semibold text-elite-black truncate">
              {user.user_metadata.full_name || 'Kullanıcı'}
            </p>
            <p className="text-xs text-elite-gray truncate">{user.email}</p>
          </div>

          {/* MENÜ LİNKLERİ */}
          <Link
            href="/account"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-elite-black hover:bg-elite-bone hover:text-elite-gold transition-colors"
          >
            <UserIcon className="w-4 h-4 text-elite-gold" />
            Hesabım
          </Link>

          <Link
            href="/account/orders"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-elite-black hover:bg-elite-bone hover:text-elite-gold transition-colors"
          >
            <Package className="w-4 h-4 text-elite-gold" />
            Siparişlerim
          </Link>

          <Link
            href="/account/addresses"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-elite-black hover:bg-elite-bone hover:text-elite-gold transition-colors"
          >
            <MapPin className="w-4 h-4 text-elite-gold" />
            Adreslerim
          </Link>

          <div className="border-t border-gray-100 my-2"></div>

          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}
