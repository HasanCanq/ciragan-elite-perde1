'use server';

// =====================================================
// ADMIN SETTINGS SERVER ACTIONS
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ApiResponse } from '@/types';

// =====================================================
// TYPES
// =====================================================

export interface StoreSettings {
  id: string;
  site_name: string;
  support_email: string;
  support_phone: string;
  free_shipping_threshold: number;
  shipping_cost: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  shop_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreSettingsUpdate {
  site_name?: string;
  support_email?: string;
  support_phone?: string;
  free_shipping_threshold?: number;
  shipping_cost?: number;
  maintenance_mode?: boolean;
  maintenance_message?: string | null;
  shop_enabled?: boolean;
}

// =====================================================
// HELPER: Admin Kontrolü
// =====================================================

async function verifyAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Yetkisiz erişim');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    throw new Error('Yetkisiz erişim');
  }

  return { supabase, userId: user.id };
}

// =====================================================
// GET SETTINGS
// =====================================================

export async function getSettings(): Promise<ApiResponse<StoreSettings>> {
  try {
    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('store_settings')
      .select('*')
      .single();

    if (error) throw error;

    return {
      data: settings as StoreSettings,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getSettings error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ayarlar yüklenemedi',
      success: false,
    };
  }
}

// =====================================================
// UPDATE SETTINGS (Admin Only)
// =====================================================

export async function updateSettings(
  updates: StoreSettingsUpdate
): Promise<ApiResponse<StoreSettings>> {
  try {
    const { supabase } = await verifyAdmin();

    // Validation
    if (updates.free_shipping_threshold !== undefined) {
      if (updates.free_shipping_threshold < 0) {
        throw new Error('Ücretsiz kargo eşiği negatif olamaz');
      }
    }

    if (updates.shipping_cost !== undefined) {
      if (updates.shipping_cost < 0) {
        throw new Error('Kargo ücreti negatif olamaz');
      }
    }

    if (updates.support_email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.support_email)) {
        throw new Error('Geçerli bir e-posta adresi giriniz');
      }
    }

    // Update settings
    const { data: settings, error } = await supabase
      .from('store_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .select()
      .single();

    if (error) throw error;

    // Revalidate paths — '/' layout clears ISR cache for all product pages too
    revalidatePath('/admin/settings');
    revalidatePath('/', 'layout');

    return {
      data: settings as StoreSettings,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateSettings error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ayarlar güncellenemedi',
      success: false,
    };
  }
}

// =====================================================
// GET PUBLIC SETTINGS (No Auth Required)
// =====================================================

export async function getPublicSettings(): Promise<
  ApiResponse<Pick<StoreSettings, 'free_shipping_threshold' | 'shipping_cost' | 'maintenance_mode' | 'shop_enabled'>>
> {
  try {
    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('store_settings')
      .select('free_shipping_threshold, shipping_cost, maintenance_mode, shop_enabled')
      .single();

    if (error) throw error;

    return {
      data: settings,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getPublicSettings error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ayarlar yüklenemedi',
      success: false,
    };
  }
}
