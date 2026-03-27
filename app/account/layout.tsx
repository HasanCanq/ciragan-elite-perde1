import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { User, MapPin, Package, LogOut, ChevronRight } from 'lucide-react';

export const revalidate = 0;

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
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-[#F3F4F6]">
        <div className="h-container py-4">
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <span className="text-[#B89947]/70 text-[9px] tracking-[0.3em] uppercase">Hesabım</span>
          </nav>
        </div>
      </div>

      <div className="h-container py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="border border-[#F3F4F6] overflow-hidden sticky top-24 bg-white">
              {/* User Info */}
              <div className="p-6 bg-[#FAFAFA] border-b border-[#F3F4F6]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-[#B89947]/40 bg-[#B89947] flex items-center justify-center text-white font-serif text-lg">
                    {profile?.full_name?.[0]?.toUpperCase() ||
                      user.email?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-black text-[11px] tracking-[0.1em] truncate">
                      {profile?.full_name || 'Kullanıcı'}
                    </p>
                    <p className="text-[9px] text-[#9CA3AF] tracking-[0.05em] truncate mt-0.5">{user.email}</p>
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
                        className="flex items-center gap-3 px-4 py-3 text-[#9CA3AF] text-[9px] tracking-[0.2em] uppercase
                                 hover:bg-[#F3F4F6] hover:text-[#B89947] transition-colors duration-200 group"
                      >
                        <item.icon className="w-4 h-4 group-hover:text-[#B89947] transition-colors shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Sign Out */}
              <div className="p-4 border-t border-[#F3F4F6]">
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400/80 text-[9px] tracking-[0.2em] uppercase
                             hover:bg-red-50 hover:text-red-500 transition-colors duration-200"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Çıkış Yap</span>
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
