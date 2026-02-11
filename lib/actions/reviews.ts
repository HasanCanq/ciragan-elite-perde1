'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ApiResponse, ReviewWithUser } from '@/types';

// Ürünün yorumlarını getir (profil bilgisiyle)
export async function getProductReviews(
  productId: string
): Promise<ApiResponse<ReviewWithUser[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reviews')
      .select('*, profile:profiles(full_name, email)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      data: data as ReviewWithUser[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProductReviews error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Yorumlar yüklenemedi',
      success: false,
    };
  }
}

// Ürünün puan özetini getir
export async function getProductRatingSummary(
  productId: string
): Promise<ApiResponse<{ average: number; count: number }>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', productId);

    if (error) throw error;

    const count = data?.length || 0;
    const average =
      count > 0
        ? data.reduce((sum, r) => sum + r.rating, 0) / count
        : 0;

    return {
      data: { average: Math.round(average * 10) / 10, count },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProductRatingSummary error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Puan özeti alınamadı',
      success: false,
    };
  }
}

// Yorum ekle
export async function addReview(
  productId: string,
  rating: number,
  comment: string
): Promise<ApiResponse<ReviewWithUser>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: 'Yorum yapmak için giriş yapmalısınız',
        success: false,
      };
    }

    if (rating < 1 || rating > 5) {
      return {
        data: null,
        error: 'Puan 1 ile 5 arasında olmalıdır',
        success: false,
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('reviews')
      .insert({
        product_id: productId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return {
          data: null,
          error: 'Bu ürüne zaten yorum yapmışsınız',
          success: false,
        };
      }
      throw insertError;
    }

    // Profil bilgisiyle birlikte getir
    const { data } = await supabase
      .from('reviews')
      .select('*, profile:profiles(full_name, email)')
      .eq('id', inserted.id)
      .single();

    revalidatePath(`/urun`);

    return {
      data: (data || inserted) as ReviewWithUser,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('addReview error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Yorum eklenemedi',
      success: false,
    };
  }
}

// Kendi yorumunu güncelle
export async function updateReview(
  reviewId: string,
  rating: number,
  comment: string
): Promise<ApiResponse<ReviewWithUser>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'Giriş yapmalısınız', success: false };
    }

    if (rating < 1 || rating > 5) {
      return { data: null, error: 'Puan 1 ile 5 arasında olmalıdır', success: false };
    }

    const { data: updated, error: updateError } = await supabase
      .from('reviews')
      .update({
        rating,
        comment: comment.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Profil bilgisiyle birlikte getir
    const { data } = await supabase
      .from('reviews')
      .select('*, profile:profiles(full_name, email)')
      .eq('id', updated.id)
      .single();

    revalidatePath(`/urun`);

    return {
      data: (data || updated) as ReviewWithUser,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateReview error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Yorum güncellenemedi',
      success: false,
    };
  }
}

// Kendi yorumunu sil
export async function deleteReview(
  reviewId: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'Giriş yapmalısınız', success: false };
    }

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath(`/urun`);

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('deleteReview error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Yorum silinemedi',
      success: false,
    };
  }
}

// Giriş yapmış kullanıcının bu ürüne verdiği yorumu getir
export async function getUserReview(
  productId: string
): Promise<ApiResponse<ReviewWithUser | null>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'NOT_AUTHENTICATED', success: false };
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('*, profile:profiles(full_name, email)')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return {
      data: data as ReviewWithUser | null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getUserReview error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Yorum bilgisi alınamadı',
      success: false,
    };
  }
}
