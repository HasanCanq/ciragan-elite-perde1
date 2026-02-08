'use server';

// =====================================================
// USER SERVER ACTIONS - Profile & Address Management
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ApiResponse } from '@/types';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface Address {
  id: string;
  user_id: string;
  title: string;
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  district: string;
  postal_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInsert {
  title: string;
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  district: string;
  postal_code?: string;
  is_default?: boolean;
}

export interface ProfileUpdate {
  full_name?: string;
  phone?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

// =====================================================
// PROFILE ACTIONS
// =====================================================

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<ApiResponse<UserProfile>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    return {
      data: profile as UserProfile,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProfile error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Profil yüklenemedi',
      success: false,
    };
  }
}

/**
 * Update user profile (full_name, phone)
 */
export async function updateProfile(
  data: ProfileUpdate
): Promise<ApiResponse<UserProfile>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    // Update profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        phone: data.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (profileError) throw profileError;

    // Also update auth.users metadata
    if (data.full_name) {
      await supabase.auth.updateUser({
        data: { full_name: data.full_name },
      });
    }

    revalidatePath('/account');

    return {
      data: profile as UserProfile,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateProfile error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Profil güncellenemedi',
      success: false,
    };
  }
}

// =====================================================
// ADDRESS ACTIONS
// =====================================================

/**
 * Get all addresses for current user
 */
export async function getAddresses(): Promise<ApiResponse<Address[]>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      data: addresses as Address[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAddresses error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Adresler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Get a single address by ID
 */
export async function getAddressById(
  addressId: string
): Promise<ApiResponse<Address>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return {
      data: address as Address,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAddressById error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Adres bulunamadı',
      success: false,
    };
  }
}

/**
 * Add a new address
 */
export async function addAddress(
  data: AddressInsert
): Promise<ApiResponse<Address>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    // Validation
    if (!data.title?.trim()) throw new Error('Adres başlığı gereklidir');
    if (!data.full_name?.trim()) throw new Error('Alıcı adı gereklidir');
    if (!data.phone?.trim()) throw new Error('Telefon numarası gereklidir');
    if (!data.address_line?.trim()) throw new Error('Adres gereklidir');
    if (!data.city?.trim()) throw new Error('İl gereklidir');
    if (!data.district?.trim()) throw new Error('İlçe gereklidir');

    // Check if this is the first address - make it default
    const { count } = await supabase
      .from('addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const isFirstAddress = count === 0;

    const { data: address, error } = await supabase
      .from('addresses')
      .insert({
        user_id: user.id,
        title: data.title.trim(),
        full_name: data.full_name.trim(),
        phone: data.phone.trim(),
        address_line: data.address_line.trim(),
        city: data.city.trim(),
        district: data.district.trim(),
        postal_code: data.postal_code?.trim() || null,
        is_default: data.is_default ?? isFirstAddress,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/account/addresses');

    return {
      data: address as Address,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('addAddress error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Adres eklenemedi',
      success: false,
    };
  }
}

/**
 * Update an existing address
 */
export async function updateAddress(
  addressId: string,
  data: Partial<AddressInsert>
): Promise<ApiResponse<Address>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.full_name !== undefined) updateData.full_name = data.full_name.trim();
    if (data.phone !== undefined) updateData.phone = data.phone.trim();
    if (data.address_line !== undefined) updateData.address_line = data.address_line.trim();
    if (data.city !== undefined) updateData.city = data.city.trim();
    if (data.district !== undefined) updateData.district = data.district.trim();
    if (data.postal_code !== undefined) updateData.postal_code = data.postal_code?.trim() || null;
    if (data.is_default !== undefined) updateData.is_default = data.is_default;

    const { data: address, error } = await supabase
      .from('addresses')
      .update(updateData)
      .eq('id', addressId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/account/addresses');

    return {
      data: address as Address,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateAddress error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Adres güncellenemedi',
      success: false,
    };
  }
}

/**
 * Delete an address
 */
export async function deleteAddress(
  addressId: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/account/addresses');

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('deleteAddress error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Adres silinemedi',
      success: false,
    };
  }
}

/**
 * Set an address as default
 */
export async function setDefaultAddress(
  addressId: string
): Promise<ApiResponse<Address>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/account/addresses');

    return {
      data: address as Address,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('setDefaultAddress error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Varsayılan adres ayarlanamadı',
      success: false,
    };
  }
}
