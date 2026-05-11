import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getFeaturedProductsPublic } from '@/lib/data/public-queries'
import type { ProductWithCategory, CalculationType } from '@/types'

const UNIT_LABEL: Record<CalculationType, string> = {
  mt:   '/ mt',
  m2:   '/ m²',
  adet: '/ adet',
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('tr-TR', {
    style:    'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n)
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg,#000 0,#000 1px,transparent 0,transparent 50%)`,
          backgroundSize: '8px 8px',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 select-none pointer-events-none">
        <p className="text-[9px] tracking-[0.5em] uppercase text-[#B8B8B8]">{label}</p>
        <div className="w-4 h-px bg-[#D0D0D0]" />
        <p className="text-[8px] tracking-[0.3em] uppercase text-[#CACACA]">Hanedan</p>
      </div>
    </>
  )
}

function ProductCard({ product }: { product: ProductWithCategory }) {
  const firstImage = product.images?.[0] ?? null

  return (
    <Link href={`/urun/${product.slug}`} className="group block" aria-label={product.name}>
      <div className="relative overflow-hidden bg-[#F3F4F6]" style={{ aspectRatio: '1/1' }}>
        <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-[1.04]">
          {firstImage ? (
            <Image
              src={firstImage}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder label={product.category?.name ?? 'Perde'} />
          )}
        </div>

        {!product.in_stock && (
          <span className="absolute bottom-3 left-3 z-10 px-2 py-1 bg-black text-white text-[8px] tracking-[0.3em] uppercase">
            Tükendi
          </span>
        )}
      </div>

      <div className="pt-4 pb-1">
        {product.category && (
          <p className="text-[9px] tracking-[0.4em] uppercase text-[#9CA3AF] mb-1.5">
            {product.category.name}
          </p>
        )}
        <h3 className="text-[13px] font-medium tracking-[0.02em] text-black leading-snug">
          {product.name}
        </h3>
        {product.short_description && (
          <p className="text-[11px] tracking-[0.04em] text-[#9CA3AF] mt-1.5 leading-none line-clamp-1">
            {product.short_description}
          </p>
        )}
        <p
          className="mt-2.5 text-[13px] font-medium tracking-[0.04em] leading-none"
          style={{ color: 'var(--accent)' }}
        >
          {formatPrice(product.base_price)}
          <span className="text-[10px] font-normal text-[#9CA3AF] ml-1">
            {UNIT_LABEL[product.calculation_type ?? 'm2']}
          </span>
        </p>
      </div>
    </Link>
  )
}

export default async function FeaturedProducts() {
  const products = await getFeaturedProductsPublic()

  if (products.length === 0) return null

  const displayed = products.slice(0, 4)

  return (
    <section aria-labelledby="featured-heading" className="h-section">
      <div className="h-container">

        <div className="flex items-end justify-between mb-12 lg:mb-16">
          <div>
            <p className="h-eyebrow mb-4">Seçkin Tasarımlar</p>
            <h2
              id="featured-heading"
              className="font-serif font-light text-[32px] lg:text-[40px] tracking-[0.02em] leading-none"
            >
              En Çok Tercih Edilenler
            </h2>
          </div>
          <Link
            href="/kategori/tum-urunler"
            className={[
              'hidden md:inline-flex items-center gap-1.5 shrink-0 mb-1',
              'text-[10px] tracking-[0.22em] uppercase text-black font-medium',
              'border-b border-black pb-[2px]',
              'hover:text-[#B89947] hover:border-[#B89947]',
              'transition-colors duration-200',
            ].join(' ')}
          >
            Tümünü Gör
            <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10 sm:gap-x-7 lg:gap-x-8">
          {displayed.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-12 flex justify-center md:hidden">
          <Link href="/kategori/tum-urunler" className="h-btn-outline">
            Tüm Ürünleri Gör
          </Link>
        </div>
      </div>
    </section>
  )
}
