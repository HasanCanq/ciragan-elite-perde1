import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Çırağan Elite Perde | Premium Perde Koleksiyonu",
  description:
    "1985'ten bu yana Türkiye'nin en seçkin perde koleksiyonlarını sunuyoruz. Tül, fon, stor ve zebra perdelerde kalite ve zarafetin adresi.",
  keywords: [
    "perde",
    "tül perde",
    "fon perde",
    "stor perde",
    "zebra perde",
    "lüks perde",
    "premium perde",
    "İstanbul perde",
  ],
  authors: [{ name: "Çırağan Elite Perde" }],
  openGraph: {
    title: "Çırağan Elite Perde | Premium Perde Koleksiyonu",
    description:
      "1985'ten bu yana Türkiye'nin en seçkin perde koleksiyonlarını sunuyoruz.",
    type: "website",
    locale: "tr_TR",
    siteName: "Çırağan Elite Perde",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="min-h-screen flex flex-col bg-elite-bone text-elite-black antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
