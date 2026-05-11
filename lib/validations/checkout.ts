import { z } from 'zod';

// =====================================================
// YARDIMCILAR
// =====================================================

const TR_PHONE_RE = /^(\+90|0090|90)?0?5\d{9}$|^05\d{9}$/;

const htmlEncode = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

const safeStr = (min: number, max = 500) =>
  z
    .string()
    .min(min, `En az ${min} karakter olmalıdır`)
    .max(max)
    .transform(htmlEncode);

// =====================================================
// ALT ŞEMALAR (internal — doğrudan export gerekmez)
// =====================================================

const addressBaseSchema = z.object({
  firstName:     safeStr(3, 150),
  lastName:      z.string().max(150).transform(htmlEncode).default(''),
  phone:         z
    .string()
    .regex(TR_PHONE_RE, 'Geçerli bir Türkiye telefon numarası girin (örn: 05xx xxx xx xx)'),
  addressLine:   safeStr(10, 500),
  neighbourhood: z.string().max(150).transform(htmlEncode).optional(),
  district:      safeStr(2, 100),
  city:          safeStr(2, 100),
  postalCode:    z
    .string()
    .regex(/^\d{5}$/, 'Posta kodu 5 haneli rakam olmalıdır')
    .optional()
    .or(z.literal('')),
});

const billingAddressSchema = addressBaseSchema
  .extend({
    billingType:  z.enum(['INDIVIDUAL', 'CORPORATE']),
    taxNumber:    z.string().max(11).optional(),
    taxOffice:    z.string().max(150).transform(htmlEncode).optional(),
    companyName:  safeStr(3, 255).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.billingType !== 'CORPORATE') return;

    if (!d.taxNumber || !/^\d{10}$/.test(d.taxNumber)) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['taxNumber'],
        message: 'Kurumsal faturalama için 10 haneli VKN zorunludur',
      });
    }
    if (!d.taxOffice || d.taxOffice.trim().length < 2) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['taxOffice'],
        message: 'Kurumsal faturalama için vergi dairesi zorunludur',
      });
    }
    if (!d.companyName || d.companyName.trim().length < 3) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['companyName'],
        message: 'Kurumsal faturalama için şirket unvanı zorunludur',
      });
    }
  });

// =====================================================
// ANA ŞEMA
// =====================================================

export const checkoutFormSchema = z
  .object({
    email:           z.string().email('Geçerli bir e-posta adresi girin').max(255),
    shippingAddress: addressBaseSchema,
    sameAsBilling:   z.boolean(),
    billingAddress:  billingAddressSchema.optional(),
    customerNote:    z.string().max(1000).transform(htmlEncode).optional(),
    paymentMethod:   z.enum(
      ['credit_card'],
      { error: 'Geçerli bir ödeme yöntemi seçin' }
    ),
    legalConsent: z.object({
      documentVersionIds: z
        .array(z.string().uuid())
        .min(1, 'Yasal belgeler onaylanmalıdır'),
    }),
  })
  .superRefine((d, ctx) => {
    if (!d.sameAsBilling && !d.billingAddress) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['billingAddress'],
        message: 'Farklı fatura adresi seçildiğinde fatura adresi zorunludur',
      });
    }
  });

// =====================================================
// TİPLER
// =====================================================

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutFormData  = z.output<typeof checkoutFormSchema>;

export interface LegalConsentInput {
  documentVersionIds: string[];
}
