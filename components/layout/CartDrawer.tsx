'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, ShoppingBag, Trash2, ArrowRight, Truck } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useCartItems, useCartIsOpen } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import { PILE_LABELS_UPPER, SHIPPING, getCartItemKey } from '@/types';

export default function CartDrawer() {
  const items          = useCartItems();
  const isOpen         = useCartIsOpen();
  const setCartOpen    = useCartStore((s) => s.setCartOpen);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const getCartSummary = useCartStore((s) => s.getCartSummary);

  const summary = getCartSummary();

  // Escape ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCartOpen]);

  // Body scroll kilidi
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setCartOpen(false)}
        className={[
          'fixed inset-0 z-[60] bg-black',
          'transition-opacity duration-300',
          isOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Drawer paneli */}
      <div
        role="dialog"
        aria-label="Sepet"
        aria-modal="true"
        className={[
          'fixed top-0 right-0 z-[70] h-full w-full max-w-[400px] bg-white',
          'flex flex-col shadow-2xl',
          'transition-transform duration-[380ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* ── Başlık ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6] shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={15} strokeWidth={1.4} className="text-black" />
            <span className="text-[10px] tracking-[0.25em] uppercase text-black">
              Sepetim
            </span>
            {items.length > 0 && (
              <span className="text-[10px] text-[#9CA3AF]">
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Sepeti kapat"
            className="p-1.5 text-[#9CA3AF] hover:text-black transition-colors duration-200"
          >
            <X size={16} strokeWidth={1.4} />
          </button>
        </div>

        {/* ── İçerik ─────────────────────────────────── */}
        {items.length === 0 ? (
          /* Boş sepet */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={44} strokeWidth={0.9} className="text-[#E5E7EB]" />
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#9CA3AF]">
              Sepetiniz boş
            </p>
            <button
              onClick={() => setCartOpen(false)}
              className="mt-1 text-[10px] tracking-[0.22em] uppercase text-black border-b border-black pb-[2px] hover:text-[#B89947] hover:border-[#B89947] transition-colors duration-200"
            >
              Alışverişe Devam Et
            </button>
          </div>
        ) : (
          <>
            {/* Ürün listesi */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {items.map((item) => {
                const key = getCartItemKey(item);
                return (
                  <div
                    key={key}
                    className="flex gap-4 py-4 border-b border-[#F5F5F3] last:border-0"
                  >
                    {/* Görsel */}
                    <div className="relative w-[68px] h-[90px] shrink-0 bg-[#F5F5F3] overflow-hidden">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          sizes="68px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ShoppingBag size={16} strokeWidth={1} className="text-[#CCCCCC]" />
                        </div>
                      )}
                    </div>

                    {/* Bilgiler */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] tracking-[0.03em] text-black font-medium leading-snug line-clamp-2">
                        {item.productName}
                      </p>

                      <div className="mt-1 space-y-0.5">
                        {item.calculationType !== 'adet' && (
                          <p className="text-[10px] text-[#9CA3AF]">
                            {item.width} × {item.height} cm
                          </p>
                        )}
                        {item.calculationType === 'mt' && (
                          <p className="text-[10px] text-[#9CA3AF]">
                            {PILE_LABELS_UPPER[item.pileFactor]}
                          </p>
                        )}
                        <p className="text-[10px] text-[#9CA3AF]">
                          Adet: {item.quantity}
                        </p>
                      </div>

                      <p
                        className="mt-2 text-[12px] font-medium"
                        style={{ color: 'var(--accent, #B89947)' }}
                      >
                        {formatPrice(item.unitPrice * item.quantity)}
                      </p>
                    </div>

                    {/* Kaldır */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(key)}
                      aria-label={`${item.productName} sepetten kaldır`}
                      className="shrink-0 self-start p-1 mt-0.5 text-[#D1D5DB] hover:text-black transition-colors duration-200"
                    >
                      <Trash2 size={13} strokeWidth={1.4} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── Alt alan ───────────────────────────── */}
            <div className="border-t border-[#F3F4F6] px-6 pt-4 pb-6 shrink-0 space-y-2.5">
              {/* Ara toplam */}
              <div className="flex justify-between text-[11px] text-[#9CA3AF]">
                <span className="tracking-[0.05em]">Ara Toplam</span>
                <span>{formatPrice(summary.subtotal)}</span>
              </div>

              {/* Kargo */}
              <div className="flex justify-between text-[11px] text-[#9CA3AF]">
                <span className="flex items-center gap-1.5 tracking-[0.05em]">
                  <Truck size={10} strokeWidth={1.4} />
                  Kargo
                </span>
                <span>
                  {summary.shippingCost === 0
                    ? 'Ücretsiz'
                    : formatPrice(summary.shippingCost)}
                </span>
              </div>

              {summary.shippingCost > 0 && (
                <p className="text-[9px] text-[#B5B5B0] tracking-[0.04em]">
                  {formatPrice(SHIPPING.FREE_THRESHOLD)} üzeri alışverişlerde ücretsiz kargo
                </p>
              )}

              {/* Toplam */}
              <div className="flex justify-between items-center pt-3 border-t border-[#F3F4F6]">
                <span className="text-[10px] tracking-[0.15em] uppercase text-black">
                  Toplam
                </span>
                <span className="text-[15px] font-medium text-black">
                  {formatPrice(summary.total)}
                </span>
              </div>

              {/* Ödemeye geç */}
              <Link
                href="/odeme"
                onClick={() => setCartOpen(false)}
                className={[
                  'flex items-center justify-center gap-2 w-full',
                  'py-3.5 mt-1 bg-black text-white',
                  'text-[10px] tracking-[0.28em] uppercase',
                  'hover:bg-[#B89947] transition-colors duration-300',
                ].join(' ')}
              >
                Ödemeye Geç
                <ArrowRight size={13} strokeWidth={1.5} />
              </Link>

              {/* Sepeti görüntüle */}
              <Link
                href="/sepet"
                onClick={() => setCartOpen(false)}
                className="block text-center text-[10px] tracking-[0.18em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200 pt-1"
              >
                Sepeti Görüntüle
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
