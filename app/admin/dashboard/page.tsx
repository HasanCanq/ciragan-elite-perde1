import { Suspense } from 'react';
import { getDashboardStats, getAllOrders } from '@/lib/actions';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from '@/types';
import { formatPrice } from '@/lib/utils';
import {
  ShoppingBag,
  Clock,
  TrendingUp,
  CalendarDays,
  Package,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { OrderStatusUpdater } from './OrderStatusUpdater';

export const dynamic = 'force-dynamic';


function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-elite-black">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}


async function DashboardStats() {
  const { data: stats, error } = await getDashboardStats();

  if (error || !stats) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        İstatistikler yüklenemedi: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Toplam Sipariş"
        value={stats.totalOrders}
        icon={ShoppingBag}
        color="bg-blue-500"
      />
      <StatCard
        title="Bekleyen Sipariş"
        value={stats.pendingOrders}
        icon={Clock}
        description="Onay bekliyor"
        color="bg-yellow-500"
      />
      <StatCard
        title="Toplam Gelir"
        value={formatPrice(stats.totalRevenue)}
        icon={TrendingUp}
        color="bg-green-500"
      />
      <StatCard
        title="Bugünkü Sipariş"
        value={stats.todayOrders}
        icon={CalendarDays}
        color="bg-purple-500"
      />
    </div>
  );
}


async function RecentOrdersTable() {
  const { data: ordersData, error } = await getAllOrders(1, 10);

  if (error || !ordersData) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Siparişler yüklenemedi: {error}
      </div>
    );
  }

  const { data: orders } = ordersData;

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Henüz sipariş bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              Sipariş No
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              Müşteri
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              Ürünler
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              Tutar
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              Durum
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              Tarih
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              İşlem
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4">
                <span className="font-mono text-sm font-medium text-elite-black">
                  {order.order_number}
                </span>
              </td>
              <td className="px-4 py-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {order.customer_name}
                  </p>
                  <p className="text-sm text-gray-500">{order.customer_email}</p>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="text-sm text-gray-600">
                  {order.items?.length || 0} ürün
                </span>
              </td>
              <td className="px-4 py-4">
                <span className="font-semibold text-elite-black">
                  {formatPrice(order.total_amount)}
                </span>
              </td>
              <td className="px-4 py-4">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    ORDER_STATUS_COLORS[order.status as OrderStatus]
                  }`}
                >
                  {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                </span>
              </td>
              <td className="px-4 py-4">
                <span className="text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </td>
              <td className="px-4 py-4">
                <OrderStatusUpdater
                  orderId={order.id}
                  currentStatus={order.status as OrderStatus}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function StatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-32"></div>
        </div>
      ))}
    </div>
  );
}

function TableLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded"></div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-elite-black">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Mağazanızın genel durumunu buradan takip edebilirsiniz.
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        <DashboardStats />
      </Suspense>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-elite-black">
              Son Siparişler
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              En son gelen siparişleriniz
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-elite-gold hover:text-elite-gold/80
                     font-medium text-sm transition-colors"
          >
            Tümünü Gör
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-6">
          <Suspense fallback={<TableLoading />}>
            <RecentOrdersTable />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
