import { Suspense } from 'react';
import { getAllOrders } from '@/lib/actions';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus, PILE_LABELS_UPPER } from '@/types';
import { formatPrice } from '@/lib/utils';
import { Package } from 'lucide-react';
import { OrderStatusUpdater } from '../dashboard/OrderStatusUpdater';
import { OrderDetailModal } from './OrderDetailModal';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

async function OrdersTable({ page, status }: { page: number; status?: OrderStatus }) {
  const { data: ordersData, error } = await getAllOrders(page, 20, status);

  if (error || !ordersData) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Siparişler yüklenemedi: {error}
      </div>
    );
  }

  const { data: orders, total, totalPages } = ordersData;

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Sipariş bulunamadı</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                Sipariş No
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                Müşteri
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                Ürün Detayları
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
                İşlemler
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
                    {order.customer_phone && (
                      <p className="text-sm text-gray-400">{order.customer_phone}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    {order.items?.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-gray-500 ml-2">
                          {item.width_cm}x{item.height_cm}cm •{' '}
                          {PILE_LABELS_UPPER[item.pile_factor]} •{' '}
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 2 && (
                      <span className="text-xs text-gray-400">
                        +{order.items!.length - 2} ürün daha
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <span className="font-semibold text-elite-black block">
                      {formatPrice(order.total_amount)}
                    </span>
                    {order.shipping_cost > 0 && (
                      <span className="text-xs text-gray-400">
                        (Kargo: {formatPrice(order.shipping_cost)})
                      </span>
                    )}
                  </div>
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
                  <div className="text-sm text-gray-500">
                    <div>
                      {new Date(order.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <OrderDetailModal order={order} />
                    <OrderStatusUpdater
                      orderId={order.id}
                      currentStatus={order.status as OrderStatus}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between px-4">
          <p className="text-sm text-gray-500">
            Toplam {total} sipariş
          </p>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`?page=${p}${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1 rounded text-sm ${
                  p === page
                    ? 'bg-elite-gold text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TableLoading() {
  return (
    <div className="space-y-4 animate-pulse p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-100 rounded"></div>
      ))}
    </div>
  );
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const status = params.status as OrderStatus | undefined;

  const statusFilters: (OrderStatus | 'ALL')[] = [
    'ALL',
    'PENDING',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-elite-black">Siparişler</h1>
        <p className="text-gray-500 mt-1">
          Tüm siparişleri buradan yönetebilirsiniz.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <a
            key={s}
            href={s === 'ALL' ? '/admin/orders' : `?status=${s}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (s === 'ALL' && !status) || s === status
                ? 'bg-elite-gold text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-elite-gold'
            }`}
          >
            {s === 'ALL' ? 'Tümü' : ORDER_STATUS_LABELS[s]}
          </a>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <Suspense fallback={<TableLoading />}>
          <OrdersTable page={page} status={status} />
        </Suspense>
      </div>
    </div>
  );
}
