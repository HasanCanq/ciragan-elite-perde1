import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getCategoriesPublic } from '@/lib/data/public-queries'
import type { Category } from '@/types'

const BG_TONES = ['bg-[#EFEFED]', 'bg-[#EDECEA]', 'bg-[#EBEAE8]'] as const

function CategoryCard({ category, index }: { category: Category; index: number }) {
  return (
    <Link
      href={`/kategori/${category.slug}`}
      className="group block"
      aria-label={`${category.name} koleksiyonunu keşfet`}
    >
      {/* Square image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
        <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-[1.04]">
          {category.image_url ? (
            <Image
              src={category.image_url}
              alt={category.name}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className={`absolute inset-0 ${BG_TONES[index % BG_TONES.length]}`}>
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(0deg,  #000 0,#000 1px,transparent 0,transparent 6px),
                    repeating-linear-gradient(90deg, #000 0,#000 1px,transparent 0,transparent 6px)
                  `,
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none pointer-events-none">
                <p className="text-[9px] tracking-[0.55em] uppercase text-[#AAAAAA]">{category.name}</p>
                <div className="w-5 h-px bg-[#CCCCCC]" />
              </div>
            </div>
          )}
        </div>

        <div aria-hidden="true" className="absolute inset-0 bg-black opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500" />

        <div
          aria-hidden="true"
          className={[
            'absolute bottom-4 right-4 z-10',
            'flex items-center justify-center w-8 h-8 bg-white',
            'translate-y-2 opacity-0',
            'group-hover:translate-y-0 group-hover:opacity-100',
            'transition-all duration-300 ease-out',
          ].join(' ')}
        >
          <ArrowUpRight size={14} strokeWidth={1.5} className="text-black" />
        </div>
      </div>

      {/* Text block */}
      <div className="pt-5 text-center">
        <h3
          className={[
            'font-serif font-light text-[20px] lg:text-[22px]',
            'tracking-[0.04em] leading-none text-black',
            'transition-colors duration-200 group-hover:text-[#B89947]',
          ].join(' ')}
        >
          {category.name}
        </h3>
        {category.description && (
          <p className="mt-2 text-[11px] tracking-[0.06em] text-[#9CA3AF] leading-snug line-clamp-2">
            {category.description}
          </p>
        )}
      </div>
    </Link>
  )
}

export default async function CategoryGrid() {
  const categories = await getCategoriesPublic()

  // Sadece kök kategoriler (parent_id = NULL), ilk 3
  const rootCategories = categories.filter((c) => c.parent_id === null).slice(0, 3)

  if (rootCategories.length === 0) return null

  return (
    <section aria-labelledby="categories-heading" className="h-section border-t border-[#F3F4F6]">
      <div className="h-container">

        <div className="flex flex-col items-center text-center mb-14 lg:mb-20">
          <p className="h-eyebrow mb-4">Mekânınızı Dönüştürün</p>
          <h2
            id="categories-heading"
            className="font-serif font-light text-[32px] lg:text-[40px] tracking-[0.02em] leading-none"
          >
            Koleksiyonlar
          </h2>
          <div className="w-8 h-px bg-[#B89947] mt-6" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 xl:gap-14">
          {rootCategories.map((category, i) => (
            <CategoryCard key={category.id} category={category} index={i} />
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            href="/kategori/tum-urunler"
            className={[
              'inline-flex items-center gap-2',
              'text-[10px] tracking-[0.28em] uppercase text-[#9CA3AF] font-medium',
              'hover:text-black transition-colors duration-200',
            ].join(' ')}
          >
            Tüm Koleksiyonları Gör
            <ArrowUpRight size={11} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
