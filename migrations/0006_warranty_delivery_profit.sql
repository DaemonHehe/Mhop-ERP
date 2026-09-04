ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE tickets ALTER COLUMN serial_number DROP NOT NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES order_items(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS warranty_start_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS warranty_expires_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution varchar(40);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_cost numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS replacement_variant_id uuid REFERENCES product_variants(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE INDEX IF NOT EXISTS tickets_order_item_idx ON tickets(order_item_id);
