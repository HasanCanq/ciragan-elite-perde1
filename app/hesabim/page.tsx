import { createClient } from '@/lib/supabase/server';
import { getUserOrders } from '@/lib/actions';
import { formatPrice } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from '@/types';
import Link from 'next/link';
import { Package, ShoppingBag, MapPin, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getUserProfile() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

export default async function HesabimPage() {
  const [profile, ordersResult] = await Promise.all([
    getUserProfile(),
    getUserOrders(),
  ]);

  const recentOrders = ordersResult.data?.slice(0, 3) || [];
  const totalOrders = ordersResult.data?.length || 0;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="font-serif text-2xl font-semibold text-elite-black mb-2">
          Hoş Geldiniz, {profile?.full_name || 'Değerli Müşterimiz'}!
        </h1>
        <p className="text-elite-gray">
          Hesabınızı bu sayfadan yönetebilir, siparişlerinizi takip edebilirsiniz.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-elite-black">{totalOrders}</p>
              <p className="text-sm text-elite-gray">Toplam Sipariş</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-elite-black">
                {recentOrders.filter((o) => o.status === 'DELIVERED').length}
              </p>
              <p className="text-sm text-elite-gray">Teslim Edilen</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <MapPin className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-elite-black">
                {profile?.address ? '1' : '0'}
              </p>
              <p className="text-sm text-elite-gray">Kayıtlı Adres</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-elite-black">
              Son Siparişlerim
            </h2>
            <p className="text-sm text-elite-gray mt-1">
              Son 3 siparişiniz
            </p>
          </div>
          <Link
            href="/hesabim/siparisler"
            className="inline-flex items-center gap-2 text-elite-gold hover:text-elite-gold/80
                     font-medium text-sm transition-colors"
          >
            Tümünü Gör
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-6">
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-elite-gray">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Henüz sipariş vermediniz</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-elite-gold mt-4 hover:underline"
              >
                Alışverişe Başla
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:border-elite-gold/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-elite-gold/10 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-elite-gold" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium text-elite-black">
                        {order.order_number}
                      </p>
                      <p className="text-sm text-elite-gray">
                        {new Date(order.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-elite-black">
                        {formatPrice(order.total_amount)}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          ORDER_STATUS_COLORS[order.status as OrderStatus]
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </span>
                    </div>

                    <Link
                      href={`/hesabim/siparisler/${order.id}`}
                      className="p-2 text-elite-gray hover:text-elite-gold transition-colors"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/hesabim/ayarlar"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
        >
          <h3 className="font-semibold text-elite-black mb-2 group-hover:text-elite-gold transition-colors">
            Profil Bilgilerini Güncelle
          </h3>
          <p className="text-sm text-elite-gray">
            Ad, soyad, telefon ve diğer bilgilerinizi düzenleyin
          </p>
        </Link>

        <Link
          href="/hesabim/adresler"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
        >
          <h3 className="font-semibold text-elite-black mb-2 group-hover:text-elite-gold transition-colors">
            Adres Yönetimi
          </h3>
          <p className="text-sm text-elite-gray">
            Teslimat adreslerinizi ekleyin veya düzenleyin
          </p>
        </Link>
      </div>
    </div>
  );
}
