# Products & Stocks Database Backups

This directory contains full snapshots of the live **Products & Stocks** data from the PostgreSQL database (Neon), including:
- All **Products** (`products` table)
- All **Product Variants** (`product_variants` table)
- All **Device Units** (`device_units` table)
- All uploaded **Media / Images** (`media_uploads` table stored as base64)

---

## How to Restore / Recover Data

If any products, variants, or photos are ever accidentally modified or deleted, you can restore them instantly using any of the following methods:

### Option 1: Using the Node Restore Script (Recommended)
Run the automated restore command from the project root:
```bash
npm run db:restore-inventory
```
This reads `backups/products-and-stocks-backup-latest.json` and safely re-inserts/updates all records in the database with conflict handling (`ON CONFLICT DO UPDATE`).

You can also restore from a specific timestamped backup:
```bash
node scripts/restore-inventory.mjs backups/products-and-stocks-backup-2026-09-12T17-45-33.json
```

---

### Option 2: Using the SQL Script
You can execute `backups/restore-products-and-stocks-latest.sql` directly against your Neon database using `psql` or the Neon SQL Editor console.

---

## How to Create a New Backup
Whenever the admin uploads or edits new products in the future, create an updated snapshot anytime by running:
```bash
npm run db:backup-inventory
```
This automatically updates `products-and-stocks-backup-latest.json` and `restore-products-and-stocks-latest.sql`, while preserving timestamped history.
