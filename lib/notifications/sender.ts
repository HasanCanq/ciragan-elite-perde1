/**
 * Sipariş Bildirim Sistemi
 *
 * Mimari:
 * - Serverless (Vercel) ortamında EventEmitter prosese bağlıdır.
 *   Bu nedenle "fire-and-forget promise" pattern kullanıyoruz.
 * - Ana iş akışı bloke edilmez: `void dispatchOrderStatusNotification(...)`
 * - E-posta: Resend API (resend.com) — Türkçe şablonlarla
 * - SMS: İletimerkezi API (iletimerkezi.com.tr) — Türkiye'nin önde gelen SMS sağlayıcısı
 *
 * Üretimde öneri: Upstash QStash ile kuyruk tabanlı geçiş yapın.
 * QStash retry, dead-letter queue ve guaranteed delivery sağlar.
 */

import { OrderStatus, ORDER_STATUS_LABELS } from '@/types';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

interface OrderNotificationContext {
  orderId:     string;
  orderNumber: string;       // Müşteri görüntüleme için kısa referans
  customerEmail: string;
  customerPhone?: string;
  customerName: string;
  newStatus:   OrderStatus;
  trackingNumber?: string;
  trackingUrl?:    string;
}

// ============================================================
// YARDIMCI: Sipariş bilgilerini DB'den çek
// ============================================================

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchOrderContext(orderId: string): Promise<OrderNotificationContext | null> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      customer_email,
      customer_name,
      tracking_number,
      tracking_url,
      profiles(phone)
    `)
    .eq('id', orderId)
    .single();

  if (error || !data) {
    console.error('[Notifications] Sipariş bağlamı alınamadı:', error);
    return null;
  }

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  return {
    orderId,
    orderNumber:   data.order_number,               // Gerçek "HND-..." formatı
    customerEmail: data.customer_email ?? '',
    customerPhone: profile?.phone ?? undefined,
    customerName:  data.customer_name ?? 'Müşteri',
    newStatus:     data.status as OrderStatus,
    trackingNumber: data.tracking_number ?? undefined,
    trackingUrl:    data.tracking_url ?? undefined,
  };
}

// ============================================================
// E-POSTA GÖNDERİCİ (Resend)
// ============================================================

/**
 * Resend API ile e-posta gönderir.
 * https://resend.com/docs/api-reference/emails/send-email
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'bildirim@ciragan-elite.com';

  if (!apiKey) {
    console.warn('[Notifications/Email] RESEND_API_KEY eksik, e-posta atlandı');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Notifications/Email] Gönderim hatası:', error.slice(0, 200));
  }
}

// ============================================================
// SMS GÖNDERİCİ (İletimerkezi)
// ============================================================

/**
 * İletimerkezi API ile SMS gönderir.
 * https://www.iletimerkezi.com/docs/api
 */
async function sendSms(phone: string, message: string): Promise<void> {
  const apiKey    = process.env.ILETIMERKEZI_API_KEY;
  const apiHash   = process.env.ILETIMERKEZI_API_HASH;
  const sender    = process.env.ILETIMERKEZI_SENDER ?? 'CIRAGAN';

  if (!apiKey || !apiHash) {
    console.warn('[Notifications/SMS] İletimerkezi credentials eksik, SMS atlandı');
    return;
  }

  // Türk telefon numarasını normalize et (05xx → 905xx)
  const normalizedPhone = phone.replace(/^0/, '90').replace(/\D/g, '');

  const response = await fetch('https://api.iletimerkezi.com/v1/send-sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: {
        authentication: { key: apiKey, hash: apiHash },
        order: {
          sender,
          sendDateTime: '',
          message: { text: message, receipents: { number: [normalizedPhone] } },
        },
      },
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    console.error('[Notifications/SMS] Gönderim hatası:', response.status);
  }
}

// ============================================================
// E-POSTA ŞABLONLARI
// ============================================================

const SITE_NAME = 'Hanedan Perde';
const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hanedan perde.com';

function buildEmailHtml(ctx: OrderNotificationContext): string {
  const statusLabel = ORDER_STATUS_LABELS[ctx.newStatus];

  const trackingSection = ctx.trackingNumber
    ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <strong>Kargo Takip</strong><br/>
        Barkod: <code>${ctx.trackingNumber}</code><br/>
        ${ctx.trackingUrl ? `<a href="${ctx.trackingUrl}" style="color:#16a34a;">Kargomu Takip Et →</a>` : ''}
      </div>`
    : '';

  const statusColors: Partial<Record<OrderStatus, string>> = {
    PAID:          '#b89947',
    CONFIRMED:     '#16a34a',
    IN_PRODUCTION: '#7c3aed',
    READY_TO_SHIP: '#0891b2',
    SHIPPED:       '#2563eb',
    IN_TRANSIT:    '#0284c7',
    DELIVERED:     '#15803d',
    CANCELLED:     '#dc2626',
    REFUNDED:      '#6b7280',
  };
  const statusColor = statusColors[ctx.newStatus] ?? '#92400e';

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <div style="background:#1a1a1a;padding:24px 32px;text-align:center;">
      <img src="${SITE_URL}/logo.png" alt="${SITE_NAME}" height="40" style="vertical-align:middle;"/>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 8px;">Sayın ${ctx.customerName},</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
        <strong>#${ctx.orderNumber}</strong> numaralı siparişinizde güncelleme var.
      </p>

      <div style="text-align:center;padding:20px;background:#fafafa;border-radius:8px;margin-bottom:24px;">
        <span style="display:inline-block;padding:8px 20px;border-radius:999px;font-weight:700;font-size:14px;
          background:${statusColor}20;color:${statusColor};">
          ${statusLabel}
        </span>
      </div>

      ${trackingSection}

      ${getStatusMessage(ctx)}

      <div style="text-align:center;margin-top:32px;">
        <a href="${SITE_URL}/account/orders/${ctx.orderId}"
           style="background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;
                  text-decoration:none;font-weight:600;font-size:14px;">
          Siparişimi Görüntüle
        </a>
      </div>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        ${SITE_NAME} · Bu e-postayı sipariş durumu güncellendiği için alıyorsunuz.
      </p>
    </div>

  </div>
</body>
</html>`;
}

function getStatusMessage(ctx: OrderNotificationContext): string {
  const messages: Partial<Record<OrderStatus, string>> = {
    PAID:
      '<p style="color:#374151;font-size:14px;">Ödemeniz başarıyla alındı. Siparişiniz en kısa sürede incelenecek ve onaylanacaktır.</p>',
    CONFIRMED:
      '<p style="color:#374151;font-size:14px;">Siparişiniz onaylandı ve en kısa sürede üretime alınacak.</p>',
    IN_PRODUCTION:
      '<p style="color:#374151;font-size:14px;">Özel ölçülerinize göre hazırlanmaya başlandı. Üretim sürecini takip edin.</p>',
    READY_TO_SHIP:
      '<p style="color:#374151;font-size:14px;">Siparişiniz hazır! Yakında kargoya verilecek.</p>',
    SHIPPED:
      '<p style="color:#374151;font-size:14px;">Siparişiniz kargoya verildi. Yukarıdaki takip numarasıyla takip edebilirsiniz.</p>',
    IN_TRANSIT:
      '<p style="color:#374151;font-size:14px;">Siparişiniz yolda. Yakında teslim edilecek.</p>',
    DELIVERED:
      '<p style="color:#374151;font-size:14px;">Siparişiniz teslim edildi. Alışverişiniz için teşekkür ederiz! 🎉</p>',
    CANCELLED:
      '<p style="color:#374151;font-size:14px;">Siparişiniz iptal edildi. Ödemeniz için iade süreci başlatılmıştır.</p>',
    DELIVERY_FAILED:
      '<p style="color:#374151;font-size:14px;">Kargo teslim denemesi başarısız. Lütfen kargo firmasıyla iletişime geçin.</p>',
  };
  return messages[ctx.newStatus] ?? '';
}

// ============================================================
// SMS MESAJLARI
// ============================================================

function buildSmsMessage(ctx: OrderNotificationContext): string | null {
  const ref = `#${ctx.orderNumber}`;
  const messages: Partial<Record<OrderStatus, string>> = {
    SHIPPED:
      `${SITE_NAME}: ${ref} siparişiniz kargoya verildi. Barkod: ${ctx.trackingNumber ?? '-'}. Takip: ${ctx.trackingUrl ?? SITE_URL}`,
    DELIVERED:
      `${SITE_NAME}: ${ref} siparişiniz teslim edildi. Teşekkür ederiz!`,
    DELIVERY_FAILED:
      `${SITE_NAME}: ${ref} siparişiniz teslim edilemedi. Kargo firmasıyla iletişime geçin.`,
    CANCELLED:
      `${SITE_NAME}: ${ref} siparişiniz iptal edildi. İade süreciniz başlatıldı.`,
  };
  return messages[ctx.newStatus] ?? null;
}

// ============================================================
// SLA TİMER: Üretim Deadline Kontrolü
// ============================================================

/**
 * Cron job ile çağrılır — üretim deadline'ı geçen siparişleri tespit eder.
 * Admin'e alarm gönderir.
 */
export async function checkProductionDeadlines(): Promise<void> {
  const supabase = getAdminSupabase();

  const { data: overdueOrders } = await supabase
    .from('orders')
    .select('id, production_deadline, profiles!inner(email, full_name)')
    .eq('status', 'IN_PRODUCTION')
    .lt('production_deadline', new Date().toISOString())
    .limit(50);

  if (!overdueOrders || overdueOrders.length === 0) return;

  console.warn(`[SLA] ${overdueOrders.length} sipariş üretim deadline'ını geçti`, {
    orderIds: overdueOrders.map((o) => o.id),
  });

  // Üretimde admin alarm emaili gönder
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const orderList = overdueOrders.map((o) => `<li>${o.id}</li>`).join('');
    await sendEmail(
      adminEmail,
      `[${SITE_NAME}] ${overdueOrders.length} Sipariş SLA İhlali`,
      `<p>Aşağıdaki siparişler üretim deadline'ını geçti:</p><ul>${orderList}</ul>`
    );
  }
}

// ============================================================
// ANA DISPATCHER — Dışa açık tek entry point
// ============================================================

/**
 * Sipariş durum değişikliğinde bildirim gönderir.
 * Her zaman `void` ile çağrılmalı (fire-and-forget):
 *   `void dispatchOrderStatusNotification(orderId, 'SHIPPED')`
 *
 * Hatalar loglenir ama ana akışa fırlatılmaz.
 */
export async function dispatchOrderStatusNotification(
  orderId: string,
  newStatus: OrderStatus
): Promise<void> {
  // Bildirim gönderilecek durum mu kontrol et
  const NOTIFIABLE_STATUSES: OrderStatus[] = [
    'PAID', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP',
    'SHIPPED', 'IN_TRANSIT', 'DELIVERED',
    'DELIVERY_FAILED', 'CANCELLED', 'REFUNDED',
  ];

  if (!NOTIFIABLE_STATUSES.includes(newStatus)) return;

  try {
    const ctx = await fetchOrderContext(orderId);
    if (!ctx) return;

    // Override the status from DB with the one passed in (DB may not have updated yet)
    ctx.newStatus = newStatus;

    const emailSubject = `Siparişiniz Güncellendi: ${ORDER_STATUS_LABELS[newStatus]}`;
    const emailHtml    = buildEmailHtml(ctx);
    const smsMessage   = buildSmsMessage(ctx);

    // E-posta + SMS paralel gönderim
    const tasks: Promise<void>[] = [sendEmail(ctx.customerEmail, emailSubject, emailHtml)];

    if (smsMessage && ctx.customerPhone) {
      tasks.push(sendSms(ctx.customerPhone, smsMessage));
    }

    await Promise.allSettled(tasks); // Biri başarısız olsa diğeri etkilenmesin
  } catch (err) {
    // Bildirim hatası hiçbir zaman ana akışa yayılmaz
    console.error('[Notifications] Bildirim gönderilemedi:', err);
  }
}
