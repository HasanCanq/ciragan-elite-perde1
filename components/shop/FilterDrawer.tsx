'use client';

import { useEffect } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { Category } from '@/types';
import ProductFilters from './ProductFilters';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currentCategory: Category;
  currentFilters: {
    minPrice?: string;
    maxPrice?: string;
    categoryIds?: string[];
  };
}

export default function FilterDrawer({
  isOpen,
  onClose,
  categories,
  currentCategory,
  currentFilters,
}: FilterDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-full max-w-sm bg-elite-bone z-50 lg:hidden
                   transform transition-transform duration-300 ease-out ${
                     isOpen ? 'translate-x-0' : '-translate-x-full'
                   }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-elite-gold" />
            <h2 className="font-serif text-lg font-semibold text-elite-black">Filtreler</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-elite-gray hover:text-elite-black hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Kapat"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-65px)] p-4">
          <ProductFilters
            categories={categories}
            currentCategory={currentCategory}
            currentFilters={currentFilters}
            onClose={onClose}
          />
        </div>
      </div>
    </>
  );
}
