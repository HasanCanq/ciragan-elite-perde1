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



interface CartState {
  // State
  items: CartItem[];
  isOpen: boolean; 

  
  addToCart: (item: Omit<CartItem, 'areaM2' | 'pileCoefficient' | 'unitPrice'>) => void;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setCartOpen: (isOpen: boolean) => void;

  
  getCartSummary: () => CartSummary;
  getCartTotal: () => number;
  getItemCount: () => number;
  getTotalItems: () => number;
  findItem: (productId: string, width: number, height: number, pileFactor: PileFactor) => CartItem | undefined;
}


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


export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial State
      items: [],
      isOpen: false,

      
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
            
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + item.quantity,
            };
            return { items: updatedItems };
          }

         
          return { items: [...state.items, newItem] };
        });
      },

     
      removeFromCart: (itemKey) => {
        set((state) => ({
          items: state.items.filter((item) => getCartItemKey(item) !== itemKey),
        }));
      },

      
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

     
      clearCart: () => {
        set({ items: [] });
      },

      
      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      
      setCartOpen: (isOpen) => {
        set({ isOpen });
      },

     
      getCartSummary: () => {
        const items = get().items;
        const itemCount = items.length;
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        const shippingCost = calculateShipping(subtotal);
        const discount = 0; 

        return {
          itemCount,
          totalItems,
          subtotal,
          shippingCost,
          discount,
          total: subtotal + shippingCost - discount,
        };
      },

      
      getCartTotal: () => {
        return get().getCartSummary().total;
      },

     
      getItemCount: () => {
        return get().items.length;
      },

      
      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

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
      name: 'ciragan-elite-cart', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);


export const useCartItems = () => useCartStore((state) => state.items);
export const useCartIsOpen = () => useCartStore((state) => state.isOpen);
export const useCartItemCount = () => useCartStore((state) => state.items.length);
export const useCartTotalItems = () =>
  useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));


export function useCartHydration() {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}


import * as React from 'react';
