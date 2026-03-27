import { getRoomsPublic } from '@/lib/data/advisor-queries';
import RoomCard from './RoomCard';

/* ──────────────────────────────────────────────────────────────
   RoomStep — Step 1: Asistan akışının oda seçim aşaması.
   ──────────────────────────────────────────────────────────────
   Server Component: veriyi sunucu tarafında çeker, Client olan
   RoomCard bileşenlerine props olarak iletir.
   ────────────────────────────────────────────────────────────── */
export default async function RoomStep() {
  const rooms = await getRoomsPublic();

  return (
    <div>
      {/* Bölüm başlığı */}
      <div className="mb-10 lg:mb-14">
        <p className="h-eyebrow mb-4">Adım 1 / 2</p>
        <h2
          className={[
            'font-serif font-light',
            'text-[36px] sm:text-[44px] lg:text-[52px]',
            'leading-none tracking-[0.02em]',
            'text-black',
            'mb-5',
          ].join(' ')}
        >
          Hangi odanız<br />
          <em className="not-italic italic">için seçiyorsunuz?</em>
        </h2>
        <div className="w-10 h-px bg-[#B89947]" />
      </div>

      {/* Oda kartları grid */}
      {rooms.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className={[
            'grid gap-[1px]',
            /* Mobil: 2 sütun | Tablet: 3 sütun | Masaüstü: yatay 6'lı veya 3'lü */
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6',
          ].join(' ')}
          role="list"
          aria-label="Oda seçenekleri"
        >
          {rooms.map((room) => (
            <div key={room.id} role="listitem">
              <RoomCard room={room} />
            </div>
          ))}
        </div>
      )}

      {/* Alt açıklama metni */}
      <p
        className={[
          'mt-10 lg:mt-14',
          'text-[11px] tracking-[0.12em]',
          'text-[#9CA3AF]',
          'max-w-[480px]',
        ].join(' ')}
      >
        Her oda için en uygun perde modellerini, maksimum ölçülerini ve
        o mekânın ihtiyaçlarına göre hazırlanmış önerilerimizi sunuyoruz.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <p className="h-eyebrow mb-3">Veri Yükleniyor</p>
      <p className="text-sm text-[#9CA3AF]">
        Oda seçenekleri yüklenemedi. Lütfen sayfayı yenileyin.
      </p>
    </div>
  );
}
