/**
 * Provider Factory
 *
 * Çevre değişkenlerine göre uygun provider'ı döner.
 * Öncelik sırası: env → Paraşüt → Uyumsoft
 */

import { InvoiceProvider } from '@/lib/einvoice/types';
import { ParasutProvider } from './parasut';
import { UyumsoftProvider } from './uyumsoft';

const providers: Record<string, InvoiceProvider> = {
  parasut:   new ParasutProvider(),
  uyumsoft:  new UyumsoftProvider(),
};

/**
 * Konfigüre edilmiş provider'ı döner.
 * EINVOICE_PROVIDER env değişkeni yoksa ilk konfigüre olanı seçer.
 */
export function getInvoiceProvider(): InvoiceProvider {
  const preferred = process.env.EINVOICE_PROVIDER?.toLowerCase();

  if (preferred && providers[preferred]) {
    const p = providers[preferred];
    if (p.isConfigured()) return p;
    console.warn(`[Invoice] ${preferred} seçildi ama konfigüre değil, fallback deneniyor`);
  }

  for (const p of Object.values(providers)) {
    if (p.isConfigured()) return p;
  }

  throw new Error(
    'Hiçbir e-fatura provider konfigüre edilmedi. ' +
    'PARASUT_* veya UYUMSOFT_* env değişkenlerini ayarlayın.'
  );
}

export { ParasutProvider } from './parasut';
export { UyumsoftProvider } from './uyumsoft';
