-- Migration 0023: Preorder Items Support with Estimated Waiting Time
ALTER TABLE products ADD COLUMN IF NOT EXISTS waiting_time varchar(80);
