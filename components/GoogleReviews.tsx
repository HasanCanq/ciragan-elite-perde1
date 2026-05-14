import Image from 'next/image';
import { getGoogleReviews, getGooglePlaceSummary } from '@/lib/data/google-reviews';
import type { GoogleReview } from '@/types';

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rating ? '#FBBC04' : 'none'}
          stroke={star <= rating ? '#FBBC04' : '#D1D5DB'}
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: GoogleReview }) {
  return (
    <div className="border border-[#1A1A1A]/10 p-6 bg-white">
      <div className="flex items-start gap-4 mb-4">
        {review.profile_photo ? (
          <Image
            src={review.profile_photo}
            alt={review.author_name}
            width={40}
            height={40}
            className="rounded-full flex-shrink-0 object-cover"
            unoptimized
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex-shrink-0 flex items-center justify-center">
            <span className="text-[12px] text-[#9CA3AF] font-medium uppercase">
              {review.author_name.charAt(0)}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-black tracking-[0.02em] truncate">
            {review.author_name}
          </p>
          {review.relative_time && (
            <p className="text-[10px] text-[#9CA3AF] tracking-[0.06em] mt-0.5">
              {review.relative_time}
            </p>
          )}
        </div>
      </div>

      <StarRow rating={review.rating} size={14} />

      {review.text && (
        <p className="mt-3 text-[12px] text-[#4A4A4A] leading-[1.75] tracking-[0.02em] line-clamp-4">
          {review.text}
        </p>
      )}
    </div>
  );
}

export default async function GoogleReviews() {
  const [reviews, summary] = await Promise.all([
    getGoogleReviews(),
    getGooglePlaceSummary(),
  ]);

  if (reviews.length === 0 && !summary) return null;

  return (
    <section className="border-t border-[#1A1A1A]/10 pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[9px] tracking-[0.3em] uppercase text-[#9CA3AF] mb-2">
            Müşteri Yorumları
          </p>
          <div className="flex items-center gap-3">
            <span className="font-['Cinzel',_serif] text-[#1A1A1A] text-[18px] tracking-[0.04em]">
              Google Yorumları
            </span>
            {summary?.total_rating && (
              <div className="flex items-center gap-2">
                <StarRow rating={Math.round(Number(summary.total_rating))} size={16} />
                <span className="text-[13px] font-medium text-black">
                  {Number(summary.total_rating).toFixed(1)}
                </span>
                {summary.total_reviews && (
                  <span className="text-[11px] text-[#9CA3AF]">
                    ({summary.total_reviews} yorum)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <svg width="20" height="20" viewBox="0 0 24 24" aria-label="Google">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      </div>

      {reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </section>
  );
}
