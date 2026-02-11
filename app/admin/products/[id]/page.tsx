'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getProductById } from '@/lib/actions/products';
import { ProductWithCategory } from '@/types';
import ProductForm from '../ProductForm';

export default function EditProductPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      const result = await getProductById(productId);
      if (result.success && result.data) {
        setProduct(result.data);
      } else {
        setError('Ürün bulunamadı');
      }
      setIsFetching(false);
    }
    loadProduct();
  }, [productId]);

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-elite-gold animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Ürün bulunamadı'}</p>
        <Link href="/admin/products" className="text-elite-gold hover:underline mt-4 inline-block">
          Ürün listesine dön
        </Link>
      </div>
    );
  }

  return <ProductForm initialData={product} />;
}
