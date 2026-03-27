/**
 * Motor Sabitleri — Server + Client paylaşımlı
 * =============================================
 * Bu dosya 'server-only' içermez; hem signer.ts (server)
 * hem cartStore.ts (client) tarafından import edilebilir.
 *
 * TOKEN_TTL_MS: signer.ts ve cartStore.ts arasındaki
 * magic number duplikasyonunu kaldırır.
 */

/** Fiyat tokeninin geçerlilik süresi — 15 dakika. */
export const TOKEN_TTL_MS = 15 * 60 * 1_000;
