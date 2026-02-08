'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown, Check, ArrowUpDown } from 'lucide-react';

interface ProductSortProps {
  currentSort: string;
  isMobile?: boolean;
}

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Önerilen Sıralama' },
  { value: 'price_asc', label: 'En Düşük Fiyat' },
  { value: 'price_desc', label: 'En Yüksek Fiyat' },
  { value: 'newest', label: 'En Yeniler' },
  { value: 'name_asc', label: 'A-Z Sıralama' },
  { value: 'name_desc', label: 'Z-A Sıralama' },
];

export default function ProductSort({ currentSort, isMobile = false }: ProductSortProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOption = SORT_OPTIONS.find((opt) => opt.value === currentSort) || SORT_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle sort change
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
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white
                   border border-gray-200 rounded-xl text-elite-black font-medium
                   hover:border-elite-gold transition-colors"
        >
          <ArrowUpDown className="w-5 h-5" />
          Sırala
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg
                        border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left
                          transition-colors ${
                            currentSort === option.value
                              ? 'bg-elite-gold/10 text-elite-gold'
                              : 'text-elite-gray hover:bg-gray-50 hover:text-elite-black'
                          }`}
              >
                <span className="text-sm">{option.label}</span>
                {currentSort === option.value && <Check className="w-4 h-4" />}
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
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg
                 text-elite-black hover:border-elite-gold transition-colors min-w-[200px]"
      >
        <span className="text-sm text-elite-gray mr-1">Sırala:</span>
        <span className="text-sm font-medium flex-1 text-left">{currentOption.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-elite-gray transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-lg
                      border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="py-1">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left
                          transition-colors ${
                            currentSort === option.value
                              ? 'bg-elite-gold/10 text-elite-gold'
                              : 'text-elite-gray hover:bg-gray-50 hover:text-elite-black'
                          }`}
              >
                <span className="text-sm">{option.label}</span>
                {currentSort === option.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
