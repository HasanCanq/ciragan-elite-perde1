import { OrderStatus } from '@/types';

/**
 * Geçerli durum geçiş haritası (State Machine).
 * Her anahtar bir "mevcut durum", değerleri ise geçilebilecek durumlardır.
 *
 * Tam akış:
 * PENDING → PAID/CANCELLED
 * PAID → CONFIRMED/CANCELLED
 * CONFIRMED → IN_PRODUCTION/CANCELLED
 * IN_PRODUCTION → ON_HOLD/READY_TO_SHIP/CANCELLED
 * ON_HOLD → IN_PRODUCTION/CANCELLED
 * READY_TO_SHIP → SHIPPED
 * SHIPPED → IN_TRANSIT/DELIVERED
 * IN_TRANSIT → DELIVERED/DELIVERY_FAILED
 * DELIVERY_FAILED → SHIPPED/CANCELLED
 * DELIVERED → RETURN_REQUESTED
 * RETURN_REQUESTED → REFUNDED/DELIVERED (iade reddedilirse geri al)
 * REFUNDED → [] (terminal)
 * CANCELLED → [] (terminal)
 * PROCESSING → IN_PRODUCTION/CANCELLED (legacy geriye dönük uyumluluk)
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:          ['PAID', 'CANCELLED'],
  PAID:             ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:        ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION:    ['ON_HOLD', 'READY_TO_SHIP', 'CANCELLED'],
  ON_HOLD:          ['IN_PRODUCTION', 'CANCELLED'],
  READY_TO_SHIP:    ['SHIPPED'],
  SHIPPED:          ['IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT:       ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED:  ['SHIPPED', 'CANCELLED'],
  DELIVERED:        ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
  REFUNDED:         [],
  CANCELLED:        [],
  PROCESSING:       ['IN_PRODUCTION', 'CANCELLED'],  // legacy
};

/**
 * Bir durum geçişinin geçerli olup olmadığını kontrol eder.
 * @param from - Mevcut sipariş durumu
 * @param to   - Geçilmek istenen durum
 * @returns    true → geçiş geçerli, false → geçiş yasak
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Bir durum için geçilebilecek tüm durumları döner.
 */
export function getAvailableTransitions(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

/**
 * Durum terminal (son) mi? (Geri dönüşü olmayan durum)
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.length === 0;
}
