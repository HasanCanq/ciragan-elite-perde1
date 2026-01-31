"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ChevronRight,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { PILE_LABELS_UPPER, SHIPPING, getCartItemKey } from "@/types";

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const items = useCartStore((state) => state.items);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const getCartSummary = useCartStore((state) => state.getCartSummary);

  useEffect(() => {
    setMounted(true);
  }, []);

  
  if (!mounted) {
    return (
      <div className="bg-elite-bone min-h-screen">
        <div className="elite-container py-8 lg:py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const summary = getCartSummary();

  
  if (items.length === 0) {
    return (
      <div className="bg-elite-bone min-h-screen">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-100">
          <div className="elite-container py-4">
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/"
                className="text-elite-gray hover:text-elite-gold transition-colors duration-300"
              >
                Ana Sayfa
              </Link>
              <ChevronRight className="w-4 h-4 text-elite-gray" />
              <span className="text-elite-black font-medium">Sepet</span>
            </nav>
          </div>
        </div>

        <div className="elite-container py-16 lg:py-24 text-center">
          <ShoppingBag className="w-24 h-24 text-elite-gray/30 mx-auto mb-6" />
          <h1 className="font-serif text-3xl font-semibold text-elite-black mb-4">
            Sepetiniz Boş
          </h1>
          <p className="text-elite-gray mb-8 max-w-md mx-auto">
            Sepetinizde henüz ürün bulunmuyor. Koleksiyonumuzu keşfederek
            hayalinizdeki perdeleri bulun.
          </p>
          <Link href="/" className="elite-button inline-flex">
            Alışverişe Başla
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-elite-bone min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="elite-container py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-elite-gray hover:text-elite-gold transition-colors duration-300"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <span className="text-elite-black font-medium">Sepet</span>
          </nav>
        </div>
      </div>

      <div className="elite-container py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-elite-black">
            Sepetim ({summary.totalItems} Ürün)
          </h1>
          <button
            onClick={() => clearCart()}
            className="text-sm text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Sepeti Temizle
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const itemKey = getCartItemKey(item);
              return (
                <div
                  key={itemKey}
                  className="bg-white rounded-xl shadow-sm p-4 sm:p-6 flex gap-4"
                >
                  {/* Product Image Placeholder */}
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-elite-gold/20 to-elite-bone rounded-lg flex-shrink-0 flex items-center justify-center">
                    <span className="text-elite-gray/40 text-xs text-center px-2">
                      {item.productName}
                    </span>
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/urun/${item.productSlug}`}
                          className="font-medium text-elite-black hover:text-elite-gold transition-colors"
                        >
                          {item.productName}
                        </Link>
                        <div className="mt-1 text-sm text-elite-gray space-y-0.5">
                          <p>
                            Boyut:{" "}
                            <span className="font-medium">
                              {item.width} x {item.height} cm
                            </span>
                          </p>
                          <p>
                            Alan:{" "}
                            <span className="font-medium">
                              {item.areaM2.toFixed(2)} m²
                            </span>
                          </p>
                          <p>
                            Pile:{" "}
                            <span className="font-medium">
                              {PILE_LABELS_UPPER[item.pileFactor]}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(itemKey)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Kaldır"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(itemKey, item.quantity - 1)
                          }
                          className="w-8 h-8 rounded-lg bg-elite-bone text-elite-gray hover:bg-elite-gold/20
                                   flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(itemKey, item.quantity + 1)
                          }
                          className="w-8 h-8 rounded-lg bg-elite-bone text-elite-gray hover:bg-elite-gold/20
                                   flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-semibold text-elite-black">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-elite-gray">
                            {formatPrice(item.unitPrice)} / adet
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="font-serif text-xl font-semibold text-elite-black mb-6">
                Sipariş Özeti
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-elite-gray">Ara Toplam</span>
                  <span className="font-medium">
                    {formatPrice(summary.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-elite-gray">Kargo</span>
                  <span className="font-medium">
                    {summary.shippingCost > 0 ? (
                      formatPrice(summary.shippingCost)
                    ) : (
                      <span className="text-green-600">Ücretsiz</span>
                    )}
                  </span>
                </div>
                {summary.shippingCost > 0 && (
                  <p className="text-xs text-elite-gray">
                    {formatPrice(SHIPPING.FREE_THRESHOLD - summary.subtotal)}{" "}
                    daha ekleyin, kargo bedava!
                  </p>
                )}
              </div>

              <div className="border-t border-gray-100 my-4 pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-elite-black">Toplam</span>
                  <span className="font-serif text-2xl font-bold text-elite-gold">
                    {formatPrice(summary.total)}
                  </span>
                </div>
                <p className="text-xs text-elite-gray mt-1">KDV dahil</p>
              </div>

              <Link
                href="/odeme"
                className="w-full elite-button justify-center mt-6"
              >
                Ödemeye Geç
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-3 text-sm text-elite-gray">
                  <Truck className="w-5 h-5 text-elite-gold flex-shrink-0" />
                  <span>5.000 TL üzeri siparişlerde ücretsiz kargo</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-elite-gray">
                  <ShieldCheck className="w-5 h-5 text-elite-gold flex-shrink-0" />
                  <span>Güvenli ödeme ve 2 yıl garanti</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
