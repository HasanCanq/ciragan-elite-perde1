import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import PDPGallery        from '@/components/product/PDPGallery'
import PDPForm           from '@/components/product/PDPForm'
import MeasurementForm   from '@/components/product/MeasurementForm'
import Link              from 'next/link'
import {
  getProductWithModelPublic,
  getAllProductSlugsPublic,
} from '@/lib/data/public-queries'
import type { ModelLimits } from '@/components/product/MeasurementForm'

/* ──────────────────────────────────────────────────────────────
   /urun/[slug] — Ürün Detay Sayfası (PDP)
   ──────────────────────────────────────────────────────────────
   ISR: 1 saatlik cache. revalidate = 3600.
   Ürün + perde modeli (max_width_cm / max_height_cm) tek sorguda
   getirilir ve MeasurementForm'a aktarılır.

   MeasurementForm, dinamik Zod şemasını model limitlerinden inşa
   eder. Model atanmamışsa genel SIZE_LIMITS devreye girer.
   ────────────────────────────────────────────────────────────── */

export const dynamicParams = true
export const revalidate    = 3600

// ─── generateStaticParams ──────────────────────────────────

export async function generateStaticParams() {
  const slugs = await getAllProductSlugsPublic()
  return slugs.map((slug) => ({ slug }))
}

// ─── generateMetadata ──────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductWithModelPublic(slug)

  if (!product) {
    return { title: 'Ürün Bulunamadı | Hanedan Perde' }
  }

  return {
    title:       `${product.name} | Hanedan Perde`,
    description: product.meta_description ??
      product.short_description ??
      `${product.name} — Hanedan lüks perde koleksiyonu.`,
    openGraph: product.images?.[0]
      ? { images: [{ url: product.images[0] }] }
      : undefined,
  }
}

// ─── Sayfa ─────────────────────────────────────────────────

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product  = await getProductWithModelPublic(slug)

  if (!product) notFound()

  // Perde modeli sınırları → MeasurementForm dinamik Zod şeması için
  const modelLimits: ModelLimits | null = product.model
    ? {
        maxWidthCm:  product.model.max_width_cm,
        maxHeightCm: product.model.max_height_cm,
        modelName:   product.model.name,
      }
    : null

  // Breadcrumb zinciri: Anasayfa → Kategori → Ürün
  const breadcrumbs = [
    { label: 'Anasayfa',    href: '/' },
    ...(product.category
      ? [{ label: product.category.name, href: `/kategori/${product.category.slug}` }]
      : [{ label: 'Tüm Ürünler', href: '/kategori/tum-urunler' }]),
  ]

  // PDPForm için renkler ve accordion'lar — DB şemasında henüz bu alanlar yok;
  // ürün açıklamasından üretilen statik yer tutucular kullanılır.
  const accordions = [
    ...(product.ozellikler
      ? [{ title: 'Özellikler', content: product.ozellikler }]
      : []),
    {
      title:   'Teslimat & İade',
      content:
        'Siparişleriniz 7–14 iş günü içinde üretilip kargoya verilir. ' +
        'Türkiye genelinde ücretsiz kargo. ' +
        'Ürün, siparişe özel üretildiğinden iade kabul edilmez. ' +
        'Ürün hasarlı ya da hatalı gelirse 3 iş günü içinde iletişime geçiniz.',
    },
  ]

  return (
    <div className="h-container py-8 lg:py-12 xl:py-16">

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <nav aria-label="Sayfa gezintisi" className="flex items-center flex-wrap gap-2 mb-8 lg:mb-12">
        {breadcrumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-2">
            <Link
              href={crumb.href}
              className="text-[10px] tracking-[0.14em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200"
            >
              {crumb.label}
            </Link>
            <span className="text-[#D4D4D4] text-[9px]" aria-hidden="true">/</span>
          </span>
        ))}
        <span
          className="text-[10px] tracking-[0.14em] uppercase text-black"
          aria-current="page"
        >
          {product.name}
        </span>
      </nav>

      {/* ── İki kolon ürün düzeni ──────────────────────────────── */}
      <div className="grid lg:grid-cols-[55fr_45fr] gap-10 lg:gap-14 xl:gap-20">

        {/* Sol: Galeri */}
        <PDPGallery
          images={
            product.images?.length
              ? product.images.map((url, i) => ({ id: String(i), url, label: `Görsel ${i + 1}` }))
              : [{ id: '0', label: 'Ürün Görseli' }]
          }
        />

        {/* Sağ: Ürün bilgisi */}
        <div>
          {/* Koleksiyon / kategori etiketi */}
          <p className="h-eyebrow mb-4">
            {product.category?.name ?? 'Perde Koleksiyonu'}
            {product.model && (
              <span className="ml-2">· {product.model.name}</span>
            )}
          </p>

          {/* Ürün adı */}
          <h1
            className={[
              'font-serif font-light text-black',
              'text-[30px] sm:text-[34px] lg:text-[38px] xl:text-[44px]',
              'tracking-[0.025em] leading-[1.1]',
              'mb-5',
            ].join(' ')}
          >
            {product.name}
          </h1>

          {/* Kısa açıklama */}
          {product.short_description && (
            <p className="text-[13px] text-[#6B7280] leading-[1.85] tracking-[0.02em] mb-6">
              {product.short_description}
            </p>
          )}

          {/* PDPForm — renkler, açıklamalar, akordeonlar + MeasurementForm slotu */}
          <PDPForm
            price={product.base_price}
            colors={[]}          /* TODO: ürün renk tablosu eklenince DB'den getir */
            accordions={accordions}
            measurementSection={
              <MeasurementForm
                product={{
                  id:               product.id,
                  name:             product.name,
                  slug:             product.slug,
                  images:           product.images ?? [],
                  base_price:       product.base_price,
                  calculation_type: product.calculation_type,
                  min_width_cm:     product.min_width_cm,
                  min_area_m2:      product.min_area_m2,
                  in_stock:         product.in_stock,
                }}
                modelLimits={modelLimits}
                pleats={product.pleats ?? []}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
