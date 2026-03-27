-- ============================================================
-- Migration 016: Atomik PENDING Sipariş Sona Erdirme Fonksiyonu
--
-- expire_pending_orders(uuid[]):
--   - Toplu sipariş ID'leri alır
--   - Her siparişi kendi implicit savepoint'inde işler (per-order ACID)
--   - FOR UPDATE SKIP LOCKED ile deadlock riskini ortadan kaldırır
--   - Stok iadesi + durum güncellemesi + tarihçe kaydını atomik yapar
--   - Her sipariş için {success, error} içeren jsonb döner
-- ============================================================

CREATE OR REPLACE FUNCTION expire_pending_orders(p_order_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        RECORD;
  v_item         RECORD;
  v_restore_amt  numeric(12, 3);
  v_results      jsonb := '[]'::jsonb;
BEGIN
  -- Siparişleri ID sırasıyla kilitle (tutarlı sıra → deadlock önleme)
  -- SKIP LOCKED: eş zamanlı işlem tarafından zaten kilitlenmiş satırları atla
  FOR v_order IN
    SELECT o.id, o.order_number
    FROM   orders o
    WHERE  o.id = ANY(p_order_ids)
      AND  o.status = 'PENDING'
    ORDER BY o.id
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- ── 1. Stok İadesi ──────────────────────────────────────────────────
      -- area_m2 * pile_coefficient * quantity = düşülen metretül miktarı
      FOR v_item IN
        SELECT
          oi.product_id,
          COALESCE(oi.area_m2,          0) AS area_m2,
          COALESCE(oi.pile_coefficient, 1) AS pile_coefficient,
          COALESCE(oi.quantity,         1) AS quantity
        FROM order_items oi
        WHERE oi.order_id = v_order.id
      LOOP
        v_restore_amt := ROUND(
          (v_item.area_m2 * v_item.pile_coefficient * v_item.quantity)::numeric,
          3
        );

        IF v_restore_amt > 0 THEN
          UPDATE products
          SET
            stock_quantity = GREATEST(0, stock_quantity + v_restore_amt),
            in_stock       = TRUE,
            updated_at     = NOW()
          WHERE id = v_item.product_id;
        END IF;
      END LOOP;

      -- ── 2. Sipariş Durumu → CANCELLED ───────────────────────────────────
      -- İkinci PENDING kontrolü: eş zamanlı ödeme callback race'ini engeller
      UPDATE orders
      SET
        status     = 'CANCELLED',
        admin_note = COALESCE(admin_note || ' | ', '') ||
                     'Ödeme 30 dakika içinde tamamlanmadı — otomatik iptal',
        updated_at = NOW()
      WHERE id     = v_order.id
        AND status = 'PENDING';

      -- Güncelleme gerçekleşmediyse (concurrent PAID) hiçbir şey loglama
      IF NOT FOUND THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'order_id',     v_order.id,
          'order_number', v_order.order_number,
          'success',      false,
          'error',        'concurrent_payment_detected'
        ));
        -- implicit savepoint → stok iadeleri de geri alınır
        RAISE EXCEPTION 'concurrent_payment_detected';
      END IF;

      -- ── 3. Durum Tarihçesi ───────────────────────────────────────────────
      INSERT INTO order_status_history (
        order_id,
        previous_status,
        new_status,
        changed_by_role,
        reason
      ) VALUES (
        v_order.id,
        'PENDING',
        'CANCELLED',
        'system',
        'Ödeme süresi doldu — otomatik iptal (cron)'
      );

      -- ── 4. Başarı kaydı ──────────────────────────────────────────────────
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'order_id',     v_order.id,
        'order_number', v_order.order_number,
        'success',      true
      ));

    EXCEPTION WHEN OTHERS THEN
      -- Bu blok bir implicit savepoint gibi davranır:
      -- yalnızca bu siparişe ait değişiklikler geri alınır,
      -- diğer siparişler etkilenmez.
      IF SQLERRM <> 'concurrent_payment_detected' THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'order_id',     v_order.id,
          'order_number', v_order.order_number,
          'success',      false,
          'error',        SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  RETURN v_results;
END;
$$;

-- ── Yetki yönetimi ─────────────────────────────────────────────────────────
-- Sadece service_role (cron worker) çağırabilir; anonim/authenticated erişemez
REVOKE EXECUTE ON FUNCTION expire_pending_orders(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION expire_pending_orders(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION expire_pending_orders(uuid[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION expire_pending_orders(uuid[]) TO service_role;
