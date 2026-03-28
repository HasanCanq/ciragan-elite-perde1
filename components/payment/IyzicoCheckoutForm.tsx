/**
 * Framework: Next.js 14 (App Router) · React 18 · TypeScript 5
 *
 * IyzicoCheckoutForm — PCI-DSS Uyumlu Gömülü Ödeme Formu
 * =========================================================
 * Iyzico'nun Checkout Form Initialize API'sinden dönen HTML embed kodunu
 * `document.write` KULLANMADAN, sayfa yenilenmesine gerek kalmadan gömülü
 * olarak render eder.
 *
 * Çalışma prensibi:
 *  1. `<div id="iyzipay-checkout-form">` React render döngüsünde DOM'a yerleşir.
 *  2. `checkoutFormContent` HTML'inden <script> etiketleri DOMParser ile parse edilir.
 *  3. Her script, `document.createElement('script')` ile yeniden oluşturulup
 *     document.body'ye eklenir — bu şekilde tarayıcı tarafından çalıştırılır.
 *  4. Iyzico'nun bundle.js'i DOM'da `#iyzipay-checkout-form` div'ini bulur
 *     ve içine kendi iframe'ini oluşturur. Kart bilgisi bu iframe'de yaşar.
 *  5. MutationObserver ile iframe oluşumu izlenir → loading spinner kaldırılır.
 *
 * PCI-DSS uyumu:
 *  - Kart verisi bu bileşenin DOM'una, uygulamamızın JS context'ine veya
 *    sunucularımıza HİÇBİR ZAMAN dokunmaz.
 *  - Iyzico'nun iframe'i cross-origin — parent document script'leri
 *    içeriğine erişemez.
 *
 * Fallback zinciri:
 *  1. Başarılı → Iyzico iframe'i render olur                         (ana yol)
 *  2. Script yüklenemedi (ağ/CSP hatası, 12s timeout) → hata mesajı (fallback 1)
 *  3. paymentPageUrl → yeni sekmede Iyzico standalone sayfası        (fallback 2)
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

// ── Tipler ───────────────────────────────────────────────────────────────────

interface Props {
  /** Iyzico checkoutFormInitialize'dan dönen ham HTML embed kodu */
  checkoutFormContent: string;
  /** Iyzico standalone ödeme URL'i — script yüklenemezse fallback */
  paymentPageUrl: string;
  /** Görsel onay için sipariş numarası */
  orderNumber: string;
  /** Kullanıcı "← Forma Dön" tıklarsa çağrılır */
  onCancel?: () => void;
}

type Status = 'loading' | 'ready' | 'error';

// ── Script inject yardımcısı ─────────────────────────────────────────────────

/**
 * checkoutFormContent HTML'inden tüm <script> etiketlerini çıkarır,
 * her birini document.body'ye ekler (inline ve external).
 * Eklenen script elementlerini geri döndürür — cleanup için.
 *
 * Neden innerHTML / createContextualFragment kullanmıyoruz?
 *  - Iyzico'nun bundle.js'i `document.getElementById('iyzipay-checkout-form')`
 *    ile container'ı arar. Script'in container'ın DIŞINDA çalışması gerekir;
 *    içine inject edilirse kendi oluşturduğu DOM'un içine bakıp bulamayabilir.
 *  - document.body'e eklenen script'ler global document context'inde çalışır,
 *    bu yüzden dışarıda önceden render edilmiş #iyzipay-checkout-form'u bulurlar.
 */
function injectScripts(html: string): HTMLScriptElement[] {
  const parser  = new DOMParser();
  const parsed  = parser.parseFromString(html, 'text/html');
  const oldTags = Array.from(parsed.querySelectorAll('script'));
  const added: HTMLScriptElement[] = [];

  oldTags.forEach((old) => {
    const s    = document.createElement('script');
    s.async    = false; // Sıralı çalıştırma — inline config, sonra bundle.js

    // Tüm attribute'ları kopyala (type, id vb.)
    Array.from(old.attributes).forEach((attr) => {
      s.setAttribute(attr.name, attr.value);
    });

    if (old.src) {
      s.src = old.src;           // External script (bundle.js)
    } else {
      s.textContent = old.textContent; // Inline config (token, locale vb.)
    }

    document.body.appendChild(s);
    added.push(s);
  });

  return added;
}

// ── Bileşen ──────────────────────────────────────────────────────────────────

export default function IyzicoCheckoutForm({
  checkoutFormContent,
  paymentPageUrl,
  orderNumber,
  onCancel,
}: Props) {
  const formDivRef              = useRef<HTMLDivElement>(null);
  const injectedScriptsRef      = useRef<HTMLScriptElement[]>([]);
  const observerRef             = useRef<MutationObserver | null>(null);
  const timeoutRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus]     = useState<Status>('loading');
  const [retryCount, setRetry]  = useState(0);

  // ── Cleanup fonksiyonu ────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // Gözlemciyi durdur
    observerRef.current?.disconnect();
    observerRef.current = null;

    // Timeout'u temizle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Inject edilen script'leri DOM'dan kaldır
    injectedScriptsRef.current.forEach((s) => s.parentNode?.removeChild(s));
    injectedScriptsRef.current = [];

    // Iyzico'nun bıraktığı global state'i temizle
    if (typeof window !== 'undefined') {
      // @ts-ignore
      delete window.iyziInit;
      // @ts-ignore
      delete window.iyzipayCheckoutConfig;
    }

    // Container'ı temizle
    if (formDivRef.current) {
      formDivRef.current.innerHTML = '';
    }
  }, []);

  // ── Inject + observe ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!checkoutFormContent?.trim()) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    cleanup();

    // Adım 1: Script'leri inject et — Iyzico'nun bundle.js'i bu div'i bulacak
    try {
      injectedScriptsRef.current = injectScripts(checkoutFormContent);
    } catch (err) {
      console.error('[IyzicoCheckoutForm] Script inject hatası:', err);
      setStatus('error');
      return;
    }

    // Adım 2: Iyzico'nun #iyzipay-checkout-form'a iframe eklemesini izle
    //         MutationObserver — polling yerine event-driven yaklaşım
    if (formDivRef.current) {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (
              node instanceof HTMLElement &&
              (node.tagName === 'IFRAME' || node.querySelector('iframe'))
            ) {
              // Iyzico iframe'ini oluşturdu → form hazır
              observer.disconnect();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setStatus('ready');
              return;
            }
          }
        }
      });

      observer.observe(formDivRef.current, { childList: true, subtree: true });
      observerRef.current = observer;
    }

    // Adım 3: Maksimum bekleme süresi — 14 saniye içinde iframe gelmezse hata
    //         (Ağ yavaşlığı, CSP bloğu, yanlış token vb.)
    timeoutRef.current = setTimeout(() => {
      const hasIframe = formDivRef.current?.querySelector('iframe');
      if (!hasIframe) {
        console.warn('[IyzicoCheckoutForm] 14s içinde iframe oluşmadı');
        setStatus('error');
      }
    }, 14_000);

    return cleanup;
  }, [checkoutFormContent, retryCount, cleanup]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-[#F3F4F6]">

      {/* ── Başlık ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div>
          <p className="text-[8px] tracking-[0.2em] uppercase text-[#9CA3AF]">
            Güvenli Ödeme
          </p>
          <p className="text-[12px] font-medium text-black tracking-[0.04em] mt-0.5">
            Sipariş #{orderNumber}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={() => { cleanup(); onCancel(); }}
            className="text-[9px] tracking-[0.16em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200 border-b border-transparent hover:border-black pb-px"
          >
            ← Geri Dön
          </button>
        )}
      </div>

      {/* ── İçerik alanı ────────────────────────────────────── */}
      <div className="relative" style={{ minHeight: 480 }}>

        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white">
            <Loader2
              className="w-5 h-5 animate-spin"
              style={{ color: 'var(--accent, #B89947)' }}
              strokeWidth={1.5}
            />
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#9CA3AF]">
              Güvenli ödeme formu yükleniyor…
            </p>
            <p className="text-[9px] text-[#D1D5DB] tracking-[0.04em] mt-1 text-center max-w-[240px] leading-relaxed">
              Kart bilgileriniz yalnızca Iyzico&apos;nun
              PCI-DSS Level 1 sertifikalı sunucularına iletilir.
            </p>
          </div>
        )}

        {/* Hata durumu */}
        {status === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6 bg-white text-center">
            <AlertCircle
              className="w-8 h-8 text-[#D1D5DB]"
              strokeWidth={1.2}
            />
            <div>
              <p className="text-[11px] text-black tracking-[0.04em] mb-1.5">
                Ödeme formu yüklenemedi.
              </p>
              <p className="text-[10px] text-[#9CA3AF] tracking-[0.03em] leading-relaxed">
                İnternet bağlantınızı kontrol edip tekrar deneyin
                veya ödeme sayfasına yönlendirilmek için aşağıdaki
                bağlantıyı kullanın.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 border border-black text-[9px] tracking-[0.2em] uppercase text-black hover:bg-black hover:text-white transition-colors duration-200"
              >
                <RefreshCw size={11} strokeWidth={1.5} />
                Tekrar Dene
              </button>
              <a
                href={paymentPageUrl}
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-black text-white text-[9px] tracking-[0.2em] uppercase hover:bg-[#B89947] transition-colors duration-300"
              >
                Ödeme Sayfasına Git
                <ExternalLink size={11} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        )}

        {/*
          Iyzico'nun bundle.js'i bu div'i `document.getElementById('iyzipay-checkout-form')`
          ile bulur ve içine kart form iframe'ini oluşturur.
          - id: Iyzico tarafından sabit olarak beklenen değer — değiştirme.
          - className "responsive": Iyzico'nun mobil uyumlu iframe boyutlandırması için.
          - ref: MutationObserver'ın iframe oluşumunu izlemesi için.
        */}
        <div
          id="iyzipay-checkout-form"
          className="responsive"
          ref={formDivRef}
          style={{ opacity: status === 'loading' ? 0 : 1 }}
        />
      </div>

      {/* ── Güvenlik notu ───────────────────────────────────── */}
      {status !== 'error' && (
        <div className="px-5 pb-5 pt-3 border-t border-[#F9F9F8]">
          <p className="text-[9px] text-[#C8C8C4] tracking-[0.03em] text-center leading-relaxed">
            Bu form Iyzico güvenli altyapısı üzerinde çalışmaktadır.
            Kart bilgileriniz uygulamamızın sunucularına iletilmez.
          </p>
        </div>
      )}
    </div>
  );
}
