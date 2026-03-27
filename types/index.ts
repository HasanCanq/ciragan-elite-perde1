// =====================================================
// ÇIRAĞAN ELITE PERDE - TYPE DEFINITIONS
// =====================================================

// =====================================================
// ENUM TİPLERİ (Veritabanı ile uyumlu)
// =====================================================

export type UserRole = 'USER' | 'ADMIN';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'       // legacy — IN_PRODUCTION ile eşdeğer
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'ON_HOLD'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERY_FAILED'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'REFUNDED'
  | 'CANCELLED';

export type PileFactor = 'SEYREK' | 'NORMAL' | 'SIK';

/**
 * Ürün fiyat hesaplama birimi (migration 012)
 *   mt    → Metre işi  (Tül, Fon)       — genişlik × pile çarpanı × birim fiyat
 *   m2    → Metrekare  (Zebra, Stor)     — alan × birim fiyat (min_width / min_area kuralları)
 *   adet  → Sabit fiyat (Aksesuar, vb.) — miktar × birim fiyat
 */
export type CalculationType = 'mt' | 'm2' | 'adet';

// Frontend için küçük harfli versiyon (mevcut uyumluluk)
export type PileRatio = 'seyrek' | 'normal' | 'sik';

// =====================================================
// VERİTABANI TABLOLARI
// =====================================================

// -----------------------------------------------------
// PROFILES
// -----------------------------------------------------
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  role?: UserRole;
}

export interface ProfileUpdate {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  role?: UserRole;
}

// -----------------------------------------------------
// CATEGORIES
// -----------------------------------------------------

/** Veritabanı satırı — migration 011 ile parent_id eklendi */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  /** Self-referencing FK. NULL = kök (ana) kategori. */
  parent_id: string | null;
}

/**
 * Hiyerarşik sorgu sonucu.
 * Supabase nested select ile: .select('*, children:categories!parent_id(*)')
 */
export interface CategoryWithChildren extends Category {
  children: Category[];
}

/**
 * Parent bilgisiyle birlikte alt kategori.
 * Supabase nested select ile: .select('*, parent:categories!parent_id(*)')
 */
export interface CategoryWithParent extends Category {
  parent: Category | null;
}

export interface CategoryInsert {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  parent_id?: string | null;
}

export interface CategoryUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  parent_id?: string | null;
}

// Mevcut kod uyumluluğu için alias
export interface CategoryLegacy {
  id: string;
  name: string;
  slug: string;
  image: string;
}

// -----------------------------------------------------
// PRODUCTS
// -----------------------------------------------------
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  category_id: string | null;
  ozellikler: string | null;
  /**
   * Birim fiyat (TRY). Hesaplama türüne göre anlam değişir:
   *   mt    → TL/metre  (≡ base_price_per_meter)
   *   m2    → TL/m²     (≡ base_price_per_m2)
   *   adet  → TL/adet
   */
  base_price: number;
  images: string[];
  is_published: boolean;
  in_stock: boolean;
  stock_quantity: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  // ── Dinamik fiyat hesaplama alanları (migration 012) ────────────────────
  /** Hesaplama birimi. DEFAULT 'adet' */
  calculation_type: CalculationType;
  /**
   * m2 türü için minimum genişlik (cm).
   * Müşteri bu değerden daha az girise, hesaplamada bu değer kullanılır.
   * NULL = sınır yok.
   */
  min_width_cm: number | null;
  /**
   * m2 türü için minimum alan (m²).
   * Hesaplanan alan bu değerin altındaysa, bu değer baz alınır.
   * NULL = sınır yok.
   */
  min_area_m2: number | null;
  // ── Perde Danışmanı (migration 019) ─────────────────────────────────────
  /**
   * Bu ürünün ait olduğu perde modeli FK (Kruvaze, Stor vb.).
   * NULL = model atanmamış (eski ürünler / aksesuar).
   * Perde asistanı bu FK üzerinden model → ürün filtrelemesi yapar.
   */
  model_id: string | null;
}

// Kategori bilgisiyle birlikte ürün
export interface ProductWithCategory extends Product {
  category: Category | null;
}

// Pile seçenekleriyle birlikte ürün (mt türü için)
export interface ProductWithPleats extends Product {
  product_pleats: ProductPleat[];
}

export interface ProductInsert {
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  ozellikler?: string | null;
  base_price: number;
  images?: string[];
  is_published?: boolean;
  in_stock?: boolean;
  stock_quantity?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  calculation_type?: CalculationType;
  min_width_cm?: number | null;
  min_area_m2?: number | null;
  model_id?: string | null;
}

export interface ProductUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  ozellikler?: string | null;
  base_price?: number;
  images?: string[];
  is_published?: boolean;
  in_stock?: boolean;
  stock_quantity?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  calculation_type?: CalculationType;
  min_width_cm?: number | null;
  min_area_m2?: number | null;
  model_id?: string | null;
}

// -----------------------------------------------------
// PRODUCT PLEATS (pile/kıvrım seçenekleri — migration 012)
// -----------------------------------------------------
export interface ProductPleat {
  id: string;
  product_id: string;
  /** Görünen ad: "1x2.5 Normal Pile" */
  name: string;
  /** Kumaş çarpanı: 2.5 → 1m genişlik için 2.5m kumaş kullanılır */
  multiplier: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductPleatInsert {
  product_id: string;
  name: string;
  multiplier: number;
  display_order?: number;
  is_active?: boolean;
}

export interface ProductPleatUpdate {
  name?: string;
  multiplier?: number;
  display_order?: number;
  is_active?: boolean;
}

// Mevcut kod uyumluluğu için (lib/data.ts formatı)
export interface ProductLegacy {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  m2_price: number;
  images: string[];
  category: string;
  category_slug: string;
  in_stock: boolean;
  created_at: string;
}

/** Sipariş zincir yönü — Zebra/Stor için (migration 013) */
export type MechanismDirection = 'sag' | 'sol' | 'cift';

// -----------------------------------------------------
// ORDERS
// -----------------------------------------------------
export interface Order {
  id: string;
  /**
   * IDOR-güvenli sipariş numarası (migration 013).
   * Format: HND-YYYYMMDD-XXXXXXXX (rassal hex).
   * Dış dünyaya (URL, e-posta) yalnızca bu alan yansıtılır.
   */
  order_number: string;
  user_id: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_address: string;
  billing_address: string | null;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  status: OrderStatus;
  customer_note: string | null;
  admin_note: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  // ── Kargo (migration 008) ──────────────────────────
  cargo_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  // ── Üretim + fatura takip (migration 013) ─────────
  /** Üretim bandı barkod verisi */
  barcode_data: string | null;
  /** Kargo takip kodu (müşteriye gönderilen) */
  shipping_tracking_code: string | null;
  /** e-Arşiv / e-Fatura bağlantısı */
  invoice_url: string | null;
  // ── Timestamps ────────────────────────────────────
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

// Sipariş kalemleriyle birlikte sipariş
export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// Durum tarihçesiyle birlikte sipariş
export interface OrderWithHistory extends Order {
  status_history: OrderStatusHistory[];
}

export interface OrderInsert {
  user_id?: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone?: string | null;
  shipping_address: string;
  billing_address?: string | null;
  subtotal: number;
  shipping_cost?: number;
  discount_amount?: number;
  total_amount: number;
  status?: OrderStatus;
  customer_note?: string | null;
  payment_method?: string | null;
}

export interface OrderUpdate {
  status?: OrderStatus;
  admin_note?: string | null;
  payment_reference?: string | null;
  barcode_data?: string | null;
  shipping_tracking_code?: string | null;
  invoice_url?: string | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

// -----------------------------------------------------
// ORDER_STATUS_HISTORY (migration 013 genişletme)
// -----------------------------------------------------
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by_user_id: string | null;
  changed_by_role: 'admin' | 'customer' | 'system';
  reason: string | null;
  /** Müşteriye gösterilecek açıklama */
  note: string | null;
  /** true = müşteri sipariş sayfasında görür */
  is_customer_visible: boolean;
  created_at: string;
}

// -----------------------------------------------------
// ORDER_ITEMS
// -----------------------------------------------------
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  width_cm: number;
  height_cm: number;
  pile_factor: PileFactor;
  // ── migration 013 ──────────────────────────────────
  /** Seçilen pile FK (silinse bile pleat_name_snapshot korunur) */
  pleat_ratio_id: string | null;
  /** Sipariş anındaki pile adı snapshot'ı */
  pleat_name_snapshot: string | null;
  /** Zebra/Stor zincir yönü */
  mechanism_direction: MechanismDirection | null;
  /** Hesaplama türü snapshot'ı: mt | m2 | adet */
  calculation_type_snapshot: string | null;
  // ──────────────────────────────────────────────────
  area_m2: number;
  price_per_m2_snapshot: number;
  pile_coefficient: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface OrderItemInsert {
  order_id: string;
  product_id?: string | null;
  product_name: string;
  product_slug: string;
  product_image?: string | null;
  width_cm: number;
  height_cm: number;
  pile_factor: PileFactor;
  /** Pile/kıvrım ID'si — mt türünde dolu, diğerlerinde null */
  pleat_ratio_id: string | null;
  /** Sipariş anındaki pile adı — mt türünde dolu, diğerlerinde null */
  pleat_name_snapshot: string | null;
  mechanism_direction?: MechanismDirection | null;
  /** Hesaplama türü snapshot'ı — motor çıktısından alınır, hardcode edilmez */
  calculation_type_snapshot: CalculationType;
  area_m2: number;
  price_per_m2_snapshot: number;
  pile_coefficient: number;
  quantity?: number;
  unit_price: number;
  total_price: number;
}

// -----------------------------------------------------
// REVIEWS
// -----------------------------------------------------
export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithUser extends Review {
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

// =====================================================
// SEPET TİPLERİ (Frontend - Zustand Store)
// =====================================================

export interface CartItem {
  // Ürün Bilgileri
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;

  // Kişiselleştirme
  width: number;              // cm
  height: number;             // cm
  pileFactor: PileFactor;
  calculationType: CalculationType;  // mt | m2 | adet
  pleatId: string | null;            // mt türü için; diğer türlerde null

  // Fiyatlandırma (motor çıktısı — /api/engine/calculate'ten)
  areaM2: number;           // Hesaplanan/efektif alan (m²)
  pileCoefficient: number;  // Kullanılan pile katsayısı
  unitPrice: number;        // Tek ürün fiyatı

  // Motor Token (signer.ts — checkout doğrulaması için zorunlu)
  priceToken: string;       // HMAC-imzalı fiyat tokeni
  tokenExpiresAt: number;   // Unix ms — TOKEN_TTL_MS (15 dk) sonra geçersiz

  // Miktar
  quantity: number;
}

// Sepet özeti
export interface CartSummary {
  itemCount: number;
  totalItems: number;  // quantity toplamı
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
}

// =====================================================
// API RESPONSE TİPLERİ
// =====================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================================
// FORM TİPLERİ
// =====================================================

export interface CheckoutFormData {
  email: string;
  fullName: string;
  phone: string;
  shippingAddress: string;
  billingAddress?: string;
  sameAsBilling: boolean;
  customerNote?: string;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'cash_on_delivery';
}

// Kredi kartı verileri (ASLA DB'ye yazılmaz - sadece bellek içi transit)
export interface CreditCardData {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}

// 3D Secure başlatma sonucu
export interface ThreedsInitResult {
  orderId: string;
  orderNumber: string;
  threeDSHtmlContent: string;
}

// =====================================================
// PAYMENT TRANSACTION LOG TİPLERİ
// =====================================================

export type PaymentEventType =
  | 'PAYMENT_INITIATED'
  | 'THREEDS_INIT_SUCCESS'
  | 'THREEDS_INIT_FAILED'
  | 'CALLBACK_RECEIVED'
  | 'THREEDS_AUTH_SUCCESS'
  | 'THREEDS_AUTH_FAILED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'FRAUD_ATTEMPT'
  | 'AMOUNT_MISMATCH';

export interface PaymentTransactionInsert {
  order_id?: string;
  user_id?: string;
  event_type: PaymentEventType;
  payment_id?: string;
  conversation_id?: string;
  md_status?: string;
  error_code?: string;
  error_message?: string;
  auth_code?: string;
  expected_amount?: number;
  paid_amount?: number;
  currency?: string;
  ip_address?: string;
  raw_response?: Record<string, unknown>;
}

export interface PaymentTransaction extends PaymentTransactionInsert {
  id: string;
  created_at: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// =====================================================
// HELPER TİPLERİ
// =====================================================

// Fiyat hesaplama input
export interface PriceCalculationInput {
  width: number;
  height: number;
  pileRatio: PileRatio;
  m2Price: number;
}

// Mevcut uyumluluk için alias
export type PriceCalculation = PriceCalculationInput;

// =====================================================
// SABİTLER
// =====================================================

// Pile katsayıları
export const PILE_COEFFICIENTS: Record<PileRatio, number> = {
  seyrek: 1.0,
  normal: 1.2,
  sik: 1.3,
};

// Pile katsayıları (büyük harfli enum için)
export const PILE_COEFFICIENTS_UPPER: Record<PileFactor, number> = {
  SEYREK: 1.0,
  NORMAL: 1.2,
  SIK: 1.3,
};

// Pile etiketleri
export const PILE_LABELS: Record<PileRatio, string> = {
  seyrek: 'Seyrek',
  normal: 'Normal',
  sik: 'Sık',
};

// Pile etiketleri (büyük harfli enum için)
export const PILE_LABELS_UPPER: Record<PileFactor, string> = {
  SEYREK: 'Seyrek',
  NORMAL: 'Normal',
  SIK: 'Sık',
};

// Sipariş durumu etiketleri
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:          'Beklemede',
  PAID:             'Ödendi',
  PROCESSING:       'Hazırlanıyor',      // legacy
  CONFIRMED:        'Onaylandı',
  IN_PRODUCTION:    'Üretimde',
  ON_HOLD:          'Askıya Alındı',
  READY_TO_SHIP:    'Kargoya Hazır',
  SHIPPED:          'Kargoya Verildi',
  IN_TRANSIT:       'Yolda',
  DELIVERY_FAILED:  'Teslim Başarısız',
  DELIVERED:        'Teslim Edildi',
  RETURN_REQUESTED: 'İade Talep Edildi',
  REFUNDED:         'İade Edildi',
  CANCELLED:        'İptal Edildi',
};

// Sipariş durumu renkleri (Tailwind class)
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:          'bg-yellow-100 text-yellow-800',
  PAID:             'bg-blue-100 text-blue-800',
  PROCESSING:       'bg-purple-100 text-purple-800',
  CONFIRMED:        'bg-sky-100 text-sky-800',
  IN_PRODUCTION:    'bg-violet-100 text-violet-800',
  ON_HOLD:          'bg-orange-100 text-orange-800',
  READY_TO_SHIP:    'bg-teal-100 text-teal-800',
  SHIPPED:          'bg-indigo-100 text-indigo-800',
  IN_TRANSIT:       'bg-cyan-100 text-cyan-800',
  DELIVERY_FAILED:  'bg-red-100 text-red-700',
  DELIVERED:        'bg-green-100 text-green-800',
  RETURN_REQUESTED: 'bg-amber-100 text-amber-800',
  REFUNDED:         'bg-gray-100 text-gray-700',
  CANCELLED:        'bg-red-100 text-red-800',
};

// =====================================================
// YASAL BELGE VERSİYONLARI
// =====================================================
export interface LegalDocumentVersion {
  id: string;
  document_type: 'ON_BILGILENDIRME' | 'MESAFELI_SATIS' | 'KVKK_AYDINLATMA' | 'CEREZ_POLITIKASI';
  version: string;
  content_hash: string;
  content_url: string | null;
  is_active: boolean;
  published_at: string;
}

export interface OrderLegalLog {
  id: string;
  order_id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  consented_at: string;
  consented_documents: Array<{
    version_id: string;
    document_type: string;
    version: string;
    content_hash: string;
  }>;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =====================================================
// E-FATURA
// =====================================================
export interface InvoiceOutboxRecord {
  id: string;
  order_id: string;
  invoice_type: 'E_ARSIV' | 'E_FATURA' | 'E_IRSALIYE';
  provider: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retry_count: number;
  invoice_number: string | null;
  invoice_uuid: string | null;
  invoice_pdf_url: string | null;
  issued_at: string | null;
  email_sent_at: string | null;
  last_error: string | null;
  created_at: string;
}

// Minimum ve maksimum ölçü limitleri (cm)
export const SIZE_LIMITS = {
  MIN_WIDTH: 50,
  MAX_WIDTH: 600,
  MIN_HEIGHT: 50,
  MAX_HEIGHT: 400,
} as const;

// Kargo ücreti eşiği ve tutarı
export const SHIPPING = {
  FREE_THRESHOLD: 5000,
  COST: 150,
} as const;

// =====================================================
// UTILITY TYPE HELPERS
// =====================================================

// PileRatio -> PileFactor dönüşümü
export function toPileFactor(ratio: PileRatio): PileFactor {
  const map: Record<PileRatio, PileFactor> = {
    seyrek: 'SEYREK',
    normal: 'NORMAL',
    sik: 'SIK',
  };
  return map[ratio];
}

// PileFactor -> PileRatio dönüşümü
export function toPileRatio(factor: PileFactor): PileRatio {
  const map: Record<PileFactor, PileRatio> = {
    SEYREK: 'seyrek',
    NORMAL: 'normal',
    SIK: 'sik',
  };
  return map[factor];
}

// CartItem için benzersiz key oluştur
export function getCartItemKey(item: Pick<CartItem, 'productId' | 'width' | 'height' | 'pileFactor'>): string {
  return `${item.productId}-${item.width}-${item.height}-${item.pileFactor}`;
}

// =====================================================
// PERDE DANIŞMANI TİPLERİ (migration 019)
// =====================================================

// -----------------------------------------------------
// ROOMS (Oda Tipleri)
// -----------------------------------------------------

export interface Room {
  id: string;
  /** Görüntülenen ad: Salon, Mutfak, Yatak Odası, Çocuk Odası */
  name: string;
  /** URL-safe slug: salon, mutfak, yatak-odasi, cocuk-odasi */
  slug: string;
  /** Asistan UI'ında kart ikonunun URL'i. NULL = ikon yok. */
  icon_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomInsert {
  name: string;
  slug: string;
  icon_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface RoomUpdate {
  name?: string;
  slug?: string;
  icon_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

// -----------------------------------------------------
// CURTAIN_MODELS (Perde Model Tipleri)
// -----------------------------------------------------

export interface CurtainModel {
  id: string;
  /** Görüntülenen ad: Kruvaze, Plicell, Stor, Blackout */
  name: string;
  /** URL-safe slug: kruvaze, plicell, stor, blackout */
  slug: string;
  /**
   * KRİTİK — Bu modelin üretilebileceği maksimum genişlik (cm).
   * Sipariş formu, anlık client-side validasyon için bu değeri kullanır.
   * Müşteri bu değerin üstünde genişlik giremez.
   * Örn: Stor = 400 cm, Kruvaze = 600 cm.
   */
  max_width_cm: number;
  /**
   * KRİTİK — Bu modelin üretilebileceği maksimum yükseklik (cm).
   * Sipariş formu, anlık client-side validasyon için bu değeri kullanır.
   */
  max_height_cm: number;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CurtainModelInsert {
  name: string;
  slug: string;
  max_width_cm: number;
  max_height_cm: number;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export interface CurtainModelUpdate {
  name?: string;
  slug?: string;
  max_width_cm?: number;
  max_height_cm?: number;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  display_order?: number;
}

// -----------------------------------------------------
// ROOM_MODELS_MAPPING (Oda–Model N:M)
// -----------------------------------------------------

export interface RoomModelMapping {
  room_id: string;
  model_id: string;
  /**
   * Bu oda + model kombinasyonuna özgü asistan UI pazarlama metni.
   * Örn (Mutfak + Stor): "Ocak ateşine karşı güvenli ve kolay temizlenebilir."
   * NULL = jenerik model açıklaması gösterilir.
   */
  marketing_text: string | null;
  display_order: number;
  created_at: string;
}

export interface RoomModelMappingInsert {
  room_id: string;
  model_id: string;
  marketing_text?: string | null;
  display_order?: number;
}

export interface RoomModelMappingUpdate {
  marketing_text?: string | null;
  display_order?: number;
}

// ── Birleşik (Join) Tipler ────────────────────────────────

/**
 * Oda + bu odaya ait modeller.
 * Supabase nested select:
 *   .select('*, mappings:room_models_mapping(*, model:curtain_models(*))')
 */
export interface RoomWithModels extends Room {
  mappings: Array<RoomModelMapping & { model: CurtainModel }>;
}

/**
 * Model + bu modeli kullanan odalar.
 * Supabase nested select:
 *   .select('*, mappings:room_models_mapping(*, room:rooms(*))')
 */
export interface CurtainModelWithRooms extends CurtainModel {
  mappings: Array<RoomModelMapping & { room: Room }>;
}

/**
 * Ürün + bağlı perde modeli detayları.
 * Supabase nested select:
 *   .select('*, curtain_model:curtain_models(*)')
 */
export interface ProductWithModel extends Product {
  /** NULL = model_id atanmamış veya model silinmiş (ON DELETE SET NULL) */
  curtain_model: CurtainModel | null;
}

/**
 * Perde asistanı için tam oda kartı.
 * Bir odanın önerilen modelleri VE her model için ürün sayısını içerir.
 * Supabase'den değil, server action'dan dönen composite tip.
 */
export interface RoomAdvisorCard {
  room: Room;
  models: Array<{
    model: CurtainModel;
    marketing_text: string | null;
    display_order: number;
    /** Bu modelde yayınlanmış ürün sayısı (ön yükleme için) */
    product_count: number;
  }>;
}

// Perde Danışmanı boyut doğrulama sonucu
export interface ModelDimensionValidation {
  isValid: boolean;
  widthError: string | null;   // null = geçerli
  heightError: string | null;  // null = geçerli
  model: Pick<CurtainModel, 'name' | 'max_width_cm' | 'max_height_cm'>;
}

/**
 * Belirli bir model için boyut validasyonu yapar.
 * Sipariş formu bileşeninde anlık (onChange) kullanılır.
 */
export function validateCurtainDimensions(
  model: Pick<CurtainModel, 'name' | 'max_width_cm' | 'max_height_cm'>,
  widthCm: number,
  heightCm: number,
): ModelDimensionValidation {
  const widthError =
    widthCm > model.max_width_cm
      ? `${model.name} modeli maksimum ${model.max_width_cm} cm genişliğe kadar üretilebilir.`
      : null;

  const heightError =
    heightCm > model.max_height_cm
      ? `${model.name} modeli maksimum ${model.max_height_cm} cm yüksekliğe kadar üretilebilir.`
      : null;

  return {
    isValid: widthError === null && heightError === null,
    widthError,
    heightError,
    model,
  };
}

// =====================================================
// İPTAL SEBEP KATEGORİLERİ
// =====================================================

export const CANCEL_REASON_CATEGORIES = [
  'Müşteri talebi — fikir değişikliği',
  'Müşteri talebi — sipariş hatası (boyut/renk)',
  'Müşteri talebi — geç teslimat',
  'Operasyonel — üretim hatası',
  'Operasyonel — stok yetersizliği',
  'Operasyonel — tedarikçi sorunu',
  'Ödeme sorunu — ödeme doğrulanamadı',
  'Kargo sorunu — adres hatalı/teslimat imkansız',
  'İade talebi sonrası iptal',
  'Diğer',
] as const;

export type CancelReasonCategory = typeof CANCEL_REASON_CATEGORIES[number];
