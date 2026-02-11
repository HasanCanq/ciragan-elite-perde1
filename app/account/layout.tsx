import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { User, MapPin, Package, LogOut, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const navItems = [
  { href: '/account', label: 'Kişisel Bilgilerim', icon: User },
  { href: '/account/addresses', label: 'Adreslerim', icon: MapPin },
  { href: '/account/orders', label: 'Siparişlerim', icon: Package },
];

async function getUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getUser();

  if (!userData) {
    redirect('/giris?redirect=/account');
  }

  const { user, profile } = userData;

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
            <div className="bg-white rounded-xl shadow-sm overflow-hidden sticky top-24">
              {/* User Info */}
              <div className="p-6 bg-gradient-to-r from-elite-gold/10 to-elite-bone border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-elite-gold flex items-center justify-center text-white text-xl font-bold">
                    {profile?.full_name?.[0]?.toUpperCase() ||
                      user.email?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-elite-black truncate">
                      {profile?.full_name || 'Kullanıcı'}
                    </p>
                    <p className="text-sm text-elite-gray truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="p-4">
                <ul className="space-y-1">
                  {navItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-elite-gray
                                 hover:bg-elite-bone hover:text-elite-gold transition-colors group"
                      >
                        <item.icon className="w-5 h-5 group-hover:text-elite-gold transition-colors" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Sign Out */}
              <div className="p-4 border-t border-gray-100">
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600
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
