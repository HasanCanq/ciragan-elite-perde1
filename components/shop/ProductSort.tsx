'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown, Check, ArrowUpDown } from 'lucide-react';

interface ProductSortProps {
  currentSort: string;
  isMobile?: boolean;
}

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Önerilen' },
  { value: 'price_asc', label: 'En Düşük Fiyat' },
  { value: 'price_desc', label: 'En Yüksek Fiyat' },
  { value: 'newest', label: 'En Yeniler' },
  { value: 'name_asc', label: 'A-Z' },
  { value: 'name_desc', label: 'Z-A' },
];

export default function ProductSort({ currentSort, isMobile = false }: ProductSortProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOption = SORT_OPTIONS.find((opt) => opt.value === currentSort) || SORT_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'recommended') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    setIsOpen(false);
  };

  if (isMobile) {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3
                     border border-[#1A1A1A]/20 text-[#4A4A4A] text-[9px] tracking-[0.25em] uppercase
                     hover:border-[#B89947]/60 hover:text-[#B89947] transition-colors duration-300 bg-white"
        >
          <ArrowUpDown className="w-4 h-4" />
          Sırala
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#1A1A1A]/20 z-50 shadow-sm">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-200 ${
                  currentSort === option.value
                    ? 'bg-[#B89947]/10 text-[#B89947]'
                    : 'text-[#4A4A4A] hover:bg-[#B89947]/5 hover:text-[#B89947]'
                }`}
              >
                <span className="text-[9px] tracking-[0.2em] uppercase">{option.label}</span>
                {currentSort === option.value && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 border border-[#1A1A1A]/20 bg-white
                   hover:border-[#B89947]/60 transition-colors duration-300 min-w-[180px]"
      >
        <span className="text-[#9A9A9A] text-[8px] tracking-[0.2em] uppercase">Sırala</span>
        <span className="text-[#4A4A4A] text-[9px] tracking-[0.15em] uppercase flex-1 text-left">{currentOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#B89947]/50 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-[#1A1A1A]/20 z-50 shadow-sm">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors duration-200 ${
                currentSort === option.value
                  ? 'bg-[#B89947]/10 text-[#B89947]'
                  : 'text-[#4A4A4A] hover:bg-[#B89947]/5 hover:text-[#B89947]'
              }`}
            >
              <span className="text-[9px] tracking-[0.2em] uppercase">{option.label}</span>
              {currentSort === option.value && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
