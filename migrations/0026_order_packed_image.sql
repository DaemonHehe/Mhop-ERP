-- Migration 0026: Add packed packaging proof image fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_image_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_image_urls jsonb DEFAULT '[]'::jsonb;
