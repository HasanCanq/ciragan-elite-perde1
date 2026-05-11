// =====================================================
// PAYMENT TRANSACTION LOGGER
// Fire-and-forget: ödeme akışını ASLA bloklamaz
// Kart bilgisi ASLA loglanmaz (sanitize edilir)
// =====================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { PaymentTransactionInsert } from '@/types';

const SENSITIVE_KEYS = new Set([
  'paymentCard',
  'cardNumber',
  'cvc',
  'expireMonth',
  'expireYear',
  'cardHolderName',
  'binNumber',
  'lastFourDigits',
  'cardToken',
  'cardUserKey',
  'cardAssociation',
  'cardFamily',
  'cardType',
]);

const MAX_SANITIZE_DEPTH = 8;

// Iyzico yanıtından kart bilgisini temizle.
// depth limiti: circular reference veya anormal derinlikte stack overflow'u önler.
function sanitizeResponse(
  response: Record<string, unknown> | undefined,
  depth = 0
): Record<string, unknown> | undefined {
  if (!response) return undefined;
  if (depth > MAX_SANITIZE_DEPTH) return { _truncated: true };

  const sanitized = { ...response };

  SENSITIVE_KEYS.forEach((key) => {
    delete sanitized[key];
  });

  for (const [key, value] of Object.entries(sanitized)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeResponse(value as Record<string, unknown>, depth + 1);
    }
  }

  return sanitized;
}

/**
 * Ödeme olayını veritabanına kaydeder.
 *
 * Fire-and-forget: Hata fırlatmaz, sadece console.error yapar.
 * Bu sayede loglama hatası ödeme akışını asla bozmaz.
 */
export async function logPaymentEvent(
  supabase: SupabaseClient,
  data: PaymentTransactionInsert
): Promise<void> {
  try {
    const insertData = {
      ...data,
      raw_response: data.raw_response
        ? sanitizeResponse(data.raw_response)
        : undefined,
    };

    const { error } = await supabase
      .from('payment_transactions')
      .insert(insertData);

    if (error) {
      console.error('[PaymentLogger] DB insert hatası:', error.message, {
        event_type: data.event_type,
        order_id: data.order_id,
      });
    }
  } catch (err) {
    console.error('[PaymentLogger] Beklenmedik hata:', err, {
      event_type: data.event_type,
      order_id: data.order_id,
    });
  }
}
