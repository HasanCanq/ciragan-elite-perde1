// =====================================================
// ÇIRAĞAN ELITE PERDE - SEPET YÖNETİMİ (Zustand Store)
// =====================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  CartItem,
  CartSummary,
  PileFactor,
  PILE_COEFFICIENTS_UPPER,
  SHIPPING,
  getCartItemKey,
} from '@/types';

// =====================================================
// STORE STATE & ACTIONS
// =====================================================

interface CartState {
  // State
  items: CartItem[];
  isOpen: boolean; // Sepet drawer/modal durumu

  // Actions
  addToCart: (item: Omit<CartItem, 'areaM2' | 'pileCoefficient' | 'unitPrice'>) => void;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setCartOpen: (isOpen: boolean) => void;

  // Computed (fonksiyon olarak)
  getCartSummary: () => CartSummary;
  getCartTotal: () => number;
  getItemCount: () => number;
  getTotalItems: () => number;
  findItem: (productId: string, width: number, height: number, pileFactor: PileFactor) => CartItem | undefined;
}

// =====================================================
// HELPER FONKSİYONLAR
// =====================================================

/**
 * Alan hesapla (m²)
 */
function calculateArea(widthCm: number, heightCm: number): number {
  return (widthCm * heightCm) / 10000;
}

/**
 * Birim fiyat hesapla
 */
function calculateUnitPrice(
  areaM2: number,
  pricePerM2: number,
  pileCoefficient: number
): number {
  return Math.round(areaM2 * pricePerM2 * pileCoefficient * 100) / 100;
}

/**
 * Kargo ücretini hesapla
 */
function calculateShipping(subtotal: number): number {
  return subtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
}

// =====================================================
// ZUSTAND STORE
// =====================================================

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial State
      items: [],
      isOpen: false,

      // =====================================================
      // ACTIONS
      // =====================================================

      /**
       * Sepete ürün ekle
       * Benzersizlik: productId + width + height + pileFactor
       */
      addToCart: (item) => {
        const pileCoefficient = PILE_COEFFICIENTS_UPPER[item.pileFactor];
        const areaM2 = calculateArea(item.width, item.height);
        const unitPrice = calculateUnitPrice(areaM2, item.pricePerM2, pileCoefficient);

        const newItem: CartItem = {
          ...item,
          areaM2,
          pileCoefficient,
          unitPrice,
        };

        const itemKey = getCartItemKey(newItem);

        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => getCartItemKey(i) === itemKey
          );

          if (existingIndex !== -1) {
            // Varolan ürünün miktarını artır
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + item.quantity,
            };
            return { items: updatedItems };
          }

          // Yeni ürün ekle
          return { items: [...state.items, newItem] };
        });
      },

      /**
       * Sepetten ürün çıkar
       */
      removeFromCart: (itemKey) => {
        set((state) => ({
          items: state.items.filter((item) => getCartItemKey(item) !== itemKey),
        }));
      },

      /**
       * Ürün miktarını güncelle
       */
      updateQuantity: (itemKey, quantity) => {
        if (quantity < 1) {
          get().removeFromCart(itemKey);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            getCartItemKey(item) === itemKey ? { ...item, quantity } : item
          ),
        }));
      },

      /**
       * Sepeti temizle
       */
      clearCart: () => {
        set({ items: [] });
      },

      /**
       * Sepet drawer/modal aç/kapa
       */
      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      /**
       * Sepet durumunu ayarla
       */
      setCartOpen: (isOpen) => {
        set({ isOpen });
      },

      // =====================================================
      // COMPUTED GETTERS
      // =====================================================

      /**
       * Sepet özeti
       */
      getCartSummary: () => {
        const items = get().items;
        const itemCount = items.length;
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        const shippingCost = calculateShipping(subtotal);
        const discount = 0; // İleride kupon sistemi eklenebilir

        return {
          itemCount,
          totalItems,
          subtotal,
          shippingCost,
          discount,
          total: subtotal + shippingCost - discount,
        };
      },

      /**
       * Sepet toplamı
       */
      getCartTotal: () => {
        return get().getCartSummary().total;
      },

      /**
       * Benzersiz ürün sayısı
       */
      getItemCount: () => {
        return get().items.length;
      },

      /**
       * Toplam ürün adedi (quantity dahil)
       */
      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      /**
       * Belirli bir ürünü bul
       */
      findItem: (productId, width, height, pileFactor) => {
        return get().items.find(
          (item) =>
            item.productId === productId &&
            item.width === width &&
            item.height === height &&
            item.pileFactor === pileFactor
        );
      },
    }),
    {
      name: 'ciragan-elite-cart', // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items, // Sadece items'ı persist et
      }),
    }
  )
);

// =====================================================
// SELECTOR HOOKS (Performans optimizasyonu)
// =====================================================

export const useCartItems = () => useCartStore((state) => state.items);
export const useCartIsOpen = () => useCartStore((state) => state.isOpen);
export const useCartItemCount = () => useCartStore((state) => state.items.length);
export const useCartTotalItems = () =>
  useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));

// =====================================================
// UTILITY: Cart Provider for SSR Hydration Fix
// =====================================================

/**
 * SSR hydration hatalarını önlemek için cart'ın yüklendiğinden emin ol
 * Client component'lerde kullanılabilir
 */
export function useCartHydration() {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

// React import (useCartHydration için)
import * as React from 'react';
