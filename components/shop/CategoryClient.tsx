'use client';

import { useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Category, ProductWithCategory } from '@/types';
import { formatPrice } from '@/lib/utils';
import CategoryLayout from './CategoryLayout';

interface CategoryClientProps {
  category: Category;
  categories: Category[];
  allProducts: ProductWithCategory[];
}

// ── Chip filtre tanımları ─────────────────────────────────────────────────────

const PRICE_CHIPS = [
  { label: 'Tüm Fiyatlar', minPrice: undefined, maxPrice: undefined },
  { label: '0 – 500 ₺/m²', minPrice: '0',    maxPrice: '500'  },
  { label: '500 – 1000 ₺', minPrice: '500',   maxPrice: '1000' },
  { label: '1000 – 2000 ₺',minPrice: '1000',  maxPrice: '2000' },
  { label: '2000 ₺ +',     minPrice: '2000',  maxPrice: undefined },
] as const;

// ── ChipFilterBar ─────────────────────────────────────────────────────────────

function ChipFilterBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const minP    = params.get('minPrice');
  const maxP    = params.get('maxPrice');
  const inStock = params.get('inStock') === 'true';

  function buildUrl(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) next.delete(k);
      else next.set(k, v);
    }
    return `${pathname}?${next.toString()}`;
  }

  function activePriceChip() {
    return PRICE_CHIPS.findIndex(
      (c) => (c.minPrice ?? null) === (minP ?? null) && (c.maxPrice ?? null) === (maxP ?? null)
    );
  }

  const activeIdx = activePriceChip();

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
      {PRICE_CHIPS.map((chip, i) => {
        const isActive = i === activeIdx;
        return (
          <button
            key={i}
            onClick={() =>
              router.push(
                buildUrl({ minPrice: chip.minPrice, maxPrice: chip.maxPrice }),
                { scroll: false }
              )
            }
            className={[
              'flex-shrink-0 px-4 py-1.5 text-[10px] tracking-[0.25em] uppercase',
              'transition-colors duration-200 border whitespace-nowrap',
              isActive
                ? 'bg-black border-black text-white'
                : 'bg-white border-[#E5E7EB] text-[#9CA3AF] hover:border-[#B89947] hover:text-[#B89947]',
            ].join(' ')}
          >
            {chip.label}
          </button>
        );
      })}

      {/* Stok chip */}
      <button
        onClick={() =>
          router.push(
            buildUrl({ inStock: inStock ? undefined : 'true' }),
            { scroll: false }
          )
        }
        className={[
          'flex-shrink-0 px-4 py-1.5 text-[10px] tracking-[0.25em] uppercase',
          'transition-colors duration-200 border whitespace-nowrap',
          inStock
            ? 'bg-black border-black text-white'
            : 'bg-white border-[#E5E7EB] text-[#9CA3AF] hover:border-black hover:text-black',
        ].join(' ')}
      >
        Stokta Var
      </button>
    </div>
  );
}

// ── ProductGrid ───────────────────────────────────────────────────────────────

function ProductGrid({ products, categoryName }: { products: ProductWithCategory[]; categoryName: string }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10 py-8">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/urun/${product.slug}`}
          className="group block"
        >
          {/* Image — portrait 3:4, overflow-hidden for scale hover */}
          <div className="relative overflow-hidden bg-[#F3F4F6]" style={{ aspectRatio: '1/1' }}>
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] tracking-[0.4em] uppercase text-[#C4C4C4]">Görsel Yok</span>
              </div>
            )}

            {/* Out-of-stock badge */}
            {!product.in_stock && (
              <div className="absolute top-3 left-3">
                <span className="h-badge-black">Tükendi</span>
              </div>
            )}
          </div>

          {/* Text below image */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#9CA3AF] mb-1 truncate">
              {product.category?.name || categoryName}
            </p>
            <h3 className="text-[13px] tracking-[0.02em] text-black group-hover:text-[#B89947] transition-colors duration-200 line-clamp-2 leading-[1.5]">
              {product.name}
            </h3>
            <p className="mt-2 text-[13px] font-medium tracking-[0.04em]" style={{ color: 'var(--accent)' }}>
              {formatPrice(product.base_price)}
              <span className="text-[10px] text-[#9CA3AF] ml-1 font-normal">/m²</span>
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-24">
      <p className="h-eyebrow mb-6 justify-center">
        {hasFilters ? 'Filtre Sonucu' : 'Kategori'}
      </p>
      <h2 className="font-serif font-light text-[24px] tracking-[0.04em] text-black mb-4">
        Ürün Bulunamadı
      </h2>
      <p className="text-[12px] tracking-[0.06em] text-[#9CA3AF] mb-10 max-w-xs mx-auto leading-[1.85]">
        {hasFilters
          ? 'Seçilen filtrelere uygun ürün yok. Filtreleri değiştirin.'
          : 'Bu kategoride henüz ürün bulunmuyor.'}
      </p>
      <Link href="/" className="h-btn-outline">
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}

// ── ProductGridSkeleton ───────────────────────────────────────────────────────

function ProductGridSkeleton() {
  return (
    <div>
      {/* Filter chip skeletons */}
      <div className="flex gap-2 overflow-x-hidden pb-1 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 h-8 w-28 bg-[#F3F4F6] animate-pulse" />
        ))}
      </div>
      {/* Product card skeletons */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10 py-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="bg-[#F3F4F6] animate-pulse" style={{ aspectRatio: '1/1' }} />
            <div className="pt-3 space-y-2">
              <div className="h-3 w-20 bg-[#F3F4F6] animate-pulse" />
              <div className="h-4 w-full bg-[#F3F4F6] animate-pulse" />
              <div className="h-4 w-16 bg-[#F3F4F6] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CategoryClientInner ───────────────────────────────────────────────────────

function CategoryClientInner({ category, categories, allProducts }: CategoryClientProps) {
  const searchParams = useSearchParams();

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const sortParam     = searchParams.get('sort') || 'recommended';
  const inStockParam  = searchParams.get('inStock');

  const currentFilters = {
    minPrice:  minPriceParam  ?? undefined,
    maxPrice:  maxPriceParam  ?? undefined,
    sortOrder: sortParam,
  };

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (minPriceParam) {
      const min = parseFloat(minPriceParam);
      if (!isNaN(min)) result = result.filter((p) => p.base_price >= min);
    }
    if (maxPriceParam) {
      const max = parseFloat(maxPriceParam);
      if (!isNaN(max)) result = result.filter((p) => p.base_price <= max);
    }
    if (inStockParam === 'true') {
      result = result.filter((p) => p.in_stock);
    }

    switch (sortParam) {
      case 'price_asc':  result.sort((a, b) => a.base_price - b.base_price); break;
      case 'price_desc': result.sort((a, b) => b.base_price - a.base_price); break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        break;
      case 'name_asc':  result.sort((a, b) => a.name.localeCompare(b.name, 'tr')); break;
      case 'name_desc': result.sort((a, b) => b.name.localeCompare(a.name, 'tr')); break;
    }

    return result;
  }, [allProducts, minPriceParam, maxPriceParam, inStockParam, sortParam]);

  return (
    <CategoryLayout
      category={category}
      categories={categories}
      products={filteredProducts}
      currentFilters={currentFilters}
    >
      {/* Chip filtre çubuğu */}
      <div className="pb-0">
        <ChipFilterBar />
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState hasFilters={Boolean(minPriceParam || maxPriceParam || inStockParam)} />
      ) : (
        <ProductGrid products={filteredProducts} categoryName={category.name} />
      )}
    </CategoryLayout>
  );
}

// ── Default export ────────────────────────────────────────────────────────────

export default function CategoryClient(props: CategoryClientProps) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CategoryClientInner {...props} />
    </Suspense>
  );
}
