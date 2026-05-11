'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, MeasurementGuide } from '@/types';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum açılmamış.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'ADMIN') throw new Error('Yetki yok.');
  return supabase;
}

export async function getMeasurementGuides(): Promise<ApiResponse<MeasurementGuide[]>> {
  try {
    const supabase = await verifyAdmin();
    const { data, error } = await supabase
      .from('measurement_guides')
      .select('*')
      .order('guide_key');
    if (error) throw error;
    return { success: true, data: data ?? [], error: null };
  } catch (e) {
    return { success: false, data: null, error: 'Kılavuzlar yüklenemedi.' };
  }
}

export async function uploadMeasurementGuideImage(
  formData: FormData,
): Promise<ApiResponse<null>> {
  try {
    const supabase  = await verifyAdmin();
    const guideKey  = formData.get('guide_key') as string;
    const file      = formData.get('image') as File;

    if (!guideKey || !file || file.size === 0) throw new Error('Eksik veri.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Dosya 5 MB\'ı geçemez.');

    const ext      = file.name.split('.').pop() ?? 'png';
    const filePath = `measurement-guides/${guideKey}.${ext}`;

    // Aynı anahtar için her zaman üzerine yaz
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    // Cache buster ekle — tarayıcı eski görseli göstermesin
    const imageUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('measurement_guides')
      .update({ image_url: imageUrl })
      .eq('guide_key', guideKey);

    if (updateError) throw updateError;

    revalidatePath('/admin/measurement-guides');
    revalidatePath('/urun', 'layout');

    return { success: true, data: null, error: null };
  } catch (e) {
    console.error('uploadMeasurementGuideImage:', e);
    return {
      success: false,
      data:    null,
      error:   e instanceof Error ? e.message : 'Yükleme başarısız.',
    };
  }
}
