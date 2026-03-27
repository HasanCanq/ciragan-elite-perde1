/**
 * Supabase Auth & REST API Yardımcıları
 *
 * k6 VU'ları bu modülü kullanarak Supabase'e auth olur
 * ve REST API'yi doğrudan test eder.
 *
 * Neden Supabase REST API ve Next.js sayfalarını birlikte test ediyoruz?
 * - Next.js sayfaları: Node.js Event Loop + ISR/cache'i test eder
 * - Supabase REST: PostgreSQL connection pool + query performansını test eder
 * - İkisi birlikte: gerçek uçtan uca yükü simüle eder
 */

import http from 'k6/http';
import { check } from 'k6';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// ─── JSON yardımcıları ──────────────────────────────────────────────────────

function jsonHeaders(token) {
  const base = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
  if (token) base['Authorization'] = `Bearer ${token}`;
  return base;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Supabase kullanıcısı olarak giriş yapar, access_token döner.
 * Her VU setUp aşamasında ya da gerektiğinde çağırır.
 *
 * @returns {{ token: string, userId: string } | null}
 */
export function supabaseLogin(email, password) {
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders(null), tags: { name: 'auth_login' } }
  );

  const ok = check(res, {
    'login: HTTP 200': (r) => r.status === 200,
    'login: token var': (r) => !!r.json('access_token'),
  });

  if (!ok) return null;

  return {
    token:  res.json('access_token'),
    userId: res.json('user.id'),
  };
}

// ─── Ürün & Kategori (Read) ─────────────────────────────────────────────────

export function getProducts(token, limit = 10) {
  return http.get(
    `${SUPABASE_URL}/rest/v1/products` +
    `?select=id,slug,name,base_price,images,in_stock` +
    `&is_published=eq.true&in_stock=eq.true&limit=${limit}`,
    { headers: jsonHeaders(token), tags: { name: 'db_get_products' } }
  );
}

export function getCategories(token) {
  return http.get(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true`,
    { headers: jsonHeaders(token), tags: { name: 'db_get_categories' } }
  );
}

export function getActiveLegalDocVersions(token) {
  return http.get(
    `${SUPABASE_URL}/rest/v1/legal_document_versions` +
    `?select=id,document_type,version,content_hash` +
    `&is_active=eq.true`,
    { headers: jsonHeaders(token), tags: { name: 'db_get_legal_docs' } }
  );
}

// ─── Sipariş Oluşturma (Write) ──────────────────────────────────────────────

/**
 * Supabase RPC üzerinden sipariş oluşturur.
 * NOT: Bu gerçek üretim akışını taklit eder ama Next.js Server Action'ı atlar.
 * Amacımız: DB connection pool + transaction throughput'u test etmek.
 */
export function createTestOrder(token, userId, product) {
  const orderId = generateUUID();
  const widthCm  = 150 + Math.floor(Math.random() * 200);  // 150–350cm
  const heightCm = 200 + Math.floor(Math.random() * 100);  // 200–300cm
  const areaM2   = (widthCm * heightCm) / 10000;
  const unitPrice = parseFloat((areaM2 * product.base_price * 1.2).toFixed(2)); // NORMAL pile
  const totalAmount = unitPrice + 150; // +kargo

  // Adım 1: orders INSERT
  const orderRes = http.post(
    `${SUPABASE_URL}/rest/v1/orders`,
    JSON.stringify({
      id:               orderId,
      user_id:          userId,
      customer_email:   `loadtest-${__VU}@test.com`,
      customer_name:    `Load Test User ${__VU}`,
      shipping_address: 'Yük Testi Caddesi No:42 Test/İstanbul',
      billing_address:  'Yük Testi Caddesi No:42 Test/İstanbul',
      subtotal:         unitPrice,
      shipping_cost:    150,
      discount_amount:  0,
      total_amount:     totalAmount,
      status:           'PENDING',
      payment_method:   'bank_transfer',
    }),
    {
      headers: { ...jsonHeaders(token), 'Prefer': 'return=representation' },
      tags: { name: 'db_create_order' },
    }
  );

  if (orderRes.status !== 201) return { success: false, error: `Order insert: ${orderRes.status}` };

  // Adım 2: order_items INSERT
  const itemRes = http.post(
    `${SUPABASE_URL}/rest/v1/order_items`,
    JSON.stringify({
      order_id:             orderId,
      product_id:           product.id,
      product_name:         product.name,
      product_slug:         product.slug,
      product_image:        product.images?.[0] || null,
      width_cm:             widthCm,
      height_cm:            heightCm,
      pile_factor:          'NORMAL',
      area_m2:              areaM2,
      price_per_m2_snapshot: product.base_price,
      pile_coefficient:     1.2,
      quantity:             1,
      unit_price:           unitPrice,
      total_price:          unitPrice,
    }),
    {
      headers: { ...jsonHeaders(token), 'Prefer': 'return=minimal' },
      tags: { name: 'db_create_order_items' },
    }
  );

  if (itemRes.status !== 201) return { success: false, error: `Item insert: ${itemRes.status}` };

  // Adım 3: Legal log INSERT (yasal kayıt)
  const legalDocRes = getActiveLegalDocVersions(token);
  const legalDocs = legalDocRes.status === 200 ? legalDocRes.json() : [];

  const legalRes = http.post(
    `${SUPABASE_URL}/rest/v1/order_legal_logs`,
    JSON.stringify({
      order_id:            orderId,
      user_id:             userId,
      ip_address:          '10.0.0.1',  // test IP
      user_agent:          `k6-load-test/1.0 VU-${__VU}`,
      consented_documents: legalDocs.map(d => ({
        version_id:    d.id,
        document_type: d.document_type,
        version:       d.version,
        content_hash:  d.content_hash,
      })),
      metadata: { test: true, vu: __VU, iteration: __ITER },
    }),
    {
      headers: { ...jsonHeaders(token), 'Prefer': 'return=minimal' },
      tags: { name: 'db_create_legal_log' },
    }
  );

  return {
    success:    legalRes.status === 201,
    orderId,
    orderRes,
    itemRes,
    legalRes,
  };
}

/**
 * Supabase RPC aracılığıyla sipariş statüsü günceller.
 * State Machine + Transaction + History Log'u stres test eder.
 */
export function updateOrderStatusRpc(token, orderId, newStatus, actorId, reason) {
  return http.post(
    `${SUPABASE_URL}/rest/v1/rpc/update_order_status_with_history`,
    JSON.stringify({
      p_order_id:           orderId,
      p_new_status:         newStatus,
      p_changed_by_user_id: actorId,
      p_changed_by_role:    'admin',
      p_reason:             reason || null,
    }),
    { headers: jsonHeaders(token), tags: { name: 'db_state_machine_transition' } }
  );
}

/**
 * Test siparişini temizle (teardown için)
 */
export function deleteTestOrder(token, orderId) {
  http.del(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`,
    null,
    { headers: jsonHeaders(token) }
  );
}

// ─── UUID üretici (k6'da crypto.randomUUID() yok) ──────────────────────────
function generateUUID() {
  const hex = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += '-';
    } else if (i === 14) {
      result += '4';
    } else if (i === 19) {
      result += hex[(Math.random() * 4) | 8];
    } else {
      result += hex[Math.floor(Math.random() * 16)];
    }
  }
  return result;
}
