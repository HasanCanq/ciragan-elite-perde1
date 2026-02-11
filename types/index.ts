// =====================================================
// ÇIRAĞAN ELITE PERDE - TYPE DEFINITIONS
// =====================================================

// =====================================================
// ENUM TİPLERİ (Veritabanı ile uyumlu)
// =====================================================

export type UserRole = 'USER' | 'ADMIN';

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type PileFactor = 'SEYREK' | 'NORMAL' | 'SIK';

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
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryInsert {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface CategoryUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
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
  base_price: number;
  images: string[];
  is_published: boolean;
  in_stock: boolean;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  ozellikler: string | null;
}

// Kategori bilgisiyle birlikte ürün
export interface ProductWithCategory extends Product {
  category: Category | null;
}

export interface ProductInsert {
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  base_price: number;
  images?: string[];
  is_published?: boolean;
  in_stock?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface ProductUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  base_price?: number;
  images?: string[];
  is_published?: boolean;
  in_stock?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
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

// -----------------------------------------------------
// ORDERS
// -----------------------------------------------------
export interface Order {
  id: string;
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
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
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
  width: number;       // cm
  height: number;      // cm
  pileFactor: PileFactor;

  // Fiyatlandırma
  pricePerM2: number;  // Birim fiyat (m² başına)
  areaM2: number;      // Hesaplanan alan
  pileCoefficient: number;
  unitPrice: number;   // Tek ürün fiyatı

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
  PENDING: 'Beklemede',
  PAID: 'Ödendi',
  PROCESSING: 'Hazırlanıyor',
  SHIPPED: 'Kargoda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

// Sipariş durumu renkleri (Tailwind class)
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

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
