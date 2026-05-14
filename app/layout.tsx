import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/layout/CartDrawer";
import CookieConsent from "@/components/CookieConsent";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildLocalBusinessSchema, buildWebSiteSchema } from "@/lib/seo/schemas";

/* ── Fonts ─────────────────────────────────────────────────────────────────
   Both fonts are self-hosted by Next.js at build time — no external requests
   at runtime. Compatible with the strict font-src CSP header.
   ─────────────────────────────────────────────────────────────────────────── */
const serifFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  preload: true,
});

const sansFont = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hanedan perde.com";

/* ── Metadata ─────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  // metadataBase: relative URL'leri (canonical, og:image) absolute'e çevirir.
  // Bu olmadan Next.js 14 canonical URL'lerini doğru üretemez.
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | Hanedan",
    default:  "Hanedan — Lüks Özel Ölçü Perde Koleksiyonu",
  },
  description:
    "Asaletin ve zarafetin buluştuğu yer. Hanedan'dan özel ölçüye göre üretilen lüks perde koleksiyonu. Fon perde, tül perde, zebra stor ve daha fazlası.",
  keywords: [
    "özel ölçü perde",
    "lüks perde",
    "tül perde",
    "fon perde",
    "zebra perde",
    "stor perde",
    "hanedan perde",
    "premium perde İstanbul",
    "sipariş üzerine perde",
  ],
  authors: [{ name: "Hanedan" }],
  openGraph: {
    title:       "Hanedan — Lüks Özel Ölçü Perde Koleksiyonu",
    description: "Asaletin ve zarafetin buluştuğu yer. Özel ölçüye göre üretilen premium perde koleksiyonu.",
    type:        "website",
    locale:      "tr_TR",
    siteName:    "Hanedan",
    url:         SITE_URL,
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Hanedan — Lüks Özel Ölçü Perde Koleksiyonu",
    description: "Asaletin ve zarafetin buluştuğu yer. Özel ölçüye göre üretilen premium perde.",
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  themeColor:   "#FFFFFF",
};

/* ── Root Layout ──────────────────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={`${serifFont.variable} ${sansFont.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-white text-black font-sans antialiased">
        {/* ── Site-wide JSON-LD: LocalBusiness + WebSite (her sayfada bir kez) */}
        {/* aggregateRating ana sayfada ayrıca Google verisiyle zenginleştirilir */}
        <JsonLd data={buildLocalBusinessSchema()} />
        <JsonLd data={buildWebSiteSchema()} />

        {/* Sticky header — sits in normal flow, hero uses calc(100vh - 64px) */}
        <Header />
        <CartDrawer />

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>

        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}
