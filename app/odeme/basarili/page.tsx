import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, Home, Phone } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ order?: string; method?: string }>;
}

export default async function OrderSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const orderNumber = params.order;
  const isCreditCard = params.method === 'credit_card';

  return (
    <div className="bg-elite-bone min-h-screen">
      <div className="elite-container py-16 lg:py-24">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-8">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-elite-black mb-4">
            Siparişiniz Alındı!
          </h1>

          <p className="text-elite-gray text-lg mb-8">
            Siparişiniz başarıyla oluşturuldu. En kısa sürede sizinle iletişime
            geçeceğiz.
          </p>

          {/* Order Number */}
          {orderNumber && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <p className="text-sm text-elite-gray mb-2">Sipariş Numaranız</p>
              <p className="font-mono text-2xl font-bold text-elite-gold">
                {orderNumber}
              </p>
              <p className="text-sm text-elite-gray mt-4">
                Bu numarayı saklayın. Siparişinizi takip etmek için kullanabilirsiniz.
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8 text-left">
            <h2 className="font-serif text-lg font-semibold text-elite-black mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-elite-gold" />
              Sonraki Adımlar
            </h2>

            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-elite-gold/20 text-elite-gold font-semibold text-sm flex items-center justify-center">
                  1
                </span>
                <div>
                  <p className="font-medium text-elite-black">Sipariş Onayı</p>
                  <p className="text-sm text-elite-gray">
                    E-posta adresinize sipariş onay maili gönderilecektir.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-elite-gold/20 text-elite-gold font-semibold text-sm flex items-center justify-center">
                  2
                </span>
                <div>
                  <p className="font-medium text-elite-black">Ödeme</p>
                  <p className="text-sm text-elite-gray">
                    {isCreditCard
                      ? 'Kredi kartı ödemeniz başarıyla alınmıştır. Siparişiniz doğrudan üretime alınacaktır.'
                      : 'Havale/EFT ile ödeme yapacaksanız, banka bilgilerimiz e-posta ile iletilecektir.'}
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-elite-gold/20 text-elite-gold font-semibold text-sm flex items-center justify-center">
                  3
                </span>
                <div>
                  <p className="font-medium text-elite-black">Üretim</p>
                  <p className="text-sm text-elite-gray">
                    Ödemeniz onaylandıktan sonra siparişiniz üretime alınacaktır.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-elite-gold/20 text-elite-gold font-semibold text-sm flex items-center justify-center">
                  4
                </span>
                <div>
                  <p className="font-medium text-elite-black">Kargo</p>
                  <p className="text-sm text-elite-gray">
                    Siparişiniz hazırlandığında kargo takip numarası ile bilgilendirileceksiniz.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Contact Info */}
          <div className="bg-elite-gold/10 rounded-xl p-6 mb-8">
            <p className="text-elite-gray mb-2">Sorularınız için bize ulaşın:</p>
            <a
              href="tel:+902125551234"
              className="inline-flex items-center gap-2 text-elite-gold font-semibold hover:underline"
            >
              <Phone className="w-5 h-5" />
              0212 555 12 34
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/account/orders"
              className="elite-button inline-flex items-center justify-center gap-2"
            >
              Siparişlerimi Görüntüle
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3
                       border border-elite-black text-elite-black rounded-lg
                       hover:bg-elite-black hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
