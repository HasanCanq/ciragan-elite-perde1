import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/actions';
import { formatPrice } from '@/lib/utils';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PILE_LABELS_UPPER,
  OrderStatus,
} from '@/types';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  Mail,
  Truck,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Status timeline
const STATUS_TIMELINE: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { data: order, error } = await getOrderById(id);

  if (error || !order) {
    notFound();
  }

  // Get current status index for timeline
  const currentStatusIndex = STATUS_TIMELINE.indexOf(order.status as OrderStatus);
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <Link
          href="/hesabim/siparisler"
          className="inline-flex items-center gap-2 text-elite-gray hover:text-elite-gold mb-4 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Siparişlerime Dön
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-elite-black">
              Sipariş Detayı
            </h1>
            <p className="font-mono text-elite-gray mt-1">{order.order_number}</p>
          </div>

          <span
            className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              ORDER_STATUS_COLORS[order.status as OrderStatus]
            }`}
          >
            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
          </span>
        </div>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-elite-black mb-6">Sipariş Durumu</h2>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
              <div
                className="h-full bg-elite-gold transition-all duration-500"
                style={{
                  width: `${(currentStatusIndex / (STATUS_TIMELINE.length - 1)) * 100}%`,
                }}
              />
            </div>

            {/* Status Points */}
            <div className="relative flex justify-between">
              {STATUS_TIMELINE.map((status, idx) => {
                const isCompleted = idx <= currentStatusIndex;
                const isCurrent = idx === currentStatusIndex;

                return (
                  <div
                    key={status}
                    className="flex flex-col items-center"
                    style={{ width: '20%' }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-colors ${
                        isCompleted
                          ? 'bg-elite-gold text-white'
                          : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-elite-gold/20' : ''}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>
                    <p
                      className={`mt-2 text-xs text-center font-medium ${
                        isCompleted ? 'text-elite-black' : 'text-gray-400'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[status]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Notice */}
      {isCancelled && (
        <div className="bg-red-50 rounded-xl p-6 flex items-center gap-4">
          <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-700">Sipariş İptal Edildi</p>
            <p className="text-sm text-red-600 mt-1">
              Bu sipariş iptal edilmiştir. Sorularınız için bizimle iletişime geçebilirsiniz.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-elite-black mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-elite-gold" />
              Sipariş Kalemleri
            </h2>

            <div className="space-y-4">
              {order.items?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-4 border border-gray-100 rounded-lg"
                >
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-gradient-to-br from-elite-gold/20 to-elite-bone rounded-lg flex-shrink-0" />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/urun/${item.product_slug}`}
                      className="font-medium text-elite-black hover:text-elite-gold transition-colors"
                    >
                      {item.product_name}
                    </Link>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-elite-gray">Boyut:</span>{' '}
                        <span className="font-medium">
                          {item.width_cm} x {item.height_cm} cm
                        </span>
                      </div>
                      <div>
                        <span className="text-elite-gray">Alan:</span>{' '}
                        <span className="font-medium">{item.area_m2.toFixed(2)} m²</span>
                      </div>
                      <div>
                        <span className="text-elite-gray">Pile:</span>{' '}
                        <span className="font-medium">
                          {PILE_LABELS_UPPER[item.pile_factor]}
                        </span>
                      </div>
                      <div>
                        <span className="text-elite-gray">Birim Fiyat:</span>{' '}
                        <span className="font-medium">
                          {formatPrice(item.price_per_m2_snapshot)}/m²
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="text-sm text-elite-gray">x{item.quantity}</p>
                    <p className="font-semibold text-elite-black mt-1">
                      {formatPrice(item.total_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-elite-gray">Ara Toplam</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elite-gray">Kargo</span>
                <span>
                  {order.shipping_cost > 0
                    ? formatPrice(order.shipping_cost)
                    : 'Ücretsiz'}
                </span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>İndirim</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-100">
                <span>Toplam</span>
                <span className="text-elite-gold">
                  {formatPrice(order.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-elite-black mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-elite-gold" />
              Teslimat Adresi
            </h3>
            <p className="text-elite-gray text-sm flex items-start gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {order.shipping_address}
            </p>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-elite-black mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-elite-gold" />
              İletişim Bilgileri
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-elite-black">{order.customer_name}</p>
              <p className="text-elite-gray flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {order.customer_email}
              </p>
              {order.customer_phone && (
                <p className="text-elite-gray flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {order.customer_phone}
                </p>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-elite-black mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-elite-gold" />
              Ödeme Bilgileri
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-elite-gray">
                <span className="font-medium">Ödeme Yöntemi:</span>{' '}
                {order.payment_method === 'bank_transfer'
                  ? 'Havale / EFT'
                  : order.payment_method === 'cash_on_delivery'
                  ? 'Kapıda Ödeme'
                  : order.payment_method === 'credit_card'
                  ? 'Kredi Kartı'
                  : order.payment_method}
              </p>
              <p className="text-elite-gray">
                <span className="font-medium">Sipariş Tarihi:</span>{' '}
                {new Date(order.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {order.paid_at && (
                <p className="text-elite-gray">
                  <span className="font-medium">Ödeme Tarihi:</span>{' '}
                  {new Date(order.paid_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Customer Note */}
          {order.customer_note && (
            <div className="bg-yellow-50 rounded-xl p-6">
              <h3 className="font-semibold text-yellow-800 mb-2">Sipariş Notunuz</h3>
              <p className="text-sm text-yellow-700">{order.customer_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
