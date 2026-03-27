/**
 * E-Fatura Outbox Cron Worker
 * GET /api/cron/process-invoice-outbox
 *
 * Vercel Cron tarafından her 10 dakikada bir tetiklenir.
 * Fatura kuyruğundaki bekleyen işleri entegratöre gönderir.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processInvoiceOutbox } from '@/lib/einvoice/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();

  try {
    const stats = await processInvoiceOutbox(5);
    const duration = Date.now() - startTime;

    console.info('[Cron/InvoiceOutbox] Tamamlandı', { ...stats, durationMs: duration });

    return NextResponse.json({ ok: true, stats, durationMs: duration });
  } catch (error) {
    console.error('[Cron/InvoiceOutbox] Kritik hata:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
