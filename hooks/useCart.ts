'use client';

/**
 * useCart — Zustand cart store selector hooks
 *
 * Separation of Concerns: React lifecycle ve hook'lar store tanımından
 * ayrı tutulur. cartStore.ts saf Zustand state tanımı içerir;
 * React'a bağımlı hook'lar bu dosyada yaşar.
 */

import { useState, useEffect } from 'react';
import { useCartStore } from '@/store/cartStore';

// ── Temel selector hook'lar ───────────────────────────────────────────────────

export const useCartItems      = () => useCartStore((state) => state.items);
export const useCartIsOpen     = () => useCartStore((state) => state.isOpen);
export const useCartItemCount  = () => useCartStore((state) => state.items.length);
export const useCartTotalItems = () =>
  useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));

// ── Token yönetimi hook'ları ──────────────────────────────────────────────────

/** Sepette süresi dolmuş gerçek tokenı olan kalem var mı? */
export const useHasStaleTokens  = () => useCartStore((state) => state.hasStaleTokens());
/** Belirli bir kalemin token'ını yenile (engine API çağrısı sonrası). */
export const useRefreshToken    = () => useCartStore((state) => state.refreshToken);
/** Süresi dolmuş kalemleri temizle (checkout öncesi kullanılabilir). */
export const usePurgeStaleItems = () => useCartStore((state) => state.purgeStaleItems);

/** Bir token için kaç dakika kaldığını döner. */
export function useTokenMinutesLeft(expiresAt: number): number {
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? Math.floor(remaining / 60_000) : 0;
}

// ── Hydration hook ────────────────────────────────────────────────────────────

/**
 * Zustand localStorage persist rehydration tamamlanana kadar false döner.
 * Server/client hydration uyumsuzluklarını önlemek için kullanılır.
 */
export function useCartHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
