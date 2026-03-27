/**
 * TAM YÜK TESTİ — Tüm Senaryolar Birlikte
 * ═══════════════════════════════════════════════════════════════
 * 10.000 kullanıcının aynı anda sistemi kullandığı üretim simülasyonu:
 *
 *   - %80 Tarayıcı/gezinme trafiği  (ISR cache, CDN, product pages)
 *   - %15 Ödeme/checkout trafiği   (DB yazar, en ağır iş yükü)
 *   -  %5 Admin işlemleri          (State machine, audit trail)
 *
 * Çalıştırma:
 *   k6 run full-load.js \
 *     --env BASE_URL=https://staging.ciragan-elite.com \
 *     --env SUPABASE_URL=https://xxx.supabase.co \
 *     --env SUPABASE_ANON_KEY=eyJ... \
 *     --out json=results/full-load-$(date +%Y%m%d-%H%M).json
 *
 * Toplam süre: ~22 dakika (ramp-up + plateau + ramp-down)
 */

import { sleep, group, check } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { SUPABASE_URL, BASE_URL, TEST_USERS, THINK_TIME } from './config.js';
import {
  supabaseLogin,
  getProducts,
  createTestOrder,
  updateOrderStatusRpc,
} from './helpers/supabase.js';

// ─── Paylaşılan test verisi ───────────────────────────────────────────────────
const testProducts = new SharedArray('products', function () {
  // Gerçek test sırasında setup() tarafından dolduruluyor
  // Bu array sadece VU'lar arasında paylaşım için tanımlandı
  return [];
});

// ─── Özel metrikler ───────────────────────────────────────────────────────────

// Tarayıcı metrikleri
const cacheHitRate       = new Rate('cache_hit_rate');
const pageLoadTrend      = new Trend('page_load_ms');
const browseErrors       = new Counter('browse_errors');

// Checkout metrikleri
const checkoutSuccess    = new Rate('checkout_success_rate');
const checkoutDuration   = new Trend('checkout_duration_ms');
const dbPoolExhausted    = new Counter('db_pool_exhausted');

// Admin metrikleri
const transitionSuccess  = new Rate('state_machine_success_rate');
const transitionDuration = new Trend('state_machine_transition_ms');

// ─── Yük profili ──────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    /**
     * BROWSE: 10.000 VU'ya tırmanan gezinme trafiği
     * ISR sayfaların cache'i test eder.
     * Gerçek dünyada kullanıcıların %80'i sadece geziyor.
     */
    browse: {
      executor:        'ramping-vus',
      startVUs:        0,
      stages: [
        { duration: '3m',  target: 500  },  // Isınma
        { duration: '3m',  target: 2000 },  // Hızlı artış
        { duration: '5m',  target: 8000 },  // Hedef yük
        { duration: '5m',  target: 8000 },  // Plateau — bu noktada sorunlar ortaya çıkar
        { duration: '3m',  target: 1000 },  // Kademeli düşüş
        { duration: '1m',  target: 0    },  // Tamamen durdur
      ],
      tags:            { scenario: 'browse' },
      exec:            'browseScenario',
      gracefulStop:    '30s',
    },

    /**
     * CHECKOUT: Sabit varış hızı — yazma ağırlıklı DB stres testi
     * Her saniye 30 yeni ödeme denemesi (yaklaşık %15 trafik payı).
     * DB connection pool'unu zorlayan ana senaryo.
     */
    checkout: {
      executor:          'constant-arrival-rate',
      rate:              30,         // Saniyede 30 checkout girişimi
      timeUnit:          '1s',
      duration:          '15m',      // Browse ile aynı süre boyunca
      preAllocatedVUs:   80,
      maxVUs:            400,
      startTime:         '2m',       // Browse ısındıktan sonra başla
      tags:              { scenario: 'checkout' },
      exec:              'checkoutScenario',
    },

    /**
     * ADMIN: Düşük hacimli, yüksek etkili state machine işlemleri
     * Gerçek admin kullanımını simüle eder — tüm trafiğin %5'i.
     */
    admin: {
      executor:          'constant-arrival-rate',
      rate:              5,          // Saniyede 5 durum güncellemesi
      timeUnit:          '1s',
      duration:          '12m',
      preAllocatedVUs:   10,
      maxVUs:            50,
      startTime:         '5m',       // Checkout başladıktan sonra başla
      tags:              { scenario: 'admin' },
      exec:              'adminScenario',
    },
  },

  thresholds: {
    // ── Genel HTTP ─────────────────────────────────────────────────────────────
    'http_req_failed':                          ['rate<0.01'],    // Toplam hata oranı %1 altında
    'http_req_duration':                        ['p(99)<5000'],   // Hiçbir istek 5sn üstünde kalmasın

    // ── Browse/Cache ───────────────────────────────────────────────────────────
    'http_req_duration{scenario:browse}':       ['p(95)<800'],    // Cache sayfaları hızlı
    'http_req_duration{scenario:browse}':       ['p(99)<2000'],
    'cache_hit_rate':                           ['rate>0.75'],    // %75 cache hit
    'page_load_ms':                             ['p(95)<1000'],
    'browse_errors':                            ['count<200'],

    // ── Checkout ───────────────────────────────────────────────────────────────
    'http_req_duration{scenario:checkout}':     ['p(95)<4000'],   // DB yazma altında kabul edilebilir
    'checkout_success_rate':                    ['rate>0.90'],    // %90 başarı
    'checkout_duration_ms':                     ['p(95)<5000'],
    'db_pool_exhausted':                        ['count<50'],     // 50'den az 503

    // ── Admin/State Machine ────────────────────────────────────────────────────
    'http_req_duration{scenario:admin}':        ['p(95)<2000'],
    'state_machine_success_rate':               ['rate>0.95'],
    'state_machine_transition_ms':              ['p(95)<1500'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  console.log('Full Load Test başlatılıyor...');

  // Admin kullanıcı ile login ol, gerçek ürün listesi al
  const adminUser = TEST_USERS[0];
  const session   = supabaseLogin(adminUser.email, adminUser.password);

  if (!session) {
    console.error('KRITIK: Admin login başarısız, setup durdu!');
    return { products: [], token: null, userId: null, testOrders: [] };
  }

  const productsRes = getProducts(session.token, 20);
  const products = productsRes.status === 200 ? productsRes.json() : [];

  // Admin senaryosu için 15 test siparişi oluştur
  const testOrders = [];
  for (let i = 0; i < 15; i++) {
    const product = products[i % products.length];
    if (!product) continue;

    const order = createTestOrder(session.token, session.userId, product);
    if (order) testOrders.push(order);
  }

  console.log(`Setup tamamlandı: ${products.length} ürün, ${testOrders.length} test siparişi`);

  return {
    products,
    token:      session.token,
    userId:     session.userId,
    testOrders,
  };
}

// ─── SENARYO 1: Tarayıcı (Browse) ────────────────────────────────────────────
export function browseScenario(data) {
  const roll = Math.random();

  if (roll < 0.50) {
    // %50 — Tipik kullanıcı: ana sayfa → kategori → ürün
    typicalBrowse();
  } else if (roll < 0.80) {
    // %30 — Kategori odaklı: doğrudan kategori
    categoryBrowse();
  } else {
    // %20 — Ürün araması: doğrudan ürün sayfası
    productBrowse(data);
  }
}

function typicalBrowse() {
  group('Tipik Gezinme', () => {
    // Ana sayfa
    const home = http.get(`${BASE_URL}/`, { tags: { page: 'home' } });
    const homeOk = check(home, {
      'Ana sayfa yüklendi': (r) => r.status === 200,
      'Ana sayfa hızlı':   (r) => r.timings.duration < 1500,
    });
    pageLoadTrend.add(home.timings.duration);
    cacheHitRate.add(detectCacheHit(home) ? 1 : 0);
    if (!homeOk) browseErrors.add(1);

    sleep(THINK_TIME.MEDIUM());

    // Kategori
    const categorySlug = pickRandom(['stor-perde', 'zebra-perde', 'tul-perde', 'pilesiz-perde']);
    const cat = http.get(`${BASE_URL}/kategori/${categorySlug}`, { tags: { page: 'category' } });
    check(cat, { 'Kategori yüklendi': (r) => r.status === 200 });
    cacheHitRate.add(detectCacheHit(cat) ? 1 : 0);

    sleep(THINK_TIME.SHORT());

    // Ürün
    const productSlug = pickRandom([
      'milano-tul-perde',
      'premium-stor-perde',
      'royal-kadife-fon',
      'venedik-dantel-tul',
      'osmanli-jakar-fon',
      'elite-zebra-perde',
    ]);
    const prod = http.get(`${BASE_URL}/urun/${productSlug}`, { tags: { page: 'product' } });
    check(prod, { 'Ürün sayfası yüklendi': (r) => r.status === 200 });
    cacheHitRate.add(detectCacheHit(prod) ? 1 : 0);

    sleep(THINK_TIME.MEDIUM());
  });
}

function categoryBrowse() {
  group('Kategori Gezinme', () => {
    const slugs = ['stor-perde', 'zebra-perde', 'tul-perde', 'pilesiz-perde', 'tum-urunler'];
    const slug  = pickRandom(slugs);

    const url = slug === 'tum-urunler'
      ? `${BASE_URL}/kategori/tum-urunler`
      : `${BASE_URL}/kategori/${slug}`;

    const res = http.get(url, { tags: { page: 'category' } });
    const ok  = check(res, {
      'Kategori 200':  (r) => r.status === 200,
      'Kategori hızlı': (r) => r.timings.duration < 1000,
    });
    cacheHitRate.add(detectCacheHit(res) ? 1 : 0);
    if (!ok) browseErrors.add(1);

    sleep(THINK_TIME.LONG());
  });
}
function productBrowse(data) {
  group('Ürün Detay', () => {
    const products = data?.products ?? [];
    if (products.length === 0) {
      sleep(THINK_TIME.SHORT());
      return;
    }

    const product = products[Math.floor(Math.random() * products.length)];
    
    // YENİ EKLENEN DEDEKTİF KODU: DB'den gelen ürünü tam olarak görelim
    console.log("DB'DEN GELEN ÜRÜN: ", JSON.stringify(product));

    // YEDEK İSMİ DE SENİN GERÇEK ÜRÜNÜNLE DEĞİŞTİRDİK
    const slug = product?.slug ?? 'premium-stor-perde'; 
    
    const hedefUrl = `${BASE_URL}/urun/${slug}`;
    console.log("K6'NIN GİTMEYE ÇALIŞTIĞI ÜRÜN URL'Sİ: ", hedefUrl); 

    const res = http.get(hedefUrl, { tags: { page: 'product' } });
    const ok  = check(res, {
      'Ürün 200':     (r) => r.status === 200,
      'Ürün <1.5sn':  (r) => r.timings.duration < 1500,
    });
    cacheHitRate.add(detectCacheHit(res) ? 1 : 0);
    pageLoadTrend.add(res.timings.duration);
    if (!ok) browseErrors.add(1);

    sleep(THINK_TIME.MEDIUM());
  });
}
// ─── SENARYO 2: Checkout (Ödeme) ─────────────────────────────────────────────
export function checkoutScenario(data) {
  if (!data.token || data.products.length === 0) {
    console.warn('[Checkout] Setup verisi eksik, atlanıyor');
    return;
  }

  group('Checkout Akışı', () => {
    const startTime = Date.now();

    // Checkout sayfasını yükle (ISR)
    const page = http.get(`${BASE_URL}/odeme`, {
      headers: { 'Accept': 'text/html' },
      tags: { page: 'checkout' },
    });
    check(page, { 'Checkout sayfası yüklendi': (r) => r.status === 200 });

    sleep(THINK_TIME.SHORT());

    // Sipariş oluştur (3 DB write: orders + order_items + legal_logs)
    const product = data.products[Math.floor(Math.random() * data.products.length)];
    const order   = createTestOrder(data.token, data.userId, product);

    const elapsed = Date.now() - startTime;
    checkoutDuration.add(elapsed);

    const success = order !== null;
    checkoutSuccess.add(success ? 1 : 0);

    // 503 = DB connection pool tükendi
    if (!success) {
      dbPoolExhausted.add(1);
    }
  });

  sleep(THINK_TIME.MEDIUM());
}

// ─── SENARYO 3: Admin (State Machine) ────────────────────────────────────────
const STATUS_FLOW = [
  'PAID',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
];

export function adminScenario(data) {
  if (!data.token || data.testOrders.length === 0) {
    console.warn('[Admin] Setup verisi eksik, atlanıyor');
    return;
  }

  group('Admin Durum Güncelleme', () => {
    const order      = data.testOrders[Math.floor(Math.random() * data.testOrders.length)];
    const currentIdx = STATUS_FLOW.indexOf(order.status ?? 'PAID');
    const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentIdx + 1]
      : STATUS_FLOW[0];

    const startTime = Date.now();
    const res       = updateOrderStatusRpc(
      data.token,
      order.id,
      nextStatus,
      data.userId,
      `Full load test: ${order.status} → ${nextStatus}`
    );
    const elapsed = Date.now() - startTime;

    transitionDuration.add(elapsed);

    const success = check(res, {
      'Geçiş başarılı (200)': (r) => r.status === 200,
      'Geçiş <2sn':           (r) => r.timings.duration < 2000,
    });

    transitionSuccess.add(success ? 1 : 0);
  });

  sleep(THINK_TIME.SHORT());
}

// ─── Teardown ─────────────────────────────────────────────────────────────────
export function teardown(data) {
  if (!data.token || data.testOrders.length === 0) return;

  const ids = data.testOrders.map((o) => `"${o.id}"`).join(',');
  http.del(
    `${SUPABASE_URL}/rest/v1/orders?id=in.(${ids})`,
    null,
    {
      headers: {
        'apikey':        __ENV.SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${data.token}`,
      },
    }
  );

  console.log(`Teardown: ${data.testOrders.length} test siparişi silindi`);
}

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

function detectCacheHit(res) {
  const xCache    = (res.headers['X-Cache']          ?? '').toUpperCase();
  const cfCache   = (res.headers['CF-Cache-Status']  ?? '').toUpperCase();
  const age       = parseInt(res.headers['Age'] ?? '0', 10);
  const xVercel   = (res.headers['X-Vercel-Cache']   ?? '').toUpperCase();

  return (
    xCache.includes('HIT')   ||
    cfCache === 'HIT'        ||
    xVercel === 'HIT'        ||
    age > 0
  );
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}