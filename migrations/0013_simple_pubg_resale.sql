-- Correct only listings withdrawn by the earlier seller-details migration.
-- Clear its empty marker so rerunning this migration cannot reopen listings
-- that an administrator later withdraws intentionally.
BEGIN;
UPDATE product_variants v SET
  listing_status = CASE WHEN v.listing_status='withdrawn' THEN 'available' ELSE v.listing_status END,
  broker_details = NULL
FROM products p
WHERE p.id=v.product_id AND p.category='PUBG Accounts'
AND v.broker_details = '{"sellerName":"","sellerContact":"","playerId":"","loginProvider":""}'::jsonb;
COMMIT;
