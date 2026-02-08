'use client';

import { useState } from 'react';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
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
    <div className="bg-elite-bone min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="elite-container py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-elite-gray hover:text-elite-gold transition-colors duration-300"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <Link
              href="/kategori/tum-urunler"
              className="text-elite-gray hover:text-elite-gold transition-colors duration-300"
            >
              Ürünler
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <span className="text-elite-black font-medium">{category.name}</span>
          </nav>
        </div>
      </div>

      {/* Category Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="elite-container py-8 lg:py-12">
          <h1 className="font-serif text-3xl lg:text-4xl xl:text-5xl font-semibold text-elite-black mb-3">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-elite-gray text-lg max-w-3xl leading-relaxed">
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white
                       border border-gray-200 rounded-xl text-elite-black font-medium
                       hover:border-elite-gold hover:text-elite-gold transition-colors"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Filtrele
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-elite-gold text-white text-xs rounded-full">
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
          <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
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
            <div className="hidden lg:flex items-center justify-between mb-6 bg-white rounded-xl px-6 py-4 shadow-sm">
              <p className="text-elite-gray">
                <span className="font-semibold text-elite-black">{products.length}</span> ürün bulundu
              </p>
              <ProductSort currentSort={currentFilters.sortOrder || 'recommended'} />
            </div>

            {/* Mobile Result Count */}
            <div className="lg:hidden mb-4">
              <p className="text-elite-gray text-sm">
                <span className="font-semibold text-elite-black">{products.length}</span> ürün bulundu
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
