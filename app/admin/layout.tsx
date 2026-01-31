import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  LogOut,
  Home,
} from 'lucide-react';

export const metadata = {
  title: 'Admin Panel | Çırağan Elite Perde',
  description: 'Yönetim Paneli',
};

async function getAdminUser() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    return null;
  }

  return { user, profile };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminData = await getAdminUser();

  if (!adminData) {
    redirect('/');
  }

  const { profile } = adminData;

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/orders', label: 'Siparişler', icon: ShoppingBag },
    { href: '/admin/products', label: 'Ürünler', icon: Package },
    { href: '/admin/customers', label: 'Müşteriler', icon: Users },
    { href: '/admin/settings', label: 'Ayarlar', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-elite-black shadow-xl z-30">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-elite-gray/30">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-serif font-bold text-elite-gold">
              Çırağan Elite
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-gray-300 rounded-lg
                           hover:bg-elite-gold/10 hover:text-elite-gold transition-colors group"
                >
                  <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-elite-gray/30">
          <Link
            href="/"
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

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <h1 className="text-lg font-medium text-gray-700">Yönetim Paneli</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Hoş geldin, <span className="font-medium text-elite-black">{profile.full_name || profile.email}</span>
            </span>
            <div className="w-10 h-10 rounded-full bg-elite-gold/20 flex items-center justify-center">
              <span className="text-elite-gold font-bold">
                {(profile.full_name || profile.email)?.[0]?.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
