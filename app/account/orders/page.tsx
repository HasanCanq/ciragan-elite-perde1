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
  BadgeCheck,
  Factory,
  PauseCircle,
  Archive,
  Navigation,
  AlertTriangle,
  RotateCcw,
  Banknote,
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

const STATUS_ICONS: Record<OrderStatus, React.ElementType> = {
  PENDING:          Clock,
  PAID:             CheckCircle,
  PROCESSING:       Package,
  CONFIRMED:        BadgeCheck,
  IN_PRODUCTION:    Factory,
  ON_HOLD:          PauseCircle,
  READY_TO_SHIP:    Archive,
  SHIPPED:          Truck,
  IN_TRANSIT:       Navigation,
  DELIVERY_FAILED:  AlertTriangle,
  DELIVERED:        CheckCircle,
  RETURN_REQUESTED: RotateCcw,
  REFUNDED:         Banknote,
  CANCELLED:        XCircle,
};

export default function AccountOrdersPage() {
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#B89947] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 p-6 bg-white">
        <div className="text-red-500 text-[10px] tracking-[0.1em]">
          Siparişler yüklenemedi: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-[#F3F4F6] p-6 bg-white">
        <h1 className="font-serif text-black text-xl tracking-[0.05em]">
          Siparişlerim
        </h1>
        <p className="text-[#9CA3AF] text-[9px] tracking-[0.15em] mt-2">
          Tüm siparişlerinizi buradan takip edebilirsiniz.
        </p>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="border border-[#F3F4F6] p-16 text-center bg-white">
          <Package className="w-12 h-12 text-[#B89947]/20 mx-auto mb-4" />
          <h2 className="font-serif text-black text-lg tracking-[0.05em] mb-2">
            Henüz Sipariş Yok
          </h2>
          <p className="text-[#9CA3AF] text-[9px] tracking-[0.15em] mb-8">
            Henüz sipariş vermediniz. Koleksiyonumuzu keşfetmeye ne dersiniz?
          </p>
          <Link href="/" className="h-btn inline-flex items-center gap-2">
            Alışverişe Başla
            <ArrowRight className="w-4 h-4" />
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
                className="border border-[#F3F4F6] overflow-hidden bg-white"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleOrder(order.id)}
                  className="w-full p-6 flex items-center justify-between gap-4 hover:bg-[#F3F4F6] transition-colors duration-200 text-left"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 border border-[#F3F4F6] bg-[#FAFAFA] flex items-center justify-center shrink-0">
                      <StatusIcon className="w-5 h-5 text-[#B89947]/60" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-mono text-[10px] tracking-[0.1em] text-black">
                          {order.order_number}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[8px] tracking-[0.1em] uppercase font-medium ${
                            ORDER_STATUS_COLORS[order.status as OrderStatus]
                          }`}
                        >
                          {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#9CA3AF] tracking-[0.05em] mt-1">
                        {new Date(order.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        <span className="mx-2">·</span>
                        {order.items?.length || 0} ürün
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-serif text-[#B89947] font-bold text-lg">
                      {formatPrice(order.total_amount)}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#B89947]/40 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Accordion Body */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 border-t border-[#F3F4F6]">
                    {/* Order Items */}
                    <div className="mt-4 space-y-3">
                      <h3 className="text-[8px] text-[#9CA3AF] tracking-[0.3em] uppercase">
                        Sipariş Kalemleri
                      </h3>
                      {order.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-4 p-4 border border-[#F3F4F6] bg-[#FAFAFA]"
                        >
                          <div className="w-12 h-12 bg-[#F3F4F6] border border-[#F3F4F6] shrink-0" />

                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/urun/${item.product_slug}`}
                              className="text-black text-[10px] tracking-[0.05em] hover:text-[#B89947] transition-colors duration-200"
                            >
                              {item.product_name}
                            </Link>
                            <div className="mt-1 text-[9px] text-[#9CA3AF] tracking-[0.05em] space-x-2">
                              <span>{item.width_cm} x {item.height_cm} cm</span>
                              <span>·</span>
                              <span>{item.area_m2.toFixed(2)} m²</span>
                              <span>·</span>
                              <span>{PILE_LABELS_UPPER[item.pile_factor]}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-[9px] text-[#9CA3AF]">x{item.quantity}</p>
                            <p className="text-[10px] text-black font-medium mt-0.5">
                              {formatPrice(item.total_price)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Shipping Address */}
                    <div className="mt-6 p-4 border border-[#F3F4F6] bg-[#FAFAFA]">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-[#B89947]/60 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">
                            Teslimat Adresi
                          </h3>
                          <p className="text-[10px] text-black tracking-[0.05em]">
                            {order.shipping_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                      <div className="flex flex-wrap justify-between gap-4 text-[9px] text-[#9CA3AF] tracking-[0.05em]">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5" />
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
