import Link from 'next/link'

const COLLECTIONS = [
  { label: 'Tül Perde',         href: '/kategori/tul-perde'         },
  { label: 'Fon Perde',         href: '/kategori/fon-perde'         },
  { label: 'Stor & Zebra',      href: '/kategori/stor-zebra'        },
  { label: 'Ahşap Jaluzi',      href: '/kategori/ahsap-jaluzi'      },
  { label: 'Motorlu Sistemler', href: '/kategori/motorlu-sistemler' },
  { label: 'Aksesuarlar',       href: '/kategori/aksesuarlar'       },
  { label: 'Rustikler',         href: '/kategori/rustikler'         },
]

const INFO_LINKS = [
  { label: 'Hakkımızda',    href: '/hakkimizda'    },
  { label: 'İletişim',      href: '/iletisim'      },
  { label: 'Sipariş Takibi', href: '/siparis-takip' },
  { label: 'Ölçü Kılavuzu', href: '/olcu-kilavuzu' },
]

const CUSTOMER_LINKS = [
  { label: 'Mesafeli Satış Sözleşmesi', href: '/mesafeli-satis'  },
  { label: 'İptal & İade Politikası',   href: '/iade-politikasi' },
]

const LEGAL_LINKS = [
  { label: 'Gizlilik Politikası', href: '/gizlilik'        },
  { label: 'KVKK',                href: '/kvkk'            },
  { label: 'Çerez Politikası',    href: '/cerez-politikasi'},
  { label: 'İptal & İade',        href: '/iade-politikasi' },
]

/* ── Footer ─────────────────────────────────────────────────────────────────
   Server component — no client JS needed.
   Hidden on admin pages via their own layout (app/admin/layout.tsx).
   ─────────────────────────────────────────────────────────────────────────── */
export default function Footer() {
  return (
    <footer className="h-rule mt-auto">
      <div className="h-container">

        {/* ── Main 4-column grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12 py-16 lg:py-20">

          {/* Col 1 — Brand ─────────────────────────────────────────────────── */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link
              href="/"
              className={[
                'font-serif text-[18px] tracking-[0.2em] uppercase text-black',
                'hover:text-[#B89947] transition-colors duration-200',
                'block mb-4',
              ].join(' ')}
            >
              Hanedan
            </Link>

            <p className="text-[12px] leading-[1.85] tracking-[0.02em] text-[#9CA3AF] mb-6 max-w-[220px]">
              Asaletin ve zarafetin buluştuğu yer. Yaşam alanlarınızı özenle
              seçilmiş perde koleksiyonlarımızla dönüştürün.
            </p>

            {/* Social */}
            <div className="flex items-center gap-5">
              <a
                href="https://www.instagram.com/hanedancollectiontr/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram'da takip edin"
                className="text-[10px] tracking-[0.22em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200"
              >
                Instagram
              </a>
              <span className="text-[#E5E7EB]" aria-hidden="true">·</span>
              <a
                href="https://wa.me/905001234567"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp ile iletişim"
                className="text-[10px] tracking-[0.22em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200"
              >
                WhatsApp
              </a>
            </div>
          </div>

          {/* Col 2 — Collections ────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-black mb-5">
              Koleksiyonlar
            </p>
            <ul className="flex flex-col gap-[10px]">
              {COLLECTIONS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[12px] tracking-[0.04em] text-[#9CA3AF] hover:text-black transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Info ──────────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-black mb-5">
              Bilgi
            </p>
            <ul className="flex flex-col gap-[10px]">
              {INFO_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[12px] tracking-[0.04em] text-[#9CA3AF] hover:text-black transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Müşteri Hizmetleri ────────────────────────────────────── */}
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-black mb-5">
              Müşteri Hizmetleri
            </p>
            <ul className="flex flex-col gap-[10px]">
              {CUSTOMER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[12px] tracking-[0.04em] text-[#9CA3AF] hover:text-black transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact ────────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-black mb-5">
              İletişim
            </p>
            <ul className="flex flex-col gap-[10px] text-[12px] tracking-[0.04em] text-[#9CA3AF]">
              <li>Mehmet Akif Ersoy Mah. Çamlıca Yolu Cad. No:31A</li>
              <li>
                <a
                  href="tel:+905530464659"
                  className="hover:text-black transition-colors duration-200"
                >
                  0553 046 46 59
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@hanedanperde.com.tr"
                  className="hover:text-black transition-colors duration-200"
                >
                  info@hanedanperde.com.tr
                </a>
              </li>
              <li className="pt-1 text-[11px]">Pzt – Cmt · 09:00 – 18:00</li>
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────────────── */}
        <div
          className={[
            'h-rule py-5',
            'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3',
          ].join(' ')}
        >
          <p className="text-[10px] tracking-[0.14em] text-[#9CA3AF]">
            © {new Date().getFullYear()} Hanedan. Tüm hakları saklıdır.
          </p>

          <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.href} className="flex items-center gap-4">
                <Link
                  href={link.href}
                  className="text-[10px] tracking-[0.1em] text-[#9CA3AF] hover:text-black transition-colors duration-200"
                >
                  {link.label}
                </Link>
                {i < LEGAL_LINKS.length - 1 && (
                  <span className="text-[#E5E7EB] text-[10px]" aria-hidden="true">·</span>
                )}
              </span>
            ))}
          </div>
        </div>

      </div>
    </footer>
  )
}
