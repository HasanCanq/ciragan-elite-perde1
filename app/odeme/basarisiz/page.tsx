import Link from 'next/link';
import { XCircle, ArrowLeft, Phone, RefreshCw } from 'lucide-react';

export const revalidate = 0; // Kullanıcıya özel, dinamik

const REASON_MESSAGES: Record<string, string> = {
  '3ds_failed': '3D Secure doğrulama başarısız oldu. Bankanız işlemi onaylamadı.',
  payment_failed: 'Ödeme işlemi başarısız oldu. Lütfen kart bilgilerinizi kontrol edin.',
  amount_mismatch: 'Ödeme tutarı uyuşmazlığı tespit edildi. Güvenlik nedeniyle işlem iptal edildi.',
  unknown: 'Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.',
};

export default function PaymentFailurePage({
  searchParams,
}: {
  searchParams: { order?: string; reason?: string };
}) {
  const orderNumber = searchParams.order;
  const reason = searchParams.reason || 'unknown';
  const message = REASON_MESSAGES[reason] || REASON_MESSAGES.unknown;

  return (
    <div className="bg-white min-h-screen">
      <div className="h-container py-12 lg:py-20">
        <div className="max-w-lg mx-auto text-center">
          {/* Icon */}
          <div className="w-20 h-20 border border-red-200 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>

          {/* Title */}
          <h1 className="font-serif text-2xl lg:text-3xl font-medium text-black mb-3">
            Ödeme Başarısız
          </h1>

          {/* Order Number */}
          {orderNumber && (
            <p className="text-[#9CA3AF] mb-4">
              Sipariş No:{' '}
              <span className="font-mono font-medium text-black">
                {orderNumber}
              </span>
            </p>
          )}

          {/* Error Message */}
          <div className="bg-red-50 border border-red-200 p-4 mb-8">
            <p className="text-red-600 text-[13px]">{message}</p>
          </div>

          {/* Info */}
          <div className="border border-[#F3F4F6] p-6 mb-8 text-left">
            <h3 className="font-medium text-black mb-3 text-[13px] tracking-[0.02em]">
              Ne yapabilirsiniz?
            </h3>
            <ul className="space-y-2 text-[13px] text-[#9CA3AF]">
              <li className="flex items-start gap-2">
                <span className="text-[#B89947] mt-0.5">1.</span>
                Kart bilgilerinizi kontrol edip tekrar deneyin
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#B89947] mt-0.5">2.</span>
                Farklı bir kart ile ödeme yapmayı deneyin
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#B89947] mt-0.5">3.</span>
                Havale/EFT veya kapıda ödeme seçeneklerini kullanın
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#B89947] mt-0.5">4.</span>
                Sorun devam ederse bizimle iletişime geçin
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sepet"
              className="h-btn inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Tekrar Dene
            </Link>

            <Link
              href="/"
              className="h-btn-outline inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Ana Sayfaya Dön
            </Link>
          </div>

          {/* Contact */}
          <div className="mt-8 pt-6 border-t border-[#F3F4F6]">
            <p className="text-[13px] text-[#9CA3AF] mb-2">
              Yardıma mı ihtiyacınız var?
            </p>
            <a
              href="tel:+905551234567"
              className="inline-flex items-center gap-2 text-[#B89947] hover:underline text-[13px]"
            >
              <Phone className="w-4 h-4" />
              0555 123 45 67
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
