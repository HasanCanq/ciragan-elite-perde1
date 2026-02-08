'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown, Check, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { Category } from '@/types';

interface ProductFiltersProps {
  categories: Category[];
  currentCategory: Category;
  currentFilters: {
    minPrice?: string;
    maxPrice?: string;
    categoryIds?: string[];
  };
  onClose?: () => void;
}

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({ title, defaultOpen = true, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="font-serif text-lg font-medium text-elite-black group-hover:text-elite-gold transition-colors">
          {title}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-elite-gray transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[500px] opacity-100 pb-4' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function ProductFilters({
  categories,
  currentCategory,
  currentFilters,
  onClose,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minPrice, setMinPrice] = useState(currentFilters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(currentFilters.maxPrice || '');

  // Create query string with updated params
  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      return params.toString();
    },
    [searchParams]
  );

  // Apply price filter
  const handlePriceFilter = () => {
    const queryString = createQueryString({
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
    });

    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    onClose?.();
  };

  // Clear all filters
  const handleClearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    router.push(pathname, { scroll: false });
    onClose?.();
  };

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    currentFilters.minPrice ||
    currentFilters.maxPrice ||
    (currentFilters.categoryIds && currentFilters.categoryIds.length > 0)
  );

  // Other categories (excluding current)
  const otherCategories = categories.filter((cat) => cat.id !== currentCategory.id);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
        <h2 className="font-serif text-xl font-semibold text-elite-black">Filtreler</h2>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 text-sm text-elite-gray hover:text-elite-gold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Temizle
          </button>
        )}
      </div>

      {/* Price Filter */}
      <AccordionSection title="Fiyat Aralığı">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-elite-gray mb-1.5">Min (TL/m²)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                         transition-colors"
              />
            </div>
            <span className="text-elite-gray mt-5">-</span>
            <div className="flex-1">
              <label className="block text-xs text-elite-gray mb-1.5">Max (TL/m²)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="10000"
                min="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                         transition-colors"
              />
            </div>
          </div>
          <button
            onClick={handlePriceFilter}
            className="w-full py-2.5 bg-elite-black text-white text-sm font-medium rounded-lg
                     hover:bg-elite-gold transition-colors"
          >
            Fiyat Uygula
          </button>

          {/* Quick Price Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: '0 - 500', min: '0', max: '500' },
              { label: '500 - 1000', min: '500', max: '1000' },
              { label: '1000 - 2000', min: '1000', max: '2000' },
              { label: '2000+', min: '2000', max: '' },
            ].map((range) => (
              <button
                key={range.label}
                onClick={() => {
                  setMinPrice(range.min);
                  setMaxPrice(range.max);
                }}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  minPrice === range.min && maxPrice === range.max
                    ? 'bg-elite-gold text-white border-elite-gold'
                    : 'bg-white text-elite-gray border-gray-200 hover:border-elite-gold hover:text-elite-gold'
                }`}
              >
                {range.label} TL
              </button>
            ))}
          </div>
        </div>
      </AccordionSection>

      {/* Categories */}
      {otherCategories.length > 0 && (
        <AccordionSection title="Kategoriler" defaultOpen={false}>
          <div className="space-y-2">
            {/* Current Category */}
            <div className="flex items-center gap-3 px-3 py-2 bg-elite-gold/10 rounded-lg">
              <div className="w-5 h-5 rounded bg-elite-gold flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-elite-black">
                {currentCategory.name}
              </span>
            </div>

            {/* Other Categories */}
            {otherCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/kategori/${cat.slug}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-5 h-5 rounded border-2 border-gray-300 group-hover:border-elite-gold transition-colors" />
                <span className="text-sm text-elite-gray group-hover:text-elite-black transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Attributes Placeholder */}
      <AccordionSection title="Özellikler" defaultOpen={false}>
        <div className="text-sm text-elite-gray bg-gray-50 rounded-lg p-4 text-center">
          Yakında eklenecek...
        </div>
      </AccordionSection>

      {/* Stock Filter */}
      <AccordionSection title="Stok Durumu" defaultOpen={false}>
        <div className="space-y-2">
          <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
            <input
              type="checkbox"
              defaultChecked
              className="w-5 h-5 rounded border-gray-300 text-elite-gold
                       focus:ring-elite-gold focus:ring-offset-0 cursor-pointer
                       accent-elite-gold"
            />
            <span className="text-sm text-elite-gray group-hover:text-elite-black transition-colors">
              Stokta Olanlar
            </span>
          </label>
          <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-gray-300 text-elite-gold
                       focus:ring-elite-gold focus:ring-offset-0 cursor-pointer
                       accent-elite-gold"
            />
            <span className="text-sm text-elite-gray group-hover:text-elite-black transition-colors">
              Tükenenler Dahil
            </span>
          </label>
        </div>
      </AccordionSection>
    </div>
  );
}
