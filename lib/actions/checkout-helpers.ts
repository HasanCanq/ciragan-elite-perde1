// Pure sync utilities — no 'use server', safe to import anywhere.

export interface ShippingAddressSnapshot {
  firstName:     string;
  lastName:      string;
  fullName:      string;
  phone:         string;
  addressLine:   string;
  neighbourhood: string | null;
  district:      string;
  city:          string;
  postalCode:    string | null;
  country:       'TR';
}

export interface BillingAddressSnapshot extends ShippingAddressSnapshot {
  billingType:  'INDIVIDUAL' | 'CORPORATE';
  taxNumber:    string | null;
  taxOffice:    string | null;
  companyName:  string | null;
}

interface AddressBaseInput {
  firstName:      string;
  lastName:       string;
  phone:          string;
  addressLine:    string;
  neighbourhood?: string;
  district:       string;
  city:           string;
  postalCode?:    string;
}

interface BillingAddressInput extends AddressBaseInput {
  billingType:  'INDIVIDUAL' | 'CORPORATE';
  taxNumber?:   string;
  taxOffice?:   string;
  companyName?: string;
}

export function buildShippingSnapshot(a: AddressBaseInput): ShippingAddressSnapshot {
  return {
    firstName:     a.firstName,
    lastName:      a.lastName,
    fullName:      [a.firstName, a.lastName].filter(Boolean).join(' '),
    phone:         a.phone,
    addressLine:   a.addressLine,
    neighbourhood: a.neighbourhood ?? null,
    district:      a.district,
    city:          a.city,
    postalCode:    a.postalCode || null,
    country:       'TR',
  };
}

export function buildBillingSnapshot(a: BillingAddressInput): BillingAddressSnapshot {
  return {
    ...buildShippingSnapshot(a),
    billingType: a.billingType,
    taxNumber:   a.taxNumber || null,
    taxOffice:   a.taxOffice || null,
    companyName: a.companyName || null,
  };
}

/** Kargo etiketi için düz metin adres satırı */
export function formatAddressText(s: ShippingAddressSnapshot): string {
  const parts = [
    s.fullName,
    s.addressLine,
    [s.neighbourhood, s.district, s.city].filter(Boolean).join(', '),
    s.postalCode ? `${s.postalCode}` : null,
    `Tel: ${s.phone}`,
  ];
  return parts.filter(Boolean).join('\n');
}
