'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'hanedan_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Daha önce onay verilmemişse banner'ı göster
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Kısa gecikme: layout shift önlemek için sayfanın tam yüklenmesini bekle
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Çerez bildirimi"
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-black border-t border-white/10',
        'px-4 py-4 sm:px-6',
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
        'animate-in slide-in-from-bottom duration-300',
      ].join(' ')}
    >
      <p className="text-[12px] leading-relaxed text-white/80 max-w-2xl">
        Çerezler, web sitemizdeki deneyiminizi geliştirmek için kullanılır. Bu web sitesine göz
        atarak çerezleri kullanmamızı kabul edersiniz. Çerezler ile ilgili detaylı bilgi için{' '}
        <Link
          href="/cerez-politikasi"
          className="text-[#B89947] underline underline-offset-2 hover:no-underline"
        >
          Çerez Politikamızı
        </Link>{' '}
        ziyaret edebilirsiniz.
      </p>

      <button
        onClick={accept}
        className={[
          'flex-shrink-0',
          'px-6 py-2.5',
          'bg-[#B89947] hover:bg-[#a08535] active:bg-[#8a7030]',
          'text-white text-[11px] font-semibold tracking-[0.14em] uppercase',
          'transition-colors duration-200',
          'whitespace-nowrap',
        ].join(' ')}
      >
        Kabul Et
      </button>
    </div>
  );
}
