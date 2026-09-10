-- Migration 0019: Customer Loyalty Points & Tiers (1000 MMK = 1 point)
-- Tiers: member (0-199), silver (200-499), gold (500-1000), platinum (1001+)
-- Perks: silver = free delivery; gold = free delivery + 5% discount; platinum = free delivery + 10% discount

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "points" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tier" varchar(40) NOT NULL DEFAULT 'member';

CREATE INDEX IF NOT EXISTS "customers_tier_idx" ON "customers" ("tier");

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customer_tier" varchar(40) NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS "tier_discount_amount" numeric(14, 2) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "tier_delivery_discount" numeric(14, 2) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "points_earned" integer NOT NULL DEFAULT 0;

-- Backfill points and tiers for existing customers based on verified order totals
UPDATE "customers" c
SET
  "points" = COALESCE(sub.earned_points, 0),
  "tier" = CASE
    WHEN COALESCE(sub.earned_points, 0) >= 1001 THEN 'platinum'
    WHEN COALESCE(sub.earned_points, 0) >= 500 THEN 'gold'
    WHEN COALESCE(sub.earned_points, 0) >= 200 THEN 'silver'
    ELSE 'member'
  END
FROM (
  SELECT
    customer_id,
    FLOOR(SUM(total_amount::numeric) / 1000)::integer AS earned_points
  FROM "orders"
  WHERE payment_status = 'verified'
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;
