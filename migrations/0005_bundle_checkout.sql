CREATE TABLE IF NOT EXISTS bundles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(180) NOT NULL, description text, bundle_price numeric(14,2) NOT NULL CHECK(bundle_price>=0), savings_amount numeric(14,2) NOT NULL CHECK(savings_amount>=0), items_json jsonb NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS order_bundle_sets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), bundle_id uuid REFERENCES bundles(id), bundle_name varchar(180) NOT NULL, bundle_price numeric(14,2) NOT NULL, items_json jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS order_bundle_sets_order_idx ON order_bundle_sets(order_id);
CREATE INDEX IF NOT EXISTS order_bundle_sets_bundle_idx ON order_bundle_sets(bundle_id);
