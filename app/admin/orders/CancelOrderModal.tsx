'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { adminForceCancelOrder } from '@/lib/actions/cancellation';
import { CANCEL_REASON_CATEGORIES, CancelReasonCategory } from '@/types';

interface Props {
  orderId: string;
  orderNumber: string;
}

export function CancelOrderModal({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<CancelReasonCategory>(
    CANCEL_REASON_CATEGORIES[0]
  );
  const [reasonNote, setReasonNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setReasonCategory(CANCEL_REASON_CATEGORIES[0]);
    setReasonNote('');
    setError(null);
    setIsOpen(true);
  };

  const handleCancel = async () => {
    setIsLoading(true);
    setError(null);

    const result = await adminForceCancelOrder(orderId, reasonCategory, reasonNote);

    if (result.success) {
      setIsOpen(false);
      router.refresh();
    } else {
      setError(result.error || 'İptal işlemi başarısız oldu.');
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        title="Siparişi İptal Et"
        className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
      >
        <XCircle className="w-4 h-4" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            {/* Başlık */}
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  Sipariş İptal Et
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Sipariş No:{' '}
                  <span className="font-mono font-medium">{orderNumber}</span>
                </p>
              </div>
            </div>

            {/* İptal Nedeni Kategorisi */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                İptal Nedeni *
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value as CancelReasonCategory)}
                className="w-full px-3 py-2.5 border border-gray-200 text-sm
                         focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]
                         outline-none bg-white"
              >
                {CANCEL_REASON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Ek Not */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ek Not{' '}
                <span className="text-gray-400 font-normal">(isteğe bağlı)</span>
              </label>
              <textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Detaylı açıklama ekleyin..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 border border-gray-200 text-sm
                         focus:ring-2 focus:ring-[#B89947]/20 focus:border-[#B89947]
                         outline-none resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">
                {reasonNote.length}/500
              </p>
            </div>

            {/* Uyarı */}
            <div className="bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm text-amber-800">
              Bu işlem geri alınamaz. Sipariş durumu <strong>İptal Edildi</strong> olarak
              değiştirilecek ve geçmiş kaydına eklenecektir.
            </div>

            {/* Hata */}
            {error && (
              <div className="bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700
                         hover:bg-gray-50 transition-colors text-sm font-medium
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                         bg-red-600 text-white hover:bg-red-700 transition-colors
                         text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    İptal Ediliyor...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    İptal Et
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
