'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowRight,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  ChevronDown,
  MapPin,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { getUserOrders } from '@/lib/actions';
import { formatPrice } from '@/lib/utils';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PILE_LABELS_UPPER,
  OrderStatus,
  OrderWithItems,
} from '@/types';

// Status icon mapping
const STATUS_ICONS: Record<OrderStatus, React.ElementType> = {
  PENDING: Clock,
  PAID: CheckCircle,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle,
  CANCELLED: XCircle,
};

export default function SiparislerPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      const result = await getUserOrders();

      if (result.success && result.data) {
        setOrders(result.data);
      } else {
        setError(result.error || 'Siparişler yüklenemedi');
      }

      setIsLoading(false);
    }

    loadOrders();
  }, []);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-elite-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-red-500 p-4 bg-red-50 rounded-lg">
          Siparişler yüklenemedi: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="font-serif text-2xl font-semibold text-elite-black">
          Siparişlerim
        </h1>
        <p className="text-elite-gray mt-1">
          Tüm siparişlerinizi buradan takip edebilirsiniz.
        </p>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package className="w-16 h-16 text-elite-gray/30 mx-auto mb-4" />
          <h2 className="font-serif text-xl font-semibold text-elite-black mb-2">
            Henüz Sipariş Yok
          </h2>
          <p className="text-elite-gray mb-6">
            Henüz sipariş vermediniz. Koleksiyonumuzu keşfetmeye ne dersiniz?
          </p>
          <Link href="/" className="elite-button inline-flex">
            Alışverişe Başla
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const StatusIcon = STATUS_ICONS[order.status as OrderStatus];
            const isExpanded = expandedOrders.has(order.id);

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* Accordion Header - Clickable */}
                <button
                  onClick={() => toggleOrder(order.id)}
                  className="w-full p-6 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-elite-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <StatusIcon className="w-6 h-6 text-elite-gold" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-mono text-sm font-medium text-elite-black">
                          {order.order_number}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            ORDER_STATUS_COLORS[order.status as OrderStatus]
                          }`}
                        >
                          {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                        </span>
                      </div>
                      <p className="text-sm text-elite-gray mt-1">
                        {new Date(order.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        <span className="mx-2">•</span>
                        {order.items?.length || 0} ürün
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="font-serif text-xl font-bold text-elite-gold">
                      {formatPrice(order.total_amount)}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Accordion Body - Expandable */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 border-t border-gray-100">
                    {/* Order Items */}
                    <div className="mt-4 space-y-3">
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        Sipariş Kalemleri
                      </h3>
                      {order.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-4 p-4 bg-elite-bone/50 rounded-lg"
                        >
                          {/* Product Image */}
                          <div className="w-14 h-14 bg-gradient-to-br from-elite-gold/20 to-elite-bone rounded-lg flex-shrink-0" />

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/urun/${item.product_slug}`}
                              className="font-medium text-elite-black hover:text-elite-gold transition-colors"
                            >
                              {item.product_name}
                            </Link>
                            <div className="mt-1 text-sm text-elite-gray">
                              <span className="font-medium">
                                {item.width_cm} x {item.height_cm} cm
                              </span>
                              <span className="mx-1.5 text-gray-300">•</span>
                              <span>{item.area_m2.toFixed(2)} m²</span>
                              <span className="mx-1.5 text-gray-300">•</span>
                              <span>{PILE_LABELS_UPPER[item.pile_factor]}</span>
                            </div>
                          </div>

                          {/* Quantity & Price */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-elite-gray">x{item.quantity}</p>
                            <p className="font-semibold text-elite-black">
                              {formatPrice(item.total_price)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Shipping Address */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-elite-gold flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">
                            Teslimat Adresi
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {order.shipping_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex flex-wrap justify-between gap-4 text-sm">
                        <div className="space-y-1 text-elite-gray">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            <span>
                              {order.payment_method === 'bank_transfer'
                                ? 'Havale/EFT'
                                : order.payment_method === 'cash_on_delivery'
                                ? 'Kapıda Ödeme'
                                : 'Kredi Kartı'}
                            </span>
                          </div>
                          {order.shipping_cost > 0 && (
                            <p>Kargo: {formatPrice(order.shipping_cost)}</p>
                          )}
                        </div>

                        <Link
                          href={`/hesabim/siparisler/${order.id}`}
                          className="inline-flex items-center gap-2 text-elite-gold hover:text-elite-gold/80 font-medium transition-colors"
                        >
                          Detaylı Görüntüle
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
