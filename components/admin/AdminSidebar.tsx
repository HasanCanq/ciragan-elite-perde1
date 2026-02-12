'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  LogOut,
  Home,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Siparişler', icon: ShoppingBag },
  { href: '/admin/products', label: 'Ürünler', icon: Package },
  { href: '/admin/customers', label: 'Müşteriler', icon: Users },
  { href: '/admin/settings', label: 'Ayarlar', icon: Settings },
];

export default function AdminSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      {/* Mobile: Hamburger Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-elite-black text-white shadow-lg"
        aria-label="Menüyü aç"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile: Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 bg-elite-black shadow-xl z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo + Mobile Close */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-elite-gray/30">
          <Link
            href="/admin/dashboard"
            onClick={closeSidebar}
            className="flex items-center gap-2"
          >
            <span className="text-xl font-serif font-bold text-elite-gold">
              Çırağan Elite
            </span>
          </Link>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 text-gray-400 hover:text-white rounded"
            aria-label="Menüyü kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/dashboard' &&
                  pathname.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group
                      ${
                        isActive
                          ? 'bg-elite-gold/15 text-elite-gold'
                          : 'text-gray-300 hover:bg-elite-gold/10 hover:text-elite-gold'
                      }
                    `}
                  >
                    <item.icon
                      className={`w-5 h-5 transition-transform ${
                        isActive ? 'scale-110' : 'group-hover:scale-110'
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-elite-gray/30">
          <Link
            href="/"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-4 py-3 text-gray-300 rounded-lg
                     hover:bg-elite-gold/10 hover:text-elite-gold transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Siteye Git</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 rounded-lg
                       hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Çıkış Yap</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
