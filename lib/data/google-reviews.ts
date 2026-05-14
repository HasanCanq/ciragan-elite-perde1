import { cache } from 'react';
import { getPublicSupabase } from '@/lib/supabase/public';
import type { GoogleReview, GooglePlaceSummary } from '@/types';

export const getGoogleReviews = cache(async (): Promise<GoogleReview[]> => {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('google_reviews_cache')
    .select('*')
    .eq('is_visible', true)
    .order('time', { ascending: false });

  if (error) {
    console.error('[getGoogleReviews]', error);
    return [];
  }
  return (data ?? []) as GoogleReview[];
});

export const getGooglePlaceSummary = cache(async (): Promise<GooglePlaceSummary | null> => {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('google_place_cache')
    .select('total_rating, total_reviews, last_fetched_at')
    .order('last_fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getGooglePlaceSummary]', error);
    return null;
  }
  return data as GooglePlaceSummary | null;
});

export const getProductRatingSummaryPublic = cache(
  async (productId: string): Promise<{ average: number; count: number }> => {
    const supabase = getPublicSupabase();
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', productId);

    if (error || !data || data.length === 0) return { average: 0, count: 0 };

    const count = data.length;
    const average = data.reduce((sum, r) => sum + r.rating, 0) / count;
    return { average: Math.round(average * 10) / 10, count };
  }
);
