"use client";

import { useState, useMemo } from "react";
import { Info, Calculator, ShoppingCart, Check } from "lucide-react";
import {
  PILE_COEFFICIENTS,
  PILE_LABELS,
  SIZE_LIMITS,
  type PileRatio,
  toPileFactor,
} from "@/types";
import { calculatePrice, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

interface PriceCalculatorProps {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  m2Price: number;
}

export default function PriceCalculator({
  productId,
  productName,
  productSlug,
  productImage,
  m2Price,
}: PriceCalculatorProps) {
  const [width, setWidth] = useState<number>(200);
  const [height, setHeight] = useState<number>(250);
  const [pileRatio, setPileRatio] = useState<PileRatio>("normal");
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdded, setIsAdded] = useState(false);

  const addToCart = useCartStore((state) => state.addToCart);

  // Validation
  const isValidWidth =
    width >= SIZE_LIMITS.MIN_WIDTH && width <= SIZE_LIMITS.MAX_WIDTH;
  const isValidHeight =
    height >= SIZE_LIMITS.MIN_HEIGHT && height <= SIZE_LIMITS.MAX_HEIGHT;
  const isValid = isValidWidth && isValidHeight && quantity > 0;

  const totalPrice = useMemo(() => {
    if (width <= 0 || height <= 0) return 0;
    return calculatePrice({
      width,
      height,
      pileRatio,
      m2Price,
    });
  }, [width, height, pileRatio, m2Price]);

  const m2Amount = useMemo(() => {
    return (width * height) / 10000;
  }, [width, height]);

  const handleAddToCart = () => {
    if (!isValid) return;

    const pileFactor = toPileFactor(pileRatio);

    addToCart({
      productId,
      productName,
      productSlug,
      productImage,
      width,
      height,
      pileFactor,
      pricePerM2: m2Price,
      quantity,
    });

    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-elite p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-5 h-5 text-elite-gold" />
        <h3 className="font-serif text-xl font-semibold text-elite-black">
          Fiyat Hesaplama
        </h3>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label
            htmlFor="width"
            className="block text-sm font-medium text-elite-gray mb-2"
          >
            En (cm)
          </label>
          <input
            type="number"
            id="width"
            value={width}
            onChange={(e) =>
              setWidth(Math.max(0, parseInt(e.target.value) || 0))
            }
            min={SIZE_LIMITS.MIN_WIDTH}
            max={SIZE_LIMITS.MAX_WIDTH}
            className={`elite-input ${
              !isValidWidth && width > 0 ? "border-red-500 focus:ring-red-500" : ""
            }`}
            placeholder="200"
          />
          {!isValidWidth && width > 0 && (
            <p className="text-xs text-red-500 mt-1">
              {SIZE_LIMITS.MIN_WIDTH}-{SIZE_LIMITS.MAX_WIDTH} cm arası olmalı
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="height"
            className="block text-sm font-medium text-elite-gray mb-2"
          >
            Boy (cm)
          </label>
          <input
            type="number"
            id="height"
            value={height}
            onChange={(e) =>
              setHeight(Math.max(0, parseInt(e.target.value) || 0))
            }
            min={SIZE_LIMITS.MIN_HEIGHT}
            max={SIZE_LIMITS.MAX_HEIGHT}
            className={`elite-input ${
              !isValidHeight && height > 0 ? "border-red-500 focus:ring-red-500" : ""
            }`}
            placeholder="250"
          />
          {!isValidHeight && height > 0 && (
            <p className="text-xs text-red-500 mt-1">
              {SIZE_LIMITS.MIN_HEIGHT}-{SIZE_LIMITS.MAX_HEIGHT} cm arası olmalı
            </p>
          )}
        </div>
      </div>

      {/* Pile Ratio */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-elite-gray">
            Pile Oranı
          </label>
          <div className="group relative">
            <Info className="w-4 h-4 text-elite-gray cursor-help" />
            <div className="invisible group-hover:visible absolute left-0 top-6 w-64 p-3 bg-elite-black text-white text-xs rounded-lg shadow-lg z-10">
              <p className="mb-2">
                Pile oranı, perdenin dalgalılık yoğunluğunu belirler:
              </p>
              <ul className="space-y-1">
                <li>
                  <strong>Seyrek:</strong> Düz görünüm (x1.0)
                </li>
                <li>
                  <strong>Normal:</strong> Hafif dalgalı (x1.2)
                </li>
                <li>
                  <strong>Sık:</strong> Yoğun dalgalı (x1.3)
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PILE_COEFFICIENTS) as PileRatio[]).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setPileRatio(ratio)}
              className={`py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                pileRatio === ratio
                  ? "bg-elite-gold text-elite-black"
                  : "bg-elite-bone text-elite-gray hover:bg-elite-gold/20"
              }`}
            >
              {PILE_LABELS[ratio]}
              <span className="block text-xs opacity-70 mt-0.5">
                x{PILE_COEFFICIENTS[ratio]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-elite-gray mb-2">
          Adet
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 rounded-lg bg-elite-bone text-elite-gray hover:bg-elite-gold/20
                     flex items-center justify-center font-semibold transition-colors"
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value) || 1))
            }
            min="1"
            className="elite-input w-20 text-center"
          />
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-10 h-10 rounded-lg bg-elite-bone text-elite-gray hover:bg-elite-gold/20
                     flex items-center justify-center font-semibold transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-elite-bone rounded-lg p-4 mb-6">
        <div className="flex justify-between text-sm text-elite-gray mb-2">
          <span>m² Fiyatı</span>
          <span>{formatPrice(m2Price)}</span>
        </div>
        <div className="flex justify-between text-sm text-elite-gray mb-2">
          <span>Toplam Alan</span>
          <span>{m2Amount.toFixed(2)} m²</span>
        </div>
        <div className="flex justify-between text-sm text-elite-gray mb-2">
          <span>Pile Katsayısı</span>
          <span>x{PILE_COEFFICIENTS[pileRatio]}</span>
        </div>
        <div className="flex justify-between text-sm text-elite-gray mb-2">
          <span>Birim Fiyat</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
        {quantity > 1 && (
          <div className="flex justify-between text-sm text-elite-gray mb-2">
            <span>Adet</span>
            <span>x{quantity}</span>
          </div>
        )}
        <div className="border-t border-gray-200 my-3" />
        <div className="flex justify-between items-center">
          <span className="font-medium text-elite-black">Toplam Fiyat</span>
          <span className="font-serif text-2xl font-semibold text-elite-gold">
            {formatPrice(totalPrice * quantity)}
          </span>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={!isValid || isAdded}
        className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium
                   transition-all duration-300 ${
                     isAdded
                       ? "bg-green-500 text-white"
                       : isValid
                       ? "elite-button"
                       : "bg-gray-200 text-gray-400 cursor-not-allowed"
                   }`}
      >
        {isAdded ? (
          <>
            <Check className="w-5 h-5" />
            Sepete Eklendi!
          </>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5" />
            Sepete Ekle
          </>
        )}
      </button>

      {/* Note */}
      <p className="text-xs text-elite-gray text-center mt-4">
        Fiyatlar KDV dahildir. Montaj ücreti ayrıca hesaplanır.
      </p>
    </div>
  );
}
