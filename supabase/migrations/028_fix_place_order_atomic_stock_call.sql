-- =============================================================================
-- Migration 028: place_order_atomic — check_and_deduct_stock çağrısı düzeltmesi
--
-- Sorun:
--   027_guest_checkout_support.sql içindeki place_order_atomic,
--   check_and_deduct_stock fonksiyonunu `IF NOT check_and_deduct_stock(...)`
--   şeklinde çağırıyordu. Ancak 013_order_security_and_tracking.sql,
--   bu fonksiyonu RETURNS VOID olarak tanımladı. PostgreSQL "argument of NOT
--   must be type boolean, not type void" hatası fırlatır.
--
-- Çözüm:
--   VOID dönen fonksiyonu PERFORM ile çağır. Fonksiyon hata durumunda
--   zaten RAISE EXCEPTION fırlatır; place_order_atomic'in WHEN OTHERS THEN
--   bloğu bunu yakalar — ayrı IF NOT kontrolüne gerek yoktur.
--
-- Bağımlılıklar:
--   013_order_security_and_tracking.sql → check_and_deduct_stock(UUID, DECIMAL) RETURNS VOID
--   027_guest_checkout_support.sql      → place_order_atomic(JSONB) ilk guest versiyonu
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION place_order_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id      UUID;
  v_order_number  TEXT;
  v_item          JSONB;
  v_item_id       UUID;
BEGIN
  -- ── 1. SİPARİŞ KAYDI ──────────────────────────────────────────────────────
  INSERT INTO orders (
    user_id,
    is_guest,
    customer_email,
    customer_name,
    customer_phone,
    shipping_address,
    billing_address,
    subtotal,
    shipping_cost,
    discount_amount,
    total_amount,
    status,
    payment_method,
    coupon_id,
    coupon_code,
    customer_note
  ) VALUES (
    NULLIF(p_payload->>'user_id', '')::UUID,
    COALESCE((p_payload->>'is_guest')::BOOLEAN, FALSE),
    p_payload->>'customer_email',
    p_payload->>'customer_name',
    NULLIF(p_payload->>'customer_phone', ''),
    p_payload->>'shipping_address',
    COALESCE(p_payload->>'billing_address', p_payload->>'shipping_address'),
    (p_payload->>'subtotal')::DECIMAL,
    COALESCE((p_payload->>'shipping_cost')::DECIMAL, 0),
    COALESCE((p_payload->>'discount_amount')::DECIMAL, 0),
    (p_payload->>'total_amount')::DECIMAL,
    'PENDING',
    p_payload->>'payment_method',
    NULLIF(p_payload->>'coupon_id', '')::UUID,
    NULLIF(p_payload->>'coupon_code', ''),
    NULLIF(p_payload->>'customer_note', '')
  )
  RETURNING id, order_number
  INTO v_order_id, v_order_number;

  -- ── 2. SİPARİŞ KALEMLERİ + STOK DÜŞME ────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      product_slug,
      product_image,
      width_cm,
      height_cm,
      pile_factor,
      pleat_ratio_id,
      pleat_name_snapshot,
      mechanism_direction,
      calculation_type_snapshot,
      area_m2,
      price_per_m2_snapshot,
      pile_coefficient,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      v_item->>'product_slug',
      NULLIF(v_item->>'product_image', ''),
      (v_item->>'width_cm')::INTEGER,
      (v_item->>'height_cm')::INTEGER,
      (v_item->>'pile_factor')::pile_factor,
      NULLIF(v_item->>'pleat_ratio_id', '')::UUID,
      NULLIF(v_item->>'pleat_name_snapshot', ''),
      NULLIF(v_item->>'mechanism_direction', '')::mechanism_direction,
      (v_item->>'calculation_type_snapshot')::calculation_type,
      (v_item->>'area_m2')::DECIMAL,
      (v_item->>'price_per_m2_snapshot')::DECIMAL,
      (v_item->>'pile_coefficient')::DECIMAL,
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'total_price')::DECIMAL
    )
    RETURNING id INTO v_item_id;

    -- check_and_deduct_stock RETURNS VOID.
    -- Yetersiz stok veya ürün bulunamadı durumunda fonksiyon RAISE EXCEPTION
    -- fırlatır; aşağıdaki WHEN OTHERS THEN bloğu bunu yakalar.
    PERFORM check_and_deduct_stock(
      (v_item->>'product_id')::UUID,
      (v_item->>'stock_deduct_m2')::DECIMAL
    );

  END LOOP;

  -- ── 3. İLK DURUM TARİHÇESİ ────────────────────────────────────────────────
  INSERT INTO order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by_role,
    note,
    is_customer_visible
  ) VALUES (
    v_order_id,
    NULL,
    'PENDING',
    'system',
    'Siparişiniz alındı. Ödeme bekleniyor.',
    true
  );

  -- ── 4. BAŞARI DÖNÜŞÜ ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',      true,
    'order_id',     v_order_id,
    'order_number', v_order_number
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[place_order_atomic] Hata: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error',   SQLERRM,
      'code',    SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION place_order_atomic(JSONB) IS
  'Sipariş + kalemler + stok düşürme + ilk durum tarihçesini '
  'TEK TRANSACTION içinde atomik olarak yürütür. '
  'check_and_deduct_stock RETURNS VOID olduğundan PERFORM ile çağrılır; '
  'hata durumunda fonksiyon RAISE EXCEPTION fırlatır, WHEN OTHERS bloğu yakalar. '
  'is_guest=true payload ile misafir kullanıcı siparişlerini destekler. '
  'SECURITY DEFINER ile çalışır.';

REVOKE ALL ON FUNCTION place_order_atomic(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order_atomic(JSONB) TO authenticated;

COMMIT;
