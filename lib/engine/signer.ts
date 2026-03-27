/**
 * KATMAN 4 — CALCULATION SIGNER
 * ================================
 * Fiyat hesap sonucunu HMAC-SHA256 ile imzalar.
 *
 * NEDEN GEREKLİ?
 *   Kullanıcı ürün konfigüratöründe hesap yaptırır ve bir fiyat görür.
 *   Ödeme adımına geçtiğinde sunucu bu fiyatın:
 *     1. Gerçekten sunucu tarafından hesaplandığını (sahte değil),
 *     2. Parametrelerinin değiştirilmediğini (price tampering yok),
 *     3. Hâlâ taze olduğunu (≤15 dakika) doğrulamak ister.
 *   İmzalı token bunu tek bir opaque string ile sağlar.
 *
 * TOKEN FORMATI  (JWT-benzeri, iki parça):
 *   base64url(JSON payload)  .  HMAC-SHA256(base64url_payload, secret) [hex]
 *
 * PAYLOAD:
 *   { productId, widthCm, heightCm, pleatId, quantity, totalPrice, calculatedAt }
 *
 * TTL: 15 dakika — check-out başlatılmadan token süresi dolarsa yeniden hesap istenir.
 *
 * SECURITY:
 *   - import 'server-only'           → client bundle'a sızmaz
 *   - PRICE_SIGN_SECRET env var       → eksikse fail-closed (sessizce geçmez)
 *   - timingSafeEqual                 → timing attack engeli
 *   - canonicalize() ile determinizm  → JSON key sırası sorunsuz imzalanır
 *   - Min 32 byte secret zorunluluğu  → zayıf anahtar engeli
 *
 * ENV VAR:
 *   PRICE_SIGN_SECRET=<en az 64 hex karakter = 32 byte>
 *   Üretmek için: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { TOKEN_TTL_MS } from './constants';

// TOKEN_TTL_MS constants.ts'den gelir — hem server hem client paylaşır.
export { TOKEN_TTL_MS };

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const TTL_MS = TOKEN_TTL_MS;

/** Token ayırıcı karakter — base64url içinde bulunmaz (URL-safe). */
const SEP = '.';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** İmzalanacak ve doğrulanacak hesap sonucu alanları */
export interface SignPayload {
  /** Hesaplanan ürünün UUID'i */
  productId: string;
  /** Genişlik (cm) */
  widthCm: number;
  /** Yükseklik (cm) */
  heightCm: number;
  /** Seçilen pile UUID'i — mt türü için; diğerleri null */
  pleatId: string | null;
  /** Sipariş adedi */
  quantity: number;
  /** Hesaplanan toplam fiyat (TRY, 2 ondalık) */
  totalPrice: number;
  /** Hesap zamanı — Unix milisaniye */
  calculatedAt: number;
}

export type SignFailReason =
  | 'INVALID_SIGNATURE' // İmza uyuşmuyor — veri değiştirilmiş
  | 'EXPIRED'           // TTL aşıldı (>15 dk)
  | 'MALFORMED';        // Token formatı bozuk / decode edilemiyor

export type VerifyResult =
  | { ok: true;  data: SignPayload }
  | { ok: false; reason: SignFailReason; message: string };

// ─── Yardımcı: Secret ─────────────────────────────────────────────────────────

/**
 * PRICE_SIGN_SECRET env var'ı döner.
 * Eksikse ya da çok kısaysa HATA FIRLATIR (fail-closed).
 * Sessizce varsayılan kullanmak güvenlik açığı yaratır.
 */
function getSecret(): string {
  const raw = process.env.PRICE_SIGN_SECRET;

  if (!raw || raw.trim().length === 0) {
    throw new Error(
      '[Signer] PRICE_SIGN_SECRET env var tanımlanmamış.\n' +
      '  Üretmek için: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Minimum 32 karakter (= 16 byte) — brute-force dayanıklılığı için 64+ önerilir
  if (raw.length < 32) {
    throw new Error(
      `[Signer] PRICE_SIGN_SECRET çok kısa (${raw.length} karakter). En az 32 karakter gereklidir.`
    );
  }

  return raw;
}

// ─── Yardımcı: Kanonikleştirme ────────────────────────────────────────────────

/**
 * Payload'ı sabit sıralı dizi olarak string'e çevirir.
 * JSON.stringify(object) anahtar sırasına güvenmek yerine
 * alan sırasını burada sabitliyoruz — forward-compatible.
 */
function canonicalize(p: SignPayload): string {
  return JSON.stringify([
    p.productId,
    p.widthCm,
    p.heightCm,
    p.pleatId,
    p.quantity,
    p.totalPrice,
    p.calculatedAt,
  ]);
}

// ─── Yardımcı: HMAC ───────────────────────────────────────────────────────────

function computeHmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

// ─── Yardımcı: Encoding ───────────────────────────────────────────────────────

function encodePayload(p: SignPayload): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}

function decodePayload(encoded: string): SignPayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(json) as SignPayload;
  } catch {
    return null;
  }
}

// ─── Genel API ────────────────────────────────────────────────────────────────

/**
 * Hesap sonucunu imzalar ve opaque token üretir.
 *
 * Token: `base64url(payload).hmac_hex`
 *
 * @example
 * const token = sign({
 *   productId: 'uuid-...',
 *   widthCm: 200, heightCm: 260,
 *   pleatId: 'uuid-...', quantity: 1,
 *   totalPrice: 600.00,
 *   calculatedAt: Date.now(),
 * });
 * // token ödeme formunda hidden input olarak saklanır
 */
export function sign(payload: SignPayload): string {
  const secret   = getSecret();
  const encoded  = encodePayload(payload);
  const canonical = canonicalize(payload);
  const sig      = computeHmac(canonical, secret);
  return `${encoded}${SEP}${sig}`;
}

/**
 * Token'ı doğrular; geçerliyse payload'ı döner.
 *
 * Başarısızlık sebepleri:
 *   MALFORMED          — parse edilemiyor veya eksik alan
 *   INVALID_SIGNATURE  — imza uyuşmuyor (tampering)
 *   EXPIRED            — 15 dakika TTL aşıldı
 *
 * @example
 * const result = verify(token);
 * if (!result.ok) {
 *   if (result.reason === 'EXPIRED')          return { error: 'Fiyat hesabı süresi doldu.' };
 *   if (result.reason === 'INVALID_SIGNATURE') return { error: 'Geçersiz fiyat tokeni.' };
 * }
 * const { totalPrice, productId } = result.data;
 */
export function verify(token: string): VerifyResult {
  // ── 1. Format kontrolü ────────────────────────────────────────────────────
  const dotIdx = token.lastIndexOf(SEP);
  if (dotIdx === -1) {
    return { ok: false, reason: 'MALFORMED', message: 'Token formatı geçersiz.' };
  }

  const encodedPart = token.slice(0, dotIdx);
  const receivedSig = token.slice(dotIdx + 1);

  if (!encodedPart || !receivedSig) {
    return { ok: false, reason: 'MALFORMED', message: 'Token parçaları eksik.' };
  }

  // ── 2. Payload decode ────────────────────────────────────────────────────
  const payload = decodePayload(encodedPart);
  if (!payload) {
    return { ok: false, reason: 'MALFORMED', message: 'Payload decode edilemedi.' };
  }

  // ── 3. Zorunlu alan kontrolü ─────────────────────────────────────────────
  if (
    typeof payload.productId     !== 'string'  ||
    typeof payload.widthCm       !== 'number'  ||
    typeof payload.heightCm      !== 'number'  ||
    typeof payload.quantity      !== 'number'  ||
    typeof payload.totalPrice    !== 'number'  ||
    typeof payload.calculatedAt  !== 'number'
  ) {
    return { ok: false, reason: 'MALFORMED', message: 'Payload alanları eksik veya yanlış tipte.' };
  }

  // ── 4. İmza doğrulama (timing-safe) ─────────────────────────────────────
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    // Secret yoksa fail-closed: token geçersiz sayılır, hata yutulmaz
    throw new Error('[Signer] Doğrulama sırasında PRICE_SIGN_SECRET erişilemez durumda.');
  }

  const expectedSig = computeHmac(canonicalize(payload), secret);

  // HMAC hex her zaman 64 karakter (SHA256 = 32 byte);
  // farklı uzunlukta gelen imzalar için padding ile eşit uzunluk sağla
  const a = Buffer.from(expectedSig.padEnd(64, '0'), 'hex');
  const b = Buffer.from(receivedSig.padEnd(64, '0').slice(0, 64), 'hex');

  const sigMatch = a.length === b.length && timingSafeEqual(a, b);

  if (!sigMatch) {
    return {
      ok:      false,
      reason:  'INVALID_SIGNATURE',
      message: 'Fiyat tokeni imzası geçersiz — olası fiyat manipülasyonu.',
    };
  }

  // ── 5. TTL kontrolü ──────────────────────────────────────────────────────
  const age = Date.now() - payload.calculatedAt;
  if (age > TTL_MS) {
    const minutes = Math.floor(age / 60_000);
    return {
      ok:      false,
      reason:  'EXPIRED',
      message: `Fiyat hesabı ${minutes} dakika önce yapılmış — lütfen yeniden hesaplayın.`,
    };
  }

  return { ok: true, data: payload };
}

// ─── Yardımcı: Token üretme + doğrulama pipeline'ı ───────────────────────────

/**
 * Hesap sonucunu anında imzalar; sign() için kolaylık sarmalayıcısı.
 * calculatedAt otomatik olarak Date.now() ile doldurulur.
 *
 * @example
 * const calcResult = calc(validated.data);
 * if (!calcResult.ok) ...
 * const token = signCalcResult({
 *   productId, widthCm, heightCm, pleatId, quantity,
 *   totalPrice: calcResult.result.totalPrice,
 * });
 */
export function signCalcResult(params: Omit<SignPayload, 'calculatedAt'>): string {
  return sign({ ...params, calculatedAt: Date.now() });
}

/**
 * Checkout sırasında client'tan gelen token'ı doğrular
 * ve doğrulanmış fiyatı döner — DB'ye yazılacak `total_amount` budur.
 *
 * @throws Asla fırlatmaz; tüm hatalar VerifyResult içinde döner.
 *
 * @example
 * const v = verifyAndExtract(req.body.priceToken);
 * if (!v.ok) return { error: v.message };
 * // v.data.totalPrice → güvenilir fiyat
 */
export function verifyAndExtract(token: string | undefined | null): VerifyResult {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      ok:      false,
      reason:  'MALFORMED',
      message: 'Fiyat tokeni eksik.',
    };
  }
  return verify(token.trim());
}
