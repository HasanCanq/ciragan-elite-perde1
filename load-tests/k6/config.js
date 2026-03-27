/**
 * k6 Yük Testi — Merkezi Konfigürasyon
 * Tüm senaryolar bu dosyadan import eder.
 *
 * Env değişkenleri çalışma zamanında k6'ya geçirilir:
 *   k6 run -e BASE_URL=https://... -e SUPABASE_URL=... script.js
 */

// ─── Hedef sistem ──────────────────────────────────────────────────────────
export const BASE_URL        = __ENV.BASE_URL;
export const SUPABASE_URL    = __ENV.SUPABASE_URL;
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
// ─── Test hesapları (Supabase'de önceden oluşturulmalı — bkz. README) ──────
// k6 VU'ları bu havuzdan sırayla seçer (round-robin).
export const TEST_USERS = [
  { email: 'loadtest1@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest2@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest3@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest4@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest5@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest6@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest7@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest8@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest9@ciragan-test.com', password: 'LoadTest123!' },
  { email: 'loadtest10@ciragan-test.com', password: 'LoadTest123!' },
];

// Test ürün slug'ları — gerçek DB'deki slugları girin
export const PRODUCT_SLUGS = [
  'milano-tul-perde',
  'royal-kadife-fon',
  'venedik-dantel-tul',
  'premium-stor-perde',
  'elite-zebra-perde',
  'osmanli-jakar-fon'
];

// Test kategori slug'ları
export const CATEGORY_SLUGS = [
  'tul-perdeler',
  'fon-perdeler',
  'stor-perdeler',
  'zebra-perdeler'
];
// ─── Başarı eşikleri (SLA hedefleri) ───────────────────────────────────────
export const THRESHOLDS = {
  // Public sayfa yükleme (ISR cache'li)
  browse: {
    'http_req_duration{scenario:browse}': ['p(95)<800', 'p(99)<1500'],
    'http_req_failed{scenario:browse}':   ['rate<0.01'],   // %1'den az hata
  },

  // Checkout (DB yazma, State Machine, Legal Log)
  checkout: {
    'http_req_duration{scenario:checkout}': ['p(95)<3000', 'p(99)<5000'],
    'http_req_failed{scenario:checkout}':   ['rate<0.05'],  // %5'ten az hata
    'checkout_success_rate':                ['rate>0.90'],  // %90+ başarı
  },

  // Admin sipariş güncelleme (State Machine + Transaction)
  admin: {
    'http_req_duration{scenario:admin}': ['p(95)<2000'],
    'http_req_failed{scenario:admin}':   ['rate<0.02'],
  },

  // Genel metrikler
  global: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed':   ['rate<0.05'],
  },
};

// ─── Düşünme süreleri (gerçekçi kullanıcı davranışı) ───────────────────────
export const THINK_TIME = {
  SHORT:  () => Math.random() * 1 + 0.5,  // 0.5–1.5 sn
  MEDIUM: () => Math.random() * 2 + 1,    // 1–3 sn
  LONG:   () => Math.random() * 3 + 2,    // 2–5 sn
};
