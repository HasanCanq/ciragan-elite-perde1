import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatus,
  OrderStatusHistory,
  InvoiceOutboxRecord,
} from '@/types';
import { getAvailableTransitions, isTerminalStatus } from '@/lib/order-state-machine';
import { OrderStatusUpdater } from '@/app/admin/dashboard/OrderStatusUpdater';
import { CancelOrderModal } from '@/app/admin/orders/CancelOrderModal';
import { ManualShippingForm } from './ManualShippingForm';
import {
  ArrowLeft,
  Package,
  Truck,
  FileText,
  Clock,
  User,
  MapPin,
  Receipt,
  AlertCircle,
  CheckCircle,
  Loader2,
  Ban,
  RefreshCw,
  Hash,
  CreditCard,
  Calendar,
} from 'lucide-react';

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style:    'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(n);
}

// ── Adres JSONB → Görüntüleme ─────────────────────────────────────────────────

interface AddressSnapshot {
  raw?:          string;
  firstName?:    string;
  lastName?:     string;
  phone?:        string;
  addressLine?:  string;
  neighbourhood?: string;
  district?:     string;
  city?:         string;
  postalCode?:   string;
  billingType?:  'INDIVIDUAL' | 'CORPORATE';
  taxNumber?:    string;
  taxOffice?:    string;
  companyName?:  string;
}

function AddressCard({
  title,
  snapshot,
  fallbackText,
}: {
  title: string;
  snapshot: AddressSnapshot | null | undefined;
  fallbackText?: string | null;
}) {
  const icon = title.includes('Teslimat') ? '📦' : '🧾';

  const content = (() => {
    if (!snapshot && !fallbackText) return null;

    // Eski format: {raw: "..."}
    if (snapshot?.raw) {
      return (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {snapshot.raw}
        </p>
      );
    }

    // Yapısal JSONB
    if (snapshot?.firstName || snapshot?.city) {
      const fullName = [snapshot.firstName, snapshot.lastName].filter(Boolean).join(' ');
      const addressLine2 = [snapshot.neighbourhood, snapshot.district, snapshot.city]
        .filter(Boolean)
        .join(' / ');

      return (
        <div className="space-y-1 text-sm text-gray-700">
          {fullName && <p className="font-semibold">{fullName}</p>}
          {snapshot.phone && <p className="text-gray-500">{snapshot.phone}</p>}
          {snapshot.addressLine && <p>{snapshot.addressLine}</p>}
          {addressLine2 && <p>{addressLine2}</p>}
          {snapshot.postalCode && <p className="font-mono text-xs text-gray-400">{snapshot.postalCode}</p>}
          {snapshot.billingType === 'CORPORATE' && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kurumsal Fatura</p>
              {snapshot.companyName && <p className="font-medium">{snapshot.companyName}</p>}
              {snapshot.taxNumber && <p className="text-gray-500">VKN: {snapshot.taxNumber}</p>}
              {snapshot.taxOffice && <p className="text-gray-500">Vergi D.: {snapshot.taxOffice}</p>}
            </div>
          )}
        </div>
      );
    }

    // Son çare: ham metin
    if (fallbackText) {
      return (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {fallbackText}
        </p>
      );
    }

    return <p className="text-sm text-gray-400 italic">Adres bilgisi bulunamadı</p>;
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5" />
        {icon} {title}
      </h3>
      {content ?? <p className="text-sm text-gray-400 italic">Adres bilgisi yok</p>}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:    'Admin',
  customer: 'Müşteri',
  system:   'Sistem',
};

const STATUS_ICON_COLOR: Partial<Record<OrderStatus, string>> = {
  PAID:            'bg-blue-500',
  CONFIRMED:       'bg-sky-500',
  IN_PRODUCTION:   'bg-violet-500',
  SHIPPED:         'bg-indigo-500',
  DELIVERED:       'bg-green-500',
  CANCELLED:       'bg-red-500',
  REFUNDED:        'bg-gray-500',
};

function Timeline({ history }: { history: OrderStatusHistory[] }) {
  if (!history.length) {
    return (
      <p className="text-sm text-gray-400 italic py-4 text-center">
        Durum geçmişi kaydı bulunmuyor
      </p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3">
      {history.map((h, idx) => {
        const dotColor = STATUS_ICON_COLOR[h.new_status as OrderStatus] ?? 'bg-gray-400';
        return (
          <li key={h.id ?? idx} className="mb-6 ml-6 last:mb-0">
            <span
              className={`absolute -left-3 flex items-center justify-center w-6 h-6
                ring-4 ring-white ${dotColor}`}
            >
              <span className="w-2 h-2 bg-white/80" />
            </span>

            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium
                  ${ORDER_STATUS_COLORS[h.new_status as OrderStatus] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {ORDER_STATUS_LABELS[h.new_status as OrderStatus] ?? h.new_status}
              </span>
              <span className="text-xs text-gray-400">
                {ROLE_LABELS[h.changed_by_role] ?? h.changed_by_role}
              </span>
              <time className="text-xs text-gray-400 ml-auto">{fmtDate(h.created_at)}</time>
            </div>

            {h.previous_status && (
              <p className="text-xs text-gray-400">
                {ORDER_STATUS_LABELS[h.previous_status as OrderStatus] ?? h.previous_status} →{' '}
                {ORDER_STATUS_LABELS[h.new_status as OrderStatus] ?? h.new_status}
              </p>
            )}

            {h.reason && (
              <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">
                {h.reason}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Fatura Durumu Kartı ───────────────────────────────────────────────────────

function InvoiceStatusCard({ invoice }: { invoice: InvoiceOutboxRecord | null }) {
  if (!invoice) {
    return (
      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">Fatura Henüz Kuyruğa Eklenmedi</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Sipariş DELIVERED durumuna geçince otomatik kuyruğa alınır.
          </p>
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded px-2 py-1">
            ⚠ Firma kaydı tamamlanana kadar fatura kesilemez. Kayıt oluştuktan sonra otomatik işlenecektir.
          </p>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    PENDING:    { icon: <Clock className="w-4 h-4" />,        color: 'text-amber-600 bg-amber-50 border-amber-200',  label: 'Fatura Kuyrukta / Bekliyor' },
    PROCESSING: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Fatura Oluşturuluyor' },
    COMPLETED:  { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-700 bg-green-50 border-green-200', label: 'Fatura Hazır' },
    FAILED:     { icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-600 bg-red-50 border-red-200',        label: 'Fatura Hatası' },
  };

  const cfg = statusConfig[invoice.status] ?? statusConfig.PENDING;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.color}`}>
      <span className="flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{cfg.label}</p>
        <p className="text-xs opacity-70 mt-0.5">
          Tür: {invoice.invoice_type} · Deneme: {invoice.retry_count}
        </p>
        {invoice.invoice_pdf_url && (
          <a
            href={invoice.invoice_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline mt-1 block"
          >
            PDF İndir
          </a>
        )}
        {invoice.status === 'FAILED' && invoice.last_error && (
          <p className="text-xs mt-1 opacity-70 font-mono break-all">
            Hata: {invoice.last_error}
          </p>
        )}
        {invoice.status === 'FAILED' && (
          <p className="text-xs mt-2 opacity-80">
            ⚠ Firma anlaşması/kredensiyalleri tamamlandığında otomatik yeniden denenecektir.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Statik kargo bilgisi kartı ────────────────────────────────────────────────

function CargoInfoBadge({
  cargoCompany,
  trackingNumber,
}: {
  cargoCompany: string | null;
  trackingNumber: string | null;
}) {
  if (!cargoCompany && !trackingNumber) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-2">
      <Truck className="w-4 h-4 flex-shrink-0" />
      <span>
        {cargoCompany && <span className="font-semibold capitalize">{cargoCompany}</span>}
        {cargoCompany && trackingNumber && <span className="mx-1">·</span>}
        {trackingNumber && <span className="font-mono">{trackingNumber}</span>}
      </span>
    </div>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { id } = params;

  // Sipariş + kalemler + geçmiş (tek sorguda)
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, total_amount, subtotal, shipping_cost, discount_amount,
      customer_email, customer_name, customer_phone, customer_note, admin_note,
      payment_method, payment_reference,
      cargo_company, tracking_number, tracking_url, shipping_tracking_code,
      barcode_data, invoice_url,
      shipping_address, billing_address,
      shipping_address_snapshot, billing_address_snapshot,
      created_at, updated_at, paid_at, shipped_at, delivered_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (orderErr || !order) {
    notFound();
  }

  // Sipariş kalemleri
  const { data: items = [] } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  // Durum geçmişi
  const { data: history = [] } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  // Fatura outbox
  const { data: invoice } = await supabase
    .from('invoice_outbox')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentStatus = order.status as OrderStatus;
  const isTerminal    = isTerminalStatus(currentStatus);

  // Kargo formu: henüz kargoya verilmemiş ve terminal değilse göster
  const showCargoForm = [
    'CONFIRMED', 'IN_PRODUCTION', 'ON_HOLD', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT',
  ].includes(currentStatus);

  // Adres snapshot JSONB
  const shippingSnap = (order.shipping_address_snapshot ?? null) as AddressSnapshot | null;
  const billingSnap  = (order.billing_address_snapshot  ?? null) as AddressSnapshot | null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Başlık ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 font-mono">
                {order.order_number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold
                  ${ORDER_STATUS_COLORS[currentStatus]}`}
              >
                {ORDER_STATUS_LABELS[currentStatus]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Oluşturulma: {fmtDate(order.created_at)}
            </p>
          </div>
        </div>

        {/* Statü güncelleme + İptal */}
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <OrderStatusUpdater orderId={order.id} currentStatus={currentStatus} />
          )}
          {!isTerminal && (
            <CancelOrderModal
              orderId={order.id}
              orderNumber={order.order_number}
              onSuccess={() => {}}
            />
          )}
        </div>
      </div>

      {/* ── Özet Kartlar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoTile
          icon={<CreditCard className="w-4 h-4" />}
          label="Toplam"
          value={fmtMoney(order.total_amount)}
        />
        <InfoTile
          icon={<Package className="w-4 h-4" />}
          label="Kalem Sayısı"
          value={`${items?.length ?? 0} ürün`}
        />
        <InfoTile
          icon={<Calendar className="w-4 h-4" />}
          label="Ödeme"
          value={fmtDate(order.paid_at)}
        />
        <InfoTile
          icon={<Truck className="w-4 h-4" />}
          label="Kargoya Verilme"
          value={fmtDate(order.shipped_at)}
        />
      </div>

      {/* ── Müşteri + Adresler ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Müşteri Bilgileri */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5" />
            Müşteri
          </h3>
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-gray-900">{order.customer_name}</p>
            <p className="text-gray-500">{order.customer_email}</p>
            {order.customer_phone && (
              <p className="text-gray-500">{order.customer_phone}</p>
            )}
            {order.payment_method && (
              <p className="text-xs text-gray-400 mt-2">
                Ödeme: <span className="font-medium capitalize">{order.payment_method.replace(/_/g, ' ')}</span>
              </p>
            )}
            {order.payment_reference && (
              <p className="text-xs font-mono text-gray-400 break-all">
                Ref: {order.payment_reference}
              </p>
            )}
          </div>

          {/* Kargo bilgisi (varsa) */}
          {(order.cargo_company || order.tracking_number) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <CargoInfoBadge
                cargoCompany={order.cargo_company}
                trackingNumber={order.tracking_number}
              />
            </div>
          )}
        </div>

        {/* Teslimat Adresi */}
        <AddressCard
          title="Teslimat Adresi"
          snapshot={shippingSnap}
          fallbackText={order.shipping_address}
        />

        {/* Fatura Adresi */}
        <AddressCard
          title="Fatura Adresi"
          snapshot={billingSnap}
          fallbackText={order.billing_address}
        />
      </div>

      {/* ── Notlar ──────────────────────────────────────────────────── */}
      {(order.customer_note || order.admin_note) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {order.customer_note && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">Müşteri Notu</p>
              <p className="text-sm text-sky-900">{order.customer_note}</p>
            </div>
          )}
          {order.admin_note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Admin Notu</p>
              <p className="text-sm text-amber-900">{order.admin_note}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Sipariş Kalemleri ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800 text-sm">Sipariş Kalemleri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ürün</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ölçü</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pile</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Adet</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Birim</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(items ?? []).map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    {item.pleat_name_snapshot && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.pleat_name_snapshot}</p>
                    )}
                    {item.mechanism_direction && (
                      <p className="text-xs text-gray-400">
                        Zincir: {item.mechanism_direction === 'sag' ? 'Sağ' : item.mechanism_direction === 'sol' ? 'Sol' : 'Çift'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {item.width_cm} × {item.height_cm} cm
                    <p className="text-xs text-gray-400">{Number(item.area_m2).toFixed(2)} m²</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="capitalize text-xs">
                      {item.pile_factor}
                      {item.pile_coefficient && (
                        <span className="text-gray-400 ml-1">×{item.pile_coefficient}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right text-xs text-gray-500">Ara Toplam</td>
                <td className="px-4 py-2 text-right text-sm font-medium">{fmtMoney(order.subtotal)}</td>
              </tr>
              {Number(order.shipping_cost) > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-1 text-right text-xs text-gray-500">Kargo</td>
                  <td className="px-4 py-1 text-right text-sm">{fmtMoney(order.shipping_cost)}</td>
                </tr>
              )}
              {Number(order.discount_amount) > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-1 text-right text-xs text-green-600">İndirim</td>
                  <td className="px-4 py-1 text-right text-sm text-green-600">-{fmtMoney(order.discount_amount)}</td>
                </tr>
              )}
              <tr className="border-t border-gray-200">
                <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700">Genel Toplam</td>
                <td className="px-4 py-2.5 text-right text-base font-bold text-gray-900">
                  {fmtMoney(order.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── İşlem Geçmişi (Timeline) ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800 text-sm">İşlem Geçmişi</h2>
          <span className="ml-auto text-xs text-gray-400">{history?.length ?? 0} kayıt</span>
        </div>
        <Timeline history={(history ?? []) as OrderStatusHistory[]} />
      </div>

      {/* ── Manuel Kargo Girişi ──────────────────────────────────────── */}
      {showCargoForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Manuel Kargo Girişi</h2>
            <span className="ml-2 text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Fallback — Kargo API entegrasyonu henüz aktif değil
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Kargo anlaşması yapılana kadar takip numarasını ve firmayı buradan manuel girin.
            Sipariş <strong>READY_TO_SHIP</strong> durumundaysa otomatik olarak <strong>SHIPPED</strong>&apos;e geçirilir.
          </p>
          <ManualShippingForm
            orderId={order.id}
            currentStatus={currentStatus}
            existingCargoCompany={order.cargo_company}
            existingTrackingNumber={order.tracking_number}
          />
        </div>
      )}

      {/* ── Fatura Durumu ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800 text-sm">Fatura Durumu</h2>
        </div>
        <InvoiceStatusCard invoice={invoice as InvoiceOutboxRecord | null} />
      </div>

    </div>
  );
}

// ── InfoTile Yardımcı Bileşeni ─────────────────────────────────────────────────

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}
