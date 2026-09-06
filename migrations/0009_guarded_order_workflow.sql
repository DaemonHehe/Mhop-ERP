-- Adds the explicit checkpoint between packing and courier dispatch.
-- Safe to run more than once on PostgreSQL 12+.
ALTER TYPE fulfillment_status ADD VALUE IF NOT EXISTS 'packed' AFTER 'packing';
