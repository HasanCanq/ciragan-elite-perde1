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
import { JsonLd }               from '@/components/seo/JsonLd'
import { ProductSchemaUpdater } from '@/components/seo/ProductSchemaUpdater'
import { buildProductSchema, buildBreadcrumbSchema } from '@/lib/seo/schemas'
import { buildProductMetadata }                      from '@/lib/seo/metadata'

/* ──────────────────────────────────────────────────────────────
   /urun/[slug] — Ürün Detay Sayfası (PDP)
   ──────────────────────────────────────────────────────────────
   ISR: 1 saatlik cache. revalidate = 3600.
   Ürün + perde modeli (max_width_cm / max_height_cm) tek sorguda
   getirilir ve MeasurementForm'a aktarılır.

   MeasurementForm, dinamik Zod şemasını model limitlerinden inşa
   eder. Model atanmamışsa genel SIZE_LIMITS devreye girer.

   SEO mimarisi:
   • generateMetadata → <title>, <meta description>, canonical, OG, Twitter
   • JsonLd (Product şeması) → SSR anında botlara sunulur; base_price ile
   • JsonLd (BreadcrumbList) → Google'ın breadcrumb rich result'ı için
   • ProductSchemaUpdater → kullanıcı ölçü girince JSON-LD fiyatını günceller
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
  const { slug }  = await params
  const product   = await getProductWithModelPublic(slug)

  if (!product) {
    return { title: 'Ürün Bulunamadı | Hanedan' }
  }

  // ProductWithModel'de category tip olarak yok ama runtime'da Supabase join'den gelir
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category = (product as any).category as { name: string; slug: string } | null

  return buildProductMetadata({
    name:             product.name,
    slug:             product.slug,
    description:      product.description,
    short_description: product.short_description,
    base_price:       product.base_price,
    calculation_type: product.calculation_type,
    images:           product.images ?? [],
    in_stock:         product.in_stock,
    meta_title:       product.meta_title,
    meta_description: product.meta_description,
    category,
  })
}

// ─── Sayfa ─────────────────────────────────────────────────

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product  = await getProductWithModelPublic(slug)

  if (!product) notFound()

  // Runtime Supabase join alanları (TypeScript türleri bu alanları görmez)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productAny = product as any
  const category   = productAny.category  as { name: string; slug: string } | null
  const model      = productAny.model     as { name: string; max_width_cm: number; max_height_cm: number } | null

  // Perde modeli sınırları → MeasurementForm dinamik Zod şeması için
  const modelLimits: ModelLimits | null = model
    ? {
        maxWidthCm:  model.max_width_cm,
        maxHeightCm: model.max_height_cm,
        modelName:   model.name,
      }
    : null

  // Breadcrumb zinciri: Anasayfa → Kategori → Ürün
  const breadcrumbs = [
    { label: 'Anasayfa', href: '/' },
    ...(category
      ? [{ label: category.name, href: `/kategori/${category.slug}` }]
      : [{ label: 'Tüm Ürünler', href: '/kategori/tum-urunler' }]),
  ]

  // ─── JSON-LD schema verisi ────────────────────────────────
  // SSR'da render edilir; botlar JavaScript çalıştırmadan okur.
  // ProductSchemaUpdater, kullanıcı ölçü değiştirince price'ı günceller.

  const productSchemaInput = {
    id:               product.id,
    name:             product.name,
    slug:             product.slug,
    description:      product.description,
    short_description: product.short_description,
    ozellikler:       product.ozellikler,
    base_price:       product.base_price,
    calculation_type: product.calculation_type,
    images:           product.images ?? [],
    in_stock:         product.in_stock,
    meta_description: product.meta_description,
    category,
  }

  const productSchema    = buildProductSchema(productSchemaInput)
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs, product.name)

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
    <>
      {/* ── JSON-LD: Product şeması (SSR) ──────────────────────────── */}
      {/* id="product-ld-json" → ProductSchemaUpdater bu script'i bulup günceller */}
      <JsonLd id="product-ld-json" data={productSchema} />

      {/* ── JSON-LD: BreadcrumbList şeması (SSR) ───────────────────── */}
      <JsonLd data={breadcrumbSchema} />

      {/* ── Dinamik fiyat güncelleyici (Client Component) ──────────── */}
      {/* DOM'da render yok; sadece seo:price-update event'ini dinler */}
      <ProductSchemaUpdater schemaId="product-ld-json" />

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

          {/* Sağ: Ürün Konfiguratörü — kullanıcı galeriyi kaydırırken sabit kalır */}
          <div className="lg:sticky lg:top-[88px] lg:self-start">
            {/* Koleksiyon / kategori etiketi */}
            <p className="h-eyebrow mb-4">
              {category?.name ?? 'Perde Koleksiyonu'}
              {model && (
                <span className="ml-2">· {model.name}</span>
              )}
            </p>

            {/* Ürün adı — H1 minimal kalır; SEO title ayrı ve zengin */}
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
    </>
  )
}
