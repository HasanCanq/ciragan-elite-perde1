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

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

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

  const currentStatusIndex = STATUS_TIMELINE.indexOf(order.status as OrderStatus);
  const isCancelled = order.status === 'CANCELLED';

  const sectionClass = "border border-[#F3F4F6] p-6 bg-white";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={sectionClass}>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-[#9CA3AF] text-[9px] tracking-[0.25em] uppercase hover:text-[#B89947] mb-4 transition-colors duration-300"
        >
          <ArrowLeft className="w-3 h-3" />
          Siparişlerime Dön
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-black text-xl tracking-[0.05em]">
              Sipariş Detayı
            </h1>
            <p className="font-mono text-[#9CA3AF] text-[10px] tracking-[0.1em] mt-1">{order.order_number}</p>
          </div>

          <span
            className={`inline-flex items-center px-4 py-2 text-[9px] tracking-[0.15em] uppercase font-medium ${
              ORDER_STATUS_COLORS[order.status as OrderStatus]
            }`}
          >
            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
          </span>
        </div>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className={sectionClass}>
          <h2 className="text-[9px] text-[#9CA3AF] tracking-[0.3em] uppercase mb-6">Sipariş Durumu</h2>

          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-px bg-[#B89947]/15">
              <div
                className="h-full bg-[#B89947] transition-all duration-500"
                style={{
                  width: `${(currentStatusIndex / (STATUS_TIMELINE.length - 1)) * 100}%`,
                }}
              />
            </div>

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
                      className={`w-10 h-10 flex items-center justify-center z-10 transition-colors border ${
                        isCompleted
                          ? 'bg-[#B89947] border-[#B89947] text-white'
                          : 'bg-white border-[#F3F4F6] text-[#9CA3AF]'
                      } ${isCurrent ? 'ring-4 ring-[#B89947]/15' : ''}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <p
                      className={`mt-2 text-[8px] text-center tracking-[0.1em] uppercase ${
                        isCompleted ? 'text-black' : 'text-[#9CA3AF]'
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
        <div className="border border-red-200 bg-red-50 p-6 flex items-center gap-4">
          <XCircle className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <p className="text-red-600 text-[10px] tracking-[0.2em] uppercase">Sipariş İptal Edildi</p>
            <p className="text-[9px] text-red-500/70 mt-1 tracking-[0.05em]">
              Bu sipariş iptal edilmiştir. Sorularınız için bizimle iletişime geçebilirsiniz.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <div className={sectionClass}>
            <h2 className="text-[9px] text-[#9CA3AF] tracking-[0.3em] uppercase mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#B89947]/60" />
              Sipariş Kalemleri
            </h2>

            <div className="space-y-4">
              {order.items?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-4 border border-[#F3F4F6]"
                >
                  <div className="w-16 h-16 bg-[#F3F4F6] border border-[#F3F4F6] shrink-0" />

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/urun/${item.product_slug}`}
                      className="text-black text-[10px] tracking-[0.05em] hover:text-[#B89947] transition-colors duration-200"
                    >
                      {item.product_name}
                    </Link>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-[#9CA3AF] tracking-[0.05em]">
                      <div><span>Boyut:</span> <span className="text-black">{item.width_cm} x {item.height_cm} cm</span></div>
                      <div><span>Alan:</span> <span className="text-black">{item.area_m2.toFixed(2)} m²</span></div>
                      <div><span>Pile:</span> <span className="text-black">{PILE_LABELS_UPPER[item.pile_factor]}</span></div>
                      <div><span>Birim:</span> <span className="text-black">{formatPrice(item.price_per_m2_snapshot)}/m²</span></div>
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

            {/* Order Summary */}
            <div className="mt-6 pt-6 border-t border-[#F3F4F6] space-y-3">
              <div className="flex justify-between text-[9px]">
                <span className="text-[#9CA3AF] tracking-[0.15em] uppercase">Ara Toplam</span>
                <span className="text-black">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-[#9CA3AF] tracking-[0.15em] uppercase">Kargo</span>
                <span className="text-black">
                  {order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : 'Ücretsiz'}
                </span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-[9px] text-green-600">
                  <span className="tracking-[0.15em] uppercase">İndirim</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-[#F3F4F6]">
                <span className="text-black text-[9px] tracking-[0.2em] uppercase">Toplam</span>
                <span className="font-serif text-[#B89947] font-bold text-xl">
                  {formatPrice(order.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Shipping Address */}
          <div className={sectionClass}>
            <h3 className="text-[9px] text-[#9CA3AF] tracking-[0.3em] uppercase mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#B89947]/60" />
              Teslimat Adresi
            </h3>
            <p className="text-black text-[10px] tracking-[0.05em] flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B89947]/50" />
              {order.shipping_address}
            </p>
          </div>

          {/* Contact Info */}
          <div className={sectionClass}>
            <h3 className="text-[9px] text-[#9CA3AF] tracking-[0.3em] uppercase mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#B89947]/60" />
              İletişim Bilgileri
            </h3>
            <div className="space-y-2 text-[10px]">
              <p className="text-black tracking-[0.05em]">{order.customer_name}</p>
              <p className="text-[#9CA3AF] flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {order.customer_email}
              </p>
              {order.customer_phone && (
                <p className="text-[#9CA3AF] flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  {order.customer_phone}
                </p>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className={sectionClass}>
            <h3 className="text-[9px] text-[#9CA3AF] tracking-[0.3em] uppercase mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#B89947]/60" />
              Ödeme Bilgileri
            </h3>
            <div className="space-y-2 text-[10px] text-[#9CA3AF] tracking-[0.05em]">
              <p>
                <span className="text-black">Yöntem:</span>{' '}
                {order.payment_method === 'bank_transfer'
                  ? 'Havale / EFT'
                  : order.payment_method === 'cash_on_delivery'
                  ? 'Kapıda Ödeme'
                  : order.payment_method === 'credit_card'
                  ? 'Kredi Kartı'
                  : order.payment_method}
              </p>
              <p>
                <span className="text-black">Sipariş Tarihi:</span>{' '}
                {new Date(order.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {order.paid_at && (
                <p>
                  <span className="text-black">Ödeme Tarihi:</span>{' '}
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
            <div className="border border-[#F3F4F6] bg-[#FAFAFA] p-6">
              <h3 className="text-[9px] text-[#B89947]/60 tracking-[0.2em] uppercase mb-2">Sipariş Notunuz</h3>
              <p className="text-[10px] text-black tracking-[0.05em]">{order.customer_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
