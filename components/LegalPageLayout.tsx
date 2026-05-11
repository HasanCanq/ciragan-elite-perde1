import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Section {
  heading: string;
  content: React.ReactNode;
}

interface LegalPageLayoutProps {
  title: string;
  description: string;
  lastUpdated: string;
  sections: Section[];
}

export default function LegalPageLayout({
  title,
  description,
  lastUpdated,
  sections,
}: LegalPageLayoutProps) {
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
            <span className="text-[#B89947]">{title}</span>
          </nav>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-white">
            {title}
          </h1>
          <p className="mt-4 text-white/70 text-lg max-w-2xl">{description}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-24">
        <div className="h-container">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-[#9CA3AF] mb-10 border-b border-gray-100 pb-6">
              Son güncelleme: <span className="font-medium text-black">{lastUpdated}</span>
            </p>

            <div className="space-y-10">
              {sections.map((section, i) => (
                <div key={i}>
                  <h2 className="font-serif text-xl font-semibold text-black mb-4 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-black text-white text-xs flex items-center justify-center flex-shrink-0 font-sans font-bold">
                      {i + 1}
                    </span>
                    {section.heading}
                  </h2>
                  <div className="text-[#555] leading-relaxed text-sm space-y-3 pl-10">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 pt-8 border-t border-gray-100 text-center">
              <p className="text-[#9CA3AF] text-sm">Sorularınız için</p>
              <a
                href="mailto:info@ciraganelite.com"
                className="text-[#B89947] font-medium hover:underline"
              >
                info@ciraganelite.com
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
