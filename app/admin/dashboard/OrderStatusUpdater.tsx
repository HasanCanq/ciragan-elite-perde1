'use client';

import { useState, useTransition } from 'react';
import { updateOrderStatus } from '@/lib/actions';
import { OrderStatus, ORDER_STATUS_LABELS } from '@/types';
import { Check, Loader2, ChevronDown } from 'lucide-react';

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: OrderStatus;
}


const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function OrderStatusUpdater({
  orderId,
  currentStatus,
}: OrderStatusUpdaterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const availableStatuses = STATUS_TRANSITIONS[currentStatus];

  const handleStatusChange = (newStatus: OrderStatus) => {
    setIsOpen(false);

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus);

      if (!result.success) {
        alert(`Hata: ${result.error}`);
      }
    });
  };

  
  if (availableStatuses.length === 0) {
    return (
      <span className="text-gray-400 text-sm flex items-center gap-1">
        <Check className="w-4 h-4" />
        Tamamlandı
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium
                 text-elite-gold bg-elite-gold/10 rounded-lg hover:bg-elite-gold/20
                 transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Güncelle
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg
                      border border-gray-200 z-20 overflow-hidden"
          >
            {availableStatuses.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50
                         transition-colors flex items-center gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === 'CANCELLED' ? 'bg-red-500' : 'bg-green-500'
                  }`}
                />
                {ORDER_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
