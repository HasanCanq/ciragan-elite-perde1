import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  CartItem,
  CartSummary,
  PileFactor,
  SHIPPING,
  getCartItemKey,
} from '@/types';
import { TOKEN_TTL_MS } from '@/lib/engine/constants';



interface CartState {
  // State
  items: CartItem[];
  isOpen: boolean;

  // Sepet işlemleri
  /** Sepete ekle. Gerçek token varsa TTL kontrolü yapar — süresi dolmuşsa false döner. */
  addToCart: (item: CartItem) => boolean;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setCartOpen: (isOpen: boolean) => void;

  // Token yönetimi (signer.ts entegrasyonu)
  /** Ürün yeniden fiyatlandırıldığında tokenı güncelle (engine API çağrısı sonrası). */
  refreshToken: (itemKey: string, token: string, expiresAt: number) => void;
  /** Süresi dolmuş gerçek tokenları olan kalemleri sepetten kaldır. */
  purgeStaleItems: () => void;
  /** Checkout öncesi kontrol — herhangi bir kalemi süresi dolmuş gerçek token varsa true. */
  hasStaleTokens: () => boolean;

  // Hesaplama yardımcıları
  getCartSummary: () => CartSummary;
  getCartTotal: () => number;
  getItemCount: () => number;
  getTotalItems: () => number;
  findItem: (productId: string, width: number, height: number, pileFactor: PileFactor) => CartItem | undefined;
}


// TOKEN_TTL_MS artık @/lib/engine/constants'tan gelir — signer.ts ile senkronize.

/**
 * Token geçerliliğini kontrol eder.
 * Boş token artık geçerli sayılmaz — motor entegrasyonu tamamlandı.
 */
function isTokenFresh(token: string, expiresAt: number): boolean {
  if (!token) return false;
  return expiresAt > Date.now();
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
        // Gerçek token varsa TTL doğrula — süresi dolmuşsa reddet
        if (!isTokenFresh(item.priceToken, item.tokenExpiresAt)) {
          console.warn('[Cart] Süresi dolmuş fiyat tokeni — sepete ekleme reddedildi:', item.productId);
          return false;
        }

        const itemKey = getCartItemKey(item);

        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => getCartItemKey(i) === itemKey
          );

          if (existingIndex !== -1) {
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + item.quantity,
              // Yeni (daha taze) token geldiyse güncelle
              priceToken:     item.priceToken     || updatedItems[existingIndex].priceToken,
              tokenExpiresAt: item.tokenExpiresAt || updatedItems[existingIndex].tokenExpiresAt,
            };
            return { items: updatedItems, isOpen: true };
          }

          return { items: [...state.items, item], isOpen: true };
        });

        return true;
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

      refreshToken: (itemKey, token, expiresAt) => {
        set((state) => ({
          items: state.items.map((item) =>
            getCartItemKey(item) === itemKey
              ? { ...item, priceToken: token, tokenExpiresAt: expiresAt }
              : item
          ),
        }));
      },

      purgeStaleItems: () => {
        const now = Date.now();
        set((state) => ({
          // Boş token veya süresi dolmuş token — ikisi de çıkarılır
          items: state.items.filter(
            (item) => item.priceToken && item.tokenExpiresAt > now
          ),
        }));
      },

      hasStaleTokens: () => {
        const now = Date.now();
        return get().items.some(
          (item) => item.priceToken !== '' && item.tokenExpiresAt <= now
        );
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
      // Sayfa yenilenmesinde localStorage'dan gelen süresi dolmuş fiyat tokenlerini temizle
      onRehydrateStorage: () => (state) => {
        if (state) state.purgeStaleItems();
      },
    }
  )
);


// Selector hook'lar ve useCartHydration → @/hooks/useCart
// React lifecycle'a bağımlı hook'lar store tanımından ayrı tutulur (SoC).
