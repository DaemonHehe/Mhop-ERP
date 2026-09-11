-- Migration 0022: Customer Secondary Phone Support
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "secondary_phone" varchar(40);

CREATE INDEX IF NOT EXISTS "customers_secondary_phone_idx" ON "customers" ("secondary_phone");
