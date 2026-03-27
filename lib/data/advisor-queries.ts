/**
 * PERDE DANIŞMANI — PUBLIC DATA QUERIES
 * ──────────────────────────────────────────────────────────
 * Migration 019'un rooms / curtain_models / room_models_mapping
 * tablolarına ait herkese açık sorgular.
 *
 * İki katmanlı optimizasyon (public-queries.ts ile aynı strateji):
 *   1) getPublicSupabase() → cookies() çağırmaz → ISR cache çalışır
 *   2) React cache()       → aynı render'da tekrar çağrılsa tek sorgu gider
 */

import { cache } from 'react';
import { getPublicSupabase } from '@/lib/supabase/public';
import type { Room, CurtainModel, RoomModelMapping, ProductWithCategory } from '@/types';

// ─── Composite tip ────────────────────────────────────────────

/** room_models_mapping satırı + inline model detayı */
export type RoomModelEntry = Omit<RoomModelMapping, 'model_id'> & {
  model_id: string;
  model: CurtainModel;
};

// ─── Geliştirme ortamı mock verisi ───────────────────────────
// Supabase bağlantısı olmayan yerel geliştirme için.
// Prod'da hiçbir zaman kullanılmaz.

const MOCK_ROOMS: Room[] = [
  { id: 'm-1', name: 'Salon',       slug: 'salon',       icon_url: null, display_order: 1, is_active: true, created_at: '', updated_at: '' },
  { id: 'm-2', name: 'Yatak Odası', slug: 'yatak-odasi', icon_url: null, display_order: 2, is_active: true, created_at: '', updated_at: '' },
  { id: 'm-3', name: 'Mutfak',      slug: 'mutfak',      icon_url: null, display_order: 3, is_active: true, created_at: '', updated_at: '' },
  { id: 'm-4', name: 'Çocuk Odası', slug: 'cocuk-odasi', icon_url: null, display_order: 4, is_active: true, created_at: '', updated_at: '' },
  { id: 'm-5', name: 'Banyo',       slug: 'banyo',       icon_url: null, display_order: 5, is_active: true, created_at: '', updated_at: '' },
  { id: 'm-6', name: 'Ofis',        slug: 'ofis',        icon_url: null, display_order: 6, is_active: true, created_at: '', updated_at: '' },
];

function mockCurtainModel(overrides: Partial<CurtainModel> & Pick<CurtainModel, 'id' | 'name' | 'slug' | 'max_width_cm' | 'max_height_cm'>): CurtainModel {
  return {
    description: null, image_url: null, is_active: true,
    display_order: 1, created_at: '', updated_at: '',
    ...overrides,
  };
}

const MOCK_ROOM_MODELS: Record<string, RoomModelEntry[]> = {
  salon: [
    { room_id: 'm-1', model_id: 'mm-1', marketing_text: 'Geniş salonunuza zarafet katın. Büyük cam yüzeyleri için mükemmel seçim.', display_order: 1, created_at: '', model: mockCurtainModel({ id: 'mm-1', name: 'Kruvaze', slug: 'kruvaze', max_width_cm: 600, max_height_cm: 350 }) },
    { room_id: 'm-1', model_id: 'mm-2', marketing_text: 'Isı yalıtımıyla kış aylarında enerji tasarrufu sağlar.', display_order: 2, created_at: '', model: mockCurtainModel({ id: 'mm-2', name: 'Plicell', slug: 'plicell', max_width_cm: 500, max_height_cm: 300 }) },
    { room_id: 'm-1', model_id: 'mm-3', marketing_text: 'Günün her saatinde ışığı kontrol edin; hem aydınlık hem mahrem.', display_order: 3, created_at: '', model: mockCurtainModel({ id: 'mm-3', name: 'Zebra', slug: 'zebra', max_width_cm: 350, max_height_cm: 280 }) },
  ],
  mutfak: [
    { room_id: 'm-3', model_id: 'mm-4', marketing_text: 'Ocak ateşine karşı güvenli ve kolay temizlenebilir özel kaplama.', display_order: 1, created_at: '', model: mockCurtainModel({ id: 'mm-4', name: 'Stor', slug: 'stor', max_width_cm: 400, max_height_cm: 300 }) },
    { room_id: 'm-3', model_id: 'mm-3', marketing_text: 'Pratik kullanım, tek elle açıp kapama.', display_order: 2, created_at: '', model: mockCurtainModel({ id: 'mm-3', name: 'Zebra', slug: 'zebra', max_width_cm: 350, max_height_cm: 280 }) },
    { room_id: 'm-3', model_id: 'mm-5', marketing_text: 'Alüminyum kanatlar buhara ve neme karşı dirençlidir.', display_order: 3, created_at: '', model: mockCurtainModel({ id: 'mm-5', name: 'Jaluzi', slug: 'jaluzi', max_width_cm: 300, max_height_cm: 280 }) },
  ],
  'yatak-odasi': [
    { room_id: 'm-2', model_id: 'mm-6', marketing_text: 'Tam karartma ile kaliteli uyku. Vardiyalı çalışanlar için vazgeçilmez.', display_order: 1, created_at: '', model: mockCurtainModel({ id: 'mm-6', name: 'Blackout', slug: 'blackout', max_width_cm: 400, max_height_cm: 300 }) },
    { room_id: 'm-2', model_id: 'mm-1', marketing_text: 'Yumuşak kumaş dokusuyla yatak odanıza sıcaklık katın.', display_order: 2, created_at: '', model: mockCurtainModel({ id: 'mm-1', name: 'Kruvaze', slug: 'kruvaze', max_width_cm: 600, max_height_cm: 350 }) },
    { room_id: 'm-2', model_id: 'mm-2', marketing_text: 'Ses yalıtımıyla şehir gürültüsünü keser, daha sessiz uyku sağlar.', display_order: 3, created_at: '', model: mockCurtainModel({ id: 'mm-2', name: 'Plicell', slug: 'plicell', max_width_cm: 500, max_height_cm: 300 }) },
  ],
  'cocuk-odasi': [
    { room_id: 'm-4', model_id: 'mm-6', marketing_text: 'Gündüz uyku saatlerinde tam karartma. Bebek ve çocuklar için güvenli kumaş.', display_order: 1, created_at: '', model: mockCurtainModel({ id: 'mm-6', name: 'Blackout', slug: 'blackout', max_width_cm: 400, max_height_cm: 300 }) },
    { room_id: 'm-4', model_id: 'mm-4', marketing_text: 'Renkli ve eğlenceli desen seçenekleriyle çocuğunuzun odasına hayat katın.', display_order: 2, created_at: '', model: mockCurtainModel({ id: 'mm-4', name: 'Stor', slug: 'stor', max_width_cm: 400, max_height_cm: 300 }) },
    { room_id: 'm-4', model_id: 'mm-1', marketing_text: 'Yumuşak ve güvenli kumaş.', display_order: 3, created_at: '', model: mockCurtainModel({ id: 'mm-1', name: 'Kruvaze', slug: 'kruvaze', max_width_cm: 600, max_height_cm: 350 }) },
  ],
};

/** Tek bir perde modelini slug ile getirir. PLP başlık bandı için. */
export const getCurtainModelBySlugPublic = cache(async (
  slug: string,
): Promise<CurtainModel | null> => {
  if (useMockInternal()) {
    const all = Object.values(MOCK_ROOM_MODELS).flat();
    return all.find((e) => e.model.slug === slug)?.model ?? null;
  }

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('curtain_models')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[getCurtainModelBySlugPublic]', slug, error.message);
    return null;
  }
  return data;
});

/** model_id FK'ya göre yayındaki ürünleri getirir. Advisor PLP için. */
export const getProductsByModelPublic = cache(async (
  modelSlug: string,
): Promise<ProductWithCategory[]> => {
  if (useMockInternal()) {
    // Mock: ürün yok — gerçek DB verisiyle çalışılmalı
    return [];
  }

  const supabase = getPublicSupabase();

  // 1) Model id'yi slug'dan çöz
  const { data: model, error: mErr } = await supabase
    .from('curtain_models')
    .select('id')
    .eq('slug', modelSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (mErr || !model) {
    if (mErr) console.error('[getProductsByModelPublic] model lookup:', mErr.message);
    return [];
  }

  // 2) O model'e ait yayındaki ürünleri getir
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('model_id', model.id)
    .eq('is_published', true)
    .order('in_stock',   { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getProductsByModelPublic] products:', modelSlug, error.message);
    return [];
  }

  return (data ?? []) as unknown as ProductWithCategory[];
});

function useMockInternal(): boolean {
  return process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

// ─── Sorgular ─────────────────────────────────────────────────

/**
 * Tüm aktif odaları display_order sırasıyla getirir.
 * Asistan Step 1 için.
 */
export const getRoomsPublic = cache(async (): Promise<Room[]> => {
  if (useMockInternal()) return MOCK_ROOMS;

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[getRoomsPublic]', error.message);
    return [];
  }

  // Geliştirme ortamında DB boşsa mock'a düş
  if (data.length === 0 && process.env.NODE_ENV === 'development') {
    console.warn('[getRoomsPublic] Tablo boş, mock verisi kullanılıyor.');
    return MOCK_ROOMS;
  }

  return data ?? [];
});

/**
 * Belirli bir odayı ve ona eşlenmiş perde modellerini getirir.
 * Asistan Step 2 için. RLS aktif modelleri filtreler.
 */
export const getRoomWithModelsPublic = cache(async (
  roomSlug: string,
): Promise<{ room: Room | null; models: RoomModelEntry[] }> => {
  if (useMockInternal()) {
    const room = MOCK_ROOMS.find((r) => r.slug === roomSlug) ?? null;
    return { room, models: MOCK_ROOM_MODELS[roomSlug] ?? [] };
  }

  const supabase = getPublicSupabase();

  // 1. Odayı getir
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('slug', roomSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (roomError) {
    console.error('[getRoomWithModelsPublic] oda:', roomSlug, roomError.message);
    return { room: null, models: [] };
  }

  if (!room) return { room: null, models: [] };

  // 2. Bu odanın model mapping'lerini + model detaylarını getir.
  //    RLS curtain_models üzerinde is_active=true zorunlu kılar — ayrıca filtrelemeye gerek yok.
  const { data: mappings, error: mappingError } = await supabase
    .from('room_models_mapping')
    .select(`
      room_id,
      model_id,
      marketing_text,
      display_order,
      created_at,
      model:curtain_models (
        id, name, slug, max_width_cm, max_height_cm,
        description, image_url, is_active, display_order,
        created_at, updated_at
      )
    `)
    .eq('room_id', room.id)
    .order('display_order', { ascending: true });

  if (mappingError) {
    console.error('[getRoomWithModelsPublic] mapping:', roomSlug, mappingError.message);
    return { room, models: [] };
  }

  // Supabase client'ı FK join'i teknik olarak dizi olarak tiplendirir (1:N varsayımı),
  // ancak PostgREST to-one ilişkisinde tek nesne döner. unknown cast zorunludur.
  // model null ise (RLS tarafından filtrelendi) satırı çıkar.
  const validMappings = ((mappings ?? []) as unknown[]).filter(
    (m): m is RoomModelEntry =>
      m !== null &&
      typeof m === 'object' &&
      (m as RoomModelEntry).model !== null,
  );

  if (validMappings.length === 0 && process.env.NODE_ENV === 'development') {
    console.warn('[getRoomWithModelsPublic] Mapping boş, mock kullanılıyor:', roomSlug);
    return { room, models: MOCK_ROOM_MODELS[roomSlug] ?? [] };
  }

  return { room, models: validMappings };
});
