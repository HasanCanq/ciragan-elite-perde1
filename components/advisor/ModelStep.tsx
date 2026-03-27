import { getRoomWithModelsPublic } from '@/lib/data/advisor-queries';
import ModelCard from './ModelCard';
import AdvisorBreadcrumb from './AdvisorBreadcrumb';
import Link from 'next/link';

/* ──────────────────────────────────────────────────────────────
   ModelStep — Step 2: Seçilen odaya uygun perde modelleri.
   ──────────────────────────────────────────────────────────────
   Server Component: Supabase'den oda + mapping + model verisi çeker.
   Client olan ModelCard ve AdvisorBreadcrumb bileşenlerine iletir.
   ────────────────────────────────────────────────────────────── */

interface ModelStepProps {
  roomSlug: string;
}

export default async function ModelStep({ roomSlug }: ModelStepProps) {
  const { room, models } = await getRoomWithModelsPublic(roomSlug);

  // Oda bulunamadıysa — yanlış slug, silinen oda vb.
  if (!room) {
    return <RoomNotFound roomSlug={roomSlug} />;
  }

  return (
    <div>
      {/* Geri navigasyon + breadcrumb */}
      <AdvisorBreadcrumb roomName={room.name} roomSlug={room.slug} />

      {/* Bölüm başlığı */}
      <div className="mb-10 lg:mb-14">
        <p className="h-eyebrow mb-4">
          {room.name} — Adım 2 / 2
        </p>
        <h2
          className={[
            'font-serif font-light',
            'text-[36px] sm:text-[44px] lg:text-[52px]',
            'leading-none tracking-[0.02em]',
            'text-black mb-5',
          ].join(' ')}
        >
          Perde modelini<br />
          <em className="not-italic italic">seçin.</em>
        </h2>
        <div className="w-10 h-px bg-[#B89947]" />
      </div>

      {/* Model kartları */}
      {models.length === 0 ? (
        <NoModelsState roomName={room.name} />
      ) : (
        <>
          <div
            className={[
              'grid gap-[1px]',
              /* Mobil: 1 sütun | Tablet: 2 | Masaüstü: 3 */
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            ].join(' ')}
            role="list"
            aria-label={`${room.name} için perde modelleri`}
          >
            {models.map(({ model, marketing_text }) => (
              <div key={model.id} role="listitem">
                <ModelCard
                  model={model}
                  marketingText={marketing_text}
                  roomSlug={roomSlug}
                />
              </div>
            ))}
          </div>

          {/* Tüm koleksiyon bağlantısı */}
          <div className="mt-12 pt-10 border-t border-[#F3F4F6] flex items-center justify-between">
            <p className="text-[11px] tracking-[0.12em] text-[#9CA3AF]">
              Farklı bir model mi arıyorsunuz?
            </p>
            <Link
              href="/kategori/tum-urunler"
              className="h-btn-ghost text-[10px]"
            >
              Tüm Koleksiyonu Gör
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Hata durumları ─────────────────────────────────────────── */

function RoomNotFound({ roomSlug }: { roomSlug: string }) {
  return (
    <div className="py-24 text-center">
      <p className="h-eyebrow mb-4">Oda Bulunamadı</p>
      <p className="text-sm text-[#9CA3AF] mb-8 max-w-xs mx-auto">
        <span className="font-mono text-xs bg-[#F3F4F6] px-1.5 py-0.5">{roomSlug}</span>{' '}
        için kayıt bulunamadı. Lütfen oda seçimine geri dönün.
      </p>
      <Link href="/asistan" className="h-btn">
        Oda Seçimine Dön
      </Link>
    </div>
  );
}

function NoModelsState({ roomName }: { roomName: string }) {
  return (
    <div className="py-20 text-center">
      <p className="h-eyebrow mb-3">Model Bulunamadı</p>
      <p className="text-sm text-[#9CA3AF] mb-8 max-w-xs mx-auto">
        {roomName} için henüz model eşlemesi yapılmamış.
      </p>
      <Link href="/kategori/tum-urunler" className="h-btn">
        Tüm Ürünleri Gör
      </Link>
    </div>
  );
}
