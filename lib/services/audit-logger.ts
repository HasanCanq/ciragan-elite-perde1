/**
 * Audit Logger Servisi
 * ====================
 * Yönetim panelindeki her hareketin izini sürmek için kullanılır.
 *
 * KATMANLAR:
 *   1. DB Trigger (migration 014)    — INSERT/UPDATE/DELETE otomatik loglanır
 *   2. auditLog()                    — Uygulama katmanı olayları, HTTP context ile
 *   3. withAudit()                   — Server action'ları saran wrapper
 *
 * TASARIM:
 *   • Log hataları asıl işlemi ASLA engellemez (fire-and-forget)
 *   • Yalnızca değişen alanlar loglanır (diff tabanlı)
 *   • Hassas alanlar (token, hash) otomatik maskelenir
 *   • ip_address ve user_agent HTTP context'ten çekilir
 */

import 'server-only';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE';

export type AuditTableName = 'products' | 'categories' | 'orders' | 'profiles';

export interface AuditLogEntry {
  action: AuditAction;
  tableName: AuditTableName;
  recordId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Hassas Alan Maskesi ──────────────────────────────────────────────────────

/** Log'a yazılmaması gereken alan adları */
const SENSITIVE_FIELDS = new Set([
  'password', 'password_hash', 'token', 'refresh_token',
  'api_key', 'secret', 'card_number', 'cvv', 'pin',
  'identity_number', // TC kimlik no — log'a yazılmaz
]);

function maskSensitiveFields(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj) return null;

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[MASKELENDI]' : value,
    ])
  );
}

// ─── Fark Hesaplayıcı ─────────────────────────────────────────────────────────

/**
 * İki nesne arasındaki farkı hesaplar.
 * Yalnızca değişen alanları döner — log boyutunu küçültür.
 *
 * @example
 * diffObjects({ price: 100, name: 'A' }, { price: 200, name: 'A' })
 * // oldDiff: { price: 100 }
 * // newDiff: { price: 200 }
 */
export function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): { oldDiff: Record<string, unknown>; newDiff: Record<string, unknown> } {
  const oldDiff: Record<string, unknown> = {};
  const newDiff: Record<string, unknown> = {};

  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Kaba karşılaştırma (JSON serializable değerler için yeterli)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldDiff[key] = oldVal;
      newDiff[key] = newVal;
    }
  }

  return { oldDiff, newDiff };
}

// ─── Ana Log Fonksiyonu ───────────────────────────────────────────────────────

/**
 * Audit olayını log_audit_event RPC üzerinden kaydeder.
 *
 * Fire-and-forget: hata fırlatmaz, sadece console.warn yazar.
 * Asıl server action'ı engellemez.
 *
 * @example
 * // Server action içinde:
 * await auditLog(supabase, {
 *   action: 'UPDATE',
 *   tableName: 'products',
 *   recordId: product.id,
 *   oldValues: { base_price: 100 },
 *   newValues: { base_price: 150 },
 * });
 */
export async function auditLog(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    let reqHeaders: ReturnType<typeof headers> | null = null;
    try { reqHeaders = headers(); } catch { reqHeaders = null; }
    const ipAddress = reqHeaders
      ? (reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
         reqHeaders.get('x-real-ip') ??
         '127.0.0.1')
      : null;
    const userAgent = reqHeaders?.get('user-agent') ?? null;

    const { error } = await (supabase as any).rpc('log_audit_event', {
      p_action:      entry.action,
      p_table_name:  entry.tableName,
      p_record_id:   entry.recordId,
      p_old_values:  maskSensitiveFields(entry.oldValues ?? null),
      p_new_values:  maskSensitiveFields(entry.newValues ?? null),
      p_ip_address:  ipAddress,
      p_user_agent:  userAgent,
    });

    if (error) {
      // RPC test DB'de olmayabilir — graceful degrade
      console.warn('[AuditLogger] RPC hatası (log kaydedilemedi):', error.message);
    }
  } catch (err) {
    // Hiçbir koşulda asıl işlemi engelleme
    console.warn('[AuditLogger] Beklenmedik hata (log kaydedilemedi):', err);
  }
}

// ─── Server Action Wrapper ────────────────────────────────────────────────────

/**
 * Server action'ları otomatik audit loglamayla saran HOC.
 *
 * Çalışma mantığı:
 *   1. Mevcut kaydı çeker (old_values)
 *   2. Action'ı çalıştırır
 *   3. Güncel kaydı çeker (new_values)
 *   4. Farkı hesaplar ve loglar
 *
 * @example
 * export const updateProductPrice = withAudit(
 *   'products',
 *   async (supabase, productId: string, newPrice: number) => {
 *     await supabase.from('products')
 *       .update({ base_price: newPrice })
 *       .eq('id', productId);
 *   }
 * );
 */
export function withAudit<TArgs extends unknown[], TReturn>(
  tableName: AuditTableName,
  fn: (supabase: SupabaseClient, recordId: string, ...args: TArgs) => Promise<TReturn>
) {
  return async (
    supabase: SupabaseClient,
    recordId: string,
    ...args: TArgs
  ): Promise<TReturn> => {
    // 1. Değişiklik öncesi snapshot
    const { data: before } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .maybeSingle();

    // 2. Asıl işlemi çalıştır
    const result = await fn(supabase, recordId, ...args);

    // 3. Değişiklik sonrası snapshot
    const { data: after } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .maybeSingle();

    // 4. Farkı hesapla ve logla (fire-and-forget)
    if (before && after) {
      const { oldDiff, newDiff } = diffObjects(
        before as Record<string, unknown>,
        after  as Record<string, unknown>
      );

      const action: AuditAction =
        after.deleted_at && !before.deleted_at ? 'SOFT_DELETE' :
        !after.deleted_at && before.deleted_at ? 'RESTORE' :
        'UPDATE';

      // Gerçekten bir şey değiştiyse logla
      if (Object.keys(oldDiff).length > 0) {
        auditLog(supabase, {
          action,
          tableName,
          recordId,
          oldValues: oldDiff,
          newValues: newDiff,
        });
      }
    } else if (!before && after) {
      // Yeni kayıt oluşturuldu
      auditLog(supabase, {
        action: 'CREATE',
        tableName,
        recordId,
        oldValues: null,
        newValues: maskSensitiveFields(after as Record<string, unknown>),
      });
    } else if (before && !after) {
      // Hard delete (artık olmamalı — yine de logla)
      auditLog(supabase, {
        action: 'DELETE',
        tableName,
        recordId,
        oldValues: maskSensitiveFields(before as Record<string, unknown>),
        newValues: null,
      });
    }

    return result;
  };
}

// ─── Audit Log Okuma (Admin Panel) ───────────────────────────────────────────

export interface AuditLogFilters {
  tableName?: AuditTableName;
  recordId?: string;
  userId?: string;
  action?: AuditAction;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Admin paneli için audit logları sayfalı getirir.
 * Yalnızca admin erişebilir (RLS).
 */
export async function getAuditLogs(
  supabase: SupabaseClient,
  filters: AuditLogFilters = {}
): Promise<{ data: AuditLog[]; total: number }> {
  const {
    tableName,
    recordId,
    userId,
    action,
    fromDate,
    toDate,
    page = 1,
    pageSize = 50,
  } = filters;

  try {
    let query = (supabase as any)
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (tableName) query = query.eq('table_name', tableName);
    if (recordId)  query = query.eq('record_id', recordId);
    if (userId)    query = query.eq('user_id', userId);
    if (action)    query = query.eq('action', action);
    if (fromDate)  query = query.gte('created_at', fromDate);
    if (toDate)    query = query.lte('created_at', toDate);

    // Sayfalama
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[AuditLogger] getAuditLogs hatası:', error);
      return { data: [], total: 0 };
    }

    return { data: (data as AuditLog[]) ?? [], total: count ?? 0 };
  } catch (err) {
    console.error('[AuditLogger] getAuditLogs beklenmedik hata:', err);
    return { data: [], total: 0 };
  }
}

/**
 * Belirli bir kaydın tüm değişiklik tarihçesini getirir.
 * Ürün detay sayfasındaki "Değişiklik Tarihçesi" için.
 *
 * @example
 * const history = await getRecordAuditHistory(supabase, 'products', productId);
 */
export async function getRecordAuditHistory(
  supabase: SupabaseClient,
  tableName: AuditTableName,
  recordId: string
): Promise<AuditLog[]> {
  const { data } = await getAuditLogs(supabase, {
    tableName,
    recordId,
    pageSize: 100,
  });
  return data;
}
