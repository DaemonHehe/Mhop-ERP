-- Migration 0020: Unique Customer Code and Telegram Tag (Username)
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "customer_code" varchar(40),
  ADD COLUMN IF NOT EXISTS "telegram_username" varchar(80);

CREATE INDEX IF NOT EXISTS "customers_customer_code_idx" ON "customers" ("customer_code");
CREATE INDEX IF NOT EXISTS "customers_telegram_username_idx" ON "customers" ("telegram_username");

-- Backfill customer_code for any existing customer records: e.g. MH-CUST-1001, MH-CUST-1002
WITH numbered AS (
  SELECT id, 'MH-CUST-' || LPAD((ROW_NUMBER() OVER (ORDER BY created_at ASC) + 1000)::text, 4, '0') AS new_code
  FROM "customers"
  WHERE "customer_code" IS NULL
)
UPDATE "customers" c
SET "customer_code" = n.new_code
FROM numbered n
WHERE c.id = n.id;

