-- Migration 0016: Support direct image uploads and multiple images for products & PUBG accounts

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL DEFAULT 'image/webp',
  size_bytes integer NOT NULL,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_uploads_created_at_idx ON media_uploads(created_at DESC);
