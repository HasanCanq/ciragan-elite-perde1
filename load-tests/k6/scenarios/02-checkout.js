/**
 * SENARYO 2 — Sipariş Oluşturma (Write-Heavy / Stress Test)
 * ═══════════════════════════════════════════════════════════════
 * Hedef: Aynı anda yüzlerce sipariş, DB'yi maksimuma zorla
 *
 * Test eder:
 *   ✓ PostgreSQL connection pool tüketimi
 *   ✓ Sipariş + order_items + legal_log INSERT transaction throughput'u
 *   ✓ Stok concurrent update yarış koşulları (Race Condition)
 *   ✓ Supabase RPC fonksiyonu (insert_order_legal_log) altında performans
 *   ✓ Node.js Event Loop: async DB çağrıları event loop'u bloke ediyor mu?
 *
 * constant-arrival-rate executor:
 *   → VU sayısından bağımsız olarak saniyede N istek gönderir
 *   → Sistem yavaşladığında k6 daha fazla VU oluşturur
 *   → Bu sayede "sistem yavaşlasa bile baskı sabit kalır" — gerçekçi baskı!
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import {
  BASE_URL, SUPABASE_URL, TEST_USERS, THINK_TIME
} from '../config.js';
import {
  supabaseLogin,
  getProducts,
  createTestOrder,
} from '../helpers/supabase.js';

// ─── Özel metrikler ──────────────────────────────────────────────────────────
const checkoutSuccessRate  = new Rate('checkout_success_rate');
const orderInsertDuration  = new Trend('order_insert_ms');    // orders INSERT süresi
const legalLogDuration     = new Trend('legal_log_ms');       // legal_log INSERT süresi
const dbPoolExhausted      = new Counter('db_pool_exhausted');// 503/429 sayacı
const authFailures         = new Counter('auth_failures');

// ─── Yük profili ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    checkout: {
      executor: 'constant-arrival-rate',
      rate:             200,   // Saniyede 200 istek (sipariş oluşturma döngüsü)
      timeUnit:         '1s',
      duration:         '10m', // 10 dakika boyunca sabit baskı
      preAllocatedVUs:  100,   // Başlangıç VU havuzu
      maxVUs:           600,   // Sistem yavaşlarsa k6 buraya kadar ek VU açar
      tags: { scenario: 'checkout' },
    },
  },
  thresholds: {
    'checkout_success_rate':                    ['rate>0.90'],
    'http_req_duration{scenario:checkout}':     ['p(95)<3000', 'p(99)<6000'],
    'http_req_failed{scenario:checkout}':       ['rate<0.05'],
    'order_insert_ms':                          ['p(95)<1500'],
    'db_pool_exhausted':                        ['count<100'],  // Max 100 pool hatası
  },
};

// ─── Test ürünleri (SharedArray: tüm VU'lar aynı belleği paylaşır) ───────────
// SharedArray ile N VU her biri kendi kopyasını oluşturmaz → düşük bellek
const TEST_PRODUCT_IDS = new SharedArray('product_ids', function () {
  // Buraya gerçek ürün ID'lerinizi yazın (Supabase dashboard'dan alın)
  return [
    { id: 'prod-uuid-1', name: 'Stor Perde Klasik', slug: 'stor-perde-klasik', base_price: 450, images: [] },
    { id: 'prod-uuid-2', name: 'Tül Perde Sade',    slug: 'tul-perde-sade',    base_price: 280, images: [] },
    { id: 'prod-uuid-3', name: 'Zebra Perde Modern',slug: 'zebra-perde-modern', base_price: 520, images: [] },
  ];
});

// ─── VU setup: her VU kendi session'ını başlatır ─────────────────────────────
export function setup() {
  // Global setup: hiçbir VU'dan önce bir kez çalışır
  // Ürün listesini DB'den çek ve test verisi olarak döndür
  const adminToken = supabaseLogin(TEST_USERS[0].email, TEST_USERS[0].password);
  if (!adminToken) return { products: [] };

  const res = getProducts(adminToken.token, 5);
  const products = res.status === 200 ? res.json() : [];

  return { products: products.length > 0 ? products : TEST_PRODUCT_IDS };
}

// ─── Ana test fonksiyonu ──────────────────────────────────────────────────────
export default function (data) {
  // Round-robin: VU ID'sine göre test kullanıcısı seç
  const user = TEST_USERS[__VU % TEST_USERS.length];

  group('Checkout Akışı', () => {

    // ── ADIM 1: Authentication ─────────────────────────────────────────────
    let session;
    group('1. Supabase Login', () => {
      session = supabaseLogin(user.email, user.password);

      if (!session) {
        authFailures.add(1);
        checkoutSuccessRate.add(0);
        return;
      }

      check(session, { 'Auth: token alındı': (s) => !!s.token });
    });

    if (!session) return;

    sleep(THINK_TIME.SHORT());

    // ── ADIM 2: Checkout sayfası yükle (Next.js SSR) ──────────────────────
    group('2. Checkout Sayfası', () => {
      const res = http.get(`${BASE_URL}/odeme`, {
        headers: { 'Cookie': `sb-access-token=${session.token}` },
        tags: { page: 'checkout_page' },
      });

      check(res, {
        'Checkout sayfa: 200 veya 307': (r) => r.status === 200 || r.status === 307,
      });
    });

    sleep(THINK_TIME.MEDIUM());

    // ── ADIM 3: Sipariş Oluştur (DB Transaction Testi) ────────────────────
    const products = data.products.length > 0 ? data.products : TEST_PRODUCT_IDS;
    const product  = products[Math.floor(Math.random() * products.length)];

    let orderResult;
    group('3. Sipariş Oluştur', () => {
      const startTime = Date.now();

      orderResult = createTestOrder(session.token, session.userId, product);

      const duration = Date.now() - startTime;
      orderInsertDuration.add(duration);

      // Supabase 503 = connection pool tükendi, 429 = rate limit
      if (orderResult.orderRes?.status === 503 || orderResult.orderRes?.status === 429) {
        dbPoolExhausted.add(1);
      }

      const success = check(orderResult, {
        'Sipariş: başarılı':        (r) => r.success === true,
        'Sipariş: order oluştu':    (r) => r.orderRes?.status === 201,
        'Sipariş: items eklendi':   (r) => r.itemRes?.status === 201,
        'Sipariş: legal log kayıt': (r) => r.legalRes?.status === 201,
      });

      checkoutSuccessRate.add(success ? 1 : 0);

      if (!success) {
        console.warn(`[VU ${__VU}] Sipariş başarısız:`, JSON.stringify({
          orderStatus: orderResult.orderRes?.status,
          orderBody:   orderResult.orderRes?.body?.slice(0, 200),
        }));
      }
    });

    // ── ADIM 4: Legal log timing ayrı ölç ─────────────────────────────────
    if (orderResult?.legalRes) {
      legalLogDuration.add(orderResult.legalRes.timings.duration);
    }

    sleep(THINK_TIME.SHORT());
  });
}

// ─── Teardown: test verilerini temizle ────────────────────────────────────────
export function teardown(data) {
  // Test siparişleri DB'de kalır, temizlik için:
  // SQL: DELETE FROM orders WHERE customer_email LIKE 'loadtest-%@test.com';
  console.log('Teardown: Test siparişleri DB\'de kaldı. Temizlik için README\'ye bakın.');
}
