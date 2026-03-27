'use client';

import { useState, useTransition } from 'react';
import { updateOrderStatus } from '@/lib/actions/orders';
import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';
import { getAvailableTransitions, isTerminalStatus } from '@/lib/order-state-machine';
import { Check, Loader2, ChevronDown } from 'lucide-react';

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: OrderStatus;
}

export function OrderStatusUpdater({
  orderId,
  currentStatus,
}: OrderStatusUpdaterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const availableStatuses = getAvailableTransitions(currentStatus);

  const handleStatusChange = (newStatus: OrderStatus) => {
    setIsOpen(false);

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus);

      if (!result.success) {
        alert(`Hata: ${result.error}`);
      }
    });
  };

  if (isTerminalStatus(currentStatus)) {
    return (
      <span className="text-gray-400 text-sm flex items-center gap-1">
        <Check className="w-4 h-4" />
        {ORDER_STATUS_LABELS[currentStatus]}
      </span>
    );
  }

  if (availableStatuses.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium
                 text-[#B89947] bg-[#FAFAFA] hover:bg-[#FAFAFA]
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
            className="absolute right-0 mt-2 w-52 bg-white
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
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium
                    ${ORDER_STATUS_COLORS[status]}`}
                >
                  {ORDER_STATUS_LABELS[status]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
