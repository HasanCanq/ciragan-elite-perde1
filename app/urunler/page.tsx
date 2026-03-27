export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  getCurtainModelBySlugPublic,
  getProductsByModelPublic,
} from '@/lib/data/advisor-queries';
import AdvisorProductCard from '@/components/advisor/AdvisorProductCard';
import { CurtainIllustration } from '@/components/advisor/CurtainIllustration';

/* ──────────────────────────────────────────────────────────────
   /urunler?model=plicell&oda=salon
   ──────────────────────────────────────────────────────────────
   Perde Danışmanı'nın sonuç sayfası.
   Kullanıcı odayı → modeli seçtikten sonra buraya yönlendirilir.

   URL şeması:
     model  → zorunlu, curtain_models.slug  (ör. "plicell")
     oda    → opsiyonel, rooms.slug context (ör. "salon") — geri
              linki için kullanılır; sorguda kullanılmaz

   Server Component: searchParams sync (Next.js 14).
   İç async bileşen Suspense ile streaming SSR'a açıktır.
   ────────────────────────────────────────────────────────────── */

interface Props {
  searchParams: { model?: string; oda?: string };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const modelSlug = searchParams.model?.trim();
  if (!modelSlug) return { title: 'Ürünler | Hanedan Perde', robots: { index: false } };

  const model = await getCurtainModelBySlugPublic(modelSlug);
  if (!model) return { title: 'Ürünler | Hanedan Perde', robots: { index: false } };

  return {
    title: `${model.name} Perde Modeli Ürünleri | Hanedan Perde`,
    description:
      model.description ??
      `${model.name} modeline ait perde ürünlerini keşfedin. Maksimum ${model.max_width_cm} cm genişlik, ${model.max_height_cm} cm yüksekliğe kadar üretim.`,
    robots: { index: false },
  };
}

export default function AdvisorPLPPage({ searchParams }: Props) {
  const modelSlug = searchParams.model?.trim() || null;
  const roomSlug  = searchParams.oda?.trim()   || null;

  // model parametresi yoksa ana sayfaya veya asistana yönlendir
  if (!modelSlug) {
    return (
      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-[9px] tracking-[0.45em] uppercase text-[#9CA3AF] mb-4">
            Perde Seçim Asistanı
          </p>
          <p className="font-serif font-light text-[24px] text-black mb-6">
            Model seçilmedi
          </p>
          <Link
            href="/asistan"
            className="h-btn"
          >
            Asistana Geri Dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)]">
      {/* ── Üst bar ──────────────────────────────────────────── */}
      <div className="border-b border-[#F3F4F6]">
        <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-5 flex items-center justify-between">
          <BackBreadcrumb roomSlug={roomSlug} modelSlug={modelSlug} />
          <p className="text-[9px] tracking-[0.45em] uppercase text-[#9CA3AF]">
            Perde Danışmanı
          </p>
        </div>
      </div>

      {/* ── İçerik ───────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-14 lg:py-20">
        <Suspense fallback={<PLPSkeleton />}>
          <AdvisorPLPContent modelSlug={modelSlug} roomSlug={roomSlug} />
        </Suspense>
      </div>
    </main>
  );
}

/* ── Async içerik bileşeni — streaming SSR ───────────────────── */
async function AdvisorPLPContent({
  modelSlug,
  roomSlug,
}: {
  modelSlug: string;
  roomSlug: string | null;
}) {
  const [model, products] = await Promise.all([
    getCurtainModelBySlugPublic(modelSlug),
    getProductsByModelPublic(modelSlug),
  ]);

  if (!model) notFound();

  const backHref = roomSlug ? `/asistan?oda=${roomSlug}` : '/asistan';

  return (
    <>
      {/* ── Model başlık bandı ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-8 mb-14">
        {/* Sol: metin */}
        <div className="flex-1">
          <p className="h-eyebrow mb-5">
            {roomSlug ? 'Seçiminize Özel Ürünler' : 'Model Ürünleri'}
          </p>

          <h1
            className={[
              'font-serif font-light text-black',
              'text-[40px] leading-none tracking-[0.02em]',
              'sm:text-[48px]',
              'lg:text-[56px]',
              'mb-4',
            ].join(' ')}
          >
            {model.name}
          </h1>

          <div className="w-10 h-px bg-[#B89947] mb-5" />

          {model.description && (
            <p className="text-[13px] leading-[1.9] tracking-[0.02em] text-[#6B7280] max-w-xl mb-6">
              {model.description}
            </p>
          )}

          {/* Boyut kısıtları */}
          <div className="flex items-center gap-3 flex-wrap">
            <ModelConstraintChip
              label="Maks. Genişlik"
              value={`${model.max_width_cm} cm`}
            />
            <span aria-hidden="true" className="text-[#D1D5DB] text-[10px]">×</span>
            <ModelConstraintChip
              label="Maks. Yükseklik"
              value={`${model.max_height_cm} cm`}
            />
          </div>
        </div>

        {/* Sağ: model illüstrasyon + geri link */}
        <div className="flex-shrink-0 flex flex-col items-center gap-4">
          <div
            aria-hidden="true"
            className="w-[120px] h-[148px] flex items-center justify-center bg-[#FAFAFA] border border-[#F3F4F6]"
          >
            <CurtainIllustration
              slug={model.slug}
              className="w-[70px] h-[88px] text-[#B89947]"
            />
          </div>

          <Link
            href={backHref}
            className={[
              'inline-flex items-center gap-1.5',
              'text-[9px] tracking-[0.38em] uppercase font-medium',
              'text-[#9CA3AF] hover:text-black',
              'transition-colors duration-200',
              'group',
            ].join(' ')}
          >
            <svg
              viewBox="0 0 14 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              aria-hidden="true"
              className="w-3 h-3 translate-x-0 group-hover:-translate-x-1 transition-transform duration-200"
            >
              <path d="M13 5 H1 M5 1 L1 5 L5 9" />
            </svg>
            {roomSlug ? 'Modeli Değiştir' : 'Asistana Dön'}
          </Link>
        </div>
      </div>

      {/* ── Ürün grid ──────────────────────────────────────── */}
      {products.length === 0 ? (
        <EmptyState modelName={model.name} />
      ) : (
        <>
          {/* Ürün sayısı */}
          <p className="text-[9px] tracking-[0.3em] uppercase text-[#9CA3AF] mb-6">
            <span className="text-black">{products.length}</span> ürün
          </p>

          <div
            className={[
              'grid gap-[1px]',
              'grid-cols-1',
              'sm:grid-cols-2',
              'lg:grid-cols-3',
              'xl:grid-cols-4',
            ].join(' ')}
          >
            {products.map((product) => (
              <AdvisorProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Alt banner — tüm koleksiyona link */}
          <div className="mt-14 pt-10 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-[12px] leading-[1.8] text-[#6B7280] max-w-sm text-center sm:text-left">
              Tüm koleksiyonumuzu keşfetmek veya farklı modeller görmek ister misiniz?
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <Link
                href="/asistan"
                className="h-btn-outline text-[10px] tracking-[0.3em]"
              >
                Asistanı Yeniden Başlat
              </Link>
              <Link
                href="/kategori/tum-urunler"
                className="h-btn text-[10px] tracking-[0.3em]"
              >
                Tüm Koleksiyon
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Geri breadcrumb ────────────────────────────────────────── */
function BackBreadcrumb({
  roomSlug,
  modelSlug,
}: {
  roomSlug: string | null;
  modelSlug: string;
}) {
  return (
    <nav aria-label="Asistan adımları" className="flex items-center gap-2 text-[9px] tracking-[0.3em] uppercase">
      <Link
        href="/asistan"
        className="text-[#9CA3AF] hover:text-black transition-colors duration-200"
      >
        Odalar
      </Link>
      {roomSlug && (
        <>
          <span aria-hidden="true" className="text-[#D1D5DB]">/</span>
          <Link
            href={`/asistan?oda=${roomSlug}`}
            className="text-[#9CA3AF] hover:text-black transition-colors duration-200"
          >
            {roomSlug}
          </Link>
        </>
      )}
      <span aria-hidden="true" className="text-[#D1D5DB]">/</span>
      <span className="text-black" aria-current="page">
        {modelSlug}
      </span>
    </nav>
  );
}

/* ── Model kısıt chip'i ─────────────────────────────────────── */
function ModelConstraintChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex flex-col items-start px-3 py-2 bg-[#F9F9F9] border border-[#F0F0F0]">
      <span className="text-[8px] tracking-[0.35em] uppercase text-[#9CA3AF] mb-0.5">
        {label}
      </span>
      <span className="text-[12px] tracking-[0.06em] font-medium text-black">
        {value}
      </span>
    </span>
  );
}

/* ── Boş durum ──────────────────────────────────────────────── */
function EmptyState({ modelName }: { modelName: string }) {
  return (
    <div className="py-20 flex flex-col items-center text-center gap-6">
      <div className="w-8 h-px bg-[#B89947]" />
      <p className="font-serif font-light text-[22px] text-black">
        Henüz ürün eklenmemiş
      </p>
      <p className="text-[12px] leading-[1.8] text-[#6B7280] max-w-sm">
        {modelName} modeline ait ürünler yakında eklenecek.
        Tüm koleksiyonumuzu inceleyebilirsiniz.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/asistan" className="h-btn-outline text-[10px] tracking-[0.3em]">
          Asistana Dön
        </Link>
        <Link href="/kategori/tum-urunler" className="h-btn text-[10px] tracking-[0.3em]">
          Tüm Koleksiyon
        </Link>
      </div>
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────── */
function PLPSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {/* Başlık iskeleti */}
      <div className="mb-14 space-y-4">
        <div className="h-2 w-32 bg-[#F3F4F6]" />
        <div className="h-12 w-64 bg-[#F3F4F6]" />
        <div className="h-px w-10 bg-[#EBEBEB]" />
        <div className="h-3 w-80 bg-[#F3F4F6]" />
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-[#F3F4F6]" />
          <div className="h-10 w-28 bg-[#F3F4F6]" />
        </div>
      </div>

      {/* Grid iskeleti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[1px]">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="bg-[#F9F9F9]"
            style={{ aspectRatio: '4/5', animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
