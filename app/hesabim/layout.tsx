import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  User,
  Package,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';

export const metadata = {
  title: 'Hesabım | Çırağan Elite Perde',
  description: 'Hesap bilgilerinizi ve siparişlerinizi yönetin',
};

async function getUserProfile() {
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

  return { user, profile };
}

export default async function HesabimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getUserProfile();

  if (!userData) {
    redirect('/giris?redirect=/hesabim');
  }

  const { profile } = userData;

  const navItems = [
    { href: '/hesabim', label: 'Hesap Özeti', icon: User },
    { href: '/hesabim/siparisler', label: 'Siparişlerim', icon: Package },
    { href: '/hesabim/adresler', label: 'Adreslerim', icon: MapPin },
    { href: '/hesabim/ayarlar', label: 'Ayarlar', icon: Settings },
  ];

  return (
    <div className="bg-elite-bone min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="elite-container py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-elite-gray hover:text-elite-gold transition-colors"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <span className="text-elite-black font-medium">Hesabım</span>
          </nav>
        </div>
      </div>

      <div className="elite-container py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              {/* User Info */}
              <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                <div className="w-14 h-14 rounded-full bg-elite-gold/20 flex items-center justify-center">
                  <span className="text-elite-gold font-bold text-xl">
                    {(profile?.full_name || profile?.email)?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-elite-black truncate">
                    {profile?.full_name || 'Kullanıcı'}
                  </p>
                  <p className="text-sm text-elite-gray truncate">
                    {profile?.email}
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="mt-6">
                <ul className="space-y-1">
                  {navItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 text-elite-gray rounded-lg
                                 hover:bg-elite-gold/10 hover:text-elite-gold transition-colors"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Logout */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 rounded-lg
                             hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Çıkış Yap</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
