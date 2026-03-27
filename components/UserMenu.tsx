"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User as UserIcon, LogOut, Package, ChevronDown, UserCircle, MapPin } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) {
    return (
      <Link
        href="/giris"
        className="hover:text-[#B89947] transition-colors duration-300"
        aria-label="Giriş Yap"
      >
        <UserIcon size={17} strokeWidth={1.5} />
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none group"
      >
        <div className="w-6 h-6 rounded-full flex items-center justify-center border border-[#B89947]/50 text-[#B89947] bg-[#B89947]/10 transition-colors group-hover:bg-[#B89947]/20">
          {user.user_metadata?.full_name ? (
            <span className="text-[10px] font-bold">
              {user.user_metadata.full_name[0].toUpperCase()}
            </span>
          ) : (
            <UserCircle size={14} strokeWidth={1.5} />
          )}
        </div>

        <span className="hidden md:block max-w-[80px] truncate text-white/80 text-[10px] tracking-[0.1em] uppercase group-hover:text-[#B89947] transition-colors">
          {user.user_metadata?.full_name || "Hesabım"}
        </span>

        <ChevronDown
          size={12}
          className={`text-white/60 group-hover:text-[#B89947] transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-4 w-56 bg-[#111111] border border-[#B89947]/20 shadow-2xl py-2 z-50">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89947]/50 to-transparent" />

          <div className="px-5 py-4 border-b border-white/5 mb-2">
            <p className="text-[11px] text-white tracking-[0.1em] uppercase truncate mb-1">
              {user.user_metadata?.full_name || "Kullanıcı"}
            </p>
            <p className="text-[9px] text-white/40 tracking-wider truncate">
              {user.email}
            </p>
          </div>

          <Link
            href="/account"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-5 py-2.5 text-[10px] text-white/60 tracking-[0.2em] uppercase hover:text-[#B89947] hover:bg-white/5 transition-all duration-300"
          >
            <UserIcon size={14} strokeWidth={1.5} />
            Hesabım
          </Link>

          <Link
            href="/account/orders"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-5 py-2.5 text-[10px] text-white/60 tracking-[0.2em] uppercase hover:text-[#B89947] hover:bg-white/5 transition-all duration-300"
          >
            <Package size={14} strokeWidth={1.5} />
            Siparişlerim
          </Link>

          <Link
            href="/account/addresses"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-5 py-2.5 text-[10px] text-white/60 tracking-[0.2em] uppercase hover:text-[#B89947] hover:bg-white/5 transition-all duration-300"
          >
            <MapPin size={14} strokeWidth={1.5} />
            Adreslerim
          </Link>

          <div className="border-t border-white/5 my-2"></div>

          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-3 px-5 py-2.5 text-[10px] text-red-400/80 tracking-[0.2em] uppercase hover:text-red-400 hover:bg-red-400/10 transition-all duration-300 text-left"
          >
            <LogOut size={14} strokeWidth={1.5} />
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}
