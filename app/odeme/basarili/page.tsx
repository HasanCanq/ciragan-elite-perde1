'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, Home, Phone } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

// useSearchParams() için Suspense boundary'ye ihtiyaç var (Next.js 14)
function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const isCreditCard = searchParams.get('method') === 'credit_card';

  const clearCart = useCartStore((state) => state.clearCart);

  // Kullanıcı gerçekten başarı sayfasına ulaştığında sepeti temizle.
  // Iyzico iframe'inde ödemeyi yarıda bırakıp geri dönerse sepet korunmuş olur.
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Success Icon */}
      <div className="inline-flex items-center justify-center w-24 h-24 border border-[#B89947]/30 mb-8">
        <CheckCircle className="w-12 h-12 text-[#B89947]" />
      </div>

      {/* Title */}
      <h1 className="font-serif text-3xl lg:text-4xl font-medium text-black mb-4">
        Siparişiniz Alındı!
      </h1>

      <p className="text-[#9CA3AF] text-lg mb-8">
        Siparişiniz başarıyla oluşturuldu. En kısa sürede sizinle iletişime
        geçeceğiz.
      </p>

      {/* Order Number */}
      {orderNumber && (
        <div className="bg-white border border-[#F3F4F6] p-6 mb-8">
          <p className="text-sm text-[#9CA3AF] mb-2">Sipariş Numaranız</p>
          <p className="font-mono text-2xl font-bold text-[#B89947]">
            {orderNumber}
          </p>
          <p className="text-sm text-[#9CA3AF] mt-4">
            Bu numarayı saklayın. Siparişinizi takip etmek için kullanabilirsiniz.
          </p>
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-white border border-[#F3F4F6] p-6 mb-8 text-left">
        <h2 className="font-serif text-lg font-medium text-black mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-[#B89947]" />
          Sonraki Adımlar
        </h2>

        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 border border-[#B89947]/40 text-[#B89947] font-medium text-[11px] flex items-center justify-center">
              1
            </span>
            <div>
              <p className="font-medium text-black">Sipariş Onayı</p>
              <p className="text-sm text-[#9CA3AF]">
                E-posta adresinize sipariş onay maili gönderilecektir.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 border border-[#B89947]/40 text-[#B89947] font-medium text-[11px] flex items-center justify-center">
              2
            </span>
            <div>
              <p className="font-medium text-black">Ödeme</p>
              <p className="text-sm text-[#9CA3AF]">
                {isCreditCard
                  ? 'Kredi kartı ödemeniz başarıyla alınmıştır. Siparişiniz doğrudan üretime alınacaktır.'
                  : 'Havale/EFT ile ödeme yapacaksanız, banka bilgilerimiz e-posta ile iletilecektir.'}
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 border border-[#B89947]/40 text-[#B89947] font-medium text-[11px] flex items-center justify-center">
              3
            </span>
            <div>
              <p className="font-medium text-black">Üretim</p>
              <p className="text-sm text-[#9CA3AF]">
                Ödemeniz onaylandıktan sonra siparişiniz üretime alınacaktır.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 border border-[#B89947]/40 text-[#B89947] font-medium text-[11px] flex items-center justify-center">
              4
            </span>
            <div>
              <p className="font-medium text-black">Kargo</p>
              <p className="text-sm text-[#9CA3AF]">
                Siparişiniz hazırlandığında kargo takip numarası ile bilgilendirileceksiniz.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* Contact Info */}
      <div className="bg-[#FAFAFA] rounded-xl p-6 mb-8">
        <p className="text-[#9CA3AF] mb-2">Sorularınız için bize ulaşın:</p>
        <a
          href="tel:+902125551234"
          className="inline-flex items-center gap-2 text-[#B89947] font-medium hover:underline"
        >
          <Phone className="w-5 h-5" />
          0212 555 12 34
        </a>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/account/orders"
          className="h-btn inline-flex items-center justify-center gap-2"
        >
          Siparişlerimi Görüntüle
          <ArrowRight className="w-5 h-5" />
        </Link>

        <Link
          href="/"
          className="h-btn-outline inline-flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="h-container py-16 lg:py-24">
        <Suspense fallback={
          <div className="max-w-2xl mx-auto text-center">
            <div className="animate-pulse space-y-6">
              <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto" />
              <div className="h-8 bg-gray-200 rounded w-64 mx-auto" />
              <div className="h-48 bg-gray-200 rounded" />
            </div>
          </div>
        }>
          <OrderSuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
