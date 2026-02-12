// =====================================================
// PAYMENT TRANSACTION LOGGER
// Fire-and-forget: ödeme akışını ASLA bloklamaz
// Kart bilgisi ASLA loglanmaz (sanitize edilir)
// =====================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { PaymentTransactionInsert } from '@/types';

// Iyzico yanıtından kart bilgisini temizle
function sanitizeResponse(
  response: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!response) return undefined;

  const sanitized = { ...response };

  // paymentCard objesini tamamen kaldır
  delete sanitized.paymentCard;

  // Bilinen hassas alanları kaldır
  const sensitiveKeys = [
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
  ];

  for (const key of sensitiveKeys) {
    delete sanitized[key];
  }

  // İç içe objeleri de temizle
  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeResponse(value as Record<string, unknown>);
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
