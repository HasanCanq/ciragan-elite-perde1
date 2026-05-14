import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlacesApiReview {
  name: string;
  relativePublishTimeDescription?: string;
  rating: number;
  text?: { text: string; languageCode: string };
  authorAttribution: {
    displayName: string;
    uri?: string;
    photoUri?: string;
  };
  publishTime?: string;
}

interface PlacesApiResponse {
  reviews?: PlacesApiReview[];
  rating?: number;
  userRatingCount?: number;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!cronSecret || token !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey  = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return NextResponse.json(
      { error: 'GOOGLE_PLACES_API_KEY veya GOOGLE_PLACE_ID eksik' },
      { status: 500 }
    );
  }

  const startTime = Date.now();

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error('[sync-google-reviews] Google API hatası:', res.status, body);
      return NextResponse.json(
        { error: 'Google API hatası', status: res.status },
        { status: 502 }
      );
    }

    const placesData: PlacesApiResponse = await res.json();
    const supabase = await createClient();
    const now = new Date().toISOString();

    if (placesData.rating !== undefined && placesData.userRatingCount !== undefined) {
      const { error: placeError } = await supabase.from('google_place_cache').insert({
        place_id:       placeId,
        total_rating:   placesData.rating,
        total_reviews:  placesData.userRatingCount,
        last_fetched_at: now,
        raw_response:   {
          rating:          placesData.rating,
          userRatingCount: placesData.userRatingCount,
        },
      });

      if (placeError) {
        console.error('[sync-google-reviews] place_cache kayıt hatası:', placeError);
      }
    }

    let synced  = 0;
    let skipped = 0;

    for (const review of placesData.reviews ?? []) {
      const unix = review.publishTime
        ? Math.floor(new Date(review.publishTime).getTime() / 1000)
        : null;

      const { error } = await supabase.from('google_reviews_cache').upsert(
        {
          google_review_id: review.name,
          author_name:      review.authorAttribution.displayName,
          author_url:       review.authorAttribution.uri ?? null,
          profile_photo:    review.authorAttribution.photoUri ?? null,
          rating:           review.rating,
          text:             review.text?.text ?? null,
          time:             unix,
          relative_time:    review.relativePublishTimeDescription ?? null,
          language:         review.text?.languageCode ?? 'tr',
          fetched_at:       now,
        },
        { onConflict: 'google_review_id' }
      );

      if (error) {
        console.error('[sync-google-reviews] Yorum kaydedilemedi:', review.name, error);
        skipped++;
      } else {
        synced++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[sync-google-reviews] Tamamlandı | synced=${synced} skipped=${skipped} duration=${duration}ms`
    );

    return NextResponse.json({ success: true, synced, skipped, duration });
  } catch (err) {
    console.error('[sync-google-reviews] Kritik hata:', err);
    return NextResponse.json(
      { error: 'İşlem başarısız', duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}
