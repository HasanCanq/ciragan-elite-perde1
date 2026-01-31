import { PILE_COEFFICIENTS, type PriceCalculation } from "@/types";

export function calculatePrice({
  width,
  height,
  pileRatio,
  m2Price,
}: PriceCalculation): number {
  const coefficient = PILE_COEFFICIENTS[pileRatio];
  const m2 = (width * height) / 10000;
  return m2 * m2Price * coefficient;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
