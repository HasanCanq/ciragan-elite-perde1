'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { getCartItemKey, PILE_LABELS_UPPER } from '@/types';

export default function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const items = useCartStore((state) => state.items);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const getCartSummary = useCartStore((state) => state.getCartSummary);

  const summary = getCartSummary();

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setCartOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, setCartOpen]);

  const handleClose = () => {
    setCartOpen(false);
  };

  const handleRemoveItem = (itemKey: string) => {
    removeFromCart(itemKey);
  };

  const handleQuantityChange = (itemKey: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantity(itemKey, newQuantity);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white z-[101] shadow-2xl
                   transform transition-transform duration-300 ease-out flex flex-col ${
                     isOpen ? 'translate-x-0' : 'translate-x-full'
                   }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-elite-bone">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-elite-gold" />
            <h2 className="font-serif text-2xl font-semibold text-elite-black">
              Sepetiniz
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 text-elite-gray hover:text-elite-black hover:bg-white rounded-lg transition-colors"
            aria-label="Sepeti Kapat"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-24 h-24 bg-elite-bone rounded-full flex items-center justify-center mb-6">
                <ShoppingBag className="w-12 h-12 text-elite-gray" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-elite-black mb-2">
                Sepetiniz Boş
              </h3>
              <p className="text-elite-gray mb-8 max-w-xs">
                Henüz sepetinize ürün eklemediniz. Koleksiyonumuzu keşfetmeye başlayın.
              </p>
              <Link
                href="/kategori/tum-urunler"
                onClick={handleClose}
                className="inline-flex items-center gap-2 bg-elite-gold text-elite-black px-8 py-3 rounded-full font-medium hover:bg-elite-black hover:text-white transition-colors duration-300"
              >
                Alışverişe Başla
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            // Cart Items
            <div className="space-y-4">
              {items.map((item) => {
                const itemKey = getCartItemKey(item);
                const itemTotal = item.unitPrice * item.quantity;

                return (
                  <div
                    key={itemKey}
                    className="flex gap-4 p-4 bg-elite-bone rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    {/* Product Image */}
                    <div className="relative w-20 h-20 flex-shrink-0 bg-white rounded-lg overflow-hidden">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-elite-bone to-gray-100">
                          <ShoppingBag className="w-8 h-8 text-elite-gray/40" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-elite-black mb-1 line-clamp-2 text-sm">
                        {item.productName}
                      </h4>
                      <div className="text-xs text-elite-gray space-y-0.5">
                        <p>
                          {item.width} x {item.height} cm ({item.areaM2.toFixed(2)} m²)
                        </p>
                        <p>Pile: {PILE_LABELS_UPPER[item.pileFactor]}</p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleQuantityChange(itemKey, item.quantity - 1)}
                            className="px-3 py-1 text-elite-gray hover:bg-gray-100 transition-colors"
                            aria-label="Azalt"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-sm font-medium min-w-[40px] text-center border-x border-gray-300">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(itemKey, item.quantity + 1)}
                            className="px-3 py-1 text-elite-gray hover:bg-gray-100 transition-colors"
                            aria-label="Artır"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveItem(itemKey)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Ürünü Kaldır"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="font-serif font-semibold text-elite-black">
                        {formatPrice(itemTotal)}
                      </p>
                      <p className="text-xs text-elite-gray mt-1">
                        {formatPrice(item.unitPrice)} x {item.quantity}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Sticky at bottom */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-5 bg-white">
            {/* Subtotal */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-elite-gray">
                <span>Ara Toplam</span>
                <span>{formatPrice(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-elite-gray">
                <span>Kargo</span>
                <span>
                  {summary.shippingCost === 0 ? (
                    <span className="text-green-600 font-medium">Ücretsiz</span>
                  ) : (
                    formatPrice(summary.shippingCost)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-lg font-serif font-semibold text-elite-black pt-2 border-t border-gray-200">
                <span>Toplam</span>
                <span>{formatPrice(summary.total)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href="/odeme"
                onClick={handleClose}
                className="block w-full py-3.5 bg-elite-gold text-elite-black text-center font-semibold rounded-xl hover:bg-elite-black hover:text-white transition-colors duration-300"
              >
                Ödemeye Geç
              </Link>
              <Link
                href="/sepet"
                onClick={handleClose}
                className="block w-full py-3 bg-white text-elite-black text-center font-medium rounded-xl border-2 border-gray-200 hover:border-elite-gold transition-colors duration-300"
              >
                Sepete Git
              </Link>
            </div>

            {/* Free Shipping Message */}
            {summary.subtotal < 5000 && (
              <p className="text-xs text-center text-elite-gray mt-4">
                <span className="font-semibold text-elite-gold">
                  {formatPrice(5000 - summary.subtotal)}
                </span>{' '}
                daha alışveriş yapın, <span className="font-semibold">ücretsiz kargo</span>{' '}
                kazanın!
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
