'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { placeOrder, validateOrder, getServerCalculatedPrices, type CheckoutFormInput } from '@/lib/actions/checkout';
import { initiateCheckoutFormPayment } from '@/lib/actions/payment';
import { syncCart } from '@/lib/actions/cart';
import { formatPrice } from '@/lib/utils';
import { PILE_LABELS_UPPER, SHIPPING, type CheckoutFormData } from '@/types';
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
  const router   = useRouter();
  const supabase = createClient();

  const [mounted, setMounted]             = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isValidating, setIsValidating]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated]   = useState<boolean | null>(null);

  // Sepet
  const items          = useCartStore((s) => s.items);
  const clearCart      = useCartStore((s) => s.clearCart);
  const getCartSummary = useCartStore((s) => s.getCartSummary);

  // Server fiyatları
  const [serverPrices, setServerPrices] = useState<{
    subtotal: number; shippingCost: number; total: number;
  } | null>(null);

  // Kayıtlı adresler
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Yasal belgeler
  const [legalDocs, setLegalDocs]         = useState<LegalDoc[]>([]);
  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set());

  // Form alanları
  const [email, setEmail]             = useState('');
  const [shipping, setShipping]       = useState<AddressForm>(emptyAddress());
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billing, setBilling]         = useState<AddressForm>(emptyAddress());
  const [billingExtra, setBillingExtra] = useState<BillingExtra>(emptyBillingExtra());
  const [customerNote, setCustomerNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash_on_delivery' | 'credit_card'>('bank_transfer');

  // İlçe listeleri (cascade)
  const [shippingDistricts, setShippingDistricts] = useState<string[]>([]);
  const [billingDistricts, setBillingDistricts]   = useState<string[]>([]);

  // ── İl → ilçe cascade ───────────────────────────────────────────────────
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

  // ── Auth + profil + adresler + yasal belgeler ───────────────────────────
  useEffect(() => {
    setMounted(true);

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);

      // Profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, phone')
        .eq('id', user.id)
        .single();

      if (profile) {
        setEmail(profile.email || user.email || '');
        // full_name → firstName + lastName ayrıştırması
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
        // Varsayılan adresi ön seç
        const def = addresses.find((a) => a.is_default) ?? addresses[0];
        applyAddress(def as SavedAddress);
        setSelectedAddressId(def.id);
      }

      // Yasal belgeler
      const { data: docs } = await supabase
        .from('legal_document_versions')
        .select('id, document_type, version, content_url')
        .in('document_type', ['ON_BILGILENDIRME', 'MESAFELI_SATIS'])
        .eq('is_active', true);

      if (docs?.length) {
        setLegalDocs(docs as LegalDoc[]);
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sepet fiyat doğrulama ────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !isAuthenticated || items.length === 0) return;

    const validateAndSync = async () => {
      setIsValidating(true);
      setValidationErrors([]);
      try {
        await syncCart(items);
        const pricesResult = await getServerCalculatedPrices(items);
        if (pricesResult.success && pricesResult.data) {
          setServerPrices({
            subtotal:     pricesResult.data.subtotal,
            shippingCost: pricesResult.data.shippingCost,
            total:        pricesResult.data.total,
          });
        }
        const validationResult = await validateOrder(items);
        if (validationResult.success && validationResult.data && !validationResult.data.valid) {
          setValidationErrors(validationResult.data.errors);
        }
      } catch (err) {
        console.error('Validation error:', err);
      } finally {
        setIsValidating(false);
      }
    };

    validateAndSync();
  }, [mounted, isAuthenticated, items]);

  // ── Kayıtlı adres seçimi ─────────────────────────────────────────────────
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

  // ── Form yardımcıları ────────────────────────────────────────────────────
  const updateShipping = (field: keyof AddressForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setSelectedAddressId(null);
    setShipping((prev) => ({ ...prev, [field]: e.target.value }));
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

  // ── Gönderim ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (validationErrors.length > 0) {
        setError(`Sipariş doğrulama hatası: ${validationErrors.join(', ')}`);
        setIsLoading(false);
        return;
      }

      const allDocIds = legalDocs.map((d) => d.id);
      const allChecked = allDocIds.every((id) => checkedDocIds.has(id));
      if (legalDocs.length > 0 && !allChecked) {
        setError('Devam etmek için tüm yasal belgeleri onaylamanız gerekmektedir.');
        setIsLoading(false);
        return;
      }

      const formInput: CheckoutFormInput = {
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
      };

      if (paymentMethod === 'credit_card') {
        // Uyumluluk katmanı — payment.ts eski tipi kullanıyor
        const legacyFormData: CheckoutFormData = {
          email,
          fullName:        `${shipping.firstName} ${shipping.lastName}`.trim(),
          phone:           shipping.phone,
          shippingAddress: [
            shipping.addressLine,
            shipping.neighbourhood,
            shipping.district,
            shipping.city,
            shipping.postalCode,
          ].filter(Boolean).join(', '),
          billingAddress: sameAsBilling ? undefined : [
            billing.addressLine,
            billing.neighbourhood,
            billing.district,
            billing.city,
            billing.postalCode,
          ].filter(Boolean).join(', '),
          sameAsBilling,
          customerNote,
          paymentMethod: 'credit_card',
        };

        const result = await initiateCheckoutFormPayment(items, legacyFormData);
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Ödeme başlatılamadı');
        }
        document.open();
        document.write(result.data.checkoutFormContent);
        document.close();
        return;
      }

      const result = await placeOrder(items, formInput);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Sipariş oluşturulamadı');
      }

      clearCart();
      router.push(`/odeme/basarili?order=${result.data.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.');
      setIsLoading(false);
    }
  };

  // ── Yükleniyor / boş sepet / giriş gerekli ───────────────────────────────

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

  if (isAuthenticated === false) {
    return (
      <div className="bg-white min-h-screen">
        <div className="h-container py-24 text-center">
          <p className="h-eyebrow justify-center mb-6">Giriş Gerekli</p>
          <h1 className="font-serif text-black text-2xl tracking-[0.05em] mb-4">
            Giriş Yapmanız Gerekiyor
          </h1>
          <p className="text-[#9CA3AF] text-[11px] tracking-[0.1em] mb-10">
            Sipariş verebilmek için lütfen giriş yapın veya kayıt olun.
          </p>
          <Link href={`/giris?redirect=/odeme`} className="h-btn">Giriş Yap</Link>
        </div>
      </div>
    );
  }

  // ── Görüntülenen değerler ────────────────────────────────────────────────
  const clientSummary    = getCartSummary();
  const displaySubtotal  = serverPrices?.subtotal     ?? clientSummary.subtotal;
  const displayShipping  = serverPrices?.shippingCost ?? clientSummary.shippingCost;
  const displayTotal     = serverPrices?.total        ?? clientSummary.total;
  const hasValidErrors   = validationErrors.length > 0;

  const allDocIds        = legalDocs.map((d) => d.id);
  const allDocsChecked   = allDocIds.length === 0 || allDocIds.every((id) => checkedDocIds.has(id));

  // ── Stil sabitleri ───────────────────────────────────────────────────────
  const inputClass   = 'h-input';
  const selectClass  = 'h-input appearance-none cursor-pointer pr-8 bg-white';
  const sectionClass = 'border border-[#F3F4F6] p-6 bg-white';
  const labelClass   = 'block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2';

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-[#F3F4F6]">
        <div className="h-container py-4">
          <nav className="flex items-center gap-2">
            <Link href="/" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">
              Ana Sayfa
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <Link href="/sepet" className="text-[#9CA3AF] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300">
              Sepet
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <span className="text-[#B89947]/70 text-[9px] tracking-[0.3em] uppercase">Ödeme</span>
          </nav>
        </div>
      </div>

      <div className="h-container py-10 lg:py-16">
        <div className="flex items-center justify-between mb-10">
          <h1 className="font-serif text-black text-2xl lg:text-3xl tracking-[0.05em]">
            Ödeme
          </h1>
          <Link href="/sepet" className="text-[#9CA3AF] text-[9px] tracking-[0.25em] uppercase hover:text-[#B89947] flex items-center gap-1.5 transition-colors duration-300">
            <ArrowLeft className="w-3 h-3" />
            Sepete Dön
          </Link>
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
            {/* Sol sütun — form */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── Kayıtlı Adreslerim ── */}
              {savedAddresses.length > 0 && (
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
                            isSelected
                              ? 'border-[#B89947]/60 bg-[#FAFAFA]'
                              : 'border-[#F3F4F6] hover:border-[#B89947]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-black text-[9px] tracking-[0.2em] uppercase font-medium">
                              {addr.title}
                            </span>
                            {addr.is_default && (
                              <span className="text-[#B89947]/70 text-[7px] tracking-[0.15em] uppercase border border-[#B89947]/30 px-1.5 py-0.5">
                                Varsayılan
                              </span>
                            )}
                          </div>
                          <p className="text-black text-[9px] tracking-[0.05em]">
                            {addr.first_name} {addr.last_name}
                          </p>
                          <p className="text-[#9CA3AF] text-[8px] tracking-[0.05em] mt-0.5 line-clamp-2">
                            {addr.address_line}, {addr.district} / {addr.city}
                          </p>
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
                    Farklı bir adres kullanmak için aşağıdaki alanlarda değişiklik yapabilirsiniz.
                  </p>
                </div>
              )}

              {/* ── İletişim Bilgileri ── */}
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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={`${inputClass} pl-10`}
                        placeholder="ornek@email.com"
                      />
                    </div>
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
                        className={`${inputClass} pl-10`}
                        placeholder="05xx xxx xx xx"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Teslimat Adresi ── */}
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
                        className={inputClass}
                        placeholder="Adınız"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Soyad</label>
                      <input
                        type="text"
                        value={shipping.lastName}
                        onChange={updateShipping('lastName')}
                        className={inputClass}
                        placeholder="Soyadınız"
                      />
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
                          className={selectClass}
                        >
                          <option value="">İl seçin</option>
                          {CITY_NAMES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>İlçe *</label>
                      <div className="relative">
                        <select
                          value={shipping.district}
                          onChange={updateShipping('district')}
                          required
                          disabled={!shipping.city}
                          className={`${selectClass} disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed`}
                        >
                          <option value="">{shipping.city ? 'İlçe seçin' : 'Önce il seçin'}</option>
                          {shippingDistricts.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Mahalle */}
                  <div>
                    <label className={labelClass}>Mahalle</label>
                    <input
                      type="text"
                      value={shipping.neighbourhood}
                      onChange={updateShipping('neighbourhood')}
                      className={inputClass}
                      placeholder="Mahalle adı"
                    />
                  </div>

                  {/* Adres satırı */}
                  <div>
                    <label className={labelClass}>Açık Adres *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-[#9CA3AF]" />
                      <textarea
                        value={shipping.addressLine}
                        onChange={updateShipping('addressLine')}
                        required
                        rows={2}
                        className={`${inputClass} pl-10 resize-none`}
                        placeholder="Sokak, Bina No, Daire No..."
                      />
                    </div>
                  </div>

                  {/* Posta kodu */}
                  <div className="md:w-1/3">
                    <label className={labelClass}>Posta Kodu</label>
                    <input
                      type="text"
                      value={shipping.postalCode}
                      onChange={updateShipping('postalCode')}
                      maxLength={5}
                      className={inputClass}
                      placeholder="34000"
                    />
                  </div>
                </div>

                {/* Fatura adresi aynı mı? */}
                <div className="mt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="w-4 h-4 border border-[#B89947]/30 cursor-pointer accent-[#B89947]"
                    />
                    <span className="text-[#9CA3AF] text-[9px] tracking-[0.2em] uppercase">
                      Fatura adresi teslimat adresi ile aynı
                    </span>
                  </label>
                </div>
              </div>

              {/* ── Fatura Adresi (farklıysa) ── */}
              {!sameAsBilling && (
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#B89947]/60" />
                    Fatura Adresi
                  </h2>

                  {/* Bireysel / Kurumsal toggle */}
                  <div className="flex gap-3 mb-6">
                    {(['INDIVIDUAL', 'CORPORATE'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBillingExtra((prev) => ({ ...prev, billingType: type }))}
                        className={`flex-1 py-2.5 text-[9px] tracking-[0.2em] uppercase border transition-colors duration-200 ${
                          billingExtra.billingType === type
                            ? 'border-black bg-black text-white'
                            : 'border-[#E5E7EB] text-[#9CA3AF] hover:border-black hover:text-black'
                        }`}
                      >
                        {type === 'INDIVIDUAL' ? 'Bireysel' : 'Kurumsal'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {/* Ad / Soyad */}
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

                    {/* Kurumsal alanlar */}
                    {billingExtra.billingType === 'CORPORATE' && (
                      <div className="space-y-4 p-4 border border-[#F3F4F6] bg-[#FAFAFA]">
                        <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] uppercase">Kurumsal Fatura Bilgileri</p>
                        <div>
                          <label className={labelClass}>Şirket Unvanı *</label>
                          <input type="text" value={billingExtra.companyName} onChange={updateBillingExtra('companyName')} required className={inputClass} placeholder="Şirket Unvanı" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelClass}>Vergi Numarası (VKN) *</label>
                            <input type="text" value={billingExtra.taxNumber} onChange={updateBillingExtra('taxNumber')} required maxLength={10} className={inputClass} placeholder="1234567890" />
                          </div>
                          <div>
                            <label className={labelClass}>Vergi Dairesi *</label>
                            <input type="text" value={billingExtra.taxOffice} onChange={updateBillingExtra('taxOffice')} required className={inputClass} placeholder="Kadıköy VD" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Telefon */}
                    <div>
                      <label className={labelClass}>Telefon *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <input type="tel" value={billing.phone} onChange={updateBilling('phone')} required={!sameAsBilling} className={`${inputClass} pl-10`} placeholder="05xx xxx xx xx" />
                      </div>
                    </div>

                    {/* İl / İlçe */}
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

                    {/* Mahalle */}
                    <div>
                      <label className={labelClass}>Mahalle</label>
                      <input type="text" value={billing.neighbourhood} onChange={updateBilling('neighbourhood')} className={inputClass} placeholder="Mahalle adı" />
                    </div>

                    {/* Adres satırı */}
                    <div>
                      <label className={labelClass}>Açık Adres *</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-[#9CA3AF]" />
                        <textarea value={billing.addressLine} onChange={updateBilling('addressLine')} required={!sameAsBilling} rows={2} className={`${inputClass} pl-10 resize-none`} placeholder="Sokak, Bina No, Daire No..." />
                      </div>
                    </div>

                    {/* Posta kodu */}
                    <div className="md:w-1/3">
                      <label className={labelClass}>Posta Kodu</label>
                      <input type="text" value={billing.postalCode} onChange={updateBilling('postalCode')} maxLength={5} className={inputClass} placeholder="34000" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Ödeme Yöntemi ── */}
              <div className={sectionClass}>
                <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#B89947]/60" />
                  Ödeme Yöntemi
                </h2>
                <div className="space-y-3">
                  {[
                    { value: 'bank_transfer',    label: 'Havale / EFT',   desc: 'Banka havalesi ile ödeme' },
                    { value: 'cash_on_delivery', label: 'Kapıda Ödeme',  desc: 'Teslimat sırasında nakit veya kart' },
                    { value: 'credit_card',      label: 'Kredi Kartı',   desc: '3D Secure ile güvenli ödeme' },
                  ].map((method) => (
                    <label
                      key={method.value}
                      className={`flex items-center gap-4 p-4 border cursor-pointer transition-colors duration-200 ${
                        paymentMethod === method.value
                          ? 'border-black bg-white'
                          : 'border-[#F3F4F6] hover:border-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.value}
                        checked={paymentMethod === method.value}
                        onChange={() => setPaymentMethod(method.value as typeof paymentMethod)}
                        className="w-4 h-4 accent-[#B89947]"
                      />
                      <div className="flex-1">
                        <p className="text-black text-[10px] tracking-[0.15em] uppercase">{method.label}</p>
                        <p className="text-[#9CA3AF] text-[9px] tracking-[0.1em] mt-0.5">{method.desc}</p>
                      </div>
                      {method.value === 'credit_card' && (
                        <ShieldCheck className="w-4 h-4 text-[#B89947]/50" />
                      )}
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

              {/* ── Sipariş Notu ── */}
              <div className={sectionClass}>
                <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#B89947]/60" />
                  Sipariş Notu
                </h2>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Özel istekleriniz varsa buraya yazabilirsiniz..."
                />
              </div>

              {/* ── Yasal Onaylar ── */}
              {legalDocs.length > 0 && (
                <div className={sectionClass}>
                  <h2 className="font-serif text-black text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#B89947]/60" />
                    Sözleşme Onayları
                  </h2>
                  <div className="space-y-3">
                    {legalDocs.map((doc) => (
                      <label key={doc.id} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checkedDocIds.has(doc.id)}
                          onChange={() => toggleDoc(doc.id)}
                          className="w-4 h-4 mt-0.5 border border-[#B89947]/30 cursor-pointer accent-[#B89947] shrink-0"
                        />
                        <span className="text-[#9CA3AF] text-[9px] tracking-[0.1em] leading-relaxed">
                          {DOC_LABELS[doc.document_type] ?? doc.document_type}
                          {' '}v{doc.version}&apos;i okudum, anladım ve kabul ediyorum.
                          {doc.content_url && (
                            <>
                              {' '}
                              <a
                                href={doc.content_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#B89947]/80 underline hover:text-[#B89947] transition-colors duration-200"
                              >
                                Metni oku
                              </a>
                            </>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  {!allDocsChecked && (
                    <p className="mt-3 text-[#9CA3AF] text-[8px] tracking-[0.1em]">
                      Siparişi tamamlamak için tüm sözleşmeleri onaylamanız gerekmektedir.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sağ sütun — sipariş özeti */}
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
                        <p className="text-[#9CA3AF] text-[8px] tracking-[0.05em] mt-0.5">
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
                    <p className="text-[#9CA3AF] text-[8px] tracking-[0.05em]">
                      {formatPrice(SHIPPING.FREE_THRESHOLD - displaySubtotal)} daha ekleyin, kargo bedava!
                    </p>
                  )}
                </div>

                <div className="border-t border-[#F3F4F6] my-4 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-black text-[9px] tracking-[0.2em] uppercase">Toplam</span>
                    <span className="font-serif text-[#B89947] font-bold text-xl">
                      {formatPrice(displayTotal)}
                    </span>
                  </div>
                  <p className="text-[#9CA3AF] text-[8px] tracking-[0.05em] mt-1">KDV dahil</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isValidating || hasValidErrors || !allDocsChecked}
                  className="h-btn w-full mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
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

                <div className="mt-6 pt-6 border-t border-[#F3F4F6] space-y-3">
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
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
