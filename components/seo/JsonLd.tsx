/**
 * components/seo/JsonLd.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * JSON-LD <script> tag renderer — Server Component uyumlu, zero-dependency.
 *
 * Kullanım:
 *   <JsonLd data={buildProductSchema(product)} />
 *   <JsonLd id="product-ld-json" data={buildProductSchema(product)} />
 *
 * id prop'u: ProductSchemaUpdater'ın dinamik fiyat güncellemesi için gereklidir.
 *   Sadece ProductPage'de product şeması için kullanın.
 *
 * Güvenlik: data objesinin kaynağı her zaman server-side builder fonksiyonudur
 *   (kullanıcı girdisi değil), dolayısıyla dangerouslySetInnerHTML güvenlidir.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface JsonLdProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  /** DOM id — ProductSchemaUpdater ile eşleşmesi için gerekli */
  id?: string
}

export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
