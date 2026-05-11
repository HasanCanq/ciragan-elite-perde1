'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

// Sözleşme metninde dinamik olarak gösterilecek müşteri bilgileri
export interface LegalModalCustomerData {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  address:   string;
  district:  string;
  city:      string;
}

interface LegalModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  title:         string;
  children:      React.ReactNode;
  customerData?: LegalModalCustomerData;
}

export default function LegalModal({
  isOpen,
  onClose,
  title,
  children,
  customerData,
}: LegalModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1F1F1F]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl max-h-[88vh] flex flex-col bg-[#F4F3EF] shadow-[0_25px_60px_rgba(31,31,31,0.5)] border border-[#C4A97B]/15">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1F1F1F] shrink-0">
          <h2 className="font-serif text-[#C4A97B] text-[11px] tracking-[0.25em] uppercase">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="ml-4 text-[#9C9286] hover:text-[#C4A97B] transition-colors duration-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-6 text-[#1F1F1F] text-[13px] leading-relaxed">

          {/* Dinamik müşteri bilgisi bloğu (prop verildiğinde gösterilir) */}
          {customerData && (
            <div className="mb-6 p-4 border-l-2 border-[#C4A97B] bg-[#1F1F1F]/[0.03] space-y-1.5">
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#9C9286] mb-2">
                Alıcı Bilgileri
              </p>
              <p className="text-[12px] font-medium text-[#1F1F1F]">
                {customerData.firstName} {customerData.lastName}
              </p>
              <p className="text-[11px] text-[#555]">
                {customerData.email}
                {customerData.phone ? ` · ${customerData.phone}` : ''}
              </p>
              <p className="text-[11px] text-[#555]">
                {customerData.address}
                {customerData.district ? `, ${customerData.district}` : ''}
                {customerData.city    ? ` / ${customerData.city}`    : ''}
              </p>
            </div>
          )}

          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 border-t border-[#D3CBBF] flex justify-end bg-[#F4F3EF]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1F1F1F] text-[#C4A97B] text-[10px] tracking-[0.2em] uppercase hover:bg-[#C4A97B] hover:text-[#1F1F1F] transition-all duration-300"
          >
            Okudum, Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
