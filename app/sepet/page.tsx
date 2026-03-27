"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { PILE_LABELS_UPPER, SHIPPING, getCartItemKey } from "@/types";
import { getPublicSupabase } from "@/lib/supabase/public";

// ── Önerilen Seçkiler ─────────────────────────────────────────────────────────

interface SimpleProduct {
  id:         string;
  name:       string;
  slug:       string;
  base_price: number;
  images:     string[] | null;
}

function RecommendedProducts() {
  const [products, setProducts] = useState<SimpleProduct[]>([]);

  useEffect(() => {
    const supabase = getPublicSupabase();
    supabase
      .from("products")
      .select("id, name, slug, base_price, images")
      .eq("is_active", true)
      .eq("in_stock", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setProducts(data as SimpleProduct[]);
      });
  }, []);

  if (products.length === 0) return null;

  return (
    <div className="mt-20">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="h-eyebrow mb-3">Önerilen Seçkiler</p>
          <h2 className="font-serif font-light text-[24px] lg:text-[28px] tracking-[0.02em]">
            Beğenebilirsiniz
          </h2>
        </div>
        <Link href="/kategori/tum-urunler" className="h-btn-ghost hidden sm:flex">
          Tümünü Gör
        </Link>
      </div>

      {/* Horizontal scroll grid */}
      <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2 -mx-[var(--page-gutter)] px-[var(--page-gutter)]">
        {products.map((p) => {
          const img = p.images?.[0] ?? null;
          return (
            <Link
              key={p.id}
              href={`/urun/${p.slug}`}
              className="group flex-shrink-0 w-44 sm:w-52 block"
            >
              {/* Image */}
              <div
                className="relative overflow-hidden bg-[#F3F4F6]"
                style={{ aspectRatio: "3/4" }}
              >
                {img ? (
                  <Image
                    src={img}
                    alt={p.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    sizes="220px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] tracking-[0.4em] uppercase text-[#C4C4C4]">
                      Görsel Yok
                    </span>
                  </div>
                )}
              </div>
              {/* Text */}
              <div className="pt-2.5">
                <h4 className="text-[12px] tracking-[0.02em] text-black group-hover:text-[#B89947] transition-colors duration-200 line-clamp-2 leading-[1.5]">
                  {p.name}
                </h4>
                <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--accent)" }}>
                  {formatPrice(p.base_price)}
                  <span className="text-[9px] text-[#9CA3AF] ml-0.5 font-normal">/m²</span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb() {
  return (
    <nav aria-label="Sayfa gezintisi" className="flex items-center gap-2 mb-8 lg:mb-10">
      <Link
        href="/"
        className="text-[10px] tracking-[0.14em] uppercase text-[#9CA3AF] hover:text-black transition-colors duration-200"
      >
        Ana Sayfa
      </Link>
      <span className="text-[#D4D4D4] text-[9px]" aria-hidden="true">/</span>
      <span className="text-[10px] tracking-[0.14em] uppercase text-black" aria-current="page">
        Sepet
      </span>
    </nav>
  );
}

// ── CartPage ──────────────────────────────────────────────────────────────────

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const items          = useCartStore((state) => state.items);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart      = useCartStore((state) => state.clearCart);
  const getCartSummary = useCartStore((state) => state.getCartSummary);

  useEffect(() => { setMounted(true); }, []);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="min-h-screen">
        <div className="h-container py-8 lg:py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-7 bg-[#F3F4F6] w-48" />
            <div className="h-px bg-[#F3F4F6]" />
            <div className="h-40 bg-[#F3F4F6]" />
            <div className="h-40 bg-[#F3F4F6]" />
          </div>
        </div>
      </div>
    );
  }

  const summary = getCartSummary();

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="h-container py-8 lg:py-12">
          <Breadcrumb />

          <div className="text-center py-20">
            <ShoppingBag
              size={48}
              strokeWidth={1}
              className="text-[#E5E7EB] mx-auto mb-6"
              aria-hidden="true"
            />
            <h1 className="font-serif font-light text-[28px] lg:text-[34px] tracking-[0.02em] leading-[1.1] mb-4">
              Sepetiniz Boş
            </h1>
            <p className="text-[13px] text-[#9CA3AF] leading-[1.85] mb-8 max-w-md mx-auto">
              Sepetinizde henüz ürün bulunmuyor. Koleksiyonumuzu keşfederek
              hayalinizdeki perdeleri bulun.
            </p>
            <Link href="/kategori/tum-urunler" className="h-btn">
              Alışverişe Başla
            </Link>
          </div>

          <RecommendedProducts />
        </div>
      </div>
    );
  }

  // ── Full cart ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="h-container py-8 lg:py-12">

        <Breadcrumb />

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif font-light text-[26px] lg:text-[32px] tracking-[0.02em]">
            Sepetim
            <span className="ml-3 text-[16px] text-[#9CA3AF] font-sans font-normal">
              ({summary.totalItems} ürün)
            </span>
          </h1>
          <button
            onClick={() => clearCart()}
            className="text-[11px] tracking-[0.12em] uppercase text-[#9CA3AF] hover:text-red-400 transition-colors duration-200 flex items-center gap-1.5"
          >
            <Trash2 size={13} strokeWidth={1.5} aria-hidden="true" />
            Sepeti Temizle
          </button>
        </div>

        {/* 2-column layout: items | summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 xl:gap-12 items-start">

          {/* ── Cart items ──────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-0 border-t border-[#F3F4F6]">
            {items.map((item) => {
              const itemKey = getCartItemKey(item);
              return (
                <div
                  key={itemKey}
                  className="flex gap-5 py-6 border-b border-[#F3F4F6]"
                >
                  {/* Product image */}
                  <div
                    className="w-20 sm:w-24 shrink-0 bg-[#F3F4F6] overflow-hidden"
                    style={{ aspectRatio: "3/4" }}
                  >
                    {item.productImage ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[8px] tracking-[0.3em] uppercase text-[#C4C4C4]">
                          Görsel
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/urun/${item.productSlug}`}
                          className="text-[14px] tracking-[0.02em] text-black hover:text-[#B89947] transition-colors duration-200 font-medium"
                        >
                          {item.productName}
                        </Link>
                        <div className="mt-2 flex flex-col gap-0.5 text-[11px] tracking-[0.06em] text-[#9CA3AF]">
                          <span>
                            Boyut:{" "}
                            <span className="text-black">{item.width} × {item.height} cm</span>
                          </span>
                          <span>
                            Alan:{" "}
                            <span className="text-black">{item.areaM2.toFixed(2)} m²</span>
                          </span>
                          <span>
                            Pile:{" "}
                            <span className="text-black">{PILE_LABELS_UPPER[item.pileFactor]}</span>
                          </span>
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(itemKey)}
                        aria-label={`${item.productName} ürününü kaldır`}
                        className="p-1 text-[#C4C4C4] hover:text-red-400 transition-colors duration-200 shrink-0"
                      >
                        <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    </div>

                    {/* Quantity + price row */}
                    <div className="mt-4 flex items-center justify-between">
                      {/* Quantity */}
                      <div
                        className="flex items-center border border-[#E5E7EB] h-9"
                        role="group"
                        aria-label="Adet"
                      >
                        <button
                          onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Azalt"
                          className="flex items-center justify-center w-9 h-full text-black hover:text-[#B89947] disabled:opacity-25 disabled:cursor-default transition-colors duration-200"
                        >
                          <Minus size={11} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center text-[13px] select-none tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                          aria-label="Artır"
                          className="flex items-center justify-center w-9 h-full text-black hover:text-[#B89947] transition-colors duration-200"
                        >
                          <Plus size={11} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p
                          className="text-[15px] font-medium tracking-[0.02em]"
                          style={{ color: "var(--accent)" }}
                        >
                          {formatPrice(item.unitPrice * item.quantity)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {formatPrice(item.unitPrice)} / adet
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Order summary ────────────────────────────────────────────────── */}
          <div className="border border-[#F3F4F6] p-6 lg:sticky lg:top-[88px]">
            <h2 className="font-serif font-light text-[20px] tracking-[0.02em] mb-6">
              Sipariş Özeti
            </h2>

            <div className="flex flex-col gap-3 text-[13px]">
              <div className="flex justify-between items-center">
                <span className="text-[#9CA3AF]">Ara Toplam</span>
                <span className="text-black">{formatPrice(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9CA3AF]">Kargo</span>
                <span className={summary.shippingCost > 0 ? "text-black" : "text-black"}>
                  {summary.shippingCost > 0
                    ? formatPrice(summary.shippingCost)
                    : "Ücretsiz"}
                </span>
              </div>
              {summary.shippingCost > 0 && (
                <p className="text-[11px] text-[#9CA3AF] leading-[1.7]">
                  {formatPrice(SHIPPING.FREE_THRESHOLD - summary.subtotal)} daha
                  ekleyin, kargo ücretsiz!
                </p>
              )}
            </div>

            {/* Total */}
            <div className="h-rule my-5 pt-5 flex justify-between items-center">
              <span className="text-[13px] font-medium text-black">Toplam</span>
              <span
                className="text-[22px] font-medium tracking-[0.01em]"
                style={{ color: "var(--accent)" }}
              >
                {formatPrice(summary.total)}
              </span>
            </div>
            <p className="text-[10px] tracking-[0.06em] text-[#9CA3AF] mb-5">KDV dahil</p>

            {/* CTA */}
            <Link href="/odeme" className="h-btn w-full justify-center">
              Ödemeye Geç
              <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </Link>

            {/* Trust signals */}
            <div className="mt-6 pt-6 h-rule flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Truck
                  size={15}
                  strokeWidth={1.5}
                  style={{ color: "var(--accent)" }}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[11px] tracking-[0.04em] text-[#9CA3AF]">
                  5.000 TL üzeri siparişlerde ücretsiz kargo
                </span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={15}
                  strokeWidth={1.5}
                  style={{ color: "var(--accent)" }}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[11px] tracking-[0.04em] text-[#9CA3AF]">
                  Güvenli ödeme · 2 yıl garanti
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Recommended products */}
        <RecommendedProducts />
      </div>
    </div>
  );
}
