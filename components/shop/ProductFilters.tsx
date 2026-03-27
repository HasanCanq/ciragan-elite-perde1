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
    <div className="border-b border-[#1A1A1A]/20 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-[#4A4A4A] text-[9px] tracking-[0.3em] uppercase group-hover:text-[#B89947] transition-colors duration-300">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#B89947]/50 transition-transform duration-200 ${
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

  const handlePriceFilter = () => {
    const queryString = createQueryString({
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
    });

    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    onClose?.();
  };

  const handleClearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    router.push(pathname, { scroll: false });
    onClose?.();
  };

  const hasActiveFilters = Boolean(
    currentFilters.minPrice ||
    currentFilters.maxPrice ||
    (currentFilters.categoryIds && currentFilters.categoryIds.length > 0)
  );

  const otherCategories = categories.filter((cat) => cat.id !== currentCategory.id);

  return (
    <div className="border border-[#1A1A1A]/20 p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#1A1A1A]/20">
        <h2 className="font-['Cinzel',_serif] text-[#1A1A1A] text-[11px] tracking-[0.2em] uppercase">Filtreler</h2>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 text-[#767676] text-[9px] tracking-[0.2em] uppercase hover:text-[#B89947] transition-colors duration-300"
          >
            <RotateCcw className="w-3 h-3" />
            Temizle
          </button>
        )}
      </div>

      {/* Price Filter */}
      <AccordionSection title="Fiyat Aralığı">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[8px] text-[#9A9A9A] tracking-[0.2em] uppercase mb-2">Min (TL/m²)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                min="0"
                className="elite-input text-sm"
              />
            </div>
            <span className="text-[#9A9A9A] mt-5">—</span>
            <div className="flex-1">
              <label className="block text-[8px] text-[#9A9A9A] tracking-[0.2em] uppercase mb-2">Max (TL/m²)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="10000"
                min="0"
                className="elite-input text-sm"
              />
            </div>
          </div>
          <button
            onClick={handlePriceFilter}
            className="elite-button w-full"
          >
            Uygula
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
                className={`px-3 py-1.5 text-[8px] tracking-[0.2em] uppercase border transition-colors duration-200 ${
                  minPrice === range.min && maxPrice === range.max
                    ? 'bg-[#B89947] text-white border-[#B89947]'
                    : 'bg-transparent text-[#767676] border-[#1A1A1A]/20 hover:border-[#B89947]/60 hover:text-[#B89947]'
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
          <div className="space-y-1">
            {/* Current Category */}
            <div className="flex items-center gap-3 px-3 py-2 bg-[#B89947]/8">
              <div className="w-4 h-4 bg-[#B89947] flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-[#B89947] text-[9px] tracking-[0.2em] uppercase">
                {currentCategory.name}
              </span>
            </div>

            {/* Other Categories */}
            {otherCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/kategori/${cat.slug}`}
                className="flex items-center gap-3 px-3 py-2 hover:bg-[#B89947]/5 transition-colors duration-200 group"
              >
                <div className="w-4 h-4 border border-[#B89947]/30 group-hover:border-[#B89947]/60 transition-colors duration-200" />
                <span className="text-[#767676] text-[9px] tracking-[0.2em] uppercase group-hover:text-[#B89947] transition-colors duration-200">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Stock Filter */}
      <AccordionSection title="Stok Durumu" defaultOpen={false}>
        <div className="space-y-1">
          <label className="flex items-center gap-3 px-3 py-2 hover:bg-[#B89947]/5 cursor-pointer group transition-colors duration-200">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 border border-[#B89947]/30 bg-transparent cursor-pointer accent-[#B89947]"
            />
            <span className="text-[#767676] text-[9px] tracking-[0.2em] uppercase group-hover:text-[#B89947] transition-colors duration-200">
              Stokta Olanlar
            </span>
          </label>
          <label className="flex items-center gap-3 px-3 py-2 hover:bg-[#B89947]/5 cursor-pointer group transition-colors duration-200">
            <input
              type="checkbox"
              className="w-4 h-4 border border-[#B89947]/30 bg-transparent cursor-pointer accent-[#B89947]"
            />
            <span className="text-[#767676] text-[9px] tracking-[0.2em] uppercase group-hover:text-[#B89947] transition-colors duration-200">
              Tükenenler Dahil
            </span>
          </label>
        </div>
      </AccordionSection>
    </div>
  );
}
