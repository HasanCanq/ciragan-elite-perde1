'use client'

import { useState } from 'react'

/* ── NewsletterCTA ───────────────────────────────────────────────────────────
   Standalone bülten aboneliği bölümü.
   API entegrasyonu hazır olduğunda handleSubmit içine eklenir.
   ─────────────────────────────────────────────────────────────────────────── */
export default function NewsletterCTA() {
  const [email, setEmail]         = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    // TODO: POST to newsletter API (Mailchimp / custom endpoint)
    await new Promise((r) => setTimeout(r, 600)) // simulate
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <section className="h-rule h-section">
      <div className="h-container">
        <div className="h-container-sm mx-auto text-center px-0">

          {/* Eyebrow */}
          <p className="h-eyebrow mb-5 justify-center">
            Önce Sizin Haberiniz Olsun
          </p>

          {/* Heading */}
          <h2 className="h-heading text-[32px] lg:text-[44px] mb-5">
            Yeni Koleksiyonlar
          </h2>

          {/* Sub-copy */}
          <p className="h-body max-w-[420px] mx-auto mb-10">
            Sezonun öne çıkan kumaşları, özel teklifler ve atölye haberleri için
            bültenimize katılın.
          </p>

          {/* Form */}
          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-stretch gap-0 max-w-[420px] mx-auto"
              noValidate
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresiniz"
                required
                aria-label="E-posta adresi"
                className={[
                  'flex-1 min-w-0',
                  'px-4 py-[13px]',
                  'bg-white text-black text-sm tracking-[0.03em]',
                  'border border-[#E5E7EB] border-r-0',
                  'placeholder:text-[#C4C4C4] placeholder:text-[12px] placeholder:tracking-[0.06em]',
                  'focus:outline-none focus:border-black',
                  'transition-colors duration-200',
                ].join(' ')}
              />
              <button
                type="submit"
                disabled={loading}
                className={[
                  'h-btn shrink-0 px-7',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {loading ? '…' : 'Abone Ol'}
              </button>
            </form>
          ) : (
            <p className="text-[13px] tracking-[0.08em] text-[#9CA3AF]">
              Teşekkürler — bültenimize kaydoldunuz.
            </p>
          )}

          {/* Privacy note */}
          <p className="mt-4 text-[10px] tracking-[0.06em] text-[#C4C4C4]">
            İstediğiniz zaman aboneliğinizi iptal edebilirsiniz.
          </p>

        </div>
      </div>
    </section>
  )
}
