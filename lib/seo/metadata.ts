/**
 * lib/seo/metadata.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js Metadata API builder fonksiyonları.
 *
 * Her sayfa türü için tip-güvenli, long-tail SEO odaklı metadata üretir.
 *
 * Strateji:
 *   1. Admin'in DB'ye girdiği meta_title / meta_description varsa → kullan
 *   2. Yoksa → ürün/kategori verilerinden otomatik olarak üret
 *
 * Title yapısı (ürün):
 *   "[Ürün adı] | Özel Ölçü [Kategori] Perde | Hanedan"
 *   ↑ H1 minimal kalır, <title> long-tail keyword ile dolu
 *
 * Canonical:
 *   alternates.canonical → duplicate content sorununu çözer
 *   URL parametreli versiyonlar (örn: ?renk=bej) canonical ile normalize edilir
 *
 * Open Graph:
 *   type: 'website' (og:product standart değil, Google/Meta her ikisini kabul eder)
 *   images: { url, width, height, alt } → lüks görsel önizleme için tam metadata
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next'
import type { Category, CalculationType } from '@/types'

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hanedan perde.com'
const SITE_NAME = 'Hanedan'

// ─── Ürün metadata tipi ────────────────────────────────────────────────────

export interface ProductMetaInput {
  name: string
  slug: string
  description: string | null
  short_description: string | null
  base_price: number
  calculation_type: CalculationType
  images: string[]
  in_stock: boolean
  meta_title: string | null
  meta_description: string | null
  category?: { name: string; slug: string } | null
}

// ─── Ürün sayfası metadata ──────────────────────────────────────────────────

export function buildProductMetadata(product: ProductMetaInput): Metadata {
  const url         = `${SITE_URL}/urun/${product.slug}`
  const title       = product.meta_title       ?? buildProductTitle(product)
  const description = product.meta_description ?? buildProductDescription(product)
  const ogImage     = product.images?.[0]

  return {
    title,
    description,
    keywords: buildProductKeywords(product),
    // canonical → searchParams'li URL'lerin duplicate olmasını önler
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type:     'website',
      locale:   'tr_TR',
      siteName: SITE_NAME,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 800, alt: product.name }]
        : [],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  }
}

function buildProductTitle(product: ProductMetaInput): string {
  // Hesaplama türüne göre ürün tipi etiketi
  const typeLabel =
    product.calculation_type === 'mt' ? 'Fon Perde'     :
    product.calculation_type === 'm2' ? 'Zebra & Stor'  : 'Perde'

  const categoryPart = product.category?.name ? `${product.category.name} ` : ''

  // Örnek çıktı: "Royal Kadife | Özel Ölçü Fon Perde Koleksiyonu | Hanedan"
  return `${product.name} | Özel Ölçü ${categoryPart}${typeLabel} | ${SITE_NAME}`
}

function buildProductDescription(product: ProductMetaInput): string {
  const categoryName = product.category?.name?.toLowerCase() ?? 'perde'

  const priceStr = new Intl.NumberFormat('tr-TR', {
    style:                 'currency',
    currency:              'TRY',
    maximumFractionDigits: 0,
  }).format(product.base_price)

  const stockNote = product.in_stock
    ? 'Stoğumuzda mevcut, hemen sipariş verebilirsiniz.'
    : 'Siparişe özel üretim.'

  if (product.short_description) {
    // Kısa açıklama varsa onu temel alarak zenginleştir
    return (
      `${product.short_description} ` +
      `${priceStr}'dan başlayan fiyatlarla özel ölçüye göre üretim. ` +
      `${SITE_NAME} premium ${categoryName} koleksiyonu. ` +
      `${stockNote} Türkiye geneli ücretsiz kargo.`
    )
  }

  return (
    `${product.name} — ${priceStr}'dan başlayan fiyatlarla özel ölçüye göre üretilen ` +
    `lüks ${categoryName}. ${SITE_NAME} premium koleksiyonu. ` +
    `7-14 iş günü teslimat, Türkiye geneli ücretsiz kargo.`
  )
}

function buildProductKeywords(product: ProductMetaInput): string[] {
  const catLower = product.category?.name?.toLowerCase() ?? 'perde'
  return [
    product.name,
    `${product.name} fiyat`,
    `${product.name} satın al`,
    `özel ölçü ${catLower}`,
    `${catLower} modelleri`,
    `lüks ${catLower}`,
    `${SITE_NAME.toLowerCase()} ${catLower}`,
    'özel ölçü perde',
    'sipariş üzerine perde',
    'lüks perde',
    'premium perde İstanbul',
  ]
}

// ─── Kategori sayfası metadata ─────────────────────────────────────────────

export function buildCategoryMetadata(category: Category): Metadata {
  const url         = `${SITE_URL}/kategori/${category.slug}`
  const catLower    = category.name.toLowerCase()
  const title       = `${category.name} | Premium Perde Modelleri | ${SITE_NAME}`
  const description =
    category.description ??
    `${category.name} modellerini keşfedin. ${SITE_NAME}'dan özel ölçüye göre üretilen ` +
    `lüks ${catLower} seçenekleri. Ücretsiz kargo, 7-14 iş günü teslimat.`

  return {
    title,
    description,
    keywords: [
      `${catLower} modelleri`,
      `özel ölçü ${catLower}`,
      `lüks ${catLower}`,
      `premium ${catLower}`,
      `${SITE_NAME.toLowerCase()} ${catLower}`,
      'özel ölçü perde',
      'lüks perde koleksiyonu',
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type:     'website',
      locale:   'tr_TR',
      siteName: SITE_NAME,
      images: category.image_url
        ? [{ url: category.image_url, width: 1200, height: 630, alt: category.name }]
        : [],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images: category.image_url ? [category.image_url] : [],
    },
  }
}

// ─── Statik sayfalar için yardımcı ─────────────────────────────────────────

export function buildStaticMetadata(opts: {
  title: string
  description: string
  path: string
  noIndex?: boolean
}): Metadata {
  const url = `${SITE_URL}${opts.path}`
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    ...(opts.noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title:       opts.title,
      description: opts.description,
      url,
      type:        'website',
      locale:      'tr_TR',
      siteName:    SITE_NAME,
    },
    twitter: {
      card:        'summary',
      title:       opts.title,
      description: opts.description,
    },
  }
}
