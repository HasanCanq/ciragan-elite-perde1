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

const EMPTY_CUSTOMER_STATS: CustomerStats = {
  totalCustomers: 0,
  totalAdmins: 0,
  totalUsers: 0,
  recentSignups: 0,
};

export async function getCustomerStats(): Promise<ApiResponse<CustomerStats>> {
  try {
    const { supabase } = await verifyAdmin();

    // 1. Try RPC (production — single round-trip)
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'get_customer_overview_stats'
      );
      if (!rpcError && rpcData) {
        return {
          data: {
            totalCustomers: rpcData.total_customers ?? 0,
            totalAdmins:    rpcData.total_admins    ?? 0,
            totalUsers:     rpcData.total_users     ?? 0,
            recentSignups:  rpcData.recent_signups  ?? 0,
          },
          error: null,
          success: true,
        };
      }
    } catch { /* RPC not in test DB — fall through */ }

    // 2. Parallel fallback
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      { count: totalCustomers },
      { count: totalAdmins },
      { count: totalUsers },
      { count: recentSignups },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'ADMIN'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'USER'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    return {
      data: {
        totalCustomers: totalCustomers || 0,
        totalAdmins:    totalAdmins    || 0,
        totalUsers:     totalUsers     || 0,
        recentSignups:  recentSignups  || 0,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCustomerStats error:', error);
    // 3. Zero fallback — never crash the dashboard
    return { data: EMPTY_CUSTOMER_STATS, error: null, success: true };
  }
}

// =====================================================
// CUSTOMER 360 — Tek müşterinin tam profili
// =====================================================

export interface Customer360 {
  profile: Profile;
  // KPI'lar
  totalOrders: number;
  totalSpent: number;
  cancelledOrders: number;
  cancellationRate: number; // 0–100
  avgOrderValue: number;
  // Son 5 sipariş
  recentOrders: {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    created_at: string;
  }[];
}

export async function getCustomer360(
  customerId: string
): Promise<ApiResponse<Customer360>> {
  try {
    const { supabase } = await verifyAdmin();

    // 1. Try RPC (production)
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'get_customer_360',
        { p_customer_id: customerId }
      );
      if (!rpcError && rpcData) {
        return { data: rpcData as Customer360, error: null, success: true };
      }
    } catch { /* RPC not in test DB */ }

    // 2. Parallel fallback
    const [profileResult, ordersResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', customerId).single(),
      supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('user_id', customerId)
        .order('created_at', { ascending: false })
        .limit(100), // enough for accurate KPIs
    ]);

    if (profileResult.error || !profileResult.data) {
      return { data: null, error: 'Müşteri bulunamadı', success: false };
    }

    const orders = (ordersResult.data || []) as {
      id: string;
      order_number: string;
      status: string;
      total_amount: number;
      created_at: string;
    }[];

    const totalOrders     = orders.length;
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;
    const totalSpent      = orders
      .filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status))
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const avgOrderValue   = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const cancellationRate = totalOrders > 0
      ? Math.round((cancelledOrders / totalOrders) * 100)
      : 0;

    return {
      data: {
        profile: profileResult.data as Profile,
        totalOrders,
        totalSpent,
        cancelledOrders,
        cancellationRate,
        avgOrderValue,
        recentOrders: orders.slice(0, 5),
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCustomer360 error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Müşteri verisi yüklenemedi',
      success: false,
    };
  }
}
