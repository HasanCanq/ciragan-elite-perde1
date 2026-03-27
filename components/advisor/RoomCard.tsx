'use client';

import { useRouter } from 'next/navigation';
import { RoomIcon } from './RoomIcon';
import type { Room } from '@/types';

/* ──────────────────────────────────────────────────────────────
   RoomCard — Step 1 interaktif oda kartı
   ──────────────────────────────────────────────────────────────
   • Tıklanınca router.push('/asistan?oda=[slug]') çağırır
   • Hover: arka plan siyahlaşır, ikon altın rengi alır, isim beyazlaşır
   • Sıfır border-radius (mimari keskinlik)
   • group/* utility ile tek geçişte tüm iç elemanlar animate edilir
   ────────────────────────────────────────────────────────────── */

interface RoomCardProps {
  room: Room;
}

export default function RoomCard({ room }: RoomCardProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/asistan?oda=${room.slug}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${room.name} odası için perde seç`}
      className={[
        'group relative w-full',
        'flex flex-col items-center justify-center gap-5',
        'border border-[#E5E5E5]',
        'px-6 py-10 sm:py-12',
        /* Hover: dolgu siyah, kenarlık siyah */
        'hover:bg-[#111111] hover:border-[#111111]',
        'transition-colors duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B89947]',
        'cursor-pointer',
      ].join(' ')}
    >
      {/* Altın üst çizgi — hover'da görünür */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-[#B89947] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
      />

      {/* İkon — hover'da altın rengi */}
      <span className="text-[#9CA3AF] group-hover:text-[#B89947] transition-colors duration-300">
        <RoomIcon
          slug={room.slug}
          className="w-10 h-10 sm:w-12 sm:h-12"
        />
      </span>

      {/* Oda adı */}
      <span
        className={[
          'font-serif font-light',
          'text-[18px] sm:text-[20px] lg:text-[22px]',
          'tracking-[0.04em] leading-none',
          'text-black group-hover:text-white',
          'transition-colors duration-300',
        ].join(' ')}
      >
        {room.name}
      </span>

      {/* "Seç" aksiyonu metni — hover'da görünür */}
      <span
        className={[
          'text-[9px] tracking-[0.42em] uppercase',
          'text-[#B89947]',
          'opacity-0 group-hover:opacity-100',
          'translate-y-1 group-hover:translate-y-0',
          'transition-all duration-300',
        ].join(' ')}
      >
        Seçin →
      </span>
    </button>
  );
}
