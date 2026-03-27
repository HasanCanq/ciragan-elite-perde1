/**
 * KATMAN 5 — API GATEWAY: Fiyat Hesaplama
 * ==========================================
 * POST /api/engine/calculate
 *
 * Güvenlik zinciri:
 *   1. IP / kullanıcı bazlı rate limit  → 30 req/dk
 *   2. Supabase session kontrolü         → authenticated vs. guest log ayrımı
 *   3. Request body Zod validasyonu      → kötü şekillendirilmiş istek reddi
 *   4. resolveProduct()                  → DB, server-only (base_price sızmaz)
 *   5. validateCalcInput()               → boyut + iş kuralı doğrulaması
 *   6. calc()                            → Decimal.js ile hesaplama
 *   7. signCalcResult()                  → HMAC-SHA256 token, TTL 15 dk
 *
 * Response: { preview, token, expiresAt }
 *   • preview  — UI'ya güvenle gösterilebilir (basePrice YOK)
 *   • token    — ödeme adımında verifyAndExtract() ile doğrulanır
 *   • expiresAt — client-side sayaç için Unix ms
 *
 * Client asla ham base_price değerini göremez.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calcLimiter } from '@/lib/rate-limit';
import { resolveProduct, toCalcInput } from '@/lib/engine/resolver';
import { validateCalcInput }           from '@/lib/engine/validator';
import { calc, formatCalcResult }      from '@/lib/engine/core';
import { signCalcResult, TOKEN_TTL_MS } from '@/lib/engine/signer';
import type { CalculationType }         from '@/lib/engine/core';

// ─── Request Şeması ───────────────────────────────────────────────────────────

/**
 * Client'tan beklenen minimal input.
 * calculation_type, base_price, min_width_cm, min_area_m2 → DB'den gelir (resolver).
 * Kullanıcı bu alanları asla sağlamaz.
 */
const RequestSchema = z.object({
  productId: z
    .string({ error: 'productId zorunludur.' })
    .uuid('productId geçerli bir UUID olmalıdır.'),
  widthCm: z
    .number({ error: 'widthCm sayı olmalıdır.' })
    .int('widthCm tam sayı (cm) olmalıdır.')
    .positive('widthCm pozitif olmalıdır.'),
  heightCm: z
    .number({ error: 'heightCm sayı olmalıdır.' })
    .int('heightCm tam sayı (cm) olmalıdır.')
    .positive('heightCm pozitif olmalıdır.'),
  quantity: z
    .number({ error: 'quantity sayı olmalıdır.' })
    .int()
    .min(1)
    .max(99),
  pleatId: z
    .string()
    .uuid('pleatId geçerli bir UUID olmalıdır.')
    .nullable()
    .optional(),
});

type ParsedRequest = z.infer<typeof RequestSchema>;

// ─── Response Tipleri ─────────────────────────────────────────────────────────

/** Client'a dönebilecek hesap özeti — basePrice içermez */
interface CalcPreview {
  totalPrice:      number;
  unitPrice:       number;
  usedQuantity:    number;
  unitLabel:       string;
  /** Hazır formatlı Türkçe özet: "5.000 m × 120,00 ₺/m = 600,00 ₺  (1x2.5 Normal)" */
  breakdownText:   string;
  calculationType: CalculationType;
}

interface CalcResponse {
  preview:   CalcPreview;
  /** HMAC-SHA256 imzalı opaque token — checkout'ta verifyAndExtract() ile doğrulanır */
  token:     string;
  /** Token sona erme zamanı (Unix ms) — client-side geri sayım için */
  expiresAt: number;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** İstemci IP'sini çözer — proxy arkasında X-Forwarded-For kullanır */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...extra } },
    { status },
  );
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  // ── 1. Oturum kontrolü ─────────────────────────────────────────────────────
  // Session session varsa user_id bazlı, yoksa IP bazlı rate-limit uygulanır.
  // Hata oturumu kapatmaz — guest akışı devam eder.
  let userId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Redis/cookie hatası session kontrolünü engellemez — guest olarak devam
  }

  // ── 2. Rate limit ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rlKey = userId ? `user:${userId}` : `ip:${ip}`;

  const rl = await calcLimiter.limit(rlKey);

  if (!rl.success) {
    const resetSec = Math.ceil((rl.reset - Date.now()) / 1000);
    return errorResponse(429, 'RATE_LIMITED',
      'Çok fazla hesaplama isteği. Lütfen biraz bekleyip tekrar deneyin.',
      { retryAfter: resetSec, limit: rl.limit },
    );
  }

  // ── 3. Body parse ─────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'İstek gövdesi geçerli JSON değil.');
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field:   i.path.join('.') || 'input',
      message: i.message,
    }));
    return errorResponse(400, 'VALIDATION_ERROR', 'İstek parametreleri geçersiz.', { errors });
  }

  const body: ParsedRequest = parsed.data;

  // ── 4. Ürün çözümleme (DB — server-only) ──────────────────────────────────
  const resolved = await resolveProduct(body.productId, {
    pleatId: body.pleatId ?? null,
  });

  if (!resolved.ok) {
    const statusMap: Record<string, number> = {
      NOT_FOUND:       404,
      OUT_OF_STOCK:    409,
      PLEAT_NOT_FOUND: 422,
      DB_ERROR:        502,
    };
    return errorResponse(
      statusMap[resolved.error.code] ?? 500,
      resolved.error.code,
      resolved.error.message,
    );
  }

  const { product } = resolved;

  // ── 5. Validator (boyut + iş kuralları + model limitleri) ─────────────────
  const rawInput = toCalcInput(product, {
    widthCm:  body.widthCm,
    heightCm: body.heightCm,
    quantity: body.quantity,
  });

  const validated = validateCalcInput(rawInput, {
    modelLimits: product.modelLimits ?? undefined,
  });

  if (!validated.ok) {
    return errorResponse(422, 'VALIDATION_ERROR',
      'Ürün ölçüleri veya iş kuralları doğrulanamadı.',
      { errors: validated.errors },
    );
  }

  // ── 6. Hesaplama (Decimal.js, saf fonksiyon) ───────────────────────────────
  const calcOut = calc(validated.data);

  if (!calcOut.ok) {
    // calc() hataları ya zaten validator'da yakalanmıştır ya da programatik hatadır.
    console.error(`[calculate] calc() hatası [${requestId}]:`, calcOut.error);
    return errorResponse(500, calcOut.error.code, calcOut.error.message);
  }

  const { result } = calcOut;

  // ── 7. İmzalama (HMAC-SHA256, TTL 15 dk) ──────────────────────────────────
  let token: string;
  const calculatedAt = Date.now();

  try {
    token = signCalcResult({
      productId:  body.productId,
      widthCm:    body.widthCm,
      heightCm:   body.heightCm,
      pleatId:    body.pleatId ?? null,
      quantity:   body.quantity,
      totalPrice: result.totalPrice,
    });
  } catch (err) {
    // PRICE_SIGN_SECRET eksikse fail-closed — 500 dön, token üretilmez
    console.error(`[calculate] signCalcResult hatası [${requestId}]:`, err);
    return errorResponse(500, 'SIGN_ERROR',
      'Fiyat imzalanamadı. Lütfen daha sonra tekrar deneyin.',
    );
  }

  // ── 8. Preview oluştur (basePrice dahil değil) ─────────────────────────────
  const preview: CalcPreview = {
    totalPrice:      result.totalPrice,
    unitPrice:       result.unitPrice,
    usedQuantity:    result.usedQuantity,
    unitLabel:       result.unitLabel,
    breakdownText:   formatCalcResult(result),
    calculationType: product.calculationType,
  };

  const response: CalcResponse = {
    preview,
    token,
    expiresAt: calculatedAt + TOKEN_TTL_MS,
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      // Rate-limit bilgisi istemciye açık
      'X-RateLimit-Limit':     String(rl.limit),
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-Request-Id':          requestId,
    },
  });
}

// ─── GET: Sağlık kontrolü ─────────────────────────────────────────────────────

export function GET(): NextResponse {
  return NextResponse.json({
    endpoint: 'POST /api/engine/calculate',
    version:  '1.0',
    ttlMs:    TOKEN_TTL_MS,
    rateLimit: '30 req/60s per IP or user',
  });
}
