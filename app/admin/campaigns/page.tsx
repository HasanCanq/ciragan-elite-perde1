'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Tag, Plus, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Loader2,
  TrendingUp, Users, AlertCircle, CheckCircle,
} from 'lucide-react';
import {
  getCampaigns,
  getCouponsForCampaign,
  createCampaign,
  createCoupon,
  updateCampaignStatus,
  toggleCouponActive,
  type CampaignRow,
  type CouponRow,
  type CreateCampaignInput,
  type CreateCouponInput,
} from '@/lib/actions/campaigns';

// ── Yardımcı ─────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT:   { label: 'Taslak',  cls: 'bg-gray-100 text-gray-600' },
  ACTIVE:  { label: 'Aktif',   cls: 'bg-green-100 text-green-700' },
  PAUSED:  { label: 'Duraklatıldı', cls: 'bg-yellow-100 text-yellow-700' },
  EXPIRED: { label: 'Sona Erdi', cls: 'bg-red-100 text-red-600' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDiscount(kind: string, value: number) {
  return kind === 'PERCENTAGE'
    ? `%${(value * 100).toFixed(0)}`
    : `₺${value.toFixed(2)}`;
}

// ── Create Campaign Form ──────────────────────────────────────

function CreateCampaignForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [form, setForm] = useState<CreateCampaignInput>({
    name:      '',
    status:    'ACTIVE',
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at:   '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createCampaign({
      ...form,
      ends_at: form.ends_at || undefined,
    });

    if (res.success) {
      setForm({ name: '', status: 'ACTIVE', starts_at: new Date().toISOString().slice(0, 16), ends_at: '' });
      onSuccess();
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kampanya Adı *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Yaza Giris 2025"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'DRAFT' | 'ACTIVE' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          >
            <option value="ACTIVE">Aktif — Hemen başlat</option>
            <option value="DRAFT">Taslak — Henüz yayınlama</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç *</label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bitiş <span className="text-gray-400 font-normal">(boş = süresiz)</span>
          </label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
          <input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="İç not (müşteriye gösterilmez)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 bg-[#B89947] text-white px-4 py-2 rounded-lg text-sm font-medium
                   hover:bg-[#a08535] disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Kampanya Oluştur
      </button>
    </form>
  );
}

// ── Create Coupon Form ────────────────────────────────────────

const SEGMENTS = ['B2B_ARCHITECTS', 'VIP_RETAIL'];

function CreateCouponForm({
  campaignId,
  onSuccess,
}: {
  campaignId: string;
  onSuccess:  () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [segRules, setSegRules] = useState<Array<{ segment: string; discount_kind: 'PERCENTAGE' | 'FIXED_AMOUNT'; discount_value: string; max_discount_amount: string }>>([]);

  const [form, setForm] = useState({
    code:                 '',
    discount_kind:        'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discount_value:       '20',     // %20 için kullanıcı 20 girer, biz 0.20'ye çeviririz
    max_discount_amount:  '',
    min_order_amount:     '0',
    usage_limit:          '',
    usage_limit_per_user: '1',
    eligible_segments:    [] as string[],
    expires_at:           '',
    first_order_only:     false,
  });

  const addSegRule = () => {
    setSegRules([...segRules, { segment: SEGMENTS[0], discount_kind: 'PERCENTAGE', discount_value: '25', max_discount_amount: '' }]);
  };

  const removeSegRule = (idx: number) => {
    setSegRules(segRules.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Yüzde → decimal çevrim (kullanıcı "20" girer → 0.20 DB'ye gider)
    const toDecimal = (v: string, kind: 'PERCENTAGE' | 'FIXED_AMOUNT') =>
      kind === 'PERCENTAGE' ? parseFloat(v) / 100 : parseFloat(v);

    const input: CreateCouponInput = {
      campaign_id:          campaignId,
      code:                 form.code,
      discount_kind:        form.discount_kind,
      discount_value:       toDecimal(form.discount_value, form.discount_kind),
      max_discount_amount:  form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      min_order_amount:     parseFloat(form.min_order_amount) || 0,
      usage_limit:          form.usage_limit ? parseInt(form.usage_limit) : null,
      usage_limit_per_user: parseInt(form.usage_limit_per_user) || 1,
      eligible_segments:    form.eligible_segments.length ? form.eligible_segments : null,
      expires_at:           form.expires_at || null,
      first_order_only:     form.first_order_only,
      segment_rules:        segRules.map((r) => ({
        segment:             r.segment,
        discount_kind:       r.discount_kind,
        discount_value:      toDecimal(r.discount_value, r.discount_kind),
        max_discount_amount: r.max_discount_amount ? parseFloat(r.max_discount_amount) : null,
      })),
    };

    const res = await createCoupon(input);
    if (res.success) {
      setSuccess(`"${form.code.toUpperCase()}" kodu oluşturuldu.`);
      setForm({ code: '', discount_kind: 'PERCENTAGE', discount_value: '20', max_discount_amount: '', min_order_amount: '0', usage_limit: '', usage_limit_per_user: '1', eligible_segments: [], expires_at: '', first_order_only: false });
      setSegRules([]);
      onSuccess();
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const toggleSegment = (seg: string) => {
    setForm((f) => ({
      ...f,
      eligible_segments: f.eligible_segments.includes(seg)
        ? f.eligible_segments.filter((s) => s !== seg)
        : [...f.eligible_segments, seg],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kod */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Kupon Kodu *</label>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="YAZA20"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>

        {/* İndirim türü */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">İndirim Türü</label>
          <select
            value={form.discount_kind}
            onChange={(e) => setForm({ ...form, discount_kind: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          >
            <option value="PERCENTAGE">Yüzde (%)</option>
            <option value="FIXED_AMOUNT">Sabit Tutar (₺)</option>
          </select>
        </div>

        {/* Değer */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {form.discount_kind === 'PERCENTAGE' ? 'İndirim (%)' : 'İndirim (₺)'}
          </label>
          <input
            type="number"
            value={form.discount_value}
            onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
            min={form.discount_kind === 'PERCENTAGE' ? '1' : '1'}
            max={form.discount_kind === 'PERCENTAGE' ? '100' : undefined}
            step={form.discount_kind === 'PERCENTAGE' ? '1' : '0.01'}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>

        {/* Tavan */}
        {form.discount_kind === 'PERCENTAGE' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max İndirim ₺ <span className="text-gray-400">(opsiyonel)</span></label>
            <input
              type="number"
              value={form.max_discount_amount}
              onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
              placeholder="Örn: 200"
              min="0"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
            />
          </div>
        )}

        {/* Min sipariş */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Min Sipariş ₺</label>
          <input
            type="number"
            value={form.min_order_amount}
            onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
            min="0"
            step="0.01"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>

        {/* Kullanım limiti */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Global Limit <span className="text-gray-400">(boş = sınırsız)</span></label>
          <input
            type="number"
            value={form.usage_limit}
            onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
            placeholder="Örn: 100"
            min="1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>

        {/* Kullanıcı başına */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Kişi Başı Limit</label>
          <input
            type="number"
            value={form.usage_limit_per_user}
            onChange={(e) => setForm({ ...form, usage_limit_per_user: e.target.value })}
            min="1"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>

        {/* Bitiş */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Kupon Bitiş <span className="text-gray-400">(opsiyonel)</span></label>
          <input
            type="datetime-local"
            value={form.expires_at}
            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89947]"
          />
        </div>
      </div>

      {/* Segmentler */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Geçerli Segmentler <span className="text-gray-400">(boş = herkese açık)</span>
        </label>
        <div className="flex gap-3 flex-wrap">
          {SEGMENTS.map((seg) => (
            <label key={seg} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.eligible_segments.includes(seg)}
                onChange={() => toggleSegment(seg)}
                className="accent-[#B89947]"
              />
              <span className="text-sm text-gray-700">
                {seg === 'B2B_ARCHITECTS' ? 'B2B Mimarlar' : 'VIP Perakende'}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.first_order_only}
              onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })}
              className="accent-[#B89947]"
            />
            <span className="text-sm text-gray-700">Yalnızca ilk sipariş</span>
          </label>
        </div>
      </div>

      {/* Segment Override Kuralları */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">
            Segment Bazlı İndirim Override
            <span className="ml-2 text-gray-400 font-normal">(farklı segmente farklı oran)</span>
          </label>
          <button type="button" onClick={addSegRule}
            className="text-xs text-[#B89947] hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Rule Ekle
          </button>
        </div>
        {segRules.map((r, i) => (
          <div key={i} className="flex gap-2 items-end mb-2 flex-wrap">
            <select value={r.segment}
              onChange={(e) => { const cp = [...segRules]; cp[i].segment = e.target.value; setSegRules(cp); }}
              className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#B89947]">
              {SEGMENTS.map((s) => <option key={s} value={s}>{s === 'B2B_ARCHITECTS' ? 'B2B Mimarlar' : 'VIP Perakende'}</option>)}
            </select>
            <select value={r.discount_kind}
              onChange={(e) => { const cp = [...segRules]; cp[i].discount_kind = e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT'; setSegRules(cp); }}
              className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#B89947]">
              <option value="PERCENTAGE">%</option>
              <option value="FIXED_AMOUNT">₺</option>
            </select>
            <input type="number" value={r.discount_value} placeholder="Değer"
              onChange={(e) => { const cp = [...segRules]; cp[i].discount_value = e.target.value; setSegRules(cp); }}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#B89947]" />
            <input type="number" value={r.max_discount_amount} placeholder="Max ₺"
              onChange={(e) => { const cp = [...segRules]; cp[i].max_discount_amount = e.target.value; setSegRules(cp); }}
              className="w-24 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#B89947]" />
            <button type="button" onClick={() => removeSegRule(i)}
              className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
          </div>
        ))}
      </div>

      {error   && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</p>}
      {success && <p className="flex items-center gap-2 text-sm text-green-600"><CheckCircle className="w-4 h-4" />{success}</p>}

      <button type="submit" disabled={loading}
        className="flex items-center gap-2 bg-[#B89947] text-white px-4 py-2 rounded-lg text-sm font-medium
                   hover:bg-[#a08535] disabled:opacity-50 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
        Kupon Oluştur
      </button>
    </form>
  );
}

// ── Campaign Card ─────────────────────────────────────────────

function CampaignCard({
  campaign,
  onRefresh,
}: {
  campaign:  CampaignRow;
  onRefresh: () => void;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [coupons,     setCoupons]     = useState<CouponRow[]>([]);
  const [loadingC,    setLoadingC]    = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadCoupons = useCallback(async () => {
    setLoadingC(true);
    const res = await getCouponsForCampaign(campaign.id);
    if (res.success && res.data) setCoupons(res.data);
    setLoadingC(false);
  }, [campaign.id]);

  const handleExpand = () => {
    if (!expanded) loadCoupons();
    setExpanded(!expanded);
  };

  const handleStatusChange = async (status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED') => {
    setStatusLoading(true);
    await updateCampaignStatus(campaign.id, status);
    onRefresh();
    setStatusLoading(false);
  };

  const handleToggleCoupon = async (couponId: string, current: boolean) => {
    await toggleCouponActive(couponId, !current);
    loadCoupons();
  };

  const s = STATUS_LABELS[campaign.status] ?? STATUS_LABELS.DRAFT;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Campaign Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleExpand}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900">{campaign.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDate(campaign.starts_at)} — {fmtDate(campaign.ends_at)}
            {!campaign.ends_at && ' (süresiz)'}
          </p>
        </div>

        {/* İstatistikler */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="font-semibold text-gray-900">{campaign.coupon_count}</div>
            <div className="text-xs text-gray-500">Kupon</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{campaign.total_redemptions ?? 0}</div>
            <div className="text-xs text-gray-500">Kullanım</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-[#B89947]">₺{(campaign.confirmed_discount ?? 0).toFixed(0)}</div>
            <div className="text-xs text-gray-500">İndirim</div>
          </div>
        </div>

        {/* Durum değiştirici */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <select
            value={campaign.status}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            disabled={statusLoading}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#B89947]"
          >
            <option value="DRAFT">Taslak</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PAUSED">Duraklat</option>
            <option value="EXPIRED">Sona Erdir</option>
          </select>
        </div>
      </div>

      {/* Expanded: Kuponlar */}
      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {/* Kupon listesi */}
          {loadingC ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : coupons.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Bu kampanyada henüz kupon yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-medium">Kod</th>
                    <th className="text-left py-2 pr-4 font-medium">İndirim</th>
                    <th className="text-left py-2 pr-4 font-medium">Min Sipariş</th>
                    <th className="text-left py-2 pr-4 font-medium">Kullanım</th>
                    <th className="text-left py-2 pr-4 font-medium">Bitiş</th>
                    <th className="text-left py-2 font-medium">Aktif</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-mono font-semibold text-gray-900">{c.code}</td>
                      <td className="py-2 pr-4">
                        <span className="text-[#B89947] font-medium">{fmtDiscount(c.discount_kind, c.discount_value)}</span>
                        {c.max_discount_amount && (
                          <span className="text-xs text-gray-400 ml-1">max ₺{c.max_discount_amount}</span>
                        )}
                        {c.segment_rules?.length > 0 && (
                          <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            <Users className="w-3 h-3 inline mr-0.5" />{c.segment_rules.length} seg
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {c.min_order_amount > 0 ? `₺${c.min_order_amount}` : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{c.usage_count}</span>
                        {c.usage_limit && (
                          <span className="text-gray-400"> / {c.usage_limit}</span>
                        )}
                        {c.usage_limit && c.usage_count >= c.usage_limit && (
                          <span className="ml-2 text-xs text-red-500">dolu</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">{fmtDate(c.expires_at)}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleToggleCoupon(c.id, c.is_active)}
                          className="text-gray-400 hover:text-[#B89947] transition-colors"
                          title={c.is_active ? 'Devre dışı bırak' : 'Etkinleştir'}
                        >
                          {c.is_active
                            ? <ToggleRight className="w-6 h-6 text-green-500" />
                            : <ToggleLeft  className="w-6 h-6 text-gray-300" />
                          }
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Kupon ekle toggle */}
          <button
            onClick={() => setShowCouponForm(!showCouponForm)}
            className="flex items-center gap-2 text-sm text-[#B89947] hover:underline mb-3"
          >
            <Plus className="w-4 h-4" />
            {showCouponForm ? 'Formu Kapat' : 'Yeni Kupon Ekle'}
          </button>

          {showCouponForm && (
            <div className="border border-dashed border-[#B89947]/40 rounded-xl p-4 bg-[#FAFAF8]">
              <CreateCouponForm
                campaignId={campaign.id}
                onSuccess={() => {
                  setShowCouponForm(false);
                  loadCoupons();
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns,        setCampaigns]        = useState<CampaignRow[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [showCreateForm,   setShowCreateForm]   = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const res = await getCampaigns();
    if (res.success && res.data) setCampaigns(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const activeCampaigns  = campaigns.filter((c) => c.status === 'ACTIVE');
  const totalRedemptions = campaigns.reduce((s, c) => s + (c.total_redemptions ?? 0), 0);
  const totalDiscount    = campaigns.reduce((s, c) => s + (c.confirmed_discount ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kampanyalar & Kuponlar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Süresi dolan kampanyalar/kuponlar veritabanında tutulur — silinmez.
            İndirim kullanım geçmişi korunur.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-[#B89947] text-white px-4 py-2 rounded-lg text-sm font-medium
                     hover:bg-[#a08535] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Kampanya
        </button>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aktif Kampanya',  value: activeCampaigns.length, icon: TrendingUp, color: 'text-green-600' },
          { label: 'Toplam Kullanım', value: totalRedemptions,        icon: Tag,        color: 'text-blue-600' },
          { label: 'Verilen İndirim', value: `₺${totalDiscount.toFixed(0)}`, icon: TrendingUp, color: 'text-[#B89947]' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`${item.color} mb-1`}><item.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-bold text-gray-900">{item.value}</div>
            <div className="text-xs text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Kampanya Oluşturma Formu */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Yeni Kampanya</h2>
          <CreateCampaignForm
            onSuccess={() => {
              setShowCreateForm(false);
              fetchCampaigns();
            }}
          />
        </div>
      )}

      {/* Kampanya Listesi */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Henüz kampanya yok. İlk kampanyanızı oluşturun.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} onRefresh={fetchCampaigns} />
          ))}
        </div>
      )}
    </div>
  );
}
