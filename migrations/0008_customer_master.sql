CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  phone varchar(40) UNIQUE NOT NULL,
  telegram_user_id varchar(80),
  primary_address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_telegram_user_idx ON customers(telegram_user_id);
CREATE INDEX IF NOT EXISTS customers_active_idx ON customers(is_active);

INSERT INTO customers (name, phone, telegram_user_id, primary_address, created_at, updated_at)
SELECT DISTINCT ON (phone)
  customer_name,
  phone,
  telegram_user_id,
  shipping_address,
  created_at,
  now()
FROM orders
ORDER BY phone, created_at DESC
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  telegram_user_id = coalesce(EXCLUDED.telegram_user_id, customers.telegram_user_id),
  primary_address = coalesce(EXCLUDED.primary_address, customers.primary_address),
  updated_at = now();

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid;

UPDATE orders
SET customer_id = customers.id
FROM customers
WHERE orders.customer_id IS NULL
  AND orders.phone = customers.phone;

ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_customers_id_fk
  FOREIGN KEY (customer_id) REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
