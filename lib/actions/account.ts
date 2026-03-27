'use server';

// =====================================================
// KVKK - HESAP SİLME (Unutulma Hakkı)
// =====================================================

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ApiResponse } from '@/types';

// Terminal (sonuçlanmış) sipariş statüsleri
const TERMINAL_STATUSES = ['DELIVERED', 'REFUNDED', 'CANCELLED'] as const;

/**
 * KVKK Madde 7 — Unutulma hakkı.
 * Kullanıcının aktif siparişi yoksa:
 *   1. profiles tablosunu anonimleştirir (full_name: '[Silindi]', phone: null)
 *   2. Service Role ile auth.admin.deleteUser çağırarak hesabı kalıcı siler
 *   3. Kullanıcıyı anasayfaya yönlendirir
 *
 * Aktif sipariş varsa hata döner, silme gerçekleşmez.
 */
export async function deleteMyAccount(): Promise<ApiResponse<null>> {
  const supabase = await createClient();

  // 1. Oturum kontrolü
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, data: null, error: 'Oturum açılmamış.' };
  }

  // 2. Aktif sipariş kontrolü
  const { data: activeOrders, error: ordersError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('user_id', user.id)
    .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
    .limit(1);

  if (ordersError) {
    console.error('deleteMyAccount — orders check error:', ordersError);
    return {
      success: false,
      data: null,
      error: 'Sipariş kontrolü sırasında hata oluştu. Lütfen tekrar deneyin.',
    };
  }

  if (activeOrders && activeOrders.length > 0) {
    return {
      success: false,
      data: null,
      error:
        'Devam eden siparişleriniz bulunduğu için hesabınız silinemiyor. ' +
        'Tüm siparişleriniz tamamlandıktan sonra tekrar deneyin.',
    };
  }

  // 3. Profili anonimleştir (yabancı anahtar referansları korunur)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: '[Silindi]',
      phone: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
    console.error('deleteMyAccount — profile anonymize error:', profileError);
    return {
      success: false,
      data: null,
      error: 'Profil anonimleştirilemedi. Lütfen tekrar deneyin.',
    };
  }

  // 4. Auth hesabını Service Role ile sil
  const adminClient = await createAdminClient();
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    // Profil zaten anonimleştirildi; geri alma yapmıyoruz (veri kalır ama kimlik bağlantısı kesildi)
    console.error('deleteMyAccount — auth.admin.deleteUser error:', deleteError);
    return {
      success: false,
      data: null,
      error: 'Hesap silme işlemi tamamlanamadı. Lütfen destek ekibiyle iletişime geçin.',
    };
  }

  // 5. Kullanıcıyı anasayfaya yönlendir (oturum otomatik kapanır)
  redirect('/');
}
