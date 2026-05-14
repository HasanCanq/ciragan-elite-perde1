'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Building2,
  Truck,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  BookOpen,
  Star,
  Tag,
  X,
  UserCheck,
  LogIn,
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { validateOrder, getServerCalculatedPrices } from '@/lib/actions/checkout';
import { type CheckoutFormInput } from '@/lib/validations/checkout';
import { initiateCheckoutFormPayment } from '@/lib/actions/payment';
import { applyCouponAction } from '@/lib/actions/coupon';
import type { AppliedCoupon } from '@/lib/promotions/types';
import { syncCart } from '@/lib/actions/cart';
import IyzicoCheckoutForm from '@/components/payment/IyzicoCheckoutForm';
import LegalModal, { type LegalModalCustomerData } from '@/components/LegalModal';
import { formatPrice } from '@/lib/utils';
import { PILE_LABELS_UPPER, SHIPPING } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { CITY_NAMES, getDistricts } from '@/lib/data/turkey-cities';

// ── Yerel tipler ──────────────────────────────────────────────────────────────

interface SavedAddress {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  phone: string;
  address_line: string;
  neighbourhood: string | null;
  district: string;
  city: string;
  postal_code: string | null;
  billing_type: 'INDIVIDUAL' | 'CORPORATE';
  tax_number: string | null;
  tax_office: string | null;
  is_default: boolean;
}

interface LegalDoc {
  id: string;
  document_type: string;
  version: string;
  content_url: string | null;
}

interface AddressForm {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine: string;
  neighbourhood: string;
  city: string;
  district: string;
  postalCode: string;
}

interface BillingExtra {
  billingType: 'INDIVIDUAL' | 'CORPORATE';
  taxNumber: string;
  taxOffice: string;
  companyName: string;
}

const emptyAddress = (): AddressForm => ({
  firstName: '',
  lastName: '',
  phone: '',
  addressLine: '',
  neighbourhood: '',
  city: '',
  district: '',
  postalCode: '',
});

const emptyBillingExtra = (): BillingExtra => ({
  billingType: 'INDIVIDUAL',
  taxNumber: '',
  taxOffice: '',
  companyName: '',
});

const DOC_LABELS: Record<string, string> = {
  ON_BILGILENDIRME: 'Ön Bilgilendirme Formu',
  MESAFELI_SATIS:   'Mesafeli Satış Sözleşmesi',
  KVKK_AYDINLATMA:  'KVKK Aydınlatma Metni',
};

// ── Bileşen ───────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const supabase = createClient();
  const formTopRef = useRef<HTMLDivElement>(null);

  // ─ Temel state ─
  const [mounted, setMounted]             = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isValidating, setIsValidating]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated]   = useState<boolean | null>(null);

  // ─ Checkout modu: null=yükleniyor, 'choose'=seçim, 'guest'=misafir, 'member'=üye ─
  const [checkoutMode, setCheckoutMode] = useState<'choose' | 'guest' | 'member' | null>(null);

  // ─ Accordion adım ─
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});

  // ─ Iyzico gömülü form state ─
  const [paymentStep, setPaymentStep] = useState<'form' | 'payment'>('form');
  const [iyzicoData, setIyzicoData]   = useState<{
    checkoutFormContent: string;
    paymentPageUrl:      string;
    orderNumber:         string;
  } | null>(null);

  // ─ Sepet ─
  const items          = useCartStore((s) => s.items);
  const getCartSummary = useCartStore((s) => s.getCartSummary);

  // ─ Server fiyatları ─
  const [serverPrices, setServerPrices] = useState<{
    subtotal: number; shippingCost: number; total: number;
  } | null>(null);

  // ─ Kayıtlı adresler ─
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // ─ Yasal belgeler (DB: ON_BILGILENDIRME + MESAFELI_SATIS) ─
  const [legalDocs, setLegalDocs]         = useState<LegalDoc[]>([]);
  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set());
  const [modalDoc, setModalDoc]           = useState<{ type: string; title: string } | null>(null);

  // ─ KVKK (Adım 1 sonu — hardcoded, DB''den gelmiyor) ─
  const [kvkkAccepted, setKvkkAccepted] = useState(false);

  // ─ Form alanları ─
  const [email, setEmail]             = useState('');
  const [shipping, setShipping]       = useState<AddressForm>(emptyAddress());
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billing, setBilling]         = useState<AddressForm>(emptyAddress());
  const [billingExtra, setBillingExtra] = useState<BillingExtra>(emptyBillingExtra());
  const [customerNote, setCustomerNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'credit_card'>('credit_card');

  // ─ Kupon state ─
  const [couponInput,   setCouponInput]   = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError,   setCouponError]   = useState<string | null>(null);

  // ─ İlçe listeleri ─
  const [shippingDistricts, setShippingDistricts] = useState<string[]>([]);
  const [billingDistricts, setBillingDistricts]   = useState<string[]>([]);

  // ── İl → ilçe cascade ───────────────────────────────────────────────────────
  useEffect(() => {
    const list = getDistricts(shipping.city);
    setShippingDistricts(list);
    if (shipping.district && !list.includes(shipping.district)) {
      setShipping((prev) => ({ ...prev, district: '' }));
    }
  }, [shipping.city]);

  useEffect(() => {
    const list = getDistricts(billing.city);
    setBillingDistricts(list);
    if (billing.district && !list.includes(billing.district)) {
      setBilling((prev) => ({ ...prev, district: '' }));
    }
  }, [billing.city]);

  // ── Auth + profil + adresler + yasal belgeler ────────────────────────────────
  useEffect(() => {
    setMounted(true);

    const fetchLegalDocs = async () => {
      const { data: docs } = await supabase
        .from('legal_document_versions')
        .select('id, document_type, version, content_url')
        .in('document_type', ['ON_BILGILENDIRME', 'MESAFELI_SATIS'])
        .eq('is_active', true);
      if (docs?.length) setLegalDocs(docs as LegalDoc[]);
    };

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        setCheckoutMode('choose');
        await fetchLegalDocs();
        return;
      }

      setIsAuthenticated(true);
      setCheckoutMode('member');

      // Profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, phone')
        .eq('id', user.id)
        .single();

      if (profile) {
        setEmail(profile.email || user.email || '');
        const parts = (profile.full_name || '').trim().split(/\s+/);
        setShipping((prev) => ({
          ...prev,
          firstName: parts[0] ?? '',
          lastName:  parts.slice(1).join(' '),
          phone:     profile.phone || '',
        }));
      } else {
        setEmail(user.email || '');
      }

      // Kayıtlı adresler
      const { data: addresses } = await supabase
        .from('addresses')
        .select('id, title, first_name, last_name, phone, address_line, neighbourhood, district, city, postal_code, billing_type, tax_number, tax_office, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (addresses?.length) {
        setSavedAddresses(addresses as SavedAddress[]);
        const def = addresses.find((a) => a.is_default) ?? addresses[0];
        applyAddress(def as SavedAddress);
        setSelectedAddressId(def.id);
      }

      await fetchLegalDocs();
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sepet fiyat doğrulama ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || items.length === 0) return;
    if (checkoutMode === null || checkoutMode === 'choose') return;

    const validateAndSync = async () => {
      setIsValidating(true);
      setValidationErrors([]);
      try {
        // Üye: sepet sync + stok/fiyat validasyon
        if (checkoutMode === 'member') {
          await syncCart(items);
          const validationResult = await validateOrder(items);
          if (validationResult.success && validationResult.data && !validationResult.data.valid) {
            setValidationErrors(validationResult.data.errors);
          }
        }
        // Her iki mod: fiyat hesaplama
        const pricesResult = await getServerCalculatedPrices(items);
        if (pricesResult.success && pricesResult.data) {
          setServerPrices({
            subtotal:     pricesResult.data.subtotal,
            shippingCost: pricesResult.data.shippingCost,
            total:        pricesResult.data.total,
          });
        }
      } catch (err) {
        console.error('Validation error:', err);
      } finally {
        setIsValidating(false);
      }
    };

    validateAndSync();
  }, [mounted, checkoutMode, items]);

  // ── Kayıtlı adres seçimi ─────────────────────────────────────────────────────
  const applyAddress = useCallback((addr: SavedAddress) => {
    setShipping({
      firstName:    addr.first_name,
      lastName:     addr.last_name,
      phone:        addr.phone,
      addressLine:  addr.address_line,
      neighbourhood: addr.neighbourhood ?? '',
      city:         addr.city,
      district:     addr.district,
      postalCode:   addr.postal_code ?? '',
    });
  }, []);

  const handleSavedAddressSelect = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    applyAddress(addr);
  };

  // ── Form yardımcıları ────────────────────────────────────────────────────────
  const updateShipping = (field: keyof AddressForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setSelectedAddressId(null);
    setShipping((prev) => ({ ...prev, [field]: e.target.value }));
    // İlgili adım 1 hatasını temizle
    if (step1Errors[field]) setStep1Errors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const updateBilling = (field: keyof AddressForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setBilling((prev) => ({ ...prev, [field]: e.target.value }));

  const updateBillingExtra = (field: keyof BillingExtra) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setBillingExtra((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleDoc = (id: string) =>
    setCheckedDocIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Adım 1 client-side validasyon ───────────────────────────────────────────
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    const phoneRe = /^(0|\+90)?5\d{9}$/;

    if (!email || !/.+@.+\..+/.test(email))
      errors.email = 'Geçerli bir e-posta adresi girin';
    if (!shipping.firstName || shipping.firstName.trim().length < 2)
      errors.firstName = 'Ad en az 2 karakter olmalıdır';
    if (!shipping.phone || !phoneRe.test(shipping.phone.replace(/\s/g, '')))
      errors.phone = 'Geçerli bir telefon numarası girin (05xxxxxxxxx)';
    if (!shipping.city)
      errors.city = 'İl seçimi zorunludur';
    if (!shipping.district)
      errors.district = 'İlçe seçimi zorunludur';
    if (!shipping.addressLine || shipping.addressLine.trim().length < 10)
      errors.addressLine = 'Açık adres en az 10 karakter olmalıdır';
    if (!kvkkAccepted)
      errors.kvkk = 'KVKK Aydınlatma Metni\'ni onaylamanız gerekmektedir';

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStepAdvance = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      // Yumuşak scroll — adım başlığına
      setTimeout(() => formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  // ── Kupon işlemleri ──────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (checkoutMode === 'guest') {
      setCouponError('Kupon kullanmak için üye girişi yapmanız gerekmektedir.');
      return;
    }
    setCouponLoading(true);
    setCouponError(null);

    const res = await applyCouponAction(code, displaySubtotal);
    if (!res.success || !res.data) {
      setCouponError(res.error ?? 'Kupon doğrulanamadı');
      setCouponLoading(false);
      return;
    }
    const result = res.data;
    if (!result.valid) {
      setCouponError(result.errorMessage);
      setCouponLoading(false);
      return;
    }
    setAppliedCoupon({
      code,
      couponId:       result.couponId,
      discountAmount: result.discountAmount,
      discountKind:   result.discountKind,
      discountRate:   result.discountRate,
      appliedSegment: result.appliedSegment,
    });
    setCouponInput('');
    setCouponLoading(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // ── Sipariş gönderimi ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setValidationErrors([]);

    try {
      // 1. Sözleşme onayları
      const allDocIds  = legalDocs.map((d) => d.id);
      const allChecked = allDocIds.every((id) => checkedDocIds.has(id));
      if (legalDocs.length > 0 && !allChecked) {
        setError('Devam etmek için tüm sözleşmeleri onaylamanız gerekmektedir.');
        setIsLoading(false);
        return;
      }

      // Stok/fiyat doğrulaması initiateCheckoutFormPayment içinde yapılır (validateStock +
      // validateAndCalculatePrices). Burada tekrar validateOrder çağırmak gereksiz ve
      // session expiry durumunda "Giriş yapmalısınız" false-positive'i üretir.

      const formInput: CheckoutFormInput & { isGuest?: boolean } = {
        email,
        shippingAddress: {
          firstName:     shipping.firstName,
          lastName:      shipping.lastName,
          phone:         shipping.phone,
          addressLine:   shipping.addressLine,
          neighbourhood: shipping.neighbourhood || undefined,
          district:      shipping.district,
          city:          shipping.city,
          postalCode:    shipping.postalCode || undefined,
        },
        sameAsBilling,
        billingAddress: sameAsBilling
          ? undefined
          : {
              firstName:     billing.firstName,
              lastName:      billing.lastName,
              phone:         billing.phone,
              addressLine:   billing.addressLine,
              neighbourhood: billing.neighbourhood || undefined,
              district:      billing.district,
              city:          billing.city,
              postalCode:    billing.postalCode || undefined,
              billingType:   billingExtra.billingType,
              taxNumber:     billingExtra.taxNumber || undefined,
              taxOffice:     billingExtra.taxOffice || undefined,
              companyName:   billingExtra.companyName || undefined,
            },
        customerNote: customerNote || undefined,
        paymentMethod,
        legalConsent:  { documentVersionIds: allDocIds },
        isGuest:       checkoutMode === 'guest',
      };

      const result = await initiateCheckoutFormPayment(
        items,
        formInput as CheckoutFormInput,
        appliedCoupon?.code,
      );
      if (!result.success || !result.data) throw new Error(result.error || 'Ödeme başlatılamadı');

      setIyzicoData({
        checkoutFormContent: result.data.checkoutFormContent,
        paymentPageUrl:      result.data.paymentPageUrl,
        orderNumber:         result.data.orderNumber,
      });
      setPaymentStep('payment');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.');
      setIsLoading(false);
    }
  };

  // ── Hesaplanan değerler ──────────────────────────────────────────────────────
  const clientSummary   = getCartSummary();
  const displaySubtotal = serverPrices?.subtotal     ?? clientSummary.subtotal;
  const displayShipping = serverPrices?.shippingCost ?? clientSummary.shippingCost;
  const displayDiscount = appliedCoupon?.discountAmount ?? 0;
  const displayTotal    = Math.round((displaySubtotal - displayDiscount + displayShipping) * 100) / 100;
  const hasValidErrors  = validationErrors.length > 0;
  const allDocIds       = legalDocs.map((d) => d.id);
  const allDocsChecked  = allDocIds.length === 0 || allDocIds.every((id) => checkedDocIds.has(id));

  // Modal için müşteri verisi
  const legalCustomerData: LegalModalCustomerData = {
    firstName: shipping.firstName,
    lastName:  shipping.lastName,
    email,
    phone:     shipping.phone,
    address:   shipping.addressLine,
    district:  shipping.district,
    city:      shipping.city,
  };

  // ── Stil sabitleri ───────────────────────────────────────────────────────────
  const inputClass   = 'h-input';
  const selectClass  = 'h-input appearance-none cursor-pointer pr-8 bg-white';
  const sectionClass = 'border border-[#F3F4F6] p-6 bg-white';
  const labelClass   = 'block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2';
  const fieldErrClass = 'mt-1 text-[9px] text-red-500 tracking-[0.05em]';

  // ── Guard states ─────────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="bg-white min-h-screen">
        <div className="h-container py-10 lg:py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[#F3F4F6] w-48" />
            <div className="h-96 bg-[#F3F4F6]" />
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-screen">
        <div className="h-container py-24 text-center">
          <p className="h-eyebrow justify-center mb-6">Sepet</p>
          <h1 className="font-serif text-black text-2xl tracking-[0.05em] mb-4">
            Sepetiniz Boş
          </h1>
          <p className="text-[#9CA3AF] text-[11px] tracking-[0.1em] mb-10">
            Ödeme yapabilmek için sepetinize ürün eklemeniz gerekmektedir.
          </p>
          <Link href="/" className="h-btn">Alışverişe Başla</Link>
        </div>
      </div>
    );
  }

  // ── Iyzico gömülü form adımı ──────────────────────────────────────────────────
  if (paymentStep === 'payment' && iyzicoData) {
    return (
      <div className="bg-white min-h-screen">
        <div className="h-container py-10 lg:py-16 max-w-[680px]">
          <IyzicoCheckoutForm
            checkoutFormContent={iyzicoData.checkoutFormContent}
            paymentPageUrl={iyzicoData.paymentPageUrl}
            orderNumber={iyzicoData.orderNumber}
            onCancel={() => { setPaymentStep('form'); setIyzicoData(null); setIsLoading(false); }}
          />
        </div>
      </div>
    );
  }

  // ── Misafir / Üye seçim ekranı ────────────────────────────────────────────────
  if (checkoutMode === 'choose') {
    return (
      <div className="bg-white min-h-screen">
        {/* Breadcrumb */}
        <div className="border-b border-[#F3F4F6]">
          <div className="h-container py-4">
            <nav className="flex items-center gap-2">
              <Link href="/" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">Ana Sayfa</Link>
              <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
              <Link href="/sepet" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">Sepet</Link>
              <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
              <span className="text-[#B89947]/70 text-[9px] tracking-[0.3em] uppercase">Ödeme</span>
            </nav>
          </div>
        </div>

        <div className="h-container py-16 lg:py-24">
          <div className="max-w-lg mx-auto">
            {/* Başlık */}
            <div className="text-center mb-12">
              <p className="text-[#B89947]/60 text-[9px] tracking-[0.4em] uppercase mb-3">
                Hanedan
              </p>
              <h1 className="font-serif text-black text-2xl lg:text-3xl tracking-[0.03em] mb-4">
                Alışverişe Devam
              </h1>
              <p className="text-[#9CA3AF] text-[11px] tracking-[0.1em] leading-relaxed">
                Siparişinizi tamamlamak için lütfen bir seçenek belirleyin.
              </p>
            </div>

            {/* Seçim kartları */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Üye Girişi */}
              <Link
                href={`/giris?redirect=/odeme`}
                className="group flex flex-col items-center gap-4 p-8 bg-[#1F1F1F] border border-[#1F1F1F] hover:border-[#C4A97B] transition-all duration-300 text-center"
              >
                <div className="w-10 h-10 border border-[#C4A97B]/30 flex items-center justify-center group-hover:border-[#C4A97B] transition-colors duration-300">
                  <LogIn className="w-5 h-5 text-[#C4A97B]" />
                </div>
                <div>
                  <p className="font-serif text-[#C4A97B] text-sm tracking-[0.1em] mb-1">
                    Üye Girişi
                  </p>
                  <p className="text-[#9C9286] text-[9px] tracking-[0.1em] leading-relaxed">
                    Hızlı ödeme, sipariş takibi ve kayıtlı adresleriniz
                  </p>
                </div>
              </Link>

              {/* Misafir Devam */}
              <button
                type="button"
                onClick={() => setCheckoutMode('guest')}
                className="group flex flex-col items-center gap-4 p-8 bg-white border border-[#E5E7EB] hover:border-[#1F1F1F] transition-all duration-300 text-center"
              >
                <div className="w-10 h-10 border border-[#E5E7EB] flex items-center justify-center group-hover:border-[#1F1F1F] transition-colors duration-300">
                  <UserCheck className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#1F1F1F] transition-colors duration-300" />
                </div>
                <div>
                  <p className="font-serif text-black text-sm tracking-[0.1em] mb-1">
                    Misafir Olarak Devam
                  </p>
                  <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                    Üyelik gerektirmez, sadece iletişim bilgileri yeterli
                  </p>
                </div>
              </button>
            </div>

            <p className="text-center text-[#9CA3AF] text-[8px] tracking-[0.15em] mt-8">
              Henüz üye değil misiniz?{' '}
              <Link href="/giris?tab=register&redirect=/odeme" className="text-[#B89947]/80 hover:text-[#B89947] underline underline-offset-2 transition-colors duration-200">
                Kayıt olun
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── JSX — Ana ödeme formu ─────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-[#F3F4F6]">
        <div className="h-container py-4">
          <nav className="flex items-center gap-2">
            <Link href="/" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">Ana Sayfa</Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <Link href="/sepet" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">Sepet</Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <span className="text-[#B89947]/70 text-[9px] tracking-[0.3em] uppercase">Ödeme</span>
          </nav>
        </div>
      </div>

      <div className="h-container py-10 lg:py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-black text-2xl lg:text-3xl tracking-[0.05em]">
            Ödeme
          </h1>
          <div className="flex items-center gap-4">
            {/* Misafir modu rozeti */}
            {checkoutMode === 'guest' && (
              <span className="flex items-center gap-1.5 text-[#9CA3AF] text-[8px] tracking-[0.2em] uppercase border border-[#E5E7EB] px-2 py-1">
                <UserCheck className="w-3 h-3" />
                Misafir
              </span>
            )}
            <Link href="/sepet" className="text-[#9CA3AF] text-[9px] tracking-[0.25em] uppercase hover:text-[#B89947] flex items-center gap-1.5 transition-colors duration-300">
              <ArrowLeft className="w-3 h-3" />
              Sepete Dön
            </Link>
          </div>
        </div>

        {/* ── Adım göstergesi ── */}
        <div ref={formTopRef} className="flex items-center gap-0 mb-8 max-w-sm">
          {/* Adım 1 */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
              currentStep === 1
                ? 'bg-[#1F1F1F] text-[#C4A97B]'
                : 'bg-[#1F1F1F] text-[#C4A97B]'
            }`}>
              {currentStep > 1 ? <CheckCircle className="w-3.5 h-3.5" /> : '1'}
            </div>
            <span className={`text-[9px] tracking-[0.2em] uppercase transition-colors duration-300 ${
              currentStep === 1 ? 'text-black' : 'text-[#B89947]/70'
            }`}>
              Teslimat
            </span>
          </div>

          {/* Bağlantı çizgisi */}
          <div className={`flex-1 mx-3 h-px transition-all duration-500 ${currentStep >= 2 ? 'bg-[#B89947]/50' : 'bg-[#E5E7EB]'}`} style={{ minWidth: '2rem' }} />

          {/* Adım 2 */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
              currentStep === 2
                ? 'bg-[#1F1F1F] text-[#C4A97B]'
                : 'bg-[#E5E7EB] text-[#9CA3AF]'
            }`}>
              2
            </div>
            <span className={`text-[9px] tracking-[0.2em] uppercase transition-colors duration-300 ${
              currentStep === 2 ? 'text-black' : 'text-[#9CA3AF]'
            }`}>
              Ödeme
            </span>
          </div>
        </div>

        {/* Hata banner'ları */}
        {hasValidErrors && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-600 text-[9px] tracking-[0.2em] uppercase mb-2">Sipariş doğrulama hatası</p>
                <ul className="text-red-500/80 text-[10px] space-y-1 list-disc list-inside">
                  {validationErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
        {error && !hasValidErrors && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 text-red-600 text-[10px] tracking-[0.1em]">
            {error}
          </div>
        )}
        {isValidating && (
          <div className="mb-6 p-4 border border-[#B89947]/30 bg-[#FAFAFA]">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-[#B89947] animate-spin" />
              <p className="text-[#B89947]/70 text-[9px] tracking-[0.2em] uppercase">Sepet doğrulanıyor...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ═══════════════════════════════════════════════════════
                SOL SÜTUN — Adım 1 ve Adım 2 içerikleri
            ═══════════════════════════════════════════════════════ */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── ADIM 2 görünümünde Adım 1 özeti ─────────────────── */}
              {currentStep === 2 && (
                <div className="border border-[#F3F4F6] p-4 bg-[#FAFAFA] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#1F1F1F] flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3 h-3 text-[#C4A97B]" />
                    </div>
                    <div>
                      <p className="text-[8px] tracking-[0.2em] uppercase text-[#9CA3AF]">
                        1. Teslimat ve İletişim
                      </p>
                      <p className="text-black text-[11px] mt-0.5">
                        {shipping.firstName} {shipping.lastName}
                        {shipping.city ? ` · ${shipping.city}${shipping.district ? `/${shipping.district}` : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[#B89947]/80 text-[9px] tracking-[0.2em] uppercase hover:text-[#B89947] underline underline-offset-2 transition-colors duration-200"
                  >
                    Düzenle
                  </button>
                </div>
              )}

              {/* ════════════════════════
                  ADIM 1 — Teslimat & İletişim
              ════════════════════════ */}
              <div className={currentStep === 1 ? 'block space-y-6' : 'hidden'}>

                {/* Kayıtlı Adresler (sadece üye) */}
                {checkoutMode === 'member' && savedAddresses.length > 0 && (
                  <div className={sectionClass}>
                    <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                      <Star className="w-4 h-4 text-[#B89947]/60" />
                      Kayıtlı Adreslerim
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        return (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => handleSavedAddressSelect(addr)}
                            className={`text-left p-4 border transition-colors duration-200 ${
                              isSelected ? 'border-[#B89947]/60 bg-[#FAFAFA]' : 'border-[#F3F4F6] hover:border-[#B89947]/40'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-black text-[9px] tracking-[0.2em] uppercase font-medium">{addr.title}</span>
                              {addr.is_default && (
                                <span className="text-[#B89947]/70 text-[7px] tracking-[0.15em] uppercase border border-[#B89947]/30 px-1.5 py-0.5">Varsayılan</span>
                              )}
                            </div>
                            <p className="text-black text-[9px]">{addr.first_name} {addr.last_name}</p>
                            <p className="text-[#9CA3AF] text-[8px] mt-0.5 line-clamp-2">{addr.address_line}, {addr.district} / {addr.city}</p>
                            {isSelected && (
                              <div className="mt-2 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-[#B89947]/70" />
                                <span className="text-[#B89947]/70 text-[7px] tracking-[0.15em] uppercase">Seçili</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[#9CA3AF] text-[8px] tracking-[0.1em]">
                      Farklı bir adres için aşağıdaki alanları güncelleyebilirsiniz.
                    </p>
                  </div>
                )}

                {/* İletişim Bilgileri */}
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#B89947]/60" />
                    İletişim Bilgileri
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>E-posta *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (step1Errors.email) setStep1Errors((p) => { const n = { ...p }; delete n.email; return n; });
                          }}
                          required
                          className={`${inputClass} pl-10 ${step1Errors.email ? 'border-red-300' : ''}`}
                          placeholder="ornek@email.com"
                        />
                      </div>
                      {step1Errors.email && <p className={fieldErrClass}>{step1Errors.email}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Telefon *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <input
                          type="tel"
                          value={shipping.phone}
                          onChange={updateShipping('phone')}
                          required
                          className={`${inputClass} pl-10 ${step1Errors.phone ? 'border-red-300' : ''}`}
                          placeholder="05xx xxx xx xx"
                        />
                      </div>
                      {step1Errors.phone && <p className={fieldErrClass}>{step1Errors.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* Teslimat Adresi */}
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#B89947]/60" />
                    Teslimat Adresi
                  </h2>
                  <div className="space-y-4">
                    {/* Ad / Soyad */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Ad *</label>
                        <input
                          type="text"
                          value={shipping.firstName}
                          onChange={updateShipping('firstName')}
                          required
                          className={`${inputClass} ${step1Errors.firstName ? 'border-red-300' : ''}`}
                          placeholder="Adınız"
                        />
                        {step1Errors.firstName && <p className={fieldErrClass}>{step1Errors.firstName}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Soyad</label>
                        <input type="text" value={shipping.lastName} onChange={updateShipping('lastName')} className={inputClass} placeholder="Soyadınız" />
                      </div>
                    </div>
                    {/* İl / İlçe */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>İl *</label>
                        <div className="relative">
                          <select
                            value={shipping.city}
                            onChange={updateShipping('city')}
                            required
                            className={`${selectClass} ${step1Errors.city ? 'border-red-300' : ''}`}
                          >
                            <option value="">İl seçin</option>
                            {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                        </div>
                        {step1Errors.city && <p className={fieldErrClass}>{step1Errors.city}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>İlçe *</label>
                        <div className="relative">
                          <select
                            value={shipping.district}
                            onChange={updateShipping('district')}
                            required
                            disabled={!shipping.city}
                            className={`${selectClass} disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed ${step1Errors.district ? 'border-red-300' : ''}`}
                          >
                            <option value="">{shipping.city ? 'İlçe seçin' : 'Önce il seçin'}</option>
                            {shippingDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                        </div>
                        {step1Errors.district && <p className={fieldErrClass}>{step1Errors.district}</p>}
                      </div>
                    </div>
                    {/* Mahalle */}
                    <div>
                      <label className={labelClass}>Mahalle</label>
                      <input type="text" value={shipping.neighbourhood} onChange={updateShipping('neighbourhood')} className={inputClass} placeholder="Mahalle adı" />
                    </div>
                    {/* Açık adres */}
                    <div>
                      <label className={labelClass}>Açık Adres *</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-[#9CA3AF]" />
                        <textarea
                          value={shipping.addressLine}
                          onChange={updateShipping('addressLine')}
                          required
                          rows={2}
                          className={`${inputClass} pl-10 resize-none ${step1Errors.addressLine ? 'border-red-300' : ''}`}
                          placeholder="Sokak, Bina No, Daire No..."
                        />
                      </div>
                      {step1Errors.addressLine && <p className={fieldErrClass}>{step1Errors.addressLine}</p>}
                    </div>
                    {/* Posta kodu */}
                    <div className="md:w-1/3">
                      <label className={labelClass}>Posta Kodu</label>
                      <input type="text" value={shipping.postalCode} onChange={updateShipping('postalCode')} maxLength={5} className={inputClass} placeholder="34000" />
                    </div>
                    {/* Fatura adresi aynı mı? */}
                    <div className="mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="w-4 h-4 border border-[#B89947]/30 cursor-pointer accent-[#B89947]" />
                        <span className="text-[#9CA3AF] text-[9px] tracking-[0.2em] uppercase">Fatura adresi teslimat adresi ile aynı</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Fatura Adresi (farklıysa) */}
                {!sameAsBilling && (
                  <div className={sectionClass}>
                    <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#B89947]/60" />
                      Fatura Adresi
                    </h2>
                    <div className="flex gap-3 mb-6">
                      {(['INDIVIDUAL', 'CORPORATE'] as const).map((type) => (
                        <button key={type} type="button" onClick={() => setBillingExtra((prev) => ({ ...prev, billingType: type }))}
                          className={`flex-1 py-2.5 text-[9px] tracking-[0.2em] uppercase border transition-colors duration-200 ${billingExtra.billingType === type ? 'border-black bg-black text-white' : 'border-[#E5E7EB] text-[#9CA3AF] hover:border-black hover:text-black'}`}>
                          {type === 'INDIVIDUAL' ? 'Bireysel' : 'Kurumsal'}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Ad *</label>
                          <input type="text" value={billing.firstName} onChange={updateBilling('firstName')} required={!sameAsBilling} className={inputClass} placeholder="Adınız" />
                        </div>
                        <div>
                          <label className={labelClass}>Soyad</label>
                          <input type="text" value={billing.lastName} onChange={updateBilling('lastName')} className={inputClass} placeholder="Soyadınız" />
                        </div>
                      </div>
                      {billingExtra.billingType === 'CORPORATE' && (
                        <div className="space-y-4 p-4 border border-[#F3F4F6] bg-[#FAFAFA]">
                          <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] uppercase">Kurumsal Fatura Bilgileri</p>
                          <div><label className={labelClass}>Şirket Unvanı *</label><input type="text" value={billingExtra.companyName} onChange={updateBillingExtra('companyName')} required className={inputClass} placeholder="Şirket Unvanı" /></div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Vergi Numarası (VKN) *</label><input type="text" value={billingExtra.taxNumber} onChange={updateBillingExtra('taxNumber')} required maxLength={10} className={inputClass} placeholder="1234567890" /></div>
                            <div><label className={labelClass}>Vergi Dairesi *</label><input type="text" value={billingExtra.taxOffice} onChange={updateBillingExtra('taxOffice')} required className={inputClass} placeholder="Kadıköy VD" /></div>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className={labelClass}>Telefon *</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                          <input type="tel" value={billing.phone} onChange={updateBilling('phone')} required={!sameAsBilling} className={`${inputClass} pl-10`} placeholder="05xx xxx xx xx" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>İl *</label>
                          <div className="relative">
                            <select value={billing.city} onChange={updateBilling('city')} required={!sameAsBilling} className={selectClass}>
                              <option value="">İl seçin</option>
                              {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>İlçe *</label>
                          <div className="relative">
                            <select value={billing.district} onChange={updateBilling('district')} required={!sameAsBilling} disabled={!billing.city} className={`${selectClass} disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed`}>
                              <option value="">{billing.city ? 'İlçe seçin' : 'Önce il seçin'}</option>
                              {billingDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                          </div>
                        </div>
                      </div>
                      <div><label className={labelClass}>Mahalle</label><input type="text" value={billing.neighbourhood} onChange={updateBilling('neighbourhood')} className={inputClass} placeholder="Mahalle adı" /></div>
                      <div>
                        <label className={labelClass}>Açık Adres *</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 w-4 h-4 text-[#9CA3AF]" />
                          <textarea value={billing.addressLine} onChange={updateBilling('addressLine')} required={!sameAsBilling} rows={2} className={`${inputClass} pl-10 resize-none`} placeholder="Sokak, Bina No, Daire No..." />
                        </div>
                      </div>
                      <div className="md:w-1/3"><label className={labelClass}>Posta Kodu</label><input type="text" value={billing.postalCode} onChange={updateBilling('postalCode')} maxLength={5} className={inputClass} placeholder="34000" /></div>
                    </div>
                  </div>
                )}

                {/* ── KVKK Onayı (Adım 1 sonu) ── */}
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#B89947]/60" />
                    Gizlilik Onayı
                  </h2>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={kvkkAccepted}
                      onChange={(e) => {
                        setKvkkAccepted(e.target.checked);
                        if (e.target.checked) setStep1Errors((p) => { const n = { ...p }; delete n.kvkk; return n; });
                      }}
                      className="w-4 h-4 mt-0.5 border border-[#B89947]/30 cursor-pointer accent-[#B89947] shrink-0"
                    />
                    <span className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                      <button
                        type="button"
                        onClick={() => setModalDoc({ type: 'KVKK_AYDINLATMA', title: 'KVKK Aydınlatma Metni' })}
                        className="text-[#B89947]/80 underline underline-offset-2 decoration-[#B89947]/40 hover:text-[#B89947] transition-colors duration-200 cursor-pointer"
                      >
                        KVKK Aydınlatma Metni
                      </button>
                      {' '}kapsamında kişisel verilerimin işlenmesini okudum ve kabul ediyorum.
                    </span>
                  </label>
                  {step1Errors.kvkk && (
                    <p className={`mt-2 ${fieldErrClass}`}>{step1Errors.kvkk}</p>
                  )}
                </div>

                {/* ── Adım 1 → Devam butonu ── */}
                <button
                  type="button"
                  onClick={handleStepAdvance}
                  className="h-btn w-full"
                >
                  Ödeme Adımına Geç →
                </button>

              </div>{/* /ADIM 1 */}

              {/* ════════════════════════
                  ADIM 2 — Ödeme & Onay
              ════════════════════════ */}
              <div className={currentStep === 2 ? 'block space-y-6' : 'hidden'}>

                {/* Ödeme Yöntemi */}
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#B89947]/60" />
                    Ödeme Yöntemi
                  </h2>
                  <div className="space-y-3">
                    {[{ value: 'credit_card', label: 'Kredi Kartı', desc: '3D Secure ile güvenli ödeme' }].map((method) => (
                      <label key={method.value} className={`flex items-center gap-4 p-4 border cursor-pointer transition-colors duration-200 ${paymentMethod === method.value ? 'border-black bg-white' : 'border-[#F3F4F6] hover:border-black'}`}>
                        <input type="radio" name="paymentMethod" value={method.value} checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value as typeof paymentMethod)} className="w-4 h-4 accent-[#B89947]" />
                        <div className="flex-1">
                          <p className="text-black text-[10px] tracking-[0.15em] uppercase">{method.label}</p>
                          <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] mt-0.5">{method.desc}</p>
                        </div>
                        {method.value === 'credit_card' && <ShieldCheck className="w-4 h-4 text-[#B89947]/50" />}
                      </label>
                    ))}
                    {paymentMethod === 'credit_card' && (
                      <div className="mt-2 p-4 border border-[#F3F4F6] bg-[#FAFAFA]">
                        <div className="flex items-center gap-2 text-[#B89947]/70">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[9px] tracking-[0.1em]">
                            Kart bilgileriniz Iyzico&apos;nun güvenli ödeme sayfasında girilir. Bilgileriniz sunucularımıza iletilmez.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sipariş Notu */}
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#B89947]/60" />
                    Sipariş Notu
                  </h2>
                  <textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Özel istekleriniz varsa buraya yazabilirsiniz..." />
                </div>

              </div>{/* /ADIM 2 */}

            </div>{/* /Sol sütun */}

            {/* ═══════════════════════════════════════════════════════
                SAĞ SÜTUN — Sipariş Özeti (her adımda görünür)
            ═══════════════════════════════════════════════════════ */}
            <div className="lg:col-span-1">
              <div className="border border-[#F3F4F6] p-6 sticky top-24 bg-white">
                <h2 className="font-serif text-black text-[13px] tracking-[0.15em] uppercase mb-6">
                  Sipariş Özeti
                </h2>

                {serverPrices && !isValidating && !hasValidErrors && (
                  <div className="mb-4 p-2 border border-[#F3F4F6] bg-[#FAFAFA] flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#B89947]/60" />
                    <span className="text-[#B89947]/60 text-[8px] tracking-[0.2em] uppercase">Fiyatlar doğrulandı</span>
                  </div>
                )}

                {/* Ürünler */}
                <div className="space-y-4 mb-6">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-14 h-14 bg-[#F3F4F6] border border-[#F3F4F6] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-black text-[9px] tracking-[0.1em] truncate">{item.productName}</p>
                        <p className="text-[#9CA3AF] text-[8px] mt-0.5">
                          {item.width}x{item.height}cm &bull; {PILE_LABELS_UPPER[item.pileFactor]}
                        </p>
                        <p className="text-[#9CA3AF] text-[8px]">x{item.quantity}</p>
                      </div>
                      <p className="text-black text-[10px]">{formatPrice(item.unitPrice * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                {/* Tutarlar */}
                <div className="space-y-3 border-t border-[#F3F4F6] pt-4">
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF] text-[9px] tracking-[0.15em] uppercase">Ara Toplam</span>
                    <span className="text-black text-[10px]">{formatPrice(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF] text-[9px] tracking-[0.15em] uppercase">Kargo</span>
                    <span className="text-[10px]">
                      {displayShipping > 0
                        ? <span className="text-black">{formatPrice(displayShipping)}</span>
                        : <span className="text-[#B89947]/70">Ücretsiz</span>
                      }
                    </span>
                  </div>
                  {displayShipping > 0 && (
                    <p className="text-[#9CA3AF] text-[8px]">
                      {formatPrice(SHIPPING.FREE_THRESHOLD - displaySubtotal)} daha ekleyin, kargo bedava!
                    </p>
                  )}
                  {displayDiscount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] tracking-[0.15em] uppercase text-green-600 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {appliedCoupon!.code}
                      </span>
                      <span className="text-green-600 text-[10px] font-medium">
                        −{formatPrice(displayDiscount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Kupon (üye modunda göster) */}
                {checkoutMode === 'member' && (
                  <div className="border-t border-[#F3F4F6] my-4 pt-4">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-[10px] text-green-700 font-mono font-semibold tracking-wider">{appliedCoupon.code}</span>
                          <span className="text-[9px] text-green-600">uygulandı</span>
                        </div>
                        <button type="button" onClick={handleRemoveCoupon} className="text-green-400 hover:text-green-700 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <label className="block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2">Kupon Kodu</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); if (couponError) setCouponError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                            placeholder="KUPON KODU"
                            maxLength={50}
                            className="flex-1 border border-[#E5E7EB] px-3 py-2 text-[10px] font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-[#B89947] transition-colors"
                          />
                          <button type="button" onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()} className="px-4 py-2 bg-[#1a1a1a] text-white text-[9px] tracking-[0.15em] uppercase hover:bg-[#B89947] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                            {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Uygula'}
                          </button>
                        </div>
                        {couponError && <p className="mt-1.5 text-[9px] text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{couponError}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Toplam */}
                <div className="border-t border-[#F3F4F6] pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-black text-[9px] tracking-[0.2em] uppercase">Toplam</span>
                    <div className="text-right">
                      {displayDiscount > 0 && (
                        <p className="text-[9px] text-[#9CA3AF] line-through mb-0.5">{formatPrice(displaySubtotal + displayShipping)}</p>
                      )}
                      <span className="font-serif text-[#B89947] font-bold text-xl">{formatPrice(displayTotal)}</span>
                    </div>
                  </div>
                  <p className="text-[#9CA3AF] text-[8px] mt-1">KDV dahil</p>
                </div>

                {/* ── Yasal Onaylar (Adım 2, CTA üstü) ── */}
                {currentStep === 2 && legalDocs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#F3F4F6] space-y-3">
                    <p className="text-[8px] tracking-[0.2em] uppercase text-[#9CA3AF] flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-[#B89947]/50" />
                      Sözleşme Onayları
                    </p>
                    {legalDocs.map((doc) => (
                      <label key={doc.id} className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checkedDocIds.has(doc.id)}
                          onChange={() => toggleDoc(doc.id)}
                          className="w-4 h-4 mt-0.5 border border-[#B89947]/30 cursor-pointer accent-[#B89947] shrink-0"
                        />
                        <span className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                          <button
                            type="button"
                            onClick={() => setModalDoc({
                              type:  doc.document_type,
                              title: DOC_LABELS[doc.document_type] ?? doc.document_type,
                            })}
                            className="text-[#B89947]/80 underline underline-offset-2 decoration-[#B89947]/40 hover:text-[#B89947] transition-colors duration-200 cursor-pointer"
                          >
                            {DOC_LABELS[doc.document_type] ?? doc.document_type}
                          </button>
                          {' '}v{doc.version}&apos;i okudum, anladım ve kabul ediyorum.
                        </span>
                      </label>
                    ))}
                    {!allDocsChecked && (
                      <p className="text-[#9CA3AF] text-[8px] tracking-[0.05em]">
                        Siparişi tamamlamak için tüm sözleşmeleri onaylamanız gerekmektedir.
                      </p>
                    )}
                  </div>
                )}

                {/* ── CTA butonu (sadece Adım 2'de) ── */}
                {currentStep === 2 ? (
                  <button
                    type="submit"
                    disabled={isLoading || isValidating || hasValidErrors || !allDocsChecked}
                    className="h-btn w-full mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isValidating ? (
                      'Doğrulanıyor...'
                    ) : hasValidErrors ? (
                      'Hata — Sepeti Kontrol Et'
                    ) : !allDocsChecked && legalDocs.length > 0 ? (
                      'Sözleşmeleri Onaylayın'
                    ) : (
                      'Siparişi Tamamla'
                    )}
                  </button>
                ) : (
                  /* Adım 1'deyken sağ kolonda fiyat bilgisi göster, buton sol kolonda */
                  <div className="mt-4 p-3 border border-[#F3F4F6] bg-[#FAFAFA] text-center">
                    <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] uppercase">
                      Teslimat bilgilerini doldurun ve ödeme adımına geçin
                    </p>
                  </div>
                )}

                <div className="mt-5 pt-5 border-t border-[#F3F4F6] space-y-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#B89947]/40 shrink-0" />
                    <span className="text-[#9CA3AF] text-[8px] tracking-[0.1em]">Güvenli ödeme ve 2 yıl garanti</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-[#B89947]/40 shrink-0" />
                    <span className="text-[#9CA3AF] text-[8px] tracking-[0.1em]">Hızlı ve güvenli teslimat</span>
                  </div>
                </div>
              </div>
            </div>{/* /Sağ sütun */}

          </div>
        </form>
      </div>

      {/* ── Yasal Belge Modali ── */}
      <LegalModal
        isOpen={modalDoc !== null}
        onClose={() => setModalDoc(null)}
        title={modalDoc?.title ?? ''}
        customerData={
          // Adım 2'deki sözleşmeler için müşteri verisini gönder;
          // KVKK için ise gerek yok (genel metin)
          modalDoc?.type !== 'KVKK_AYDINLATMA' ? legalCustomerData : undefined
        }
      >
        {modalDoc?.type === 'MESAFELI_SATIS' && (
          <div className="space-y-5">
            {/* TODO: Mesafeli Satış Sözleşmesi içeriğini buraya ekleyin */}
            <p className="text-[#9C9286] text-xs italic">
              Mesafeli Satış Sözleşmesi: İade, Cayma Hakkı ve Kalite Kontrol Maddeleri
MADDE [X] – CAYMA HAKKI VE İSTİSNALARI
1. Alıcı, Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin 1. fıkrasının (b) bendi uyarınca; "Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallar" kapsamında sipariş edilen özel ölçülü perde ve tekstil ürünlerinde CAYMA HAKKINA SAHİP DEĞİLDİR.
2. Alıcı, site üzerinden kendi belirlediği en, boy, renk ve donanım özelliklerine göre spesifik olarak üretime alınan bu ürünlerin, yeniden satılabilirliğinin olmaması sebebiyle iadesinin veya keyfi değişiminin hukuken mümkün olmadığını sipariş anında peşinen kabul, beyan ve taahhüt eder.

MADDE [Y] – AYIPLI İFA, KALİTE KONTROL (QC) VE BİLDİRİM YÜKÜMLÜLÜĞÜ
1. Satıcı, ürünlerin sipariş edilen ölçü ve spesifikasyonlara uygun olarak, kusursuz şekilde teslim edilmesinden sorumludur. Tüm gönderiler, Satıcı tesislerinde detaylı kalite kontrol sürecinden geçirilerek, kamera/fotoğraf kaydı ile belgelenip "Kalite Kontrol Onaylı" ibaresiyle sevk edilmektedir. Olası hukuki uyuşmazlıklarda bu kayıtlar Satıcı tarafından kesin delil olarak sunulacaktır.
2. Alıcı, ürünü kargo firmasından teslim alırken paket üzerinde ezilme, yırtılma, ıslanma veya açılma gibi fiziksel bir hasar tespit etmesi halinde paketi teslim almamak ve kargo görevlisine "Hasar Tespit Tutanağı" tutturmakla yükümlüdür. Tutanak tutulmayan kargo hasarlarından Satıcı hiçbir şekilde sorumlu tutulamaz.
3. Ürünün paketinden çıkarılmasını takiben tespit edilen, kargo taşımasıyla ilgili olmayan üretimsel ayıplar (kumaş dokuma hataları, mekanizma arızaları vb.), ürünün teslimat tarihinden itibaren en geç 24 saat içerisinde Satıcı'ya yazılı ve görsel (fotoğraf/video) olarak bildirilmek zorundadır.
4. Alıcı'nın kusurundan kaynaklanan (kasıtlı veya kasıtsız kesici alet hasarları, talimatlara aykırı yıkama/temizleme, hatalı montaj sebebiyle oluşan yıpranmalar) deformasyonlar ayıp kapsamında değerlendirilmez. Satıcı'nın inceleme ekibi tarafından tespit edilen bu tip durumlarda iade ve değişim talepleri kesinlikle reddedilecektir.

MADDE [Z] – SATICI İNİSİYATİFİ VE REVİZYON ŞARTLARI
1. Cayma hakkı istisnası kapsamında iadesi mümkün olmayan ürünlerde, Alıcı'nın kendi ölçü alımından veya sipariş girişinden kaynaklanan hatalar (yanlış ölçü siparişi vb.) durumunda Satıcı, tamamen kendi takdirine bağlı olmak kaydıyla, ürünün teknik elverişliliğine (daraltma, boy kısaltma gibi işlemler) göre revizyon desteği sunabilir.
2. Satıcı'nın onayı ile gerçekleştirilecek bu istisnai revizyon süreçleri iade hakkı doğurmaz. Bu işlemlerde ürünün gidiş ve dönüş kargo bedelleri ile oluşabilecek ek işçilik/materyal masrafları tamamen Alıcı tarafından karşılanacaktır. Alıcı, masrafları ödemeyi reddettiği takdirde Satıcı revizyon işleminden imtina etme hakkına sahiptir.
            </p>
          </div>
        )}
        {modalDoc?.type === 'ON_BILGILENDIRME' && (
          <div className="space-y-5">
            {/* TODO: Ön Bilgilendirme Formu içeriğini buraya ekleyin */}
            <p className="text-[#9C9286] text-xs italic">
              Ön Bilgilendirme Formu Metni
1. KONU
İşbu Ön Bilgilendirme Formu'nun ("Form") konusu, ALICI'nın SATICI'ya ait internet sitesi üzerinden elektronik ortamda siparişini verdiği aşağıda nitelikleri ve satış fiyatı belirtilen ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince bilgilendirilmesidir.

2. SATICI BİLGİLERİ
Unvanı: Hanedan
Adres: Atatürk, Estergon Cd. No:3, 34000 Ümraniye/İstanbul
Telefon: 0553 046 4659
E-posta: info@hanedanperde.com.tr

3. ALICI BİLGİLERİ
(Bu bölüm, form açıldığında sistem tarafından otomatik doldurulacaktır.)
Adı Soyadı / Unvanı: [Alıcı Ad Soyad]
Teslimat Adresi: [Alıcı Adres Bilgisi]
Telefon: [Alıcı Telefon]
E-posta: [Alıcı E-posta]

4. SÖZLEŞME KONUSU ÜRÜN BİLGİLERİ VE ÖDEME DETAYLARI
ALICI tarafından seçilen ürünlerin cinsi, miktarı, marka/modeli, özel ölçü donanımları, rengi, vergiler dâhil satış bedeli ve kargo ücreti, ödeme sayfasında yer alan "Sipariş Özeti" tablosunda açıkça belirtildiği gibidir.

ALICI, sipariş ettiği ürünlerin kendi belirttiği ölçü ve isteklere göre özel olarak üretime alınacağını peşinen kabul eder.

5. TESLİMAT ŞARTLARI
Ürünler, ALICI'nın belirttiği teslimat adresine 7-14 iş günü içerisinde anlaşmalı kargo firması (ürün boyutlarına göre lojistik firması) aracılığıyla gönderilecektir. Teslimat anında pakette ezilme, yırtılma veya açılma tespit edilmesi halinde ALICI, kargo görevlisine "Hasar Tespit Tutanağı" tutturmakla yükümlüdür.

6. CAYMA HAKKI VE İSTİSNALARI (ÖNEMLİ)
Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin 1. fıkrasının (b) bendi uyarınca; "Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallar" kapsamında sipariş edilen özel ölçülü perde ve tekstil ürünlerinde CAYMA HAKKI GEÇERLİ DEĞİLDİR. ALICI, kendi belirlediği ölçü, renk ve donanım özelliklerine göre spesifik olarak üretime alınan bu ürünlerin, üretimsel bir hata olmadığı sürece iadesinin veya keyfi değişiminin hukuken mümkün olmadığını peşinen kabul eder.

7. ÜRETİM HATALARI VE KALİTE KONTROL BİLDİRİMİ
SATICI, ürünleri "Kalite Kontrol Onaylı" barkodu ve kamera kaydı belgelemesiyle kargolamaktadır. Teslim alınan üründe tespit edilen olası üretim veya kumaş dokuma ayıplarının, teslimat tarihinden itibaren en geç 24 saat içerisinde SATICI'ya görsel materyallerle birlikte yazılı olarak bildirilmesi zorunludur. Kullanıcı hatası kaynaklı (kesici alet hasarı, montaj zedelenmesi, hatalı yıkama) durumlar iade veya değişim kapsamı dışındadır.

8. GEÇERLİLİK VE UYUŞMAZLIK ÇÖZÜMÜ
İşbu formda yer alan ürün fiyatları ve vaatler, güncelleme yapılana veya stok tükenene kadar geçerlidir. Olası uyuşmazlıklarda, T.C. Ticaret Bakanlığı tarafından ilan edilen parasal sınırlara göre ALICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri veya Tüketici Mahkemeleri yetkilidir.
            </p>
          </div>
        )}
        {modalDoc?.type === 'KVKK_AYDINLATMA' && (
          <div className="space-y-5">
            {/* TODO: KVKK Aydınlatma Metni içeriğini buraya ekleyin */}
            <p className="text-[#9C9286] text-xs italic">
              1. Veri Sorumlusu
Kişisel verileriniz; veri sorumlusu sıfatıyla [Resmi Şirket Ünvanınız veya Adınız Soyadınız] (Hanedan) (Atatürk, Estergon Cd. No:3, 34000 Ümraniye/İstanbul — info@hanedanperde.com.tr — 0553 046 4659) tarafından, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında işlenmektedir.

2. İşlenen Kişisel Verileriniz

Kimlik Bilgileri: Ad, soyad

İletişim Bilgileri: E-posta adresi, telefon numarası, teslimat ve fatura adresi

Müşteri İşlem Bilgileri: Sipariş geçmişi, ürün konfigürasyon detayları, ödeme yöntemi bilgisi (kredi kartı bilgileriniz sunucularımızda kesinlikle saklanmaz).

İşlem Güvenliği Bilgileri: IP adresi, oturum bilgileri, çerez (cookie) verileri.

3. Kişisel Verilerin İşlenme Amaçları
Toplanan kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:

Özel ölçülü siparişlerinizin alınması, üretimi ve teslimat süreçlerinin yürütülmesi,

Satış sözleşmesinden doğan yükümlülüklerimizin yerine getirilmesi,

Fatura kesimi ve muhasebe işlemlerinin gerçekleştirilmesi,

Satış sonrası destek ve müşteri hizmetleri faaliyetlerinin yürütülmesi,

Web sitemizin güvenliğinin sağlanması ve olası dolandırıcılık faaliyetlerinin önlenmesi,

Açık rızanızın bulunması hâlinde; size özel kampanya, indirim ve bülten iletilerinin gönderilmesi.

4. Hukuki İşleme Sebepleri
Kişisel verileriniz, KVKK'nın 5. maddesinde belirtilen şu hukuki sebeplere dayanarak toplanmaktadır:

Sözleşmenin Kurulması ve İfası (Md. 5/2-c): Sipariş ve teslimat süreçleri.

Hukuki Yükümlülüklerin Yerine Getirilmesi (Md. 5/2-ç): Ticari ve mali kayıtların tutulması, e-fatura süreçleri.

Meşru Menfaat (Md. 5/2-f): Sistem güvenliğinin sağlanması.

Açık Rıza (Md. 5/1): Pazarlama ve tanıtım iletişimleri.

5. Kişisel Verilerin Aktarımı
Kişisel verileriniz, yalnızca yukarıda belirtilen amaçların gerçekleştirilmesi için ve KVKK'nın 8. ve 9. maddelerine uygun olarak aktarılmaktadır:

Lojistik İş Ortakları: Siparişlerinizin teslimatı için anlaşmalı kargo firmaları,

Ödeme Kuruluşları: Güvenli tahsilatın sağlanması amacıyla BDDK lisanslı ödeme altyapı sağlayıcıları (örn. iyzico),

Teknoloji Sağlayıcıları: Veri güvenliğini sağlamak amacıyla uluslararası standartlarda barındırma ve altyapı hizmeti aldığımız teknoloji firmaları,

Yetkili Kurumlar: Yasal yükümlülükler gereği talep edilmesi hâlinde resmi kamu kurum ve kuruluşları.

6. Kişisel Verilerin Saklanma Süresi
İşlenen verileriniz, ilgili yasal mevzuatlarda (Türk Ticaret Kanunu, Vergi Usul Kanunu vb.) öngörülen saklama süreleri boyunca muhafaza edilir. Yasal sürelerin dolması veya işleme amacının ortadan kalkması hâlinde verileriniz periyodik imha politikamıza uygun olarak silinir, yok edilir veya anonim hâle getirilir.

7. İlgili Kişi Olarak Haklarınız (KVKK Madde 11)
KVKK kapsamında; verilerinizin işlenip işlenmediğini öğrenme, işlenme amacını bilme, yurt içi/yurt dışı aktarım durumunu öğrenme, eksik/yanlış verilerin düzeltilmesini ve şartları oluştuğunda silinmesini talep etme haklarına sahipsiniz.

Bu haklarınızı kullanmak için taleplerinizi info@hanedanperde.com.tr adresine güvenli elektronik imza ile veya kimliğinizi doğrulayan yazılı bir dilekçe ile iletebilirsiniz. Başvurularınız en geç 30 gün içinde ücretsiz olarak sonuçlandırılacaktır.
            </p>
          </div>
        )}
      </LegalModal>
    </div>
  );
}
