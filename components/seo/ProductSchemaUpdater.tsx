'use client'


import { useEffect } from 'react'

interface ProductSchemaUpdaterProps {
  /** JsonLd bileşenine verilen id ile eşleşmeli. Örn: "product-ld-json" */
  schemaId: string
}

export function ProductSchemaUpdater({ schemaId }: ProductSchemaUpdaterProps) {
  useEffect(() => {
    function handlePriceUpdate(event: Event) {
      const price = (event as CustomEvent<{ price: number }>).detail?.price
      if (typeof price !== 'number' || price <= 0) return

      const script = document.getElementById(schemaId) as HTMLScriptElement | null
      if (!script || !script.textContent) return

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schema: any = JSON.parse(script.textContent)

        // Offers objesini güncelle (tekil veya dizi)
        const offers = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers
        if (!offers) return

        const priceStr = price.toFixed(2)
        offers.price = priceStr

        if (offers.priceSpecification?.price !== undefined) {
          offers.priceSpecification.price = priceStr
        }

        if (offers.priceSpecification?.description) {
          // İlk sayıyı yeni fiyatla değiştir (açıklama metninde görünür)
          offers.priceSpecification.description =
            offers.priceSpecification.description.replace(
              /^\d+(\.\d+)?/,
              priceStr,
            )
        }

        script.textContent = JSON.stringify(schema)
      } catch {
        // JSON parse hatası (beklenmedik içerik) → sessizce geç
      }
    }

    window.addEventListener('seo:price-update', handlePriceUpdate)
    return () => window.removeEventListener('seo:price-update', handlePriceUpdate)
  }, [schemaId])

  // DOM manipülasyonu yapıyor; render etmesi gereken element yok
  return null
}
