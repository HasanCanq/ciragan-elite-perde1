'use client';

import { useState, useEffect } from 'react';
import { Star, Loader2, Trash2, Edit3, Send, LogIn } from 'lucide-react';
import Link from 'next/link';
import {
  getProductReviews,
  addReview,
  updateReview,
  deleteReview,
  getUserReview,
} from '@/lib/actions/reviews';
import { ReviewWithUser } from '@/types';

interface ProductReviewsProps {
  productId: string;
}

// Yıldız gösterici (sadece okuma)
function StarDisplay({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

// Tıklanabilir yıldız seçici
function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 ${
              star <= (hover || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myReview, setMyReview] = useState<ReviewWithUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    setIsLoading(true);

    const [reviewsResult, userReviewResult] = await Promise.all([
      getProductReviews(productId),
      getUserReview(productId),
    ]);

    if (reviewsResult.success && reviewsResult.data) {
      setReviews(reviewsResult.data);
    }

    if (userReviewResult.error === 'NOT_AUTHENTICATED') {
      setIsLoggedIn(false);
    } else {
      setIsLoggedIn(true);
      setMyReview(userReviewResult.data || null);

      if (userReviewResult.data) {
        setRating(userReviewResult.data.rating);
        setComment(userReviewResult.data.comment || '');
      }
    }

    setIsLoading(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Lütfen bir puan seçin');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let result;
    if (myReview && isEditing) {
      result = await updateReview(myReview.id, rating, comment);
    } else {
      result = await addReview(productId, rating, comment);
    }

    if (result.success && result.data) {
      setMyReview(result.data);
      setIsEditing(false);

      // Listeyi güncelle
      if (myReview) {
        setReviews((prev) =>
          prev.map((r) => (r.id === result.data!.id ? result.data! : r))
        );
      } else {
        setReviews((prev) => [result.data!, ...prev]);
      }
    } else {
      setError(result.error || 'Bir hata oluştu');
    }

    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!myReview) return;

    setIsSubmitting(true);
    const result = await deleteReview(myReview.id);

    if (result.success) {
      setReviews((prev) => prev.filter((r) => r.id !== myReview.id));
      setMyReview(null);
      setRating(0);
      setComment('');
      setIsEditing(false);
    } else {
      setError(result.error || 'Yorum silinemedi');
    }

    setIsSubmitting(false);
  };

  // Ortalama puan hesapla
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-elite-gold animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header: Özet */}
      <div className="p-6 lg:p-8 border-b border-gray-100">
        <h2 className="font-serif text-2xl font-semibold text-elite-black mb-4">
          Değerlendirmeler
        </h2>

        <div className="flex items-center gap-6">
          {/* Büyük puan */}
          <div className="text-center">
            <p className="font-serif text-4xl font-bold text-elite-gold">
              {avgRating > 0 ? avgRating.toFixed(1) : '-'}
            </p>
            <StarDisplay rating={Math.round(avgRating)} size="w-5 h-5" />
            <p className="text-sm text-elite-gray mt-1">
              {reviews.length} değerlendirme
            </p>
          </div>

          {/* Puan dağılımı */}
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-elite-gray">{star}</span>
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-elite-gray">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Yorum Formu */}
      <div className="p-6 lg:p-8 border-b border-gray-100 bg-elite-bone/30">
        {isLoggedIn === false ? (
          <div className="text-center py-4">
            <p className="text-elite-gray mb-3">
              Değerlendirme yapmak için giriş yapın
            </p>
            <Link
              href="/giris"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-elite-gold text-white rounded-lg hover:bg-elite-gold/90 transition-colors font-medium"
            >
              <LogIn className="w-4 h-4" />
              Giriş Yap
            </Link>
          </div>
        ) : myReview && !isEditing ? (
          /* Kendi yorumu göster */
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-elite-black">
                Değerlendirmeniz
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-sm text-elite-gold hover:underline"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Düzenle
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 text-sm text-red-500 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sil
                </button>
              </div>
            </div>
            <StarDisplay rating={myReview.rating} size="w-5 h-5" />
            {myReview.comment && (
              <p className="text-elite-gray mt-2">{myReview.comment}</p>
            )}
          </div>
        ) : (
          /* Yorum yazma / düzenleme formu */
          <form onSubmit={handleSubmit}>
            <p className="text-sm font-medium text-elite-black mb-3">
              {isEditing ? 'Değerlendirmenizi Düzenleyin' : 'Değerlendirme Yazın'}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-3">
                {error}
              </div>
            )}

            <div className="mb-4">
              <StarSelector value={rating} onChange={setRating} />
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ürün hakkında düşüncelerinizi paylaşın... (Opsiyonel)"
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg
                       focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                       transition-colors outline-none resize-none"
            />

            <div className="flex items-center justify-end gap-3 mt-3">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setRating(myReview?.rating || 0);
                    setComment(myReview?.comment || '');
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  İptal
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-elite-gold text-white rounded-lg
                         hover:bg-elite-gold/90 transition-colors font-medium
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isEditing ? 'Güncelle' : 'Gönder'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Yorum Listesi */}
      <div className="p-6 lg:p-8">
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <Star className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-elite-gray">
              Henüz değerlendirme yapılmamış. İlk değerlendiren siz olun!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="pb-6 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      {/* Kullanıcı avatarı */}
                      <div className="w-8 h-8 rounded-full bg-elite-gold/20 flex items-center justify-center text-elite-gold font-bold text-sm">
                        {(
                          review.profile?.full_name?.[0] ||
                          review.profile?.email?.[0] ||
                          '?'
                        ).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-elite-black text-sm">
                          {review.profile?.full_name || 'Anonim'}
                        </p>
                        <StarDisplay rating={review.rating} />
                      </div>
                    </div>
                  </div>
                  <time className="text-xs text-elite-gray flex-shrink-0">
                    {new Date(review.created_at).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                {review.comment && (
                  <p className="text-elite-gray mt-2 ml-11 text-sm leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
