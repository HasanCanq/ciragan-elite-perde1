/**
 * Kargo Outbox Cron Worker
 * GET /api/cron/process-cargo-outbox
 *
 * Vercel Cron Jobs tarafından her 5 dakikada bir çağrılır.
 * Bekleyen kargo API isteklerini işler, başarısızları retry kuyruğuna alır.
 *
 * Güvenlik: CRON_SECRET ile korunur (sadece Vercel çağırabilir).
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCargoOutbox } from '@/lib/cargo/outbox';

export const runtime = 'nodejs'; // crypto ve fetch için Node.js runtime
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── Cron secret doğrulama ─────────────────────────────────────────────────
  // Vercel otomatik olarak Authorization: Bearer <CRON_SECRET> header'ı ekler
  const cronSecret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!cronSecret || token !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── İşlemi çalıştır ───────────────────────────────────────────────────────
  const startTime = Date.now();

  try {
    const stats = await processCargoOutbox(10);

    const duration = Date.now() - startTime;
    console.info('[Cron/CargoOutbox] Tamamlandı', { ...stats, durationMs: duration });

    return NextResponse.json({
      ok: true,
      stats,
      durationMs: duration,
    });
  } catch (error) {
    console.error('[Cron/CargoOutbox] Kritik hata:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
