'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload, Loader2, CheckCircle, ImageOff } from 'lucide-react';
import {
  getMeasurementGuides,
  uploadMeasurementGuideImage,
} from '@/lib/actions/measurement-guides';
import type { MeasurementGuide } from '@/types';

const GUIDE_LABELS: Record<string, string> = {
  'fon':          'Fon Perde',
  'tul':          'Tül Perde',
  'zebra':        'Zebra Perde',
  'stor':         'Stor Perde',
  'ahsap-jaluzi': 'Ahşap Jaluzi',
};

export default function MeasurementGuidesPage() {
  const [guides, setGuides]   = useState<MeasurementGuide[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGuides = async () => {
    setLoading(true);
    const result = await getMeasurementGuides();
    if (result.success && result.data) setGuides(result.data);
    setLoading(false);
  };

  useEffect(() => { loadGuides(); }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ölçü Kılavuzları</h1>
        <p className="mt-1 text-sm text-gray-500">
          Her kategori türü için ölçü alma diyagramını yükleyin. Ürün sayfasında
          &quot;Ölçü Nasıl Alınır?&quot; butonuna basıldığında bu görsel açılır.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {guides.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              label={GUIDE_LABELS[guide.guide_key] ?? guide.guide_key}
              onUploaded={loadGuides}
            />
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-700 font-medium mb-1">Kategori Eşleştirmesi</p>
        <p className="text-xs text-amber-600">
          Her kategorinin hangi kılavuzu kullandığını Supabase &gt; Table Editor &gt;
          <strong> categories</strong> tablosundaki <code>measurement_guide_key</code> kolonundan
          ayarlayın. Örnek değerler: <code>fon</code>, <code>tul</code>, <code>zebra-stor-ahsap</code>
        </p>
      </div>
    </div>
  );
}

/* ── Tek kılavuz kartı ─────────────────────────────────────────────────── */
function GuideCard({
  guide,
  label,
  onUploaded,
}: {
  guide:      MeasurementGuide;
  label:      string;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Yalnızca görsel dosyası yüklenebilir.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    const form = new FormData();
    form.append('guide_key', guide.guide_key);
    form.append('image', file);

    const result = await uploadMeasurementGuideImage(form);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onUploaded(); }, 1500);
    } else {
      setError(result.error ?? 'Yükleme başarısız.');
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex gap-5">
      {/* Mevcut görsel */}
      <div className="w-36 h-28 flex-shrink-0 bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden rounded-lg">
        {guide.image_url ? (
          <div className="relative w-full h-full">
            <Image
              src={guide.image_url}
              alt={label}
              fill
              className="object-contain p-1"
              sizes="144px"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <ImageOff className="w-6 h-6" />
            <span className="text-[10px]">Görsel yok</span>
          </div>
        )}
      </div>

      {/* Bilgi ve yükleme */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{guide.guide_key}</p>
        <p className="text-xs text-gray-500 mt-1">{guide.title}</p>

        <div className="mt-3 flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            className="hidden"
            id={`upload-${guide.guide_key}`}
          />
          <label
            htmlFor={`upload-${guide.guide_key}`}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer transition-colors',
              uploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#B89947] text-white hover:bg-[#a08535]',
            ].join(' ')}
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor...</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> {guide.image_url ? 'Görseli Değiştir' : 'Görsel Yükle'}</>
            )}
          </label>

          {success && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" /> Kaydedildi
            </span>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
