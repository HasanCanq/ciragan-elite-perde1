import "./hanedan-hero.css";

/* Navbar layout.tsx'te — buraya ayrı nav EKLEME */
export default function HanadanHero() {
  return (
    <div className="overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════════
          HERO — Her zaman flex-row. Asla flex-col değil.
          Altın Oran: Sol %61.8 / Sağ %38.2 (inline width)
      ══════════════════════════════════════════════════════════ */}
      <div
        className="w-full flex flex-row"
        style={{ minHeight: "100vh", paddingTop: "clamp(64px, 6vh, 80px)" }}
      >

        {/* ── Sol Panel %61.8 ─────────────────────────────────── */}
        <div
          className="bg-[#111111] flex items-center justify-center overflow-hidden"
          style={{ width: "61.8%", padding: "clamp(1rem,5vw,5rem)" }}
        >
          <div className="w-full" style={{ maxWidth: "clamp(260px,38vw,560px)" }}>

            {/* Eyebrow */}
            <p
              className="flex items-center gap-3 text-[#B89947]/75 tracking-[0.45em] uppercase mb-8"
              style={{ fontSize: "clamp(8px,1.5vw,11px)" }}
            >
              <span className="block h-px bg-[#B89947]/50 shrink-0" style={{ width: "clamp(16px,2vw,28px)" }} />
              Hanedan Perde — İstanbul
            </p>

            {/* Manifesto — mobilde text-[5vw], masaüstünde lg:text-7xl */}
            <h2
              className="font-['Cinzel',_serif] font-normal text-white leading-[1.1] mb-8 text-[5vw] lg:text-7xl"
            >
              Kumaşın<br />
              fark yarattığı<br />
              yer.
            </h2>

            <p
              className="text-[#B89947]/65 tracking-[0.4em] uppercase"
              style={{ fontSize: "clamp(9px,1.4vw,12px)" }}
            >
              — Hanedan
            </p>

          </div>
        </div>

        {/* ── Altın İp — 1px dikey ayırıcı ───────────────────── */}
        <div className="w-px bg-[#B89947]/30 shrink-0 self-stretch" />

        {/* ── Sağ Panel %38.2 ─────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{ width: "38.2%" }}
        >
          {/* Arkaplan görseli — absolute inset-0 ile kutuyu tam kaplar */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/3.jpg')",
            }}
          />

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

          {/* Alt içerik */}
          <div
            className="absolute bottom-0 left-0 right-0 z-10"
            style={{ padding: "clamp(1rem,4vw,3rem)" }}
          >
            {/* Eyebrow küçük */}
            <p
              className="flex items-center gap-2 text-[#B89947]/80 tracking-[0.4em] uppercase mb-3"
              style={{ fontSize: "clamp(7px,1.2vw,10px)" }}
            >
              <span className="block h-px bg-[#B89947]/55 shrink-0" style={{ width: "clamp(12px,1.5vw,20px)" }} />
              Est. 1987
            </p>

            {/* Başlık — mobilde text-[4vw], masaüstünde lg:text-6xl */}
            <h1
              className="font-['Cinzel',_serif] font-normal text-white leading-[1.05] mb-4 text-[4vw] lg:text-6xl"
            >
              Sessiz<br />
              <em className="text-[#B89947]">İhtişam.</em>
            </h1>

            {/* Meta */}
            <div className="border-t border-white/15 pt-2 space-y-0.5">
              <p
                className="text-white/45 tracking-[0.3em] uppercase"
                style={{ fontSize: "clamp(7px,1.1vw,10px)" }}
              >
                Koleksiyon No. XII
              </p>
              <p
                className="text-white/45 tracking-[0.3em] uppercase"
                style={{ fontSize: "clamp(7px,1.1vw,10px)" }}
              >
                El Dokuma · İpek Karışım
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════
          HERİTAGE — Statik, CSS sınıfları
      ══════════════════════════════════════════════════════════ */}
      <section id="heritage" aria-labelledby="heritage-heading">

        <header className="heritage__header">
          <div>
            <p className="heritage__eyebrow">Projeler — 1987&apos;den Bu Yana</p>
            <h2 className="heritage__heading" id="heritage-heading">
              Sessiz bir <em>miras.</em><br />
              Gözle görülen bir iz.
            </h2>
          </div>
          <div className="heritage__counter" aria-hidden="true">
            <span className="heritage__counter-num">500</span>
            <span className="heritage__counter-label">Tamamlanan Proje</span>
          </div>
        </header>

        <div className="heritage__mosaic" role="list" aria-label="Tamamlanan projelerden seçmeler">
          <article className="mosaic__block mosaic__block--A" role="listitem">
            <div className="mosaic__img" role="img" aria-label="Boğaziçi Yalısı projesi" />
            <div className="mosaic__overlay" aria-hidden="true" />
            <div className="mosaic__label">
              <span className="mosaic__label-project">Boğaziçi Yalısı</span>
              <span className="mosaic__label-year">1998</span>
            </div>
          </article>
          <article className="mosaic__block mosaic__block--B" role="listitem">
            <div className="mosaic__img" role="img" aria-label="Devlet Konukevi projesi" />
            <div className="mosaic__overlay" aria-hidden="true" />
            <div className="mosaic__label">
              <span className="mosaic__label-project">Devlet Konukevi</span>
              <span className="mosaic__label-year">2011</span>
            </div>
          </article>
          <article className="mosaic__block mosaic__block--C" role="listitem">
            <div className="mosaic__img" role="img" aria-label="Topkapı Müzesi projesi" />
            <div className="mosaic__overlay" aria-hidden="true" />
            <div className="mosaic__label">
              <span className="mosaic__label-project">Topkapı Müzesi</span>
              <span className="mosaic__label-year">2006</span>
            </div>
          </article>
          <article className="mosaic__block mosaic__block--D" role="listitem">
            <div className="mosaic__img" role="img" aria-label="Beşiktaş Konağı projesi" />
            <div className="mosaic__overlay" aria-hidden="true" />
            <div className="mosaic__float" aria-hidden="true">
              <p>Her proje, bir ailenin hikâyesini<br />taşıyan kumaşlarla tamamlanır.</p>
            </div>
            <div className="mosaic__label">
              <span className="mosaic__label-project">Beşiktaş Konağı</span>
              <span className="mosaic__label-year">2019</span>
            </div>
          </article>
        </div>

        <blockquote className="heritage__quote">
          <span className="heritage__quote-glyph" aria-hidden="true">&ldquo;</span>
          <div className="heritage__quote-body">
            <p className="heritage__quote-text">
              Sarayları süsleyen kumaşlar<br />
              artık <em>evinizde.</em>
            </p>
            <cite className="heritage__quote-cite">Hanedan Perde — Atölye Arşivi</cite>
          </div>
        </blockquote>

        <div className="heritage__stats" role="list" aria-label="Hanedan rakamları">
          <div className="heritage__stat" role="listitem">
            <span className="heritage__stat-num">36<sup>+</sup></span>
            <p className="heritage__stat-desc">
              Sektördeki yılımız.<br />1987&apos;den bu yana kesintisiz üretim.
            </p>
          </div>
          <div className="heritage__stat" role="listitem">
            <span className="heritage__stat-num">500<sup>+</sup></span>
            <p className="heritage__stat-desc">
              Saray, müze, konut ve<br />otel projesi teslim ettik.
            </p>
          </div>
          <div className="heritage__stat" role="listitem">
            <span className="heritage__stat-num">12</span>
            <p className="heritage__stat-desc">
              Ülkedeki kurumsal müşterimiz<br />hizmetimizi tercih ediyor.
            </p>
          </div>
        </div>

        <p className="hanedan-colophon">
          Hanedan Perde.&ensp;Zanaatın konuşulduğu masa için:&ensp;
          <a href="mailto:randevu@hanedan.com">randevu@hanedan.com</a>
        </p>

      </section>

    </div>
  );
}
