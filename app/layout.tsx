import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

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

/* ── Metadata ─────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    template: "%s — Hanedan",
    default:  "Hanedan — Lüks Perde Koleksiyonu",
  },
  description:
    "Asaletin ve zarafetin buluştuğu yer. Hanedan ile yaşam alanlarınızı dönüştürün.",
  keywords: [
    "perde",
    "lüks perde",
    "tül perde",
    "fon perde",
    "zebra perde",
    "stor perde",
    "hanedan perde",
    "premium perde",
    "İstanbul",
  ],
  authors: [{ name: "Hanedan" }],
  openGraph: {
    title:       "Hanedan — Lüks Perde Koleksiyonu",
    description: "Asaletin ve zarafetin buluştuğu yer.",
    type:        "website",
    locale:      "tr_TR",
    siteName:    "Hanedan",
  },
  robots: {
    index:  true,
    follow: true,
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
        {/* Sticky header — sits in normal flow, hero uses calc(100vh - 64px) */}
        <Header />

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
