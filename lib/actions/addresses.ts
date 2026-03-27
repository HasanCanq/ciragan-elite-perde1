'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { type ApiResponse } from '@/types';

// ── Tipler ─────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  user_id: string;
  title: string;
  first_name: string;
  last_name: string;
  phone: string;
  address_line: string;
  neighbourhood: string | null;
  district: string;
  city: string;
  postal_code: string | null;
  billing_type: 'INDIVIDUAL' | 'CORPORATE';
  tax_number: string | null;
  tax_office: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ── Zod şeması ─────────────────────────────────────────────────────────────

const TR_PHONE = /^(\+90|0090|90)?0?5\d{9}$|^05\d{9}$/;

const addressSchema = z
  .object({
    title:         z.string().min(1).max(100),
    first_name:    z.string().min(2, 'Ad en az 2 karakter olmalıdır').max(150),
    last_name:     z.string().max(150).default(''),
    phone:         z.string().regex(TR_PHONE, 'Geçerli bir Türkiye telefon numarası girin'),
    address_line:  z.string().min(10, 'Açık adres en az 10 karakter olmalıdır').max(500),
    neighbourhood: z.string().max(150).optional().or(z.literal('')),
    district:      z.string().min(2, 'İlçe zorunludur').max(100),
    city:          z.string().min(2, 'İl zorunludur').max(100),
    postal_code:   z
      .string()
      .regex(/^\d{5}$/, 'Posta kodu 5 haneli rakam olmalıdır')
      .optional()
      .or(z.literal('')),
    billing_type:  z.enum(['INDIVIDUAL', 'CORPORATE']).default('INDIVIDUAL'),
    tax_number:    z.string().max(11).optional().or(z.literal('')),
    tax_office:    z.string().max(150).optional().or(z.literal('')),
    company_name:  z.string().max(255).optional().or(z.literal('')),
    is_default:    z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.billing_type !== 'CORPORATE') return;
    if (!d.tax_number || !/^\d{10}$/.test(d.tax_number)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tax_number'], message: 'Kurumsal için 10 haneli VKN zorunludur' });
    }
    if (!d.tax_office || d.tax_office.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tax_office'], message: 'Kurumsal için vergi dairesi zorunludur' });
    }
  });

export type AddressInput = z.input<typeof addressSchema>;

// ── Yardımcı ───────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// ── Server Actions ─────────────────────────────────────────────────────────

export async function getAddresses(): Promise<ApiResponse<Address[]>> {
  try {
    const { supabase, user } = await getAuthUser();
    if (!user) return { success: false, data: null, error: 'Oturum açılmamış' };

    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data ?? []) as Address[], error: null };
  } catch (err) {
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Adresler yüklenemedi' };
  }
}

export async function createAddress(raw: AddressInput): Promise<ApiResponse<Address>> {
  try {
    const { supabase, user } = await getAuthUser();
    if (!user) return { success: false, data: null, error: 'Oturum açılmamış' };

    const parsed = addressSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Geçersiz form verisi';
      return { success: false, data: null, error: msg };
    }
    const d = parsed.data;

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id:       user.id,
        title:         d.title,
        first_name:    d.first_name,
        last_name:     d.last_name,
        phone:         d.phone,
        address_line:  d.address_line,
        neighbourhood: d.neighbourhood || null,
        district:      d.district,
        city:          d.city,
        postal_code:   d.postal_code || null,
        billing_type:  d.billing_type,
        tax_number:    d.tax_number || null,
        tax_office:    d.tax_office || null,
        is_default:    d.is_default,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/account/addresses');
    return { success: true, data: data as Address, error: null };
  } catch (err) {
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Adres eklenemedi' };
  }
}

export async function updateAddress(id: string, raw: AddressInput): Promise<ApiResponse<Address>> {
  try {
    const { supabase, user } = await getAuthUser();
    if (!user) return { success: false, data: null, error: 'Oturum açılmamış' };

    const parsed = addressSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Geçersiz form verisi';
      return { success: false, data: null, error: msg };
    }
    const d = parsed.data;

    const { data, error } = await supabase
      .from('addresses')
      .update({
        title:         d.title,
        first_name:    d.first_name,
        last_name:     d.last_name,
        phone:         d.phone,
        address_line:  d.address_line,
        neighbourhood: d.neighbourhood || null,
        district:      d.district,
        city:          d.city,
        postal_code:   d.postal_code || null,
        billing_type:  d.billing_type,
        tax_number:    d.tax_number || null,
        tax_office:    d.tax_office || null,
        is_default:    d.is_default,
      })
      .eq('id', id)
      .eq('user_id', user.id)   // RLS + explicit check
      .select()
      .single();

    if (error) throw error;
    if (!data) return { success: false, data: null, error: 'Adres bulunamadı' };

    revalidatePath('/account/addresses');
    return { success: true, data: data as Address, error: null };
  } catch (err) {
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Adres güncellenemedi' };
  }
}

export async function deleteAddress(id: string): Promise<ApiResponse<null>> {
  try {
    const { supabase, user } = await getAuthUser();
    if (!user) return { success: false, data: null, error: 'Oturum açılmamış' };

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/account/addresses');
    return { success: true, data: null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Adres silinemedi' };
  }
}

export async function setDefaultAddress(id: string): Promise<ApiResponse<null>> {
  try {
    const { supabase, user } = await getAuthUser();
    if (!user) return { success: false, data: null, error: 'Oturum açılmamış' };

    // DB trigger (ensure_single_default) zaten diğerlerini false yapar.
    // Ek güvence: sadece kendi adresi mi kontrolü
    const { error } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/account/addresses');
    return { success: true, data: null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err instanceof Error ? err.message : 'Varsayılan adres ayarlanamadı' };
  }
}
