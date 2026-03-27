'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Star,
  Loader2,
  X,
  Phone,
  ChevronDown,
  Pencil,
  Building2,
  Home,
  Briefcase,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type Address,
  type AddressInput,
} from '@/lib/actions/addresses';
import { CITY_NAMES, getDistricts } from '@/lib/data/turkey-cities';

// ── Tipler & sabitler ────────────────────────────────────────────────────────

const TITLE_OPTIONS = ['Ev', 'İş', 'Diğer'] as const;

const emptyForm = (): AddressInput => ({
  title:         '',
  first_name:    '',
  last_name:     '',
  phone:         '',
  address_line:  '',
  neighbourhood: '',
  district:      '',
  city:          '',
  postal_code:   '',
  billing_type:  'INDIVIDUAL',
  tax_number:    '',
  tax_office:    '',
  company_name:  '',
  is_default:    false,
});

function addressToInput(a: Address): AddressInput {
  return {
    title:         a.title,
    first_name:    a.first_name,
    last_name:     a.last_name,
    phone:         a.phone,
    address_line:  a.address_line,
    neighbourhood: a.neighbourhood ?? '',
    district:      a.district,
    city:          a.city,
    postal_code:   a.postal_code ?? '',
    billing_type:  a.billing_type,
    tax_number:    a.tax_number ?? '',
    tax_office:    a.tax_office ?? '',
    company_name:  '',
    is_default:    a.is_default,
  };
}

// ── Stil sabitleri ───────────────────────────────────────────────────────────

const inputClass  = 'h-input';
const selectClass = 'h-input appearance-none cursor-pointer pr-8 bg-white';
const labelClass  = 'block text-[8px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-2';

// ── Modal bileşeni ───────────────────────────────────────────────────────────

interface ModalProps {
  mode:     'create' | 'edit';
  initial:  AddressInput;
  onClose:  () => void;
  onSave:   (data: AddressInput, editId?: string) => Promise<void>;
  editId?:  string;
  saving:   boolean;
  error:    string | null;
}

function AddressModal({ mode, initial, onClose, onSave, editId, saving, error }: ModalProps) {
  const [form, setForm]               = useState<AddressInput>(initial);
  const [districts, setDistricts]     = useState<string[]>(() => getDistricts(initial.city ?? ''));

  // İl değişince ilçe listesini güncelle
  useEffect(() => {
    const list = getDistricts(form.city ?? '');
    setDistricts(list);
    if (form.district && !list.includes(form.district)) {
      setForm((prev) => ({ ...prev, district: '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city]);

  const set = (field: keyof AddressInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({
        ...prev,
        [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
      }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form, editId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-[#F3F4F6] w-full max-w-xl max-h-[92vh] flex flex-col">
        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6] shrink-0">
          <h2 className="font-serif text-black text-[13px] tracking-[0.15em] uppercase">
            {mode === 'create' ? 'Yeni Adres Ekle' : 'Adresi Düzenle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-[#F3F4F6] hover:border-[#B89947]/50 hover:text-[#B89947] transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form id="address-modal-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Hata */}
          {error && (
            <div className="flex items-start gap-3 p-3 border border-red-300 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600 text-[10px] tracking-[0.1em]">{error}</p>
            </div>
          )}

          {/* Başlık seçimi */}
          <div>
            <label className={labelClass}>Adres Başlığı *</label>
            <div className="relative">
              <select value={form.title} onChange={set('title')} required className={selectClass}>
                <option value="">Seçiniz</option>
                {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
            </div>
          </div>

          {/* Ad / Soyad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ad *</label>
              <input type="text" value={form.first_name} onChange={set('first_name')} required className={inputClass} placeholder="Adınız" />
            </div>
            <div>
              <label className={labelClass}>Soyad</label>
              <input type="text" value={form.last_name} onChange={set('last_name')} className={inputClass} placeholder="Soyadınız" />
            </div>
          </div>

          {/* Telefon */}
          <div>
            <label className={labelClass}>Telefon *</label>
            <input type="tel" value={form.phone} onChange={set('phone')} required className={inputClass} placeholder="05xx xxx xx xx" />
          </div>

          {/* Bireysel / Kurumsal */}
          <div>
            <label className={labelClass}>Fatura Tipi</label>
            <div className="flex gap-3">
              {(['INDIVIDUAL', 'CORPORATE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, billing_type: type }))}
                  className={`flex-1 py-2.5 text-[9px] tracking-[0.2em] uppercase border transition-colors duration-200 ${
                    form.billing_type === type
                      ? 'border-black bg-black text-white'
                      : 'border-[#E5E7EB] text-[#9CA3AF] hover:border-black hover:text-black'
                  }`}
                >
                  {type === 'INDIVIDUAL' ? 'Bireysel' : 'Kurumsal'}
                </button>
              ))}
            </div>
          </div>

          {/* Kurumsal alanlar */}
          {form.billing_type === 'CORPORATE' && (
            <div className="space-y-4 p-4 border border-[#F3F4F6] bg-[#FAFAFA]">
              <p className="text-[#9CA3AF] text-[8px] tracking-[0.15em] uppercase">Kurumsal Bilgiler</p>
              <div>
                <label className={labelClass}>Şirket Unvanı *</label>
                <input type="text" value={form.company_name ?? ''} onChange={set('company_name')} required className={inputClass} placeholder="Şirket Unvanı" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>VKN (10 hane) *</label>
                  <input type="text" value={form.tax_number ?? ''} onChange={set('tax_number')} required maxLength={10} className={inputClass} placeholder="1234567890" />
                </div>
                <div>
                  <label className={labelClass}>Vergi Dairesi *</label>
                  <input type="text" value={form.tax_office ?? ''} onChange={set('tax_office')} required className={inputClass} placeholder="Kadıköy VD" />
                </div>
              </div>
            </div>
          )}

          {/* İl / İlçe */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>İl *</label>
              <div className="relative">
                <select value={form.city} onChange={set('city')} required className={selectClass}>
                  <option value="">İl seçin</option>
                  {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelClass}>İlçe *</label>
              <div className="relative">
                <select value={form.district} onChange={set('district')} required disabled={!form.city} className={`${selectClass} disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]`}>
                  <option value="">{form.city ? 'İlçe seçin' : 'Önce il seçin'}</option>
                  {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Mahalle */}
          <div>
            <label className={labelClass}>Mahalle</label>
            <input type="text" value={form.neighbourhood ?? ''} onChange={set('neighbourhood')} className={inputClass} placeholder="Mahalle adı" />
          </div>

          {/* Açık adres */}
          <div>
            <label className={labelClass}>Açık Adres *</label>
            <textarea value={form.address_line} onChange={set('address_line')} required rows={2} className={`${inputClass} resize-none`} placeholder="Sokak, Bina No, Daire No..." />
          </div>

          {/* Posta kodu */}
          <div className="w-1/2">
            <label className={labelClass}>Posta Kodu</label>
            <input type="text" value={form.postal_code ?? ''} onChange={set('postal_code')} maxLength={5} className={inputClass} placeholder="34000" />
          </div>

          {/* Varsayılan */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.is_default}
              onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
              className="w-4 h-4 border border-[#B89947]/30 cursor-pointer accent-[#B89947]"
            />
            <span className="text-[#9CA3AF] text-[9px] tracking-[0.2em] uppercase">
              Varsayılan teslimat adresi olarak kaydet
            </span>
          </label>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#F3F4F6] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            type="submit"
            form="address-modal-form"
            disabled={saving}
            className="flex-1 h-btn disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
            ) : mode === 'create' ? (
              <><Plus className="w-4 h-4" /> Ekle</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Kaydet</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Adres kartı bileşeni ─────────────────────────────────────────────────────

interface CardProps {
  address:        Address;
  actionLoading:  string | null;
  deleteConfirm:  string | null;
  onEdit:         (a: Address) => void;
  onSetDefault:   (id: string) => void;
  onDeleteAsk:    (id: string) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm:(id: string) => void;
}

function AddressCard({
  address, actionLoading, deleteConfirm,
  onEdit, onSetDefault, onDeleteAsk, onDeleteCancel, onDeleteConfirm,
}: CardProps) {
  const isBusy = actionLoading === address.id;

  const TitleIcon =
    address.title === 'Ev'  ? Home      :
    address.title === 'İş'  ? Briefcase :
    Building2;

  return (
    <div className={`border bg-white flex flex-col transition-colors duration-200 ${
      address.is_default ? 'border-[#B89947]/50' : 'border-[#F3F4F6]'
    }`}>
      {/* Üst şerit */}
      <div className={`px-5 py-3 flex items-center justify-between border-b ${
        address.is_default ? 'border-[#B89947]/30 bg-[#FAFAFA]' : 'border-[#F3F4F6] bg-[#FAFAFA]'
      }`}>
        <div className="flex items-center gap-2">
          <TitleIcon className={`w-3.5 h-3.5 ${address.is_default ? 'text-[#B89947]' : 'text-[#9CA3AF]'}`} />
          <span className={`text-[9px] tracking-[0.2em] uppercase font-medium ${
            address.is_default ? 'text-[#B89947]' : 'text-black'
          }`}>
            {address.title}
          </span>
        </div>
        {address.is_default && (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-[#B89947] fill-[#B89947]" />
            <span className="text-[7px] tracking-[0.2em] uppercase text-[#B89947]">Varsayılan</span>
          </div>
        )}
        {address.billing_type === 'CORPORATE' && (
          <span className="text-[7px] tracking-[0.2em] uppercase border border-[#F3F4F6] px-1.5 py-0.5 text-[#9CA3AF]">
            Kurumsal
          </span>
        )}
      </div>

      {/* İçerik */}
      <div className="px-5 py-4 flex-1 space-y-2">
        <p className="text-black text-[10px] tracking-[0.1em]">
          {address.first_name} {address.last_name}
        </p>
        <div className="flex items-center gap-1.5 text-[#9CA3AF]">
          <Phone className="w-3 h-3 shrink-0" />
          <span className="text-[9px] tracking-[0.05em]">{address.phone}</span>
        </div>
        <div className="flex items-start gap-1.5 text-[#9CA3AF]">
          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="text-[9px] tracking-[0.05em] leading-relaxed">
            {[
              address.neighbourhood,
              address.address_line,
              address.district,
              address.city,
              address.postal_code,
            ].filter(Boolean).join(', ')}
          </span>
        </div>
        {address.tax_number && (
          <p className="text-[#9CA3AF] text-[8px] tracking-[0.05em]">
            VKN: {address.tax_number} — {address.tax_office}
          </p>
        )}
      </div>

      {/* Aksiyonlar */}
      <div className="px-5 py-3 border-t border-[#F3F4F6] flex items-center gap-2">
        {/* Varsayılan yap */}
        {!address.is_default && (
          <button
            type="button"
            onClick={() => onSetDefault(address.id)}
            disabled={isBusy}
            className="flex items-center gap-1 text-[8px] tracking-[0.15em] uppercase text-[#9CA3AF] hover:text-[#B89947] transition-colors duration-200 disabled:opacity-40"
          >
            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
            Varsayılan Yap
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Düzenle */}
          <button
            type="button"
            onClick={() => onEdit(address)}
            disabled={isBusy}
            className="flex items-center gap-1 text-[8px] tracking-[0.15em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200 disabled:opacity-40 px-2 py-1 border border-[#F3F4F6] hover:border-[#9CA3AF]"
          >
            <Pencil className="w-3 h-3" />
            Düzenle
          </button>

          {/* Sil — inline onay */}
          {deleteConfirm === address.id ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDeleteConfirm(address.id)}
                disabled={isBusy}
                className="text-[8px] tracking-[0.15em] uppercase px-2 py-1 border border-red-300 text-red-500 hover:bg-red-50 transition-colors duration-200 disabled:opacity-40"
              >
                {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Evet, Sil'}
              </button>
              <button
                type="button"
                onClick={onDeleteCancel}
                disabled={isBusy}
                className="text-[8px] tracking-[0.15em] uppercase px-2 py-1 border border-[#F3F4F6] text-[#9CA3AF] hover:border-[#9CA3AF] transition-colors duration-200"
              >
                İptal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onDeleteAsk(address.id)}
              disabled={isBusy}
              className="flex items-center gap-1 text-[8px] tracking-[0.15em] uppercase text-red-400/80 hover:text-red-500 transition-colors duration-200 disabled:opacity-40 px-2 py-1 border border-red-200/60 hover:border-red-300"
            >
              <Trash2 className="w-3 h-3" />
              Sil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Ana sayfa bileşeni ────────────────────────────────────────────────────────

export default function AccountAddressesPage() {
  const [addresses, setAddresses]     = useState<Address[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);

  // Modal
  const [modalMode, setModalMode]     = useState<'create' | 'edit'>('create');
  const [showModal, setShowModal]     = useState(false);
  const [editId, setEditId]           = useState<string | undefined>();
  const [modalInitial, setModalInitial] = useState<AddressInput>(emptyForm());
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError]   = useState<string | null>(null);

  // Kart aksiyonları
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Toast
  const [toast, setToast]             = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Yükle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const result = await getAddresses();
      if (result.success && result.data) {
        setAddresses(result.data);
      } else {
        setPageError(result.error ?? 'Adresler yüklenemedi');
      }
      setIsLoading(false);
    })();
  }, []);

  // ── Modal işlemleri ───────────────────────────────────────────────────
  const openCreate = () => {
    setModalMode('create');
    setModalInitial(emptyForm());
    setEditId(undefined);
    setModalError(null);
    setShowModal(true);
  };

  const openEdit = (addr: Address) => {
    setModalMode('edit');
    setModalInitial(addressToInput(addr));
    setEditId(addr.id);
    setModalError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (modalSaving) return;
    setShowModal(false);
  };

  const handleSave = async (data: AddressInput, id?: string) => {
    setModalSaving(true);
    setModalError(null);

    const result = id
      ? await updateAddress(id, data)
      : await createAddress(data);

    if (result.success && result.data) {
      if (id) {
        setAddresses((prev) => {
          const next = prev.map((a) => {
            if (a.id === id) return result.data!;
            // is_default değişmişse diğerlerini false yap
            if (result.data!.is_default) return { ...a, is_default: false };
            return a;
          });
          return next;
        });
      } else {
        setAddresses((prev) => {
          const next = data.is_default
            ? prev.map((a) => ({ ...a, is_default: false }))
            : [...prev];
          return [result.data!, ...next];
        });
      }
      setShowModal(false);
      showToast(id ? 'Adres güncellendi.' : 'Yeni adres eklendi.', 'ok');
    } else {
      setModalError(result.error ?? 'İşlem başarısız');
    }

    setModalSaving(false);
  };

  // ── Varsayılan yap ────────────────────────────────────────────────────
  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    const result = await setDefaultAddress(id);
    if (result.success) {
      setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
      showToast('Varsayılan adres güncellendi.', 'ok');
    } else {
      showToast(result.error ?? 'İşlem başarısız', 'err');
    }
    setActionLoading(null);
  };

  // ── Sil ──────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async (id: string) => {
    setActionLoading(id);
    const result = await deleteAddress(id);
    if (result.success) {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
      showToast('Adres silindi.', 'ok');
    } else {
      showToast(result.error ?? 'Adres silinemedi', 'err');
    }
    setActionLoading(null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#B89947] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 border shadow-lg transition-all duration-300 ${
          toast.type === 'ok'
            ? 'border-[#B89947]/40 bg-[#FAFAFA] text-[#B89947]'
            : 'border-red-300 bg-red-50 text-red-600'
        }`}>
          {toast.type === 'ok'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />
          }
          <span className="text-[9px] tracking-[0.2em] uppercase">{toast.msg}</span>
        </div>
      )}

      {/* Başlık */}
      <div className="border border-[#F3F4F6] p-6 bg-white flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-black text-xl tracking-[0.05em]">
            Adreslerim
          </h1>
          <p className="text-[#9CA3AF] text-[9px] tracking-[0.15em] mt-2">
            Kayıtlı teslimat ve fatura adreslerinizi yönetin.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-btn shrink-0 flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Yeni Adres
        </button>
      </div>

      {/* Sayfa hatası */}
      {pageError && (
        <div className="flex items-center gap-3 border border-red-300 bg-red-50 p-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-red-600 text-[10px] tracking-[0.1em]">{pageError}</p>
        </div>
      )}

      {/* Boş durum */}
      {addresses.length === 0 && !pageError && (
        <div className="border border-[#F3F4F6] bg-white py-16 text-center">
          <MapPin className="w-10 h-10 text-black/10 mx-auto mb-5" />
          <h2 className="font-serif text-black text-[13px] tracking-[0.1em] mb-3">
            Kayıtlı Adres Yok
          </h2>
          <p className="text-[#9CA3AF] text-[9px] tracking-[0.15em] mb-8">
            Siparişlerinizde hızlı kullanmak için adres ekleyin.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="h-btn inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            İlk Adresinizi Ekleyin
          </button>
        </div>
      )}

      {/* Adres kartları */}
      {addresses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              actionLoading={actionLoading}
              deleteConfirm={deleteConfirm}
              onEdit={openEdit}
              onSetDefault={handleSetDefault}
              onDeleteAsk={(id) => setDeleteConfirm(id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
              onDeleteConfirm={handleDeleteConfirm}
            />
          ))}

          {/* Yeni adres ekleme kartı */}
          <button
            type="button"
            onClick={openCreate}
            className="border border-dashed border-[#F3F4F6] hover:border-[#B89947]/50 bg-white flex flex-col items-center justify-center gap-3 py-10 transition-colors duration-200 group min-h-[180px]"
          >
            <div className="w-8 h-8 border border-[#F3F4F6] group-hover:border-[#B89947]/50 flex items-center justify-center transition-colors duration-200">
              <Plus className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#B89947] transition-colors duration-200" />
            </div>
            <span className="text-[8px] tracking-[0.25em] uppercase text-[#9CA3AF] group-hover:text-[#B89947] transition-colors duration-200">
              Yeni Adres Ekle
            </span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AddressModal
          mode={modalMode}
          initial={modalInitial}
          editId={editId}
          onClose={closeModal}
          onSave={handleSave}
          saving={modalSaving}
          error={modalError}
        />
      )}
    </div>
  );
}
