'use client';

// =====================================================
// PERDE DANIŞMANI — ROUTING HOOK
// =====================================================
// Asistan akışının gerçek durumunu URL search param'larından okur
// ve navigasyon fonksiyonları sağlar.
//
// URL yapısı:
//   /asistan                            → Adım 1: Oda seç
//   /asistan?oda=mutfak                 → Adım 2: Model seç
//   /asistan?oda=mutfak&model=stor      → Adım 3: Ürünleri gör
//
// KULLANIM NOTU: useSearchParams() bir Suspense sınırı gerektirir.
// Bu hook'u kullanan sayfa bileşeni <Suspense fallback={...}> ile
// sarmalanmalıdır. Örnek:
//
//   // app/asistan/page.tsx
//   import { Suspense } from 'react';
//   import AssistantClient from './AssistantClient';
//
//   export default function AssistantPage() {
//     return (
//       <Suspense fallback={<AssistantSkeleton />}>
//         <AssistantClient />
//       </Suspense>
//     );
//   }
//
//   // AssistantClient.tsx — "use client" + bu hook'u kullanır
// =====================================================

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// ── URL parametre sabitleri ──────────────────────────────────
// Tek noktadan yönetim: param adı değişirse sadece burası güncellenir.
export const ADVISOR_PARAMS = {
  ROOM:  'oda',
  MODEL: 'model',
} as const;

// ── Tip tanımları ────────────────────────────────────────────

/** Asistan akışının hangi adımında olduğumuzu gösterir */
export type AssistantStep =
  | 'room'      // Adım 1: Oda seçimi  (oda param yok)
  | 'model'     // Adım 2: Model seçimi (oda var, model yok)
  | 'products'; // Adım 3: Ürün listesi (oda + model var)

export interface AssistantFlowState {
  // ── URL'den türetilen okuma alanları ──────────────
  /** Seçilen odanın slug'ı. Henüz seçilmediyse null. Örn: 'mutfak' */
  selectedRoomSlug: string | null;
  /** Seçilen modelin slug'ı. Henüz seçilmediyse null. Örn: 'stor' */
  selectedModelSlug: string | null;
  /** Mevcut adım — URL'den türetilir, ayrı state gerektirmez. */
  step: AssistantStep;

  // ── Navigasyon aksiyonları ─────────────────────────
  /**
   * Oda seçer. URL: ?oda=[roomSlug]
   * Önceki model seçimi sıfırlanır (yeni oda için temiz başlangıç).
   * router.push kullanır: geri tuşu çalışır.
   */
  selectRoom: (roomSlug: string) => void;

  /**
   * Model seçer. URL: ?oda=[mevcut]&model=[modelSlug]
   * Önce oda seçilmiş olmalıdır; değilse console.warn basar ve çıkar.
   * router.push kullanır: geri tuşu çalışır.
   */
  selectModel: (modelSlug: string) => void;

  /**
   * Adım 1'e sıfırlar. URL: pathname (parametre yok)
   * router.replace kullanır: history kirlenmez.
   */
  resetToRooms: () => void;

  /**
   * Adım 2'ye döner. URL: ?oda=[mevcut]
   * Model parametresini siler, oda seçimi korunur.
   * router.replace kullanır: history kirlenmez.
   */
  resetToModels: () => void;
}

// ── Hook implementasyonu ─────────────────────────────────────

export function useAssistantFlow(): AssistantFlowState {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  // URL'den mevcut seçimleri oku
  const selectedRoomSlug  = searchParams.get(ADVISOR_PARAMS.ROOM);
  const selectedModelSlug = searchParams.get(ADVISOR_PARAMS.MODEL);

  // Hangi adımda olduğumuzu URL'den türet — ayrı state gereksiz
  const step = useMemo<AssistantStep>(() => {
    if (selectedRoomSlug && selectedModelSlug) return 'products';
    if (selectedRoomSlug) return 'model';
    return 'room';
  }, [selectedRoomSlug, selectedModelSlug]);

  // ── Yardımcı: yeni bir URL oluştur ────────────────────────
  // Mevcut tüm param'ları korur; sadece overrides objesindeki key'leri değiştirir.
  // value=null → o param silinir. value=string → set edilir.
  const buildUrl = useCallback(
    (overrides: Partial<Record<string, string | null>>): string => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  // ── Oda seç ───────────────────────────────────────────────
  const selectRoom = useCallback(
    (roomSlug: string) => {
      // Model parametresini null yaparak sıfırla:
      // kullanıcı farklı bir oda seçtiğinde önceki model seçimi geçersizdir.
      router.push(
        buildUrl({
          [ADVISOR_PARAMS.ROOM]:  roomSlug,
          [ADVISOR_PARAMS.MODEL]: null,
        }),
        { scroll: false }, // Sayfa başına scroll etme — sihirbaz aynı konumda kalır
      );
    },
    [router, buildUrl],
  );

  // ── Model seç ─────────────────────────────────────────────
  const selectModel = useCallback(
    (modelSlug: string) => {
      if (!selectedRoomSlug) {
        // Oda seçilmeden model seçilemez.
        // Bu durum normal kullanımda olmamalı; component bağlantısı hatalıysa uyar.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[useAssistantFlow] selectModel("%s") çağrıldı ancak oda (%s) seçili değil. ' +
            'Önce selectRoom() çağrılmalıdır.',
            modelSlug,
            ADVISOR_PARAMS.ROOM,
          );
        }
        return;
      }

      router.push(
        buildUrl({ [ADVISOR_PARAMS.MODEL]: modelSlug }),
        { scroll: false },
      );
    },
    [router, buildUrl, selectedRoomSlug],
  );

  // ── Adım 1'e sıfırla ──────────────────────────────────────
  // replace: Sıfırlama bir "ileri" navigasyon değil, bir "geri dön" eylemi.
  // History'ye yeni kayıt eklemek anlamsız olur.
  const resetToRooms = useCallback(() => {
    router.replace(
      buildUrl({
        [ADVISOR_PARAMS.ROOM]:  null,
        [ADVISOR_PARAMS.MODEL]: null,
      }),
      { scroll: false },
    );
  }, [router, buildUrl]);

  // ── Adım 2'ye döner ───────────────────────────────────────
  // Oda seçimi korunur; sadece model parametresi silinir.
  const resetToModels = useCallback(() => {
    router.replace(
      buildUrl({ [ADVISOR_PARAMS.MODEL]: null }),
      { scroll: false },
    );
  }, [router, buildUrl]);

  return {
    selectedRoomSlug,
    selectedModelSlug,
    step,
    selectRoom,
    selectModel,
    resetToRooms,
    resetToModels,
  };
}

// ── Granüler hook'lar (sadece belirli değerlere ihtiyaç duyan bileşenler için) ──

/**
 * Sadece mevcut adımı okur. Oda/model seçimi gerektirmeyen
 * header/breadcrumb bileşenleri için performanslı alternatif.
 */
export function useAssistantStep(): AssistantStep {
  const searchParams = useSearchParams();
  const room  = searchParams.get(ADVISOR_PARAMS.ROOM);
  const model = searchParams.get(ADVISOR_PARAMS.MODEL);
  if (room && model) return 'products';
  if (room) return 'model';
  return 'room';
}

/**
 * Adım indeksini döner: room=0, model=1, products=2.
 * İlerleme çubuğu (progress bar) bileşenleri için kullanışlıdır.
 */
export function useAssistantStepIndex(): 0 | 1 | 2 {
  const step = useAssistantStep();
  const map: Record<AssistantStep, 0 | 1 | 2> = {
    room: 0, model: 1, products: 2,
  };
  return map[step];
}
