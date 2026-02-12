import { createClient } from '@/lib/supabase/server';
import AdminSidebar from '@/components/admin/AdminSidebar';

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

  // If not admin, render children without sidebar (login page)
  // Middleware ensures only login page is accessible without admin auth
  if (!adminData) {
    return <>{children}</>;
  }

  const { profile } = adminData;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar (Client Component - hamburger + slide-over) */}
      <AdminSidebar />

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-6">
          {/* Mobilde hamburger buton alanı için sol boşluk */}
          <h1 className="text-lg font-medium text-gray-700 pl-12 lg:pl-0 hidden sm:block">
            Yönetim Paneli
          </h1>
          {/* Mobilde boş alan (hamburger button zaten fixed) */}
          <div className="sm:hidden pl-12" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:inline">
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
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
