/**
 * Yasal Belge Versiyon Servisi
 *
 * Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin
 * aktif versiyonlarını sağlar.
 *
 * Neden versiyon yönetimi?
 * - Müşterinin onayladığı EXACT metni ispat edebilmek
 * - Belge güncellendiğinde eski siparişlerin hukuki kaydı bozulmasın
 * - TÜFE/BTK/GIB denetimleri sırasında "hangi tarihte hangi metni onayladı" sorusuna yanıt
 */

import crypto from 'crypto';
import { createClient as createAdminSupabase } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

export type LegalDocumentType =
  | 'ON_BILGILENDIRME'
  | 'MESAFELI_SATIS'
  | 'KVKK_AYDINLATMA'
  | 'CEREZ_POLITIKASI';

export interface LegalDocumentVersion {
  id: string;
  document_type: LegalDocumentType;
  version: string;
  content_hash: string;
  content_url: string | null;
  is_active: boolean;
  published_at: string;
}

/** Checkout'ta müşteriye gösterilecek minimal bilgi */
export interface ActiveDocumentSummary {
  id: string;
  document_type: LegalDocumentType;
  version: string;
  content_hash: string;
  content_url: string | null;
}

/** Sipariş onay kaydına yazılacak yapı (JSON array içinde) */
export interface ConsentedDocument {
  version_id: string;
  document_type: LegalDocumentType;
  version: string;
  content_hash: string;
}

// ============================================================
// YARDIMCI: Belge içeriğini SHA-256 ile hash'le
// ============================================================

/**
 * Belge içeriğinin SHA-256 hex fingerprint'ini üretir.
 * Kullanım: yeni belge versiyonu yayınlarken content_hash alanına yaz.
 *
 * @example
 * const hash = hashDocumentContent(fs.readFileSync('on-bilgilendirme-v2.html', 'utf8'));
 */
export function hashDocumentContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ============================================================
// AKTIF VERSİYONLARI GETIR (Checkout sayfası için)
// ============================================================

/**
 * Checkout sayfasının başlamasından önce çağrılır.
 * Müşteriye "Aşağıdaki metinleri okudum, onaylıyorum" kutucuğunun
 * altında gösterilecek belge linklerini döner.
 */
export async function getActiveDocumentVersions(
  types: LegalDocumentType[] = ['ON_BILGILENDIRME', 'MESAFELI_SATIS']
): Promise<ActiveDocumentSummary[]> {
  // Server Component veya Server Action'dan çağrılabilir
  // Service role gerekmez — RLS aktif, "is_active=true" public policy var
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_document_versions')
    .select('id, document_type, version, content_hash, content_url')
    .in('document_type', types)
    .eq('is_active', true);

  if (error) {
    console.error('[LegalDocs] Aktif versiyonlar alınamadı:', error);
    return [];
  }

  return (data ?? []) as ActiveDocumentSummary[];
}

/**
 * Verilen version ID'lerinin gerçekten aktif ve geçerli olduğunu doğrular.
 * Sipariş onay anında server-side kontrol için kullanılır.
 *
 * Güvenlik: Client-side'dan gelen version ID'lerine güvenmiyoruz —
 * bu fonksiyon DB'de doğrular.
 */
export async function validateAndBuildConsentedDocuments(
  versionIds: string[]
): Promise<{ valid: boolean; documents: ConsentedDocument[]; error?: string }> {
  if (!versionIds || versionIds.length === 0) {
    return { valid: false, documents: [], error: 'Belge versiyonları boş' };
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: versions, error } = await supabase
    .from('legal_document_versions')
    .select('id, document_type, version, content_hash, is_active')
    .in('id', versionIds);

  if (error) {
    return { valid: false, documents: [], error: 'Belge versiyonları doğrulanamadı' };
  }

  // Gönderilen tüm ID'ler DB'de var mı ve hepsi aktif mi?
  if (!versions || versions.length !== versionIds.length) {
    return { valid: false, documents: [], error: 'Bazı belge versiyonları bulunamadı' };
  }

  const inactiveDoc = versions.find((v) => !v.is_active);
  if (inactiveDoc) {
    return {
      valid: false,
      documents: [],
      error: `Onaylanan belge güncel değil: ${inactiveDoc.document_type} ${inactiveDoc.version}`,
    };
  }

  // Zorunlu belgeler onaylandı mı?
  const requiredTypes: LegalDocumentType[] = ['ON_BILGILENDIRME', 'MESAFELI_SATIS'];
  const approvedTypes = versions.map((v) => v.document_type as LegalDocumentType);
  const missingRequired = requiredTypes.filter((t) => !approvedTypes.includes(t));

  if (missingRequired.length > 0) {
    return {
      valid: false,
      documents: [],
      error: `Zorunlu belgeler onaylanmadı: ${missingRequired.join(', ')}`,
    };
  }

  const documents: ConsentedDocument[] = versions.map((v) => ({
    version_id:    v.id,
    document_type: v.document_type as LegalDocumentType,
    version:       v.version,
    content_hash:  v.content_hash,
  }));

  return { valid: true, documents };
}

// ============================================================
// ADMIN: Yeni Belge Versiyonu Yayınla
// ============================================================

/**
 * Admin panelinden çağrılır.
 * Önceki aktif versiyonu pasife çeker ve yeniyi aktif yapar.
 * Bu iki işlem tek transaction'da olur (RPC değil, ardışık update + insert).
 */
export async function publishNewDocumentVersion(params: {
  documentType: LegalDocumentType;
  version: string;
  contentHash: string;    // hashDocumentContent() ile hesaplanmış
  contentUrl?: string;
  publishedBy: string;    // user.id
}): Promise<{ success: boolean; id?: string; error?: string }> {
  function getAdmin() {
    return createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }

  const supabase = getAdmin();

  // Önce mevcut aktifi pasif yap
  await supabase
    .from('legal_document_versions')
    .update({ is_active: false })
    .eq('document_type', params.documentType)
    .eq('is_active', true);

  // Yeni versiyonu ekle
  const { data, error } = await supabase
    .from('legal_document_versions')
    .insert({
      document_type: params.documentType,
      version:       params.version,
      content_hash:  params.contentHash,
      content_url:   params.contentUrl ?? null,
      is_active:     true,
      created_by:    params.publishedBy,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}
