'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  Search, Loader2, Package, CheckCircle, Clock, Truck,
  Box, Hammer, AlertTriangle, ExternalLink, ChevronRight,
  RotateCcw, XCircle, PackageCheck,
} from 'lucide-react';
import { trackGuestOrder, type GuestOrderResult } from '@/lib/actions/guest-tracking';
import { type OrderStatus } from '@/types';

// ── Validasyon ───────────────────────────────────────────────────────────────

const schema = z.object({
  orderNumber:   z.string().regex(
    /^HND-\d{8}-[A-F0-9]{8}$/,
    'Sipariş numarası geçersiz. Örnek: HND-20250319-A1B2C3D4'
  ),
  customerEmail: z.string().email('Geçerli bir e-posta adresi girin'),
});
type FormValues = z.infer<typeof schema>;

// ── Zaman çizelgesi adımları ─────────────────────────────────────────────────

interface Step {
  key:    string;         // grup adı
  label:  string;
  icon:   React.ElementType;
  statuses: OrderStatus[];
}

const TIMELINE_STEPS: Step[] = [
  { key: 'received',    label: 'Sipariş Alındı',      icon: Package,      statuses: ['PENDING', 'PAID'] },
  { key: 'confirmed',   label: 'Onaylandı',           icon: CheckCircle,  statuses: ['CONFIRMED'] },
  { key: 'production',  label: 'Üretimde',            icon: Hammer,       statuses: ['IN_PRODUCTION', 'PROCESSING'] },
  { key: 'ready',       label: 'Kargoya Hazır',       icon: Box,          statuses: ['READY_TO_SHIP'] },
  { key: 'shipped',     label: 'Kargoya Verildi',     icon: Truck,        statuses: ['SHIPPED', 'IN_TRANSIT'] },
  { key: 'delivered',   label: 'Teslim Edildi',       icon: PackageCheck, statuses: ['DELIVERED'] },
];

const TERMINAL_STATUSES: Partial<Record<OrderStatus, { label: string; icon: React.ElementType; color: string }>> = {
  CANCELLED:        { label: 'İptal Edildi',        icon: XCircle,        color: '#ef4444' },
  REFUNDED:         { label: 'İade Edildi',         icon: RotateCcw,      color: '#6b7280' },
  DELIVERY_FAILED:  { label: 'Teslim Başarısız',   icon: AlertTriangle,  color: '#f97316' },
  RETURN_REQUESTED: { label: 'İade Talep Edildi',  icon: RotateCcw,      color: '#f59e0b' },
  ON_HOLD:          { label: 'Askıya Alındı',       icon: Clock,          color: '#8b5cf6' },
};

function getStepIndex(status: OrderStatus): number {
  return TIMELINE_STEPS.findIndex((s) => s.statuses.includes(status));
}

// ── Para formatı ─────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

// ── Kargo takip URL'si ───────────────────────────────────────────────────────
// Kargo şirketi tespiti için basit prefix kontrolü
function buildTrackingUrl(code: string): string {
  if (/^1Z/i.test(code))        return `https://www.ups.com/track?tracknum=${code}`;
  if (/^\d{12,}$/.test(code))   return `https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code=${code}`;
  return `https://kargotakip.com/?code=${code}`;
}

// ── Sonuç kartı ──────────────────────────────────────────────────────────────

function ResultCard({ result, onReset }: { result: GuestOrderResult; onReset: () => void }) {
  const status      = result.status as OrderStatus;
  const terminal    = TERMINAL_STATUSES[status];
  const activeIndex = getStepIndex(status);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Başlık satırı */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#9CA3AF] text-[8px] tracking-[0.3em] uppercase mb-1">Sipariş Takip Sonucu</p>
          <h2 className="font-serif text-black text-lg tracking-[0.05em]">
            #{result.order_number}
          </h2>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-[8px] tracking-[0.2em] uppercase text-[#9CA3AF]
                     hover:text-[#B89947] border border-[#F3F4F6] hover:border-[#B89947]/40
                     px-3 py-2 transition-colors duration-200"
        >
          <Search className="w-3 h-3" />
          Yeni Sorgulama
        </button>
      </div>

      {/* Özet bilgiler */}
      <div className="border border-[#F3F4F6] bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#F3F4F6]">
          {[
            { label: 'Sipariş Tarihi',  value: formatDate(result.created_at) },
            { label: 'Sipariş Tutarı',  value: formatCurrency(result.total_amount) },
            { label: 'Kargo Ücreti',    value: result.shipping_cost != null ? formatCurrency(result.shipping_cost) : 'Ücretsiz' },
            { label: 'Alıcı',           value: result.customer_name },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[#9CA3AF] text-[7px] tracking-[0.25em] uppercase mb-1">{label}</p>
              <p className="text-black text-[11px] tracking-[0.05em] font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal durum (iptal / iade / başarısız) */}
      {terminal ? (
        <div className="border p-5 flex items-start gap-4" style={{ borderColor: terminal.color + '40', backgroundColor: terminal.color + '08' }}>
          <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ border: `1px solid ${terminal.color}40` }}>
            <terminal.icon className="w-4 h-4" style={{ color: terminal.color }} />
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: terminal.color }}>
              {terminal.label}
            </p>
            {status === 'CANCELLED' && (
              <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                Siparişiniz iptal edildi. Ödeme iadesi için lütfen müşteri hizmetlerimizle iletişime geçin.
              </p>
            )}
            {status === 'DELIVERY_FAILED' && (
              <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                Kargo teslim denemesi başarısız oldu. Kargo firmasıyla iletişime geçerek yeniden teslimat ayarlayabilirsiniz.
              </p>
            )}
            {(status === 'REFUNDED' || status === 'RETURN_REQUESTED') && (
              <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                İade süreciniz işleme alındı. Ödemeniz en geç 5–10 iş günü içinde hesabınıza aktarılacaktır.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Zaman çizelgesi — yatay (masaüstü) / dikey (mobil) */
        <div className="border border-[#F3F4F6] bg-white p-6">
          <p className="text-[#9CA3AF] text-[8px] tracking-[0.3em] uppercase mb-6">Sipariş Durumu</p>

          {/* Masaüstü: yatay */}
          <div className="hidden md:flex items-start">
            {TIMELINE_STEPS.map((step, idx) => {
              const isDone    = activeIndex > idx;
              const isActive  = activeIndex === idx;
              const isPending = activeIndex < idx;

              const dotColor    = isDone || isActive ? '#B89947' : '#E5E5E5';
              const labelColor  = isActive ? '#000000' : isDone ? '#9CA3AF' : '#D1D5DB';
              const lineColor   = isDone ? '#B89947' : '#E5E5E5';

              const Icon = step.icon;

              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {/* Bağlantı çizgisi (son eleman hariç) */}
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div
                      className="absolute top-4 left-1/2 w-full h-px transition-colors duration-500"
                      style={{ backgroundColor: lineColor }}
                    />
                  )}

                  {/* Nokta */}
                  <div
                    className="relative z-10 w-8 h-8 flex items-center justify-center border transition-all duration-500 mb-3"
                    style={{
                      borderColor:     dotColor,
                      backgroundColor: isDone || isActive ? dotColor : '#FFFFFF',
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5 transition-colors duration-300"
                      style={{ color: isDone || isActive ? '#FFFFFF' : '#CCCCCC' }}
                    />
                  </div>

                  {/* Etiket */}
                  <p
                    className="text-center text-[7px] tracking-[0.15em] uppercase leading-tight transition-colors duration-300 px-1"
                    style={{ color: labelColor, fontWeight: isActive ? 600 : 400 }}
                  >
                    {step.label}
                  </p>

                  {isActive && (
                    <span className="mt-1.5 text-[6px] tracking-[0.2em] uppercase text-[#B89947] font-semibold">
                      ● Şu an
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobil: dikey */}
          <div className="md:hidden space-y-0">
            {TIMELINE_STEPS.map((step, idx) => {
              const isDone   = activeIndex > idx;
              const isActive = activeIndex === idx;

              const dotColor   = isDone || isActive ? '#B89947' : '#E5E5E5';
              const labelColor = isActive ? '#000000' : isDone ? '#9CA3AF' : '#D1D5DB';
              const lineColor  = isDone ? '#B89947' : '#E5E5E5';

              const Icon = step.icon;
              const isLast = idx === TIMELINE_STEPS.length - 1;

              return (
                <div key={step.key} className="flex gap-4">
                  {/* Dikey eksen */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-7 h-7 flex items-center justify-center border shrink-0 transition-all duration-500"
                      style={{
                        borderColor:     dotColor,
                        backgroundColor: isDone || isActive ? dotColor : '#FFFFFF',
                      }}
                    >
                      <Icon
                        className="w-3 h-3"
                        style={{ color: isDone || isActive ? '#FFFFFF' : '#CCCCCC' }}
                      />
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 my-1 min-h-[20px] transition-colors duration-500"
                           style={{ backgroundColor: lineColor }} />
                    )}
                  </div>

                  {/* İçerik */}
                  <div className="pb-4">
                    <p
                      className="text-[9px] tracking-[0.15em] uppercase leading-none mb-0.5 transition-colors duration-300"
                      style={{ color: labelColor, fontWeight: isActive ? 600 : 400 }}
                    >
                      {step.label}
                    </p>
                    {isActive && (
                      <span className="text-[7px] tracking-[0.15em] uppercase text-[#B89947]">Şu an</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kargo takip */}
      {result.shipping_tracking_code && (
        <div className="border border-[#B89947]/30 bg-[#FAFAFA] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[#9CA3AF] text-[7px] tracking-[0.3em] uppercase mb-1">Kargo Takip Numarası</p>
            <p className="font-mono text-black text-[11px] tracking-[0.1em]">
              {result.shipping_tracking_code}
            </p>
          </div>
          <a
            href={buildTrackingUrl(result.shipping_tracking_code)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 text-[8px] tracking-[0.2em] uppercase
                       text-[#B89947] border border-[#B89947]/40 hover:border-[#B89947] hover:bg-[#B89947]
                       hover:text-white px-3 py-2 transition-all duration-200"
          >
            Takip Et
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Fatura linki */}
      {result.invoice_url && (
        <div className="flex justify-end">
          <a
            href={result.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[8px] tracking-[0.2em] uppercase text-[#9CA3AF]
                       hover:text-[#B89947] transition-colors duration-200"
          >
            E-Faturayı Görüntüle
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Alt yardım */}
      <p className="text-center text-[#9CA3AF] text-[8px] tracking-[0.15em] leading-relaxed">
        Siparişinizle ilgili sorun mu yaşıyorsunuz?{' '}
        <Link href="/iletisim" className="text-[#B89947]/80 hover:text-[#B89947] transition-colors duration-200 underline underline-offset-2">
          Bize ulaşın
        </Link>
      </p>
    </div>
  );
}

// ── Yükleme iskeleti ─────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-28 bg-[#F3F4F6]" />
          <div className="h-5 w-48 bg-[#F3F4F6]" />
        </div>
        <div className="h-8 w-32 bg-[#F3F4F6]" />
      </div>
      <div className="border border-[#F3F4F6]">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#F3F4F6]">
          {[1,2,3,4].map((i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="h-2 w-16 bg-[#F3F4F6]" />
              <div className="h-3 w-24 bg-[#F3F4F6]" />
            </div>
          ))}
        </div>
      </div>
      <div className="border border-[#F3F4F6] p-6">
        <div className="h-2 w-24 bg-[#F3F4F6] mb-6" />
        <div className="flex items-center justify-between">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className="w-8 h-8 bg-[#F3F4F6]" />
              <div className="h-2 w-12 bg-[#F3F4F6]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ana sayfa ────────────────────────────────────────────────────────────────

export default function SiparisTakipPage() {
  const [result,    setResult]    = useState<GuestOrderResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, getValues, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setSearching(true);
    setServerErr(null);
    setResult(null);

    const fd = new FormData();
    fd.set('orderNumber',   values.orderNumber.trim().toUpperCase());
    fd.set('customerEmail', values.customerEmail.trim().toLowerCase());

    const res = await trackGuestOrder(fd);

    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setServerErr(res.error ?? 'Bir hata oluştu.');
    }

    setSearching(false);
  };

  const handleReset = () => {
    setResult(null);
    setServerErr(null);
    reset();
  };

  const labelClass = 'block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2';
  const inputClass = 'h-input';

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="border-b border-[#F3F4F6]">
        <div className="h-container py-4">
          <nav className="flex items-center gap-2">
            <Link href="/" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">
              Ana Sayfa
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <span className="text-[#B89947]/70 text-[9px] tracking-[0.3em] uppercase">Sipariş Takip</span>
          </nav>
        </div>
      </div>

      <div className="h-container py-12 lg:py-16">
        <div className="max-w-2xl mx-auto">

          {/* Sayfa başlığı */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 border border-[#B89947]/40 mb-6">
              <Package className="w-5 h-5 text-[#B89947]" />
            </div>
            <h1 className="font-serif text-black text-2xl md:text-3xl tracking-[0.08em] mb-3">
              Sipariş Takip
            </h1>
            <p className="text-[#9CA3AF] text-[10px] tracking-[0.2em] leading-relaxed">
              Siparişinizin güncel durumunu öğrenmek için sipariş numaranızı<br className="hidden md:block" />
              ve sipariş sırasında kullandığınız e-posta adresinizi girin.
            </p>
          </div>

          {/* ── Sonuç veya form ── */}
          {searching ? (
            <ResultSkeleton />
          ) : result ? (
            <ResultCard result={result} onReset={handleReset} />
          ) : (
            <div className="border border-[#F3F4F6] bg-white p-8">

              {/* Sunucu hatası */}
              {serverErr && (
                <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 mb-6">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-600 text-[9px] tracking-[0.1em] leading-relaxed">{serverErr}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Sipariş numarası */}
                <div>
                  <label className={labelClass}>Sipariş Numarası *</label>
                  <input
                    {...register('orderNumber')}
                    type="text"
                    placeholder="HND-20250319-A1B2C3D4"
                    autoComplete="off"
                    spellCheck={false}
                    className={`${inputClass} font-mono uppercase placeholder:normal-case placeholder:font-sans ${errors.orderNumber ? 'border-red-300' : ''}`}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      register('orderNumber').onChange(e);
                    }}
                  />
                  {errors.orderNumber && (
                    <p className="mt-1.5 text-red-500 text-[8px] tracking-[0.1em]">
                      {errors.orderNumber.message}
                    </p>
                  )}
                  <p className="mt-1.5 text-[#9CA3AF] text-[7px] tracking-[0.1em]">
                    Sipariş onay e-postanızda "HND-" ile başlayan numara
                  </p>
                </div>

                {/* E-posta */}
                <div>
                  <label className={labelClass}>E-posta Adresi *</label>
                  <input
                    {...register('customerEmail')}
                    type="email"
                    placeholder="ornek@email.com"
                    autoComplete="email"
                    className={`${inputClass} ${errors.customerEmail ? 'border-red-300' : ''}`}
                  />
                  {errors.customerEmail && (
                    <p className="mt-1.5 text-red-500 text-[8px] tracking-[0.1em]">
                      {errors.customerEmail.message}
                    </p>
                  )}
                  <p className="mt-1.5 text-[#9CA3AF] text-[7px] tracking-[0.1em]">
                    Sipariş sırasında kullandığınız e-posta adresi
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="h-btn w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                >
                  {searching ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sorgulanıyor...</>
                  ) : (
                    <><Search className="w-4 h-4" /> Siparişimi Sorgula</>
                  )}
                </button>
              </form>

              {/* Giriş yapmış kullanıcı için shortcut */}
              <div className="mt-6 pt-5 border-t border-[#F3F4F6] text-center">
                <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] mb-3">
                  Üye misiniz?
                </p>
                <Link
                  href="/account/orders"
                  className="inline-flex items-center gap-1.5 text-[8px] tracking-[0.2em] uppercase
                             text-[#9CA3AF] hover:text-[#B89947] transition-colors duration-200"
                >
                  Tüm siparişlerinizi hesabınızdan görüntüleyin
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
