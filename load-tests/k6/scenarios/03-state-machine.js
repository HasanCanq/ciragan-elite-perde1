/**
 * SENARYO 3 — State Machine Stres Testi
 * ═══════════════════════════════════════════════════════════════
 * Hedef: Eş zamanlı sipariş durum güncellemeleri
 *
 * Test eder:
 *   ✓ update_order_status_with_history RPC'nin concurrent performansı
 *   ✓ PostgreSQL row-level locking (FOR UPDATE) altında throughput
 *   ✓ order_status_history INSERT throughput (audit trail yazma hızı)
 *   ✓ State Machine geçiş hataları (geçersiz geçiş → 400 mü dönüyor?)
 *   ✓ Connection Pool: Çok sayıda eş zamanlı transaction açık kalıyor mu?
 *
 * Bu test admin panelinin yoğun kullanım altında nasıl davrandığını gösterir.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SUPABASE_URL, TEST_USERS, THINK_TIME } from '../config.js';
import { supabaseLogin, updateOrderStatusRpc } from '../helpers/supabase.js';

// ─── Özel metrikler ──────────────────────────────────────────────────────────
const transitionSuccessRate   = new Rate('state_machine_success_rate');
const transitionDuration      = new Trend('state_machine_transition_ms');
const invalidTransitionErrors = new Counter('invalid_transition_attempts');
const lockWaitTime            = new Trend('db_lock_wait_ms');

// ─── Yük profili ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    admin: {
      executor: 'constant-arrival-rate',
      rate:          50,    // Saniyede 50 durum güncellemesi
      timeUnit:      '1s',
      duration:      '8m',
      preAllocatedVUs: 30,
      maxVUs:        200,
      tags: { scenario: 'admin' },
    },
  },
  thresholds: {
    'state_machine_success_rate':           ['rate>0.95'],
    'http_req_duration{scenario:admin}':    ['p(95)<2000'],
    'state_machine_transition_ms':          ['p(95)<1500'],
    'invalid_transition_attempts':          ['count<50'],
  },
};

// ─── Durum geçiş dizisi (gerçekçi sipariş yolculuğu) ────────────────────────
// Her test siparişi bu dizinin bir adımını ilerler
const STATUS_FLOW = [
  'PAID',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
];

// ─── Setup: test siparişleri oluştur ─────────────────────────────────────────
export function setup() {
  const adminUser = TEST_USERS[0];
  const session   = supabaseLogin(adminUser.email, adminUser.password);
  if (!session) return { orders: [], token: null, userId: null };

  // Test için 20 adet sipariş oluştur (sadece orders tablosuna — order_items olmadan)
  const orders = [];
  for (let i = 0; i < 20; i++) {
    const res = http.post(
      `${SUPABASE_URL}/rest/v1/orders`,
      JSON.stringify({
        user_id:          session.userId,
        customer_email:   `sm-test-${i}@ciragan-test.com`,
        customer_name:    `State Machine Test ${i}`,
        shipping_address: 'Test Caddesi 1',
        billing_address:  'Test Caddesi 1',
        subtotal:         1000,
        shipping_cost:    150,
        discount_amount:  0,
        total_amount:     1150,
        status:           'PENDING',
        payment_method:   'bank_transfer',
      }),
      {
        headers: {
          'Content-Type':  'application/json',
          'apikey':        __ENV.SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${session.token}`,
          'Prefer':        'return=representation',
        },
      }
    );

    if (res.status === 201) {
      const order = res.json();
      orders.push(Array.isArray(order) ? order[0] : order);
    }
  }

  console.log(`State Machine setup: ${orders.length} test siparişi oluşturuldu`);
  return { orders, token: session.token, userId: session.userId };
}

// ─── Ana test fonksiyonu ──────────────────────────────────────────────────────
export default function (data) {
  if (!data.token || data.orders.length === 0) {
    console.warn('Setup başarısız, test atlanıyor');
    return;
  }

  // Rastgele bir sipariş ve geçiş seç
  const order     = data.orders[Math.floor(Math.random() * data.orders.length)];
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1]
    : STATUS_FLOW[0];  // Döngüsel — test devam eder

  group('State Machine Transition', () => {

    // ── Geçerli geçiş ───────────────────────────────────────────────────
    const startTime = Date.now();
    const res = updateOrderStatusRpc(
      data.token,
      order.id,
      nextStatus,
      data.userId,
      `Load test geçişi: ${order.status} → ${nextStatus}`
    );
    const elapsed = Date.now() - startTime;

    transitionDuration.add(elapsed);

    const success = check(res, {
      'Transition: başarılı (200)':   (r) => r.status === 200,
      'Transition: <2sn':             (r) => r.timings.duration < 2000,
      'Transition: DB lock yok':      (r) => r.status !== 409,  // Deadlock
    });

    transitionSuccessRate.add(success ? 1 : 0);

    // Connection pool metriği: lock_wait_time (PostgreSQL'de LOCK_TIMEOUT)
    if (res.status === 503) {
      lockWaitTime.add(elapsed);
      console.warn(`[VU ${__VU}] DB bağlantı havuzu tükendi (503):`, order.id);
    }

    // ── Kasıtlı geçersiz geçiş testi (State Machine koruması) ───────────
    // Her 10. VU kasıtlı geçersiz bir geçiş dener
    if (__VU % 10 === 0) {
      group('Invalid Transition Test', () => {
        const invalidRes = updateOrderStatusRpc(
          data.token,
          order.id,
          'PENDING',   // PENDING'e geri dönemez — State Machine bunu reddetmeli
          data.userId,
          'Kasıtlı geçersiz geçiş testi'
        );

        // RPC hata fırlatır → Supabase 500 döner
        // Bu beklenen bir durum, sayıcıya ekle
        if (invalidRes.status >= 400) {
          invalidTransitionErrors.add(1);
        }

        check(invalidRes, {
          'Geçersiz transition reddedildi': (r) => r.status >= 400,
        });
      });
    }
  });

  sleep(THINK_TIME.SHORT());
}

// ─── Teardown: test siparişlerini temizle ────────────────────────────────────
export function teardown(data) {
  if (!data.token || data.orders.length === 0) return;

  const orderIds = data.orders.map(o => `"${o.id}"`).join(',');
  http.del(
    `${SUPABASE_URL}/rest/v1/orders?id=in.(${orderIds})`,
    null,
    {
      headers: {
        'apikey': __ENV.SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${data.token}`,
      },
    }
  );

  console.log(`Teardown: ${data.orders.length} test siparişi silindi`);
}
