ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS products_sort_order_idx ON products(sort_order);
