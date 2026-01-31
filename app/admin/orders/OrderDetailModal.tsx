'use client';

import { useState } from 'react';
import { OrderWithItems, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PILE_LABELS_UPPER, OrderStatus } from '@/types';
import { formatPrice } from '@/lib/utils';
import { Eye, X, MapPin, Phone, Mail, Package, Truck } from 'lucide-react';

interface OrderDetailModalProps {
  order: OrderWithItems;
}

export function OrderDetailModal({ order }: OrderDetailModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-400 hover:text-elite-gold hover:bg-elite-gold/10
                 rounded-lg transition-colors"
        title="Detay"
      >
        <Eye className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-elite-black">
                  Sipariş Detayı
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-mono">
                  {order.order_number}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status & Date */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                    ORDER_STATUS_COLORS[order.status as OrderStatus]
                  }`}
                >
                  {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-elite-black flex items-center gap-2">
                  <Package className="w-4 h-4 text-elite-gold" />
                  Müşteri Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Ad Soyad</p>
                    <p className="font-medium">{order.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> E-posta
                    </p>
                    <p className="font-medium">{order.customer_email}</p>
                  </div>
                  {order.customer_phone && (
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Telefon
                      </p>
                      <p className="font-medium">{order.customer_phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-elite-black flex items-center gap-2">
                  <Truck className="w-4 h-4 text-elite-gold" />
                  Teslimat Adresi
                </h3>
                <p className="text-gray-700 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  {order.shipping_address}
                </p>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-elite-black mb-4">
                  Sipariş Kalemleri
                </h3>
                <div className="space-y-4">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-100 rounded-xl p-4 flex gap-4"
                    >
                      {/* Product Image Placeholder */}
                      <div className="w-20 h-20 bg-gradient-to-br from-elite-gold/20 to-elite-bone rounded-lg flex-shrink-0" />

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-elite-black">
                          {item.product_name}
                        </h4>
                        <div className="mt-1 text-sm text-gray-500 space-y-1">
                          <p>
                            Boyut: <span className="font-medium">{item.width_cm} x {item.height_cm} cm</span>
                          </p>
                          <p>
                            Alan: <span className="font-medium">{item.area_m2.toFixed(2)} m²</span>
                          </p>
                          <p>
                            Pile: <span className="font-medium">{PILE_LABELS_UPPER[item.pile_factor]}</span>
                            <span className="text-gray-400 ml-1">(x{item.pile_coefficient})</span>
                          </p>
                          <p>
                            Birim Fiyat: <span className="font-medium">{formatPrice(item.price_per_m2_snapshot)}/m²</span>
                          </p>
                        </div>
                      </div>

                      {/* Quantity & Price */}
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          x{item.quantity}
                        </p>
                        <p className="font-semibold text-elite-black mt-1">
                          {formatPrice(item.total_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ara Toplam</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kargo</span>
                  <span>
                    {order.shipping_cost > 0
                      ? formatPrice(order.shipping_cost)
                      : 'Ücretsiz'}
                  </span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>İndirim</span>
                    <span>-{formatPrice(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
                  <span>Toplam</span>
                  <span className="text-elite-gold">
                    {formatPrice(order.total_amount)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {(order.customer_note || order.admin_note) && (
                <div className="bg-yellow-50 rounded-xl p-4 space-y-2">
                  {order.customer_note && (
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Müşteri Notu:
                      </p>
                      <p className="text-sm text-yellow-700">
                        {order.customer_note}
                      </p>
                    </div>
                  )}
                  {order.admin_note && (
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Admin Notu:
                      </p>
                      <p className="text-sm text-yellow-700">
                        {order.admin_note}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
