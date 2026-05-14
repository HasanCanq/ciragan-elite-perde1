import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { MeasurementGuide } from '@/types';
import MeasurementAccordion from './MeasurementAccordion';

export const metadata = {
  title: 'Ölçü Kılavuzu | Çırağan Elite Perde',
  description: 'Tül perde, fon perde, zebra ve stor perdeler için doğru ölçü nasıl alınır? Adım adım görsel kılavuz.',
};

const GUIDE_LABELS: Record<string, string> = {
  'tul':          'Tül Perde',
  'fon':          'Fon Perde',
  'zebra':        'Zebra Perde',
  'stor':         'Stor Perde',
  'ahsap-jaluzi': 'Ahşap Jaluzi',
};

async function getPublicGuides(): Promise<MeasurementGuide[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('measurement_guides')
    .select('*')
    .eq('is_active', true)
    .order('guide_key');
  return data ?? [];
}

export default async function OlcuKilavuzuPage() {
  const guides = await getPublicGuides();

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-black py-16 lg:py-24">
        <div className="h-container">
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link href="/" className="text-white/70 hover:text-[#B89947] transition-colors">
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-white/70" />
            <span className="text-[#B89947]">Ölçü Kılavuzu</span>
          </nav>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-white">
            Ölçü Kılavuzu
          </h1>
          <p className="mt-4 text-white/70 text-lg max-w-2xl">
            Doğru ölçüm, mükemmel uyumun temelidir. Kategori seçerek kılavuzu inceleyin.
          </p>
        </div>
      </section>

      {/* Accordion */}
      <section className="py-16 lg:py-24">
        <div className="h-container max-w-2xl">
          {guides.length === 0 ? (
            <p className="text-[#9CA3AF] text-sm text-center py-12">
              Kılavuzlar henüz yüklenmedi. Yakında eklenecek.
            </p>
          ) : (
            <MeasurementAccordion
              guides={guides}
              labels={GUIDE_LABELS}
            />
          )}
        </div>
      </section>
    </main>
  );
}
