'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Building,
  Truck,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { placeOrder, validateOrder, getServerCalculatedPrices } from '@/lib/actions/checkout';
import { initiateCreditCardPayment } from '@/lib/actions/payment';
import { syncCart } from '@/lib/actions/cart';
import { formatPrice } from '@/lib/utils';
import { PILE_LABELS_UPPER, SHIPPING, CheckoutFormData, CreditCardData } from '@/types';
import { createClient } from '@/lib/supabase/client';

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Server-side hesaplanmış fiyatlar
  const [serverPrices, setServerPrices] = useState<{
    subtotal: number;
    shippingCost: number;
    total: number;
  } | null>(null);

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const getCartSummary = useCartStore((state) => state.getCartSummary);

  // Form state
  const [formData, setFormData] = useState<CheckoutFormData>({
    email: '',
    fullName: '',
    phone: '',
    shippingAddress: '',
    billingAddress: '',
    sameAsBilling: true,
    customerNote: '',
    paymentMethod: 'bank_transfer',
  });

  // Kredi kartı state
  const [cardData, setCardData] = useState<CreditCardData>({
    cardHolderName: '',
    cardNumber: '',
    expireMonth: '',
    expireYear: '',
    cvc: '',
  });

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      // Get profile data to pre-fill form
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFormData((prev) => ({
          ...prev,
          email: profile.email || user.email || '',
          fullName: profile.full_name || '',
          phone: profile.phone || '',
          shippingAddress: profile.address || '',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          email: user.email || '',
        }));
      }
    };

    checkAuth();
  }, [supabase]);

  // Sepet değiştiğinde server-side fiyat doğrulama ve senkronizasyon
  useEffect(() => {
    if (!mounted || !isAuthenticated || items.length === 0) return;

    const validateAndSync = async () => {
      setIsValidating(true);
      setValidationErrors([]);

      try {
        // Sepeti server'a senkronize et
        await syncCart(items);

        // Server-side fiyatları al
        const pricesResult = await getServerCalculatedPrices(items);
        if (pricesResult.success && pricesResult.data) {
          setServerPrices({
            subtotal: pricesResult.data.subtotal,
            shippingCost: pricesResult.data.shippingCost,
            total: pricesResult.data.total,
          });
        }

        // Sipariş doğrulama (stok ve fiyat)
        const validationResult = await validateOrder(items);
        if (validationResult.success && validationResult.data) {
          if (!validationResult.data.valid) {
            setValidationErrors(validationResult.data.errors);
          }
        }
      } catch (err) {
        console.error('Validation error:', err);
      } finally {
        setIsValidating(false);
      }
    };

    validateAndSync();
  }, [mounted, isAuthenticated, items]);

  if (!mounted) {
    return (
      <div className="bg-elite-bone min-h-screen">
        <div className="elite-container py-8 lg:py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
            <div className="h-96 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Redirect to cart if empty
  if (items.length === 0) {
    return (
      <div className="bg-elite-bone min-h-screen">
        <div className="elite-container py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold text-elite-black mb-4">
            Sepetiniz Boş
          </h1>
          <p className="text-elite-gray mb-8">
            Ödeme yapabilmek için sepetinize ürün eklemeniz gerekmektedir.
          </p>
          <Link href="/" className="elite-button inline-flex">
            Alışverişe Başla
          </Link>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (isAuthenticated === false) {
    return (
      <div className="bg-elite-bone min-h-screen">
        <div className="elite-container py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold text-elite-black mb-4">
            Giriş Yapmanız Gerekiyor
          </h1>
          <p className="text-elite-gray mb-8">
            Sipariş verebilmek için lütfen giriş yapın veya kayıt olun.
          </p>
          <Link
            href={`/giris?redirect=/odeme`}
            className="elite-button inline-flex"
          >
            Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  const clientSummary = getCartSummary();
  // Server fiyatları varsa onları kullan, yoksa client fiyatlarını göster
  const displaySubtotal = serverPrices?.subtotal ?? clientSummary.subtotal;
  const displayShipping = serverPrices?.shippingCost ?? clientSummary.shippingCost;
  const displayTotal = serverPrices?.total ?? clientSummary.total;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Kart numarası formatlama (4'lü gruplar)
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'cardNumber') {
      setCardData(prev => ({ ...prev, cardNumber: formatCardNumber(value) }));
    } else {
      setCardData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Doğrulama hatası varsa işlemi durdur
      if (validationErrors.length > 0) {
        setError(`Sipariş doğrulama hatası: ${validationErrors.join(', ')}`);
        setIsLoading(false);
        return;
      }

      if (formData.paymentMethod === 'credit_card') {
        // Kart bilgisi kontrol
        const cleanCardNumber = cardData.cardNumber.replace(/\s/g, '');
        if (!cardData.cardHolderName || cleanCardNumber.length < 15 || !cardData.expireMonth || !cardData.expireYear || cardData.cvc.length < 3) {
          setError('Lütfen kart bilgilerini eksiksiz doldurun');
          setIsLoading(false);
          return;
        }

        // 3D Secure ödeme başlat
        const result = await initiateCreditCardPayment(items, formData, cardData);

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Ödeme başlatılamadı');
        }

        // 3DS HTML'i render et - banka sayfası gösterilir
        clearCart();
        document.open();
        document.write(result.data.threeDSHtmlContent);
        document.close();
        return;
      } else {
        // Havale/EFT veya Kapıda Ödeme
        const result = await placeOrder(items, formData);

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Sipariş oluşturulamadı');
        }

        clearCart();
        router.push(`/odeme/basarili?order=${result.data.orderNumber}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.'
      );
      setIsLoading(false);
    }
  };

  const hasValidationErrors = validationErrors.length > 0;

  return (
    <div className="bg-elite-bone min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="elite-container py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-elite-gray hover:text-elite-gold transition-colors"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <Link
              href="/sepet"
              className="text-elite-gray hover:text-elite-gold transition-colors"
            >
              Sepet
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <span className="text-elite-black font-medium">Ödeme</span>
          </nav>
        </div>
      </div>

      <div className="elite-container py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-elite-black">
            Ödeme
          </h1>
          <Link
            href="/sepet"
            className="text-sm text-elite-gray hover:text-elite-gold flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Sepete Dön
          </Link>
        </div>

        {/* Validation Errors */}
        {hasValidationErrors && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">Sipariş doğrulama hatası</p>
                <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* General Error */}
        {error && !hasValidationErrors && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Validating Indicator */}
        {isValidating && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <p className="text-blue-700">Sepet doğrulanıyor...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Information */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-serif text-lg font-semibold text-elite-black mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-elite-gold" />
                  İletişim Bilgileri
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-elite-gray mb-2">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg
                               focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                               transition-colors outline-none"
                      placeholder="Ad Soyad"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-elite-gray mb-2">
                      E-posta *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-elite-gray" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                                 focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                 transition-colors outline-none"
                        placeholder="ornek@email.com"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-elite-gray mb-2">
                      Telefon
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-elite-gray" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                                 focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                 transition-colors outline-none"
                        placeholder="0555 555 55 55"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-serif text-lg font-semibold text-elite-black mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-elite-gold" />
                  Teslimat Adresi
                </h2>

                <div>
                  <label className="block text-sm font-medium text-elite-gray mb-2">
                    Adres *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-elite-gray" />
                    <textarea
                      name="shippingAddress"
                      value={formData.shippingAddress}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                               focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                               transition-colors outline-none resize-none"
                      placeholder="Mahalle, Sokak, Bina No, Daire No, İlçe/İl"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="sameAsBilling"
                      checked={formData.sameAsBilling}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-elite-gold border-gray-300 rounded
                               focus:ring-elite-gold"
                    />
                    <span className="text-sm text-elite-gray">
                      Fatura adresi teslimat adresi ile aynı
                    </span>
                  </label>
                </div>

                {!formData.sameAsBilling && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-elite-gray mb-2">
                      Fatura Adresi *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-5 h-5 text-elite-gray" />
                      <textarea
                        name="billingAddress"
                        value={formData.billingAddress}
                        onChange={handleInputChange}
                        required={!formData.sameAsBilling}
                        rows={3}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg
                                 focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                 transition-colors outline-none resize-none"
                        placeholder="Fatura adresi"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-serif text-lg font-semibold text-elite-black mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-elite-gold" />
                  Ödeme Yöntemi
                </h2>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-elite-gold transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={formData.paymentMethod === 'bank_transfer'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-elite-gold border-gray-300 focus:ring-elite-gold"
                    />
                    <div>
                      <p className="font-medium text-elite-black">Havale / EFT</p>
                      <p className="text-sm text-elite-gray">
                        Banka havalesi ile ödeme
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-elite-gold transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash_on_delivery"
                      checked={formData.paymentMethod === 'cash_on_delivery'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-elite-gold border-gray-300 focus:ring-elite-gold"
                    />
                    <div>
                      <p className="font-medium text-elite-black">Kapıda Ödeme</p>
                      <p className="text-sm text-elite-gray">
                        Teslimat sırasında nakit veya kart ile ödeme
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-elite-gold transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="credit_card"
                      checked={formData.paymentMethod === 'credit_card'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-elite-gold border-gray-300 focus:ring-elite-gold"
                    />
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-elite-black">Kredi Kartı</p>
                        <p className="text-sm text-elite-gray">
                          3D Secure ile güvenli ödeme
                        </p>
                      </div>
                      <ShieldCheck className="w-5 h-5 text-green-500 ml-auto" />
                    </div>
                  </label>

                  {/* Kredi Kartı Formu */}
                  {formData.paymentMethod === 'credit_card' && (
                    <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-elite-gray mb-1.5">
                          Kart Üzerindeki İsim
                        </label>
                        <input
                          type="text"
                          name="cardHolderName"
                          value={cardData.cardHolderName}
                          onChange={handleCardChange}
                          required
                          placeholder="AD SOYAD"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg
                                   focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                   transition-colors outline-none uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-elite-gray mb-1.5">
                          Kart Numarası
                        </label>
                        <input
                          type="text"
                          name="cardNumber"
                          value={cardData.cardNumber}
                          onChange={handleCardChange}
                          required
                          maxLength={19}
                          placeholder="0000 0000 0000 0000"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg
                                   focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                   transition-colors outline-none font-mono tracking-wider"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-elite-gray mb-1.5">
                            Ay
                          </label>
                          <select
                            name="expireMonth"
                            value={cardData.expireMonth}
                            onChange={handleCardChange}
                            required
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg
                                     focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                     transition-colors outline-none bg-white"
                          >
                            <option value="">Ay</option>
                            {Array.from({ length: 12 }, (_, i) => {
                              const month = String(i + 1).padStart(2, '0');
                              return (
                                <option key={month} value={month}>
                                  {month}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-elite-gray mb-1.5">
                            Yıl
                          </label>
                          <select
                            name="expireYear"
                            value={cardData.expireYear}
                            onChange={handleCardChange}
                            required
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg
                                     focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                     transition-colors outline-none bg-white"
                          >
                            <option value="">Yıl</option>
                            {Array.from({ length: 11 }, (_, i) => {
                              const year = String(new Date().getFullYear() + i);
                              return (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-elite-gray mb-1.5">
                            CVC
                          </label>
                          <input
                            type="password"
                            name="cvc"
                            value={cardData.cvc}
                            onChange={handleCardChange}
                            required
                            maxLength={4}
                            placeholder="***"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg
                                     focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                                     transition-colors outline-none text-center font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Kart bilgileriniz 3D Secure ile güvenli şekilde işlenir.
                          Bilgileriniz sunucularımızda saklanmaz.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-serif text-lg font-semibold text-elite-black mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-elite-gold" />
                  Sipariş Notu (Opsiyonel)
                </h2>

                <textarea
                  name="customerNote"
                  value={formData.customerNote}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg
                           focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                           transition-colors outline-none resize-none"
                  placeholder="Siparişiniz ile ilgili özel istekleriniz varsa buraya yazabilirsiniz..."
                />
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                <h2 className="font-serif text-xl font-semibold text-elite-black mb-6">
                  Sipariş Özeti
                </h2>

                {/* Server Validated Badge */}
                {serverPrices && !isValidating && !hasValidationErrors && (
                  <div className="mb-4 p-2 bg-green-50 rounded-lg flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Fiyatlar doğrulandı</span>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-4 mb-6">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-16 h-16 bg-gradient-to-br from-elite-gold/20 to-elite-bone rounded-lg flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-elite-black text-sm truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-elite-gray">
                          {item.width}x{item.height}cm • {PILE_LABELS_UPPER[item.pileFactor]}
                        </p>
                        <p className="text-xs text-elite-gray">
                          x{item.quantity}
                        </p>
                      </div>
                      <p className="font-medium text-sm">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-3 text-sm border-t border-gray-100 pt-4">
                  <div className="flex justify-between">
                    <span className="text-elite-gray">Ara Toplam</span>
                    <span className="font-medium">{formatPrice(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-elite-gray">Kargo</span>
                    <span className="font-medium">
                      {displayShipping > 0 ? (
                        formatPrice(displayShipping)
                      ) : (
                        <span className="text-green-600">Ücretsiz</span>
                      )}
                    </span>
                  </div>
                  {displayShipping > 0 && (
                    <p className="text-xs text-elite-gray">
                      {formatPrice(SHIPPING.FREE_THRESHOLD - displaySubtotal)} daha
                      ekleyin, kargo bedava!
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-100 my-4 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-elite-black">Toplam</span>
                    <span className="font-serif text-2xl font-bold text-elite-gold">
                      {formatPrice(displayTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-elite-gray mt-1">KDV dahil</p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || isValidating || hasValidationErrors}
                  className="w-full elite-button justify-center mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isValidating ? (
                    'Doğrulanıyor...'
                  ) : hasValidationErrors ? (
                    'Hata - Sepeti Kontrol Edin'
                  ) : (
                    'Siparişi Tamamla'
                  )}
                </button>

                {/* Trust Badges */}
                <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-elite-gray">
                    <ShieldCheck className="w-5 h-5 text-elite-gold flex-shrink-0" />
                    <span>Güvenli ödeme ve 2 yıl garanti</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-elite-gray">
                    <Truck className="w-5 h-5 text-elite-gold flex-shrink-0" />
                    <span>Hızlı ve güvenli teslimat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
