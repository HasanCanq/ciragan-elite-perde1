/**
 * SENARYO 1 — Göz Atma (Read-Heavy)
 * ═══════════════════════════════════════════════════════════════
 * Hedef: 10.000 eş zamanlı kullanıcı, sadece okuma
 *
 * Test eder:
 *   ✓ Next.js ISR cache etkinliği (cache hit/miss oranı)
 *   ✓ Node.js Event Loop tıkanması (yüksek VU'da p99 spike)
 *   ✓ CDN ve statik varlık dağıtımı
 *   ✓ Middleware performansı (public route bypass)
 *
 * Ramp-up planı:
 *   0–2 dk:   0 → 1.000 VU  (yavaş ısınma)
 *   2–5 dk:   1.000 → 5.000 VU
 *   5–8 dk:   5.000 → 10.000 VU  (zirve yük)
 *   8–12 dk:  10.000 VU sabit     (plateau — darboğaz burada görülür)
 *   12–14 dk: 10.000 → 0 VU      (soğuma)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, PRODUCT_SLUGS, CATEGORY_SLUGS, THINK_TIME } from '../config.js';

// ─── Özel metrikler ─────────────────────────────────────────────────────────
const cacheHitRate   = new Rate('cache_hit_rate');     // ISR cache oranı
const homepageTrend  = new Trend('homepage_duration'); // Ana sayfa yanıt süresi
const categoryTrend  = new Trend('category_duration'); // Kategori sayfası
const productTrend   = new Trend('product_duration');  // Ürün sayfası
const errorCounter   = new Counter('browse_errors');

// ─── Yük profili ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',  target: 1000  },  // Isınma
        { duration: '3m',  target: 5000  },  // Tırmanış
        { duration: '3m',  target: 10000 },  // Zirveye çık
        { duration: '4m',  target: 10000 },  // Plateau — event loop testi
        { duration: '2m',  target: 0     },  // Soğuma
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'browse' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:browse}': [
      'p(50)<300',   // Median 300ms altında
      'p(95)<800',   // %95'i 800ms altında (SLA)
      'p(99)<1500',  // %99'u 1.5sn altında
    ],
    'http_req_failed{scenario:browse}': ['rate<0.01'],   // %1'den az hata
    'cache_hit_rate':                   ['rate>0.80'],   // %80+ cache hit bekliyoruz
  },
};

// ─── Kullanıcı davranışı ─────────────────────────────────────────────────────
export default function () {
  // Her VU rastgele bir kullanıcı yolculuğu izler (weighted random)
  const journey = weightedRandom([
    { fn: typicalBrowse,   weight: 50 },  // Tipik ziyaretçi (%50)
    { fn: categoryFocused, weight: 30 },  // Kategori odaklı (%30)
    { fn: productSearch,   weight: 20 },  // Ürün araştıran (%20)
  ]);

  journey();
}

// ─── Kullanıcı Yolculukları ──────────────────────────────────────────────────

/** Ana sayfa → Kategori → Ürün (en yaygın yol) */
function typicalBrowse() {
  group('Tipik Ziyaretçi', () => {
    // Ana sayfa
    group('Ana Sayfa', () => {
      const res = http.get(BASE_URL + '/', {
        tags: { page: 'homepage' },
      });

      const isOk = check(res, {
        'Ana sayfa: 200 OK':          (r) => r.status === 200,
        'Ana sayfa: HTML içeriyor':   (r) => r.body.includes('Çırağan') || r.body.includes('perde'),
        'Ana sayfa: <2sn':            (r) => r.timings.duration < 2000,
      });

      homepageTrend.add(res.timings.duration);
      detectCacheHit(res);
      if (!isOk) errorCounter.add(1);
    });

    sleep(THINK_TIME.MEDIUM());

    // Kategori sayfası
    const categorySlug = randomItem(CATEGORY_SLUGS);
    group('Kategori Sayfası', () => {
      const res = http.get(`${BASE_URL}/kategori/${categorySlug}`, {
        tags: { page: 'category' },
      });

      check(res, {
        'Kategori: 200 OK':        (r) => r.status === 200,
        'Kategori: ürün listesi':  (r) => r.body.includes('product') || r.body.length > 5000,
      });

      categoryTrend.add(res.timings.duration);
      detectCacheHit(res);
    });

    sleep(THINK_TIME.MEDIUM());

    // Ürün detayı
    const productSlug = randomItem(PRODUCT_SLUGS);
    group('Ürün Detayı', () => {
      const res = http.get(`${BASE_URL}/urun/${productSlug}`, {
        tags: { page: 'product' },
      });

      check(res, {
        'Ürün: 200 OK':          (r) => r.status === 200,
        'Ürün: fiyat bilgisi':   (r) => r.body.includes('₺') || r.body.includes('TL'),
        'Ürün: <3sn':            (r) => r.timings.duration < 3000,
      });

      productTrend.add(res.timings.duration);
      detectCacheHit(res);
    });

    sleep(THINK_TIME.SHORT());
  });
}

/** Sadece kategori sayfalarına gider (catalog browser) */
function categoryFocused() {
  group('Kategori Odaklı', () => {
    // Tüm ürünler sayfası
    const allRes = http.get(`${BASE_URL}/kategori/tum-urunler`, {
      tags: { page: 'all_products' },
    });
    check(allRes, { 'Tüm ürünler: 200': (r) => r.status === 200 });
    categoryTrend.add(allRes.timings.duration);
    detectCacheHit(allRes);

    sleep(THINK_TIME.LONG());

    // Birden fazla kategori gez
    for (let i = 0; i < 2; i++) {
      const slug = randomItem(CATEGORY_SLUGS);
      const res  = http.get(`${BASE_URL}/kategori/${slug}`, {
        tags: { page: 'category' },
      });
      check(res, { 'Kategori: 200': (r) => r.status === 200 });
      categoryTrend.add(res.timings.duration);
      detectCacheHit(res);
      sleep(THINK_TIME.MEDIUM());
    }
  });
}

/** Birden fazla ürün detayı inceler */
function productSearch() {
  group('Ürün Araştıran', () => {
    // Birden fazla ürün incele
    for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
      const slug = randomItem(PRODUCT_SLUGS);
      const res  = http.get(`${BASE_URL}/urun/${slug}`, {
        tags: { page: 'product' },
      });

      check(res, { 'Ürün detayı: 200': (r) => r.status === 200 });
      productTrend.add(res.timings.duration);
      detectCacheHit(res);
      sleep(THINK_TIME.LONG());
    }
  });
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

/**
 * ISR/CDN cache hit tespiti.
 * Next.js ISR sayfaları cache'den gelince x-cache veya age header'ı gönderir.
 */
function detectCacheHit(res) {
  const xCache    = res.headers['X-Cache']         || '';
  const cfCache   = res.headers['CF-Cache-Status'] || '';
  const ageHeader = res.headers['Age'];

  const isHit = xCache.includes('HIT') ||
                cfCache === 'HIT'       ||
                (ageHeader && parseInt(ageHeader) > 0);

  cacheHitRate.add(isHit ? 1 : 0);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(items) {
  const total  = items.reduce((sum, item) => sum + item.weight, 0);
  const rand   = Math.random() * total;
  let  running = 0;

  for (const item of items) {
    running += item.weight;
    if (rand < running) return item.fn;
  }
  return items[0].fn;
}
