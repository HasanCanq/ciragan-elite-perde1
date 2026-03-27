// =====================================================
// GA4 MEASUREMENT PROTOCOL — SERVER-SIDE TRACKING
//
// Neden server-side?
//   Client-side gtag.js, ad-blocker'lar (~%30–40 kullanıcı) tarafından
//   engellenir. Measurement Protocol, sunucudan Google'a doğrudan POST
//   attığı için bu sorunu ortadan kaldırır.
//
// Env değişkenleri:
//   NEXT_PUBLIC_GA_MEASUREMENT_ID  — G-XXXXXXXXXX formatında
//   GA_API_SECRET                  — GA4 arayüzünden oluşturulan API Secret
//
// Her iki değişken de eksikse fonksiyon sessizce çıkar (graceful degradation).
// =====================================================

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export interface GA4PurchaseItem {
  item_id:       string;
  item_name:     string;
  item_category?: string;
  quantity:      number;
  price:         number;
}

export interface GA4PurchaseOrderData {
  orderId:    string;
  orderNumber: string;
  revenue:    number;   // total_amount (vergiler dahil)
  shipping:   number;
  currency:   string;   // 'TRY'
  items:      GA4PurchaseItem[];
}

// ──────────────────────────────────────────────────────────────────────────
// _ga cookie'den clientId parse et
// _ga formatı: GA1.1.<client_id_part1>.<client_id_part2>
// GA4'ün beklediği clientId: "<part1>.<part2>"
// ──────────────────────────────────────────────────────────────────────────
export function parseGaClientId(gaCookieValue: string | undefined): string | null {
  if (!gaCookieValue) return null;
  const parts = gaCookieValue.split('.');
  if (parts.length >= 4) {
    return `${parts[2]}.${parts[3]}`;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Ana fonksiyon: GA4'e purchase event gönder
//
// @param orderData  - Sipariş bilgileri
// @param clientId   - _ga cookie'den alınan GA clientId (anonim ziyaretçi ID'si)
//                     yoksa crypto.randomUUID() ile anonim ID üretilir
// ──────────────────────────────────────────────────────────────────────────
export async function sendGA4PurchaseEvent(
  orderData: GA4PurchaseOrderData,
  clientId?: string | null
): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret     = process.env.GA_API_SECRET;

  // Env değişkeni yoksa sessizce çık — prod dışı ortamları kırmaz
  if (!measurementId || !apiSecret) {
    console.log('[GA4] Env değişkeni eksik — tracking atlandı (normal dev/test ortamında)');
    return;
  }

  // clientId yoksa anonim UUID — event yine de gönderilir
  const resolvedClientId = clientId ?? crypto.randomUUID();

  const payload = {
    client_id: resolvedClientId,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: orderData.orderNumber,
          value:          orderData.revenue,
          shipping:       orderData.shipping,
          currency:       orderData.currency,
          items:          orderData.items.map((item) => ({
            item_id:       item.item_id,
            item_name:     item.item_name,
            item_category: item.item_category ?? 'Perde',
            quantity:      item.quantity,
            price:         item.price,
          })),
        },
      },
    ],
  };

  try {
    const url = `${GA4_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000), // 5 sn zaman aşımı — ödeme akışını bloke etme
    });

    // Measurement Protocol her zaman 2xx döner — body'i loglayarak hata ayıkla
    if (!res.ok) {
      console.warn('[GA4] Measurement Protocol HTTP hatası:', res.status);
    } else {
      console.log('[GA4] purchase event gönderildi:', {
        orderId:   orderData.orderId,
        value:     orderData.revenue,
        clientId:  resolvedClientId,
      });
    }
  } catch (err) {
    // Ağ hatası vb. — ödeme akışını asla engelleme
    console.error('[GA4] purchase event gönderilemedi (non-blocking):', err);
  }
}
