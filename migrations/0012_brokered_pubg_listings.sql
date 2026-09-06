BEGIN;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS listing_status varchar(20) NOT NULL DEFAULT 'available';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS broker_details jsonb;
-- Preserve legacy serialized records and order references. Existing PUBG listings
-- need seller verification before becoming individual brokered sales.
UPDATE product_variants v SET
  listing_status = CASE
    WHEN EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE i.variant_id=v.id AND o.fulfillment_status NOT IN ('cancelled','delivered')) THEN 'reserved'
    WHEN EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE i.variant_id=v.id AND o.fulfillment_status='delivered') THEN 'sold'
    ELSE 'withdrawn' END,
  broker_details = jsonb_build_object('sellerName','','sellerContact','','playerId','','loginProvider',''),
  stock_quantity = 0, low_stock_threshold = 0
FROM products p WHERE p.id=v.product_id AND p.category='PUBG Accounts' AND v.broker_details IS NULL;
COMMIT;
