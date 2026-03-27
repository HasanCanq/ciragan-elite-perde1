'use client';

import { useState, useTransition } from 'react';
import { Truck, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { setOrderShipping } from '@/lib/actions/orders';
import type { OrderStatus } from '@/types';

// ── Desteklenen kargo firmaları ───────────────────────────────────────────────

const CARGO_COMPANIES = [
  { value: 'yurtici', label: 'Yurtiçi Kargo'  },
  { value: 'mng',     label: 'MNG Kargo'       },
  { value: 'ptt',     label: 'PTT Kargo'       },
  { value: 'ups',     label: 'UPS'             },
  { value: 'other',   label: 'Diğer'           },
] as const;

type CargoCompany = typeof CARGO_COMPANIES[number]['value'];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orderId:                string;
  currentStatus:          OrderStatus;
  existingCargoCompany:   string | null;
  existingTrackingNumber: string | null;
}

// ── Bileşen ───────────────────────────────────────────────────────────────────

export function ManualShippingForm({
  orderId,
  currentStatus,
  existingCargoCompany,
  existingTrackingNumber,
}: Props) {
  const [cargoCompany,   setCargoCompany]   = useState<CargoCompany>(
    (existingCargoCompany as CargoCompany) ?? 'yurtici'
  );
  const [trackingNumber, setTrackingNumber] = useState(existingTrackingNumber ?? '');
  const [success,        setSuccess]        = useState(false);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);
  const [isPending,      startTransition]   = useTransition();

  const isReadyToShip = currentStatus === 'READY_TO_SHIP';
  const isAlreadyShipped = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(currentStatus);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess(false);
    setErrorMsg(null);

    if (!trackingNumber.trim()) {
      setErrorMsg('Takip numarası boş olamaz.');
      return;
    }

    startTransition(async () => {
      const result = await setOrderShipping(orderId, {
        cargoCompany,
        trackingNumber: trackingNumber.trim(),
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setErrorMsg(result.error ?? 'Kargo bilgisi kaydedilemedi.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Durum bilgilendirme */}
      {isReadyToShip && (
        <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800">
          <Truck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Sipariş <strong>Kargoya Hazır</strong> durumunda. Takip numarası girince otomatik olarak
            <strong> Kargoya Verildi</strong> durumuna geçirilecek.
          </p>
        </div>
      )}

      {isAlreadyShipped && (
        <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
          <Truck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Sipariş zaten kargoya verilmiş. Bu form yalnızca <strong>takip bilgisini günceller</strong>.</p>
        </div>
      )}

      {/* Form alanları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Kargo Firması */}
        <div>
          <label
            htmlFor="cargoCompany"
            className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5"
          >
            Kargo Firması *
          </label>
          <select
            id="cargoCompany"
            value={cargoCompany}
            onChange={(e) => setCargoCompany(e.target.value as CargoCompany)}
            disabled={isPending}
            className="w-full px-3 py-2.5 border border-gray-200 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {CARGO_COMPANIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Takip Numarası */}
        <div>
          <label
            htmlFor="trackingNumber"
            className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5"
          >
            Takip Numarası *
          </label>
          <input
            id="trackingNumber"
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="örn: 123456789"
            disabled={isPending}
            maxLength={100}
            className="w-full px-3 py-2.5 border border-gray-200 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]
                       disabled:opacity-50 disabled:cursor-not-allowed placeholder:font-sans"
          />
        </div>
      </div>

      {/* Başarı mesajı */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <p>
            Kargo bilgisi başarıyla kaydedildi.
            {isReadyToShip && ' Sipariş SHIPPED durumuna geçirildi.'}
          </p>
        </div>
      )}

      {/* Hata mesajı */}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Submit butonu */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !trackingNumber.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm
                     font-medium hover:bg-gray-800 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isReadyToShip ? 'Kargoya Ver' : 'Takip Bilgisini Güncelle'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
