/**
 * ============================================================
 * ORDER SERVICE — Merkezi Sipariş Durum Makinesi
 * ============================================================
 *
 * Bu servis katmanı auth-agnostiktir; admin kontrolü, route
 * handler veya server action katmanında yapılmalıdır.
 * Servis sadece iş mantığından sorumludur.
 *
 * Transaction Stratejisi:
 * Supabase JS client'ı BEGIN/COMMIT desteklemez. Atomiklik
 * `update_order_status_with_history` PostgreSQL fonksiyonu ile
 * sağlanır; SQL seviyesinde tek transaction'da çalışır.
 * Eşdeğeri: Prisma `prisma.$transaction([...])` veya
 *            Knex    `knex.transaction(trx => {...})`
 * ============================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// 1. ENUM — Sipariş Durumları
// ============================================================

export enum OrderStatus {
  PAYMENT_PENDING  = 'PENDING',       // Ödeme bekleniyor (DB'deki mevcut PENDING ile uyumlu)
  PAID             = 'PAID',
  CONFIRMED        = 'CONFIRMED',     // Admin manuel onayı
  IN_PRODUCTION    = 'IN_PRODUCTION', // Kumaş kesim / dikim / montaj aşaması
  READY_TO_SHIP    = 'READY_TO_SHIP',
  SHIPPED          = 'SHIPPED',
  DELIVERED        = 'DELIVERED',
  CANCELLED        = 'CANCELLED',
  RETURNED         = 'RETURN_REQUESTED', // İade talebi (DB'deki RETURN_REQUESTED ile uyumlu)
  REFUNDED         = 'REFUNDED',
  // ── Operasyonel ek durumlar ──
  ON_HOLD          = 'ON_HOLD',          // Üretimde gecikme / bekletme
  IN_TRANSIT       = 'IN_TRANSIT',       // Kargoda / yolda
  DELIVERY_FAILED  = 'DELIVERY_FAILED',  // Teslim başarısız
}

// ============================================================
// 2. GEÇİŞ HARİTASI (Transition Map)
// ============================================================
// Her anahtar: mevcut durum
// Her değer   : geçilebilecek durumlar listesi
//
// Tasarım kararları:
//   • IN_PRODUCTION → CANCELLED yok: kumaş kesilmiş, iade dışında geri dönüş yok
//   • READY_TO_SHIP → yalnızca SHIPPED: kargoya verilmeden iptal edilemez
//   • DELIVERED → yalnızca RETURNED: teslim sonrası sadece iade akışı açık
//   • CANCELLED, REFUNDED → terminal: hiçbir geçişe izin verilmez

const TRANSITION_MAP: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],

  [OrderStatus.PAID]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,   // Üretim başlamadı; admin iptali mümkün
  ],

  [OrderStatus.CONFIRMED]: [
    OrderStatus.IN_PRODUCTION,
    OrderStatus.CANCELLED,   // Onaylandı ama üretime girmedi; iptal mümkün
  ],

  [OrderStatus.IN_PRODUCTION]: [
    OrderStatus.ON_HOLD,     // Üretim askıya alındı (malzeme bekleme vb.)
    OrderStatus.READY_TO_SHIP,
    // ❌ CANCELLED yok: kumaş/mekanizma kesilmiş, hukuki olarak iptal edilemez
  ],

  [OrderStatus.ON_HOLD]: [
    OrderStatus.IN_PRODUCTION, // Bekleme sona erdi, üretime devam
    OrderStatus.CANCELLED,     // Admin kararıyla iptal (nadir)
  ],

  [OrderStatus.READY_TO_SHIP]: [
    OrderStatus.SHIPPED,
    // ❌ CANCELLED yok: hazır paket kargoya verilecek
  ],

  [OrderStatus.SHIPPED]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,   // Direkt teslim (küçük teslimatlar)
  ],

  [OrderStatus.IN_TRANSIT]: [
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERY_FAILED,
  ],

  [OrderStatus.DELIVERY_FAILED]: [
    OrderStatus.SHIPPED,     // Tekrar kargoya ver
    OrderStatus.CANCELLED,   // Müşteri almak istemedi, iptal + iade
  ],

  [OrderStatus.DELIVERED]: [
    OrderStatus.RETURNED,    // Mesafeli satış 14 günlük iade hakkı
  ],

  [OrderStatus.RETURNED]: [
    OrderStatus.REFUNDED,
    OrderStatus.DELIVERED,   // İade talebi reddedildi, kapandı
  ],

  // ── Terminal durumlar: hiçbir geçişe izin yok ──────────────
  [OrderStatus.REFUNDED]:  [],
  [OrderStatus.CANCELLED]: [],
};

// ============================================================
// 3. ÖZEL HATA SINIFLARI
// ============================================================

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Sipariş bulunamadı: ${orderId}`);
    this.name = 'OrderNotFoundError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    const allowed = TRANSITION_MAP[from].map((s) => s).join(', ') || 'yok (terminal durum)';
    super(
      `Geçersiz durum geçişi: "${from}" → "${to}". ` +
      `"${from}" durumundan izin verilen geçişler: [${allowed}]`
    );
    this.name = 'InvalidTransitionError';
  }
}

export class DatabaseTransactionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`Veritabanı transaction hatası: ${message}`);
    this.name = 'DatabaseTransactionError';
  }
}

// ============================================================
// 4. TIPLER
// ============================================================

export type ActorRole = 'admin' | 'customer' | 'system';

export interface UpdateStatusParams {
  orderId:  string;
  newStatus: OrderStatus;
  actorId:  string;          // İşlemi yapan user.id veya 'system'
  actorRole?: ActorRole;
  note?:    string;          // Opsiyonel not (audit trail için)
}

export interface UpdateStatusResult {
  orderId:        string;
  previousStatus: OrderStatus;
  newStatus:      OrderStatus;
  historyLogId:   string | null;
  invoiceQueued:  boolean;
}

// DB'den gelen ham sipariş satırı (sadece ihtiyacımız olan alanlar)
interface OrderRow {
  id:     string;
  status: string;
}

// ============================================================
// 5. YARDIMCI: DB İSTEMCİSİ (Service Role — auth gerektirmez)
// ============================================================

function buildAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik'
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================
// 6. YARDIMCI: GEÇİŞ DOĞRULAMA
// ============================================================

/**
 * İstenen geçişin TRANSITION_MAP'e göre yasal olup olmadığını kontrol eder.
 * Geçersizse InvalidTransitionError fırlatır.
 */
function assertValidTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = TRANSITION_MAP[current];

  if (!allowed) {
    // Bu durum TRANSITION_MAP'te tanımlı değil (olmamalı, tip güvenliği var)
    throw new InvalidTransitionError(current, next);
  }

  if (!allowed.includes(next)) {
    throw new InvalidTransitionError(current, next);
  }
}

/**
 * DB'deki ham status string'ini OrderStatus enum'una cast eder.
 * Bilinmeyen değer gelirse hata fırlatır.
 */
function parseOrderStatus(raw: string): OrderStatus {
  const match = Object.values(OrderStatus).find((v) => v === raw);
  if (!match) {
    throw new Error(`Bilinmeyen sipariş durumu: "${raw}"`);
  }
  return match as OrderStatus;
}

// ============================================================
// 7. FATURA TETİKLEYİCİ (Event Hook)
// ============================================================

/** Fatura oluşturulacak durumlar */
const INVOICE_TRIGGER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.SHIPPED,    // Erken fatura isteyen işletmeler için
  OrderStatus.DELIVERED,  // Türk e-Arşiv standardı (B2C)
]);

/**
 * Ana akışı bloklamaz (fire-and-forget).
 * Hata loglenir ama üst fonksiyona yayılmaz.
 * Prod'da buraya Slack/PagerDuty alarmı ekleyin.
 */
function triggerInvoiceAsync(orderId: string, status: OrderStatus): void {
  if (!INVOICE_TRIGGER_STATUSES.has(status)) return;

  // Dynamic import: bu modülü sadece fatura tetiklenince yükle (bundle optimizasyonu)
  void import('@/lib/einvoice/outbox')
    .then(({ enqueueInvoiceForOrder }) => enqueueInvoiceForOrder(orderId, 'E_ARSIV'))
    .catch((err: unknown) => {
      // ❗ Fatura kuyruğu hatası siparişi geri almaz — sadece loglanır
      // Cron worker bir sonraki çalışmada retry yapar
      console.error('[OrderService] Fatura kuyruğuna eklenemedi (non-blocking):', {
        orderId,
        status,
        error: err instanceof Error ? err.message : err,
      });
    });
}

// ============================================================
// 8. ANA FONKSİYON — updateOrderStatus
// ============================================================

/**
 * Siparişin durumunu güvenli ve denetlenebilir şekilde günceller.
 *
 * Akış:
 *   1. Siparişi DB'den çek                          (OrderNotFoundError)
 *   2. Geçişin TRANSITION_MAP'e uygunluğunu doğrula  (InvalidTransitionError)
 *   3. DB transaction başlat:
 *      a) orders.status güncelle
 *      b) order_status_history satırı ekle
 *      Her ikisi PostgreSQL fonksiyonu içinde atomic olarak çalışır.
 *      Biri başarısız olursa PostgreSQL otomatik ROLLBACK yapar.
 *   4. Transaction başarılı → fatura tetikleyicisini arka planda çalıştır
 *
 * @throws {OrderNotFoundError}        Sipariş DB'de yoksa
 * @throws {InvalidTransitionError}    Geçiş TRANSITION_MAP'e aykırıysa
 * @throws {DatabaseTransactionError}  DB işlemi başarısız olursa
 */
export async function updateOrderStatus(
  params: UpdateStatusParams
): Promise<UpdateStatusResult> {
  const {
    orderId,
    newStatus,
    actorId,
    actorRole = 'admin',
    note,
  } = params;

  const db = buildAdminClient();

  // ── ADIM 1: Mevcut siparişi DB'den çek ──────────────────────────────────
  const { data: order, error: fetchError } = await db
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle<OrderRow>();

  if (fetchError) {
    throw new DatabaseTransactionError(
      `Sipariş okunamadı: ${fetchError.message}`,
      fetchError
    );
  }

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  const currentStatus = parseOrderStatus(order.status);

  // ── ADIM 2: Geçiş doğrulama — hata fırlatırsa DB'ye dokunulmaz ─────────
  assertValidTransition(currentStatus, newStatus);

  // ── ADIM 3: Atomik DB Transaction ───────────────────────────────────────
  //   `update_order_status_with_history` PostgreSQL fonksiyonu:
  //   BEGIN
  //     UPDATE orders SET status = $newStatus ...
  //     INSERT INTO order_status_history (previous_status, new_status, ...) VALUES (...)
  //   COMMIT   ← ikisi birlikte başarılı olursa
  //   ROLLBACK ← biri başarısız olursa otomatik geri alınır
  //
  //   Prisma eşdeğeri:
  //     await prisma.$transaction([
  //       prisma.orders.update({ where: { id: orderId }, data: { status: newStatus } }),
  //       prisma.orderStatusHistory.create({ data: { orderId, previousStatus: currentStatus, newStatus, actorId } }),
  //     ]);
  //
  //   Knex eşdeğeri:
  //     await knex.transaction(async trx => {
  //       await trx('orders').where({ id: orderId }).update({ status: newStatus });
  //       await trx('order_status_history').insert({ order_id: orderId, ... });
  //     });

  const { error: transactionError } = await db.rpc(
    'update_order_status_with_history',
    {
      p_order_id:           orderId,
      p_new_status:         newStatus,          // enum değeri (DB'deki VARCHAR ile eşleşir)
      p_changed_by_user_id: actorId === 'system' ? null : actorId,
      p_changed_by_role:    actorRole,
      p_reason:             note ?? null,
    }
  );

  if (transactionError) {
    // PostgreSQL ROLLBACK yaptı — orders ve history tutarlı kaldı
    throw new DatabaseTransactionError(transactionError.message, transactionError);
  }

  // ── ADIM 4: Side-effect — fatura (transaction dışında, non-blocking) ────
  //   Transaction tamamlandıktan SONRA çalışır.
  //   Başarısız olursa siparişi geri almaz — sadece loglama + retry kuyruğu.
  triggerInvoiceAsync(orderId, newStatus);

  return {
    orderId,
    previousStatus: currentStatus,
    newStatus,
    historyLogId:   null,   // RPC'den dönmüyor; gerekirse SELECT ile alınabilir
    invoiceQueued:  INVOICE_TRIGGER_STATUSES.has(newStatus),
  };
}

// ============================================================
// 9. YARDIMCI PUBLIC API'LER
// ============================================================

/**
 * Bir durumdan hangi durumlara geçilebileceğini döner.
 * Admin paneli dropdown'ı ve müşteri iptal butonu için kullanılır.
 */
export function getAvailableTransitions(status: OrderStatus): OrderStatus[] {
  return TRANSITION_MAP[status] ?? [];
}

/**
 * Durum bir terminal durum mu? (Hiçbir geçişe izin verilmiyor mu?)
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return (TRANSITION_MAP[status]?.length ?? 0) === 0;
}

/**
 * İki durum arasındaki geçişin geçerli olup olmadığını boolean olarak döner.
 * Hata fırlatmaz; UI kontrolü için uygundur.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITION_MAP[from]?.includes(to) ?? false;
}

// ============================================================
// 10. KULLANIM ÖRNEKLERİ (referans için — silin ya da bırakın)
// ============================================================
//
// ── Server Action (admin paneli) ────────────────────────────
//
//   import { updateOrderStatus, OrderStatus } from '@/lib/services/order-service';
//
//   const result = await updateOrderStatus({
//     orderId:  'uuid-siparis',
//     newStatus: OrderStatus.SHIPPED,
//     actorId:  adminUser.id,
//     actorRole: 'admin',
//     note: 'Yurtiçi Kargo barkod: 012345678',
//   });
//
// ── Kargo Webhook (system actor) ───────────────────────────
//
//   await updateOrderStatus({
//     orderId:  normalizedPayload.orderId,
//     newStatus: OrderStatus.DELIVERED,
//     actorId:  'system',
//     actorRole: 'system',
//     note: `Kargo webhook: ${carrier} — ${rawStatus}`,
//   });
//
// ── Müşteri İptal (customer actor) ─────────────────────────
//
//   try {
//     await updateOrderStatus({
//       orderId:  orderId,
//       newStatus: OrderStatus.CANCELLED,
//       actorId:  user.id,
//       actorRole: 'customer',
//     });
//   } catch (err) {
//     if (err instanceof InvalidTransitionError) {
//       // Üretim aşamasındaki sipariş — müşteriye göster
//       return { error: 'Siparişiniz üretim aşamasında olduğu için iptal edilemez.' };
//     }
//     throw err;
//   }
