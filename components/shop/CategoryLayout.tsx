'use client';

import { useState } from 'react';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { Category, ProductWithCategory } from '@/types';
import ProductFilters from './ProductFilters';
import ProductSort from './ProductSort';
import FilterDrawer from './FilterDrawer';

interface CategoryLayoutProps {
  category: Category;
  categories: Category[];
  products: ProductWithCategory[];
  children: React.ReactNode;
  currentFilters: {
    minPrice?: string;
    maxPrice?: string;
    sortOrder?: string;
    categoryIds?: string[];
  };
}

export default function CategoryLayout({
  category,
  categories,
  products,
  children,
  currentFilters,
}: CategoryLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeFiltersCount = [
    currentFilters.minPrice,
    currentFilters.maxPrice,
    ...(currentFilters.categoryIds || []),
  ].filter(Boolean).length;

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-[#1A1A1A]/20">
        <div className="elite-container py-4">
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="text-[#767676] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <Link
              href="/kategori/tum-urunler"
              className="text-[#767676] text-[9px] tracking-[0.3em] uppercase hover:text-[#B89947] transition-colors duration-300"
            >
              Ürünler
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B89947]/40" />
            <span className="text-[#B89947]/80 text-[9px] tracking-[0.3em] uppercase">{category.name}</span>
          </nav>
        </div>
      </div>

      {/* Category Header */}
      <div className="border-b border-[#1A1A1A]/20">
        <div className="elite-container py-10 lg:py-16">
          <p className="elite-eyebrow mb-4">Koleksiyon</p>
          <h1 className="font-['Cinzel',_serif] text-[#1A1A1A] text-3xl lg:text-4xl tracking-[0.05em] mb-4">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-[#767676] text-[11px] tracking-[0.15em] max-w-xl leading-relaxed">
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="elite-container py-8">
        {/* Mobile Filter Bar */}
        <div className="lg:hidden mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                         border border-[#1A1A1A]/20 text-[#4A4A4A] text-[9px] tracking-[0.25em] uppercase
                         hover:border-[#B89947]/60 hover:text-[#B89947] transition-colors duration-300"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtrele
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-[#B89947] text-white text-[8px] tracking-[0.1em]">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <div className="flex-1">
              <ProductSort
                currentSort={currentFilters.sortOrder || 'recommended'}
                isMobile
              />
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="flex gap-8">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
            <div className="sticky top-24">
              <ProductFilters
                categories={categories}
                currentCategory={category}
                currentFilters={currentFilters}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Top Bar */}
            <div className="hidden lg:flex items-center justify-between mb-6 border border-[#1A1A1A]/20 px-6 py-4">
              <p className="text-[#767676] text-[9px] tracking-[0.25em] uppercase">
                <span className="text-[#1A1A1A]">{products.length}</span> ürün
              </p>
              <ProductSort currentSort={currentFilters.sortOrder || 'recommended'} />
            </div>

            {/* Mobile Result Count */}
            <div className="lg:hidden mb-4">
              <p className="text-[#767676] text-[9px] tracking-[0.25em] uppercase">
                <span className="text-[#1A1A1A]">{products.length}</span> ürün
              </p>
            </div>

            {/* Products Grid */}
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        categories={categories}
        currentCategory={category}
        currentFilters={currentFilters}
      />
    </div>
  );
}
