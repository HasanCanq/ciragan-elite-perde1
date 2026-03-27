/**
 * E-Fatura Sistem Tipleri
 *
 * Türkiye e-Fatura Mevzuatı:
 * - e-Fatura: B2B, VKN zorunlu, GIB UBL-TR formatı, anlık iletim
 * - e-Arşiv: B2C, TCKN opsiyonel, 500₺ altı isteğe bağlı, aylık toplu bildirim
 * - e-İrsaliye: Kargo irsaliyesi (şimdilik kapsam dışı)
 *
 * KDV Oranları (2024):
 * - Genel KDV: %20 (perde, tekstil)
 * - İndirimli KDV: %10 (bazı gıda)
 * - Özel KDV: %1 (konut)
 */

// ============================================================
// FATURA VERİ YAPILARI
// ============================================================

export type InvoiceType = 'E_ARSIV' | 'E_FATURA' | 'E_IRSALIYE';

export interface InvoiceCustomer {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  country: string;        // ISO 3166: 'TR'
  taxNumber?: string;     // VKN (10 hane) veya TCKN (11 hane)
  taxOffice?: string;     // Vergi dairesi adı (B2B için)
}

export interface InvoiceLineItem {
  name: string;           // Ürün/hizmet adı
  quantity: number;
  unitCode: string;       // 'ADET', 'M2', 'MT', 'KG'
  unitPrice: number;      // KDV hariç birim fiyat
  vatRate: number;        // Oran: 0, 1, 10, 20
  discountRate?: number;  // İskonto %
  description?: string;  // Özel ölçü detayları
}

export interface InvoiceData {
  // Sipariş referansı
  orderId:      string;
  orderNumber:  string;

  // Fatura tipi ve tarihi
  invoiceType:  InvoiceType;
  invoiceDate:  string;       // ISO 8601: '2024-03-15'

  // Müşteri
  customer:     InvoiceCustomer;

  // Kalemler
  lineItems:    InvoiceLineItem[];

  // Tutarlar (entegratör de hesaplar ama double-check için)
  subtotal:     number;       // KDV hariç toplam
  vatAmount:    number;       // Toplam KDV
  totalAmount:  number;       // KDV dahil toplam (TL)

  // Opsiyonel notlar
  notes?: string;
}

// ============================================================
// ENTEGRATÖR YANIT YAPILARI
// ============================================================

export interface InvoiceResult {
  success:        boolean;

  // Başarı durumunda
  invoiceNumber?: string;    // GIB fatura numarası (ör: AGP2024000000001)
  invoiceUuid?:   string;    // GIB UUID
  pdfUrl?:        string;    // PDF indirme linki
  htmlUrl?:       string;    // HTML görüntüleme linki
  issuedAt?:      string;    // ISO 8601

  // Hata durumunda
  error?:         string;
  errorCode?:     string;   // Entegratöre özgü hata kodu
  retryable?:     boolean;  // false → retry yapma (ör: müşteri verisi hatalı)
}

// ============================================================
// PROVIDER INTERFACE (Strategy Pattern)
// ============================================================

export interface InvoiceProvider {
  readonly name: string;

  /**
   * Entegratör API'sine fatura oluşturma isteği gönderir.
   * Her provider kendi auth/format dönüşümünü yapar.
   */
  createInvoice(data: InvoiceData): Promise<InvoiceResult>;

  /**
   * Entegratöre erişim sağlanabiliyor mu? (credentials var mı?)
   */
  isConfigured(): boolean;
}

// ============================================================
// SIPARIS → FATURA DÖNÜŞÜM YARDIMCISI
// ============================================================

const VAT_RATE = 20; // Perde/tekstil KDV oranı

/**
 * Supabase order + order_items'tan InvoiceData üretir.
 */
export function buildInvoiceData(
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    shipping_address: { address?: string; city?: string } | string;
    subtotal: number;
    total_amount: number;
  },
  items: Array<{
    product_name: string;
    quantity: number;
    area_m2: number;
    unit_price: number;
    total_price: number;
    width_cm?: number;
    height_cm?: number;
    pile_factor?: string;
  }>,
  invoiceType: InvoiceType = 'E_ARSIV'
): InvoiceData {
  const address =
    typeof order.shipping_address === 'string'
      ? order.shipping_address
      : (order.shipping_address?.address ?? '');
  const city =
    typeof order.shipping_address === 'object'
      ? (order.shipping_address?.city ?? 'İstanbul')
      : 'İstanbul';

  // KDV hariç tutarları hesapla (fiyatlar KDV dahil varsayımıyla)
  const vatDivisor  = 1 + VAT_RATE / 100;
  const subtotalNet = Math.round((order.total_amount / vatDivisor) * 100) / 100;
  const vatAmount   = Math.round((order.total_amount - subtotalNet) * 100) / 100;

  const lineItems: InvoiceLineItem[] = items.map((item) => {
    const unitPriceNet = Math.round((item.unit_price / vatDivisor) * 100) / 100;
    const description = item.width_cm
      ? `${item.width_cm}cm x ${item.height_cm}cm, ${item.area_m2?.toFixed(2)}m², ${item.pile_factor ?? ''}`
      : undefined;

    return {
      name:       item.product_name,
      quantity:   item.quantity,
      unitCode:   'ADET',
      unitPrice:  unitPriceNet,
      vatRate:    VAT_RATE,
      description,
    };
  });

  return {
    orderId:      order.id,
    orderNumber:  order.order_number,
    invoiceType,
    invoiceDate:  new Date().toISOString().slice(0, 10),
    customer: {
      name:    order.customer_name,
      email:   order.customer_email,
      phone:   order.customer_phone ?? undefined,
      address,
      city,
      country: 'TR',
    },
    lineItems,
    subtotal:    subtotalNet,
    vatAmount,
    totalAmount: order.total_amount,
  };
}
