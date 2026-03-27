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
  DollarSign,
  Percent,
} from 'lucide-react';
import Link from 'next/link';
import { OrderStatusUpdater } from './OrderStatusUpdater';
import { DashboardDateFilter } from './DashboardDateFilter';

export const revalidate = 0; // Admin, her zaman güncel

// Varsayılan kâr marjı: DB'de base_cost henüz yokken kullanılır
const DEFAULT_MARGIN = 0.30;

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

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
    <div className="bg-white rounded-xl p-6 border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-black">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          )}
        </div>
        <div className={`p-3 ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

async function DashboardStats({ days }: { days: number }) {
  const { data: stats, error } = await getDashboardStats(days);

  if (error || !stats) {
    return (
      <div className="text-red-500 p-4 bg-red-50">
        İstatistikler yüklenemedi: {error}
      </div>
    );
  }

  // Kârlılık: ileride getDashboardStats'tan gelecek; şimdilik fallback hesabı
  const netProfit    = (stats as any).netProfit    ?? stats.totalRevenue * DEFAULT_MARGIN;
  const profitMargin = (stats as any).profitMargin ?? DEFAULT_MARGIN * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div className="xl:col-span-1 md:col-span-1">
        <StatCard
          title="Toplam Sipariş"
          value={stats.totalOrders}
          icon={ShoppingBag}
          color="bg-blue-500"
        />
      </div>
      <div className="xl:col-span-1 md:col-span-1">
        <StatCard
          title="Bekleyen Sipariş"
          value={stats.pendingOrders}
          icon={Clock}
          description="Onay bekliyor"
          color="bg-yellow-500"
        />
      </div>
      <div className="xl:col-span-1 md:col-span-1">
        <StatCard
          title="Toplam Gelir"
          value={formatPrice(stats.totalRevenue)}
          icon={TrendingUp}
          color="bg-green-500"
        />
      </div>
      <div className="xl:col-span-1 md:col-span-1">
        <StatCard
          title="Bugünkü Sipariş"
          value={stats.todayOrders}
          icon={CalendarDays}
          color="bg-purple-500"
        />
      </div>
      {/* Kârlılık kartları */}
      <div className="xl:col-span-1 md:col-span-1">
        <StatCard
          title="Net Kâr"
          value={formatPrice(netProfit)}
          icon={DollarSign}
          description="Tahmini (maliyet girilince güncellenir)"
          color="bg-emerald-600"
        />
      </div>
      <div className="xl:col-span-1 md:col-span-1">
        <StatCard
          title="Kâr Marjı"
          value={`%${profitMargin.toFixed(1)}`}
          icon={Percent}
          description="Tahmini (%30 varsayılan)"
          color="bg-teal-500"
        />
      </div>
    </div>
  );
}

async function RecentOrdersTable() {
  const { data: ordersData, error } = await getAllOrders(1, 10);

  if (error || !ordersData) {
    return (
      <div className="text-red-500 p-4 bg-red-50">
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
                <span className="font-mono text-sm font-medium text-black">
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
                <span className="font-semibold text-black">
                  {formatPrice(order.total_amount)}
                </span>
              </td>
              <td className="px-4 py-4">
                <span
                  className={`inline-flex items-center px-2.5 py-1 text-xs font-medium ${
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-6 border border-gray-100 animate-pulse"
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

export default async function AdminDashboard({ searchParams }: PageProps) {
  const params = await searchParams;
  const days = Math.min(Math.max(Number(params.days) || 30, 1), 365); // 1–365 arası clamp

  return (
    <div className="space-y-8">
      {/* Page Header + Tarih Filtresi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Mağazanızın genel durumunu buradan takip edebilirsiniz.
          </p>
        </div>
        <DashboardDateFilter />
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        <DashboardStats days={days} />
      </Suspense>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-black">
              Son Siparişler
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              En son gelen siparişleriniz
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-[#B89947] hover:text-[#B89947]/80
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
