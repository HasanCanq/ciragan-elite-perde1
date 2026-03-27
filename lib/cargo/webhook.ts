/**
 * Kargo Webhook Servisi
 *
 * - Türk kargo firmalarından (Yurtiçi, MNG, PTT, UPS) gelen webhook'ları normalize eder
 * - HMAC-SHA256 imza doğrulaması yapar
 * - Ham kargo durum kodlarını OrderStatus'a map eder
 */

import crypto from 'crypto';
import { OrderStatus } from '@/types';

// ============================================================
// TYPES
// ============================================================

export type SupportedCarrier = 'yurtici' | 'mng' | 'ptt' | 'ups' | 'generic';

/** Normalize edilmiş webhook payload — carrier bağımsız */
export interface NormalizedCargoWebhook {
  orderId: string;           // Bizim sipariş ID'miz
  trackingNumber: string;    // Kargo barkodu
  carrier: SupportedCarrier;
  mappedStatus: OrderStatus | null; // null = tanımlanamayan durum (log et, geç)
  rawStatus: string;         // Kargo firmasının orijinal kodu (audit için)
  eventTime: string;         // ISO 8601
  deliveryDetails?: {
    recipientName?: string;
    branchName?: string;
    failureReason?: string;
  };
}

// ============================================================
// CARRIER STATUS MAPPINGS
// ============================================================

/**
 * Yurtiçi Kargo — integer status kodları
 * https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula
 */
const YURTICI_STATUS_MAP: Record<number, OrderStatus> = {
  1:  'SHIPPED',          // Kargo kabul
  3:  'IN_TRANSIT',       // Transfer merkezi
  5:  'IN_TRANSIT',       // Dağıtım merkezinde
  7:  'IN_TRANSIT',       // Dağıtıcıda
  47: 'SHIPPED',          // Yola çıktı
  48: 'DELIVERED',        // Teslim edildi
  97: 'DELIVERY_FAILED',  // Teslim edilemedi (adreste yok)
  98: 'DELIVERY_FAILED',  // İade başlatıldı
};

/**
 * MNG Kargo — string status kodları
 */
const MNG_STATUS_MAP: Record<string, OrderStatus> = {
  'ACCEPTED':          'SHIPPED',
  'IN_TRANSIT':        'IN_TRANSIT',
  'OUT_FOR_DELIVERY':  'IN_TRANSIT',
  'DELIVERED':         'DELIVERED',
  'DELIVERY_FAILED':   'DELIVERY_FAILED',
  'RETURNED':          'DELIVERY_FAILED',
};

/**
 * PTT Kargo — string status kodları
 */
const PTT_STATUS_MAP: Record<string, OrderStatus> = {
  'KABUL':      'SHIPPED',
  'TRANSIT':    'IN_TRANSIT',
  'DAGITIMDA':  'IN_TRANSIT',
  'TESLIM':     'DELIVERED',
  'IADE':       'DELIVERY_FAILED',
};

// ============================================================
// SIGNATURE VALIDATION
// ============================================================

/**
 * HMAC-SHA256 imza doğrulaması.
 * Kargo firması webhook'u göndermeden önce body'yi secret ile imzalar.
 * Biz de aynı hesabı yapıp karşılaştırıyoruz.
 *
 * timing-safe compare kullanıyoruz (timing attack önlemi).
 */
export function validateHmacSignature(
  rawBody: string,
  receivedSignature: string,
  secret: string
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // hex string → Buffer — uzunluk eşit değilse timingSafeEqual fırlatır
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(
      receivedSignature.replace(/^sha256=/, ''), // GitHub-style prefix varsa temizle
      'hex'
    );

    if (expectedBuf.length !== receivedBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Basit Bearer token doğrulaması (bazı firmalar HMAC yerine static token kullanır).
 */
export function validateBearerToken(
  authHeader: string | null,
  expectedToken: string
): boolean {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  // timing-safe compare
  try {
    const expected = Buffer.from(expectedToken, 'utf8');
    const received = Buffer.from(token, 'utf8');
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

// ============================================================
// PAYLOAD NORMALIZASYON
// ============================================================

/**
 * Yurtiçi Kargo webhook payload → NormalizedCargoWebhook
 *
 * Örnek payload:
 * {
 *   "barcode": "0012345678",
 *   "orderNo": "uuid-siparis-id",
 *   "statusCode": 48,
 *   "statusDesc": "TESLİM EDİLDİ",
 *   "deliveryDate": "2024-03-15T14:30:00",
 *   "receiverName": "Ahmet Yılmaz"
 * }
 */
export function normalizeYurticiPayload(body: Record<string, unknown>): NormalizedCargoWebhook {
  const statusCode = Number(body.statusCode ?? body.status);
  return {
    orderId:        String(body.orderNo ?? body.orderId ?? ''),
    trackingNumber: String(body.barcode ?? body.trackingNumber ?? ''),
    carrier:        'yurtici',
    mappedStatus:   YURTICI_STATUS_MAP[statusCode] ?? null,
    rawStatus:      String(statusCode),
    eventTime:      String(body.deliveryDate ?? body.eventDate ?? new Date().toISOString()),
    deliveryDetails: {
      recipientName: body.receiverName ? String(body.receiverName) : undefined,
      branchName:    body.branchName   ? String(body.branchName)   : undefined,
      failureReason: body.failureReason ? String(body.failureReason) : undefined,
    },
  };
}

/**
 * MNG Kargo webhook payload → NormalizedCargoWebhook
 *
 * Örnek payload:
 * {
 *   "referenceNo": "uuid-siparis-id",
 *   "barcode": "MNG123456",
 *   "statusCode": "DELIVERED",
 *   "statusMessage": "Teslim edildi",
 *   "eventDateTime": "2024-03-15T14:30:00Z"
 * }
 */
export function normalizeMNGPayload(body: Record<string, unknown>): NormalizedCargoWebhook {
  const rawStatus = String(body.statusCode ?? body.status ?? '').toUpperCase();
  return {
    orderId:        String(body.referenceNo ?? body.orderNo ?? body.orderId ?? ''),
    trackingNumber: String(body.barcode ?? body.trackingNo ?? ''),
    carrier:        'mng',
    mappedStatus:   MNG_STATUS_MAP[rawStatus] ?? null,
    rawStatus,
    eventTime:      String(body.eventDateTime ?? body.eventDate ?? new Date().toISOString()),
    deliveryDetails: {
      recipientName: body.deliveryName ? String(body.deliveryName) : undefined,
      failureReason: body.failureReason ? String(body.failureReason) : undefined,
    },
  };
}

/**
 * PTT Kargo webhook payload → NormalizedCargoWebhook
 */
export function normalizePTTPayload(body: Record<string, unknown>): NormalizedCargoWebhook {
  const rawStatus = String(body.durum ?? body.status ?? '').toUpperCase();
  return {
    orderId:        String(body.siparisNo ?? body.referansNo ?? body.orderId ?? ''),
    trackingNumber: String(body.barkod ?? body.trackingNo ?? ''),
    carrier:        'ptt',
    mappedStatus:   PTT_STATUS_MAP[rawStatus] ?? null,
    rawStatus,
    eventTime:      String(body.tarih ?? body.eventDate ?? new Date().toISOString()),
  };
}

/**
 * Kargo firmasına göre uygun normalizer'ı çağırır.
 */
export function normalizeCargoWebhook(
  carrier: SupportedCarrier,
  body: Record<string, unknown>
): NormalizedCargoWebhook {
  switch (carrier) {
    case 'yurtici': return normalizeYurticiPayload(body);
    case 'mng':     return normalizeMNGPayload(body);
    case 'ptt':     return normalizePTTPayload(body);
    default:        return normalizeYurticiPayload(body); // generic fallback
  }
}
