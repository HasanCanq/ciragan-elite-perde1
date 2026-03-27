import { getCustomer360 } from '@/lib/actions/customers';
import { formatPrice } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from '@/types';
import {
  User,
  ShoppingBag,
  TrendingUp,
  XCircle,
  BarChart3,
  Mail,
  Phone,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Customer360Page({ params }: PageProps) {
  const { id } = await params;
  const { data, success } = await getCustomer360(id);

  // Elegant empty state — no 404
  if (!success || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <User className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Müşteri Bulunamadı</h2>
        <p className="text-gray-400 mb-6">
          Bu müşteriye ait veri mevcut değil ya da silinmiş olabilir.
        </p>
        <Link
          href="/admin/customers"
          className="flex items-center gap-2 px-4 py-2 text-sm text-[#B89947] border border-[#B89947] hover:bg-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Müşteri Listesine Dön
        </Link>
      </div>
    );
  }

  const { profile, totalOrders, totalSpent, cancelledOrders, cancellationRate, avgOrderValue, recentOrders } = data;

  const kpis = [
    {
      label: 'Toplam Sipariş',
      value: totalOrders.toString(),
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Yaşam Boyu Değer (LTV)',
      value: formatPrice(totalSpent),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Ortalama Sipariş',
      value: formatPrice(avgOrderValue),
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'İptal Oranı',
      value: `%${cancellationRate}`,
      icon: XCircle,
      color: cancellationRate > 30 ? 'text-red-600' : 'text-gray-600',
      bg: cancellationRate > 30 ? 'bg-red-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Geri Git */}
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#B89947] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Müşteri Listesi
      </Link>

      {/* Profil Kartı */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-[#FAFAFA] flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-[#B89947]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl font-semibold text-black truncate">
              {profile.full_name || 'İsimsiz Müşteri'}
            </h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
              {profile.email && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Mail className="w-4 h-4" />
                  {profile.email}
                </span>
              )}
              {profile.phone && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Phone className="w-4 h-4" />
                  {profile.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                Kayıt:{' '}
                {new Date(profile.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 flex-shrink-0 ${
              profile.role === 'ADMIN'
                ? 'bg-[#FAFAFA] text-[#B89947]'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {profile.role}
          </span>
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-5">
            <div className={`w-10 h-10 ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold text-black">{kpi.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Son Siparişler */}
      <div className="bg-white rounded-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Son Siparişler</h2>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Henüz sipariş yok</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span className="font-mono text-sm font-medium text-black">
                    {order.order_number}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-900">
                    {formatPrice(order.total_amount)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium ${
                      ORDER_STATUS_COLORS[order.status as OrderStatus] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalOrders > 5 && (
          <div className="px-6 py-3 border-t border-gray-100 text-center">
            <Link
              href={`/admin/orders?customer=${id}`}
              className="text-sm text-[#B89947] hover:underline"
            >
              Tüm {totalOrders} siparişi görüntüle →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
