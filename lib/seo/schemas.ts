/**
 * lib/seo/schemas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Schema.org JSON-LD builder fonksiyonları.
 *
 * Tüm fonksiyonlar saf (pure) obje döner — <script type="application/ld+json">
 * içine JSON.stringify ile enjekte edilir.
 *
 * Botlar JavaScript çalıştırmadan SSR anında sunulan bu veriyi okur.
 * Dinamik fiyat güncellemesi ProductSchemaUpdater Client Component tarafından
 * yapılır; bu dosya yalnızca sunucu tarafında çalışır.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CalculationType } from '@/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hanedan perde.com'
const SITE_NAME = 'Hanedan'
const CURRENCY = 'TRY'

/** ISO 4217 / UN/CEFACT birim kodları */
const UNIT_CODE: Record<CalculationType, string> = {
  mt:   'MTR', // metre
  m2:   'MTK', // metrekare
  adet: 'C62', // adet (each)
}

const UNIT_TEXT: Record<CalculationType, string> = {
  mt:   'metre',
  m2:   'm²',
  adet: 'adet',
}

export interface BreadcrumbItem {
  label: string
  href: string
}

// Minimum product verisi — schema builder'ın ihtiyaç duyduğu alanlar
export interface SchemaProductInput {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  ozellikler?: string | null
  base_price: number
  calculation_type: CalculationType
  images: string[]
  in_stock: boolean
  meta_description?: string | null
  category?: { name: string; slug: string } | null
  aggregateRating?: { ratingValue: number; reviewCount: number } | null
}

export interface SchemaProductBasic {
  name: string
  slug: string
  images?: string[]
  base_price: number
  in_stock: boolean
}

// ─── Yardımcı ──────────────────────────────────────────────────────────────

function nextYearDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Product şeması ────────────────────────────────────────────────────────
//
// Google'ın Product rich result gereksinimleri:
//   ZORUNLU: name, image, offers.price, offers.priceCurrency, offers.availability
//   ÖNERİLEN: description, brand, sku, review/aggregateRating
//
// Özel ölçülü e-ticaret için Offer.priceSpecification → UnitPriceSpecification
// hem fiyat şeffaflığı sağlar hem de Google'ın "fiyat aralığı" yorumunu önler.

export function buildProductSchema(
  product: SchemaProductInput,
  opts?: { baseUrl?: string },
) {
  const base = opts?.baseUrl ?? SITE_URL
  const url  = `${base}/urun/${product.slug}`

  const description =
    product.meta_description ??
    product.short_description ??
    product.description ??
    `${product.name} — ${SITE_NAME} lüks perde koleksiyonu. Özel ölçüye göre üretim.`

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    description,
    url,
    ...(product.images?.length ? { image: product.images } : {}),
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    ...(product.category ? { category: product.category.name } : {}),
    ...(product.aggregateRating && product.aggregateRating.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.aggregateRating.ratingValue.toFixed(1),
            reviewCount: product.aggregateRating.reviewCount,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
    offers: buildOfferSchema(product, url, base),
  }
}

function buildOfferSchema(
  product: SchemaProductInput,
  productUrl: string,
  base: string,
) {
  const calcLabel =
    product.calculation_type === 'mt' ? 'metre başına' :
    product.calculation_type === 'm2' ? 'm² başına'    : 'adet'

  return {
    '@type': 'Offer',
    '@id': `${productUrl}#offer`,
    url: productUrl,
    priceCurrency: CURRENCY,
    // SSR'da taban fiyat gösterilir. Kullanıcı ölçü girince
    // ProductSchemaUpdater bu değeri dinamik olarak günceller.
    price: product.base_price.toFixed(2),
    priceValidUntil: nextYearDate(),
    availability: product.in_stock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: base,
    },
    // Özel ölçü için birim fiyat açıklaması
    // Google bu alandan hesaplama türünü anlayabilir
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: product.base_price.toFixed(2),
      priceCurrency: CURRENCY,
      description: `${product.base_price.toFixed(2)} TRY ${calcLabel} başlangıç fiyatı. Toplam fiyat seçilen ölçüye göre hesaplanır.`,
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: '1',
        unitCode: UNIT_CODE[product.calculation_type],
        unitText: UNIT_TEXT[product.calculation_type],
      },
    },
  }
}

// ─── BreadcrumbList şeması ──────────────────────────────────────────────────
//
// currentLabel son eleman olarak eklenir; item URL'si olmaz (Google best practice).

export function buildBreadcrumbSchema(
  crumbs: BreadcrumbItem[],
  currentLabel: string,
  opts?: { baseUrl?: string },
) {
  const base     = opts?.baseUrl ?? SITE_URL
  const allItems = [...crumbs, { label: currentLabel, href: '' }]

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: allItems.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${base}${crumb.href}` } : {}),
    })),
  }
}

// ─── Organization şeması ───────────────────────────────────────────────────
//
// Root layout'ta bir kez enjekte edilir.
// @id ile diğer şemalar bu organizasyonu referans alabilir.

export function buildOrganizationSchema(opts?: { baseUrl?: string }) {
  const base = opts?.baseUrl ?? SITE_URL
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: SITE_NAME,
    url: base,
    logo: {
      '@type': 'ImageObject',
      url: `${base}/logo.png`,
      width: '200',
      height: '60',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: { '@type': 'Language', name: 'Turkish' },
    },
  }
}

// ─── LocalBusiness şeması ──────────────────────────────────────────────────
//
// Root layout'ta Organization yerine kullanılır.
// Ana sayfada aggregateRating (Google Places) ile genişletilir.

export function buildLocalBusinessSchema(opts?: {
  baseUrl?: string
  aggregateRating?: { ratingValue: number; reviewCount: number } | null
}) {
  const base = opts?.baseUrl ?? SITE_URL
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${base}/#organization`,
    name: SITE_NAME,
    url: base,
    logo: {
      '@type': 'ImageObject',
      url: `${base}/logo.png`,
      width: '200',
      height: '60',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: { '@type': 'Language', name: 'Turkish' },
    },
    ...(opts?.aggregateRating && opts.aggregateRating.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: opts.aggregateRating.ratingValue.toFixed(1),
            reviewCount: opts.aggregateRating.reviewCount,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  }
}

// ─── WebSite şeması ────────────────────────────────────────────────────────
//
// potentialAction → SearchAction: Google'ın site-search sitelink'lerini aktive eder.

export function buildWebSiteSchema(opts?: { baseUrl?: string }) {
  const base = opts?.baseUrl ?? SITE_URL
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: base,
    name: SITE_NAME,
    publisher: { '@id': `${base}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/kategori/tum-urunler?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

// ─── ItemList şeması (kategori sayfası) ────────────────────────────────────
//
// Kategori sayfasında ürün listesi Google'a yapısal veri olarak bildirilir.
// Her ürün item kendi Offer ve image bilgisiyle verilir.

export function buildItemListSchema(
  products: SchemaProductBasic[],
  listName: string,
  opts?: { baseUrl?: string },
) {
  const base = opts?.baseUrl ?? SITE_URL
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((product, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        url: `${base}/urun/${product.slug}`,
        ...(product.images?.[0] ? { image: product.images[0] } : {}),
        offers: {
          '@type': 'Offer',
          priceCurrency: CURRENCY,
          price: product.base_price.toFixed(2),
          availability: product.in_stock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      },
    })),
  }
}
