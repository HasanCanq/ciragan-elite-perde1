import { create } from 'zustand';

// =====================================================
// PERDE DANIŞMANI — UI TOGGLE STATE
// =====================================================
// Bu store yalnızca geçici UI durumunu yönetir:
//   isAssistantModalOpen, isFiltersExpanded vb.
//
// GERÇEK İŞ DURUMU (hangi oda/model seçildi) buraya ait DEĞİL.
// O durum URL search param'larında yaşar: ?oda=mutfak&model=stor
// Bkz: hooks/useAssistantFlow.ts
//
// Persist YÖNTEM: Kasıtlı olarak persist KULLANILMADI.
// Modal açık/kapalı durumu sayfa yenilenmesinde sıfırlanmalıdır;
// URL zaten seçimleri koruyor.
// =====================================================

interface AssistantUIState {
  // ── Modal ──────────────────────────────────────────
  /** Ana asistan widget/modalının açık olup olmadığı */
  isAssistantModalOpen: boolean;

  // ── Filtre paneli (ürün listesi adımında) ──────────
  /** Ürün listesi adımındaki filtre çekmecesinin açık olup olmadığı */
  isFilterDrawerOpen: boolean;

  // ── Aksiyonlar ─────────────────────────────────────
  openAssistantModal:   () => void;
  closeAssistantModal:  () => void;
  toggleAssistantModal: () => void;

  openFilterDrawer:   () => void;
  closeFilterDrawer:  () => void;
  toggleFilterDrawer: () => void;
}

export const useAssistantStore = create<AssistantUIState>((set) => ({
  // Initial state
  isAssistantModalOpen: false,
  isFilterDrawerOpen:   false,

  // Modal aksiyonları
  openAssistantModal:   () => set({ isAssistantModalOpen: true }),
  closeAssistantModal:  () => set({ isAssistantModalOpen: false }),
  toggleAssistantModal: () =>
    set((s) => ({ isAssistantModalOpen: !s.isAssistantModalOpen })),

  // Filtre çekmecesi aksiyonları
  openFilterDrawer:   () => set({ isFilterDrawerOpen: true }),
  closeFilterDrawer:  () => set({ isFilterDrawerOpen: false }),
  toggleFilterDrawer: () =>
    set((s) => ({ isFilterDrawerOpen: !s.isFilterDrawerOpen })),
}));

// ── Granüler selector hook'ları (gereksiz re-render'ı önler) ─
export const useAssistantModalOpen    = () => useAssistantStore((s) => s.isAssistantModalOpen);
export const useAssistantFilterDrawer = () => useAssistantStore((s) => s.isFilterDrawerOpen);
