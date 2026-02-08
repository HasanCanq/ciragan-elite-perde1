'use server';

// =====================================================
// ADMIN CUSTOMERS SERVER ACTIONS
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { Profile, ApiResponse, PaginatedResponse } from '@/types';

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
// GET CUSTOMERS (Paginated with Search)
// =====================================================

export async function getCustomers(
  page = 1,
  pageSize = 20,
  search?: string
): Promise<ApiResponse<PaginatedResponse<Profile>>> {
  try {
    const { supabase } = await verifyAdmin();

    // Count query
    let countQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Data query
    const offset = (page - 1) * pageSize;
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    return {
      data: {
        data: profiles as Profile[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCustomers error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Müşteriler yüklenemedi',
      success: false,
    };
  }
}

// =====================================================
// GET CUSTOMER BY ID
// =====================================================

export async function getCustomerById(
  customerId: string
): Promise<ApiResponse<Profile>> {
  try {
    const { supabase } = await verifyAdmin();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) throw error;

    return {
      data: profile as Profile,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCustomerById error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Müşteri bulunamadı',
      success: false,
    };
  }
}

// =====================================================
// GET CUSTOMER STATS
// =====================================================

export interface CustomerStats {
  totalCustomers: number;
  totalAdmins: number;
  totalUsers: number;
  recentSignups: number; // Last 30 days
}

export async function getCustomerStats(): Promise<ApiResponse<CustomerStats>> {
  try {
    const { supabase } = await verifyAdmin();

    // Get total counts
    const { count: totalCustomers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const { count: totalAdmins } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'ADMIN');

    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'USER');

    // Get recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: recentSignups } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    return {
      data: {
        totalCustomers: totalCustomers || 0,
        totalAdmins: totalAdmins || 0,
        totalUsers: totalUsers || 0,
        recentSignups: recentSignups || 0,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCustomerStats error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'İstatistikler yüklenemedi',
      success: false,
    };
  }
}
