import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runBackup() {
  console.log("Connecting to database and fetching Products & Stocks data...");

  // 1. Fetch tables
  const products = await sql`SELECT * FROM products ORDER BY sort_order ASC, name ASC`;
  const variants = await sql`SELECT * FROM product_variants ORDER BY sku ASC`;
  
  let deviceUnits = [];
  try {
    deviceUnits = await sql`SELECT * FROM device_units ORDER BY serial_number ASC`;
  } catch (e) {
    console.warn("device_units table not accessible or empty:", e.message);
  }

  let bundles = [];
  let bundleItems = [];
  try {
    bundles = await sql`SELECT * FROM bundles ORDER BY name ASC`;
    bundleItems = await sql`SELECT * FROM bundle_items`;
  } catch (e) {
    console.warn("bundles table not accessible or empty:", e.message);
  }

  let mediaUploads = [];
  try {
    mediaUploads = await sql`SELECT id, filename, mime_type, size_bytes, data, created_at FROM media_uploads ORDER BY created_at ASC`;
  } catch (e) {
    console.warn("media_uploads table not accessible or empty:", e.message);
  }

  console.log(`Found:`);
  console.log(`  - Products: ${products.length}`);
  console.log(`  - Product Variants: ${variants.length}`);
  console.log(`  - Device Units: ${deviceUnits.length}`);
  console.log(`  - Bundles: ${bundles.length} (Items: ${bundleItems.length})`);
  console.log(`  - Uploaded Media Files: ${mediaUploads.length}`);

  const backupData = {
    exportedAt: new Date().toISOString(),
    databaseUrlMasked: process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@"),
    summary: {
      productsCount: products.length,
      variantsCount: variants.length,
      deviceUnitsCount: deviceUnits.length,
      bundlesCount: bundles.length,
      mediaCount: mediaUploads.length,
    },
    tables: {
      products,
      productVariants: variants,
      deviceUnits,
      bundles,
      bundleItems,
      mediaUploads,
    },
  };

  const backupDir = path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonFilename = `products-and-stocks-backup-${timestamp}.json`;
  const latestJsonFilename = `products-and-stocks-backup-latest.json`;

  const jsonPath = path.join(backupDir, jsonFilename);
  const latestJsonPath = path.join(backupDir, latestJsonFilename);

  await fs.writeFile(jsonPath, JSON.stringify(backupData, null, 2), "utf8");
  await fs.writeFile(latestJsonPath, JSON.stringify(backupData, null, 2), "utf8");

  console.log(`Saved JSON backup to:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${latestJsonPath}`);

  // Generate SQL restore script
  const sqlFilename = `restore-products-and-stocks-${timestamp}.sql`;
  const latestSqlFilename = `restore-products-and-stocks-latest.sql`;
  const sqlPath = path.join(backupDir, sqlFilename);
  const latestSqlPath = path.join(backupDir, latestSqlFilename);

  let sqlContent = `-- Products & Stocks Snapshot Backup
-- Exported At: ${backupData.exportedAt}
-- Contains:
--   - ${products.length} products
--   - ${variants.length} product_variants
--   - ${deviceUnits.length} device_units
--   - ${bundles.length} bundles
--   - ${mediaUploads.length} media_uploads

BEGIN;

`;

  // Media uploads restore
  if (mediaUploads.length > 0) {
    sqlContent += `-- 1. Restore Media Uploads\n`;
    for (const m of mediaUploads) {
      const escapeStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
      sqlContent += `INSERT INTO media_uploads (id, filename, mime_type, size_bytes, data, created_at)
VALUES (${escapeStr(m.id)}, ${escapeStr(m.filename)}, ${escapeStr(m.mime_type)}, ${m.size_bytes || "NULL"}, ${escapeStr(m.data)}, ${escapeStr(m.created_at)})
ON CONFLICT (id) DO UPDATE SET
  filename = EXCLUDED.filename,
  mime_type = EXCLUDED.mime_type,
  size_bytes = EXCLUDED.size_bytes,
  data = EXCLUDED.data;
`;
    }
    sqlContent += `\n`;
  }

  // Products restore
  if (products.length > 0) {
    sqlContent += `-- 2. Restore Products\n`;
    for (const p of products) {
      const escapeStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
      const imageUrlsJson = JSON.stringify(p.image_urls || []).replace(/'/g, "''");
      sqlContent += `INSERT INTO products (id, name, brand, category, subcategory, description, image_url, image_urls, base_cost, is_active, waiting_time, sort_order)
VALUES (${escapeStr(p.id)}, ${escapeStr(p.name)}, ${escapeStr(p.brand)}, ${escapeStr(p.category)}, ${escapeStr(p.subcategory)}, ${escapeStr(p.description)}, ${escapeStr(p.image_url)}, '${imageUrlsJson}'::jsonb, ${p.base_cost}, ${p.is_active}, ${escapeStr(p.waiting_time)}, ${p.sort_order ?? 0})
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  image_urls = EXCLUDED.image_urls,
  base_cost = EXCLUDED.base_cost,
  is_active = EXCLUDED.is_active,
  waiting_time = EXCLUDED.waiting_time,
  sort_order = EXCLUDED.sort_order;
`;
    }
    sqlContent += `\n`;
  }

  // Product Variants restore
  if (variants.length > 0) {
    sqlContent += `-- 3. Restore Product Variants\n`;
    for (const v of variants) {
      const escapeStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
      sqlContent += `INSERT INTO product_variants (id, product_id, sku, color, storage, ram, condition, price, cost_price, warranty_months, stock_quantity, listing_status, low_stock_threshold, is_active)
VALUES (${escapeStr(v.id)}, ${escapeStr(v.product_id)}, ${escapeStr(v.sku)}, ${escapeStr(v.color)}, ${escapeStr(v.storage)}, ${escapeStr(v.ram)}, ${escapeStr(v.condition)}, ${v.price}, ${v.cost_price}, ${v.warranty_months}, ${v.stock_quantity}, ${escapeStr(v.listing_status)}, ${v.low_stock_threshold}, ${v.is_active})
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  sku = EXCLUDED.sku,
  color = EXCLUDED.color,
  storage = EXCLUDED.storage,
  ram = EXCLUDED.ram,
  condition = EXCLUDED.condition,
  price = EXCLUDED.price,
  cost_price = EXCLUDED.cost_price,
  warranty_months = EXCLUDED.warranty_months,
  stock_quantity = EXCLUDED.stock_quantity,
  listing_status = EXCLUDED.listing_status,
  low_stock_threshold = EXCLUDED.low_stock_threshold,
  is_active = EXCLUDED.is_active;
`;
    }
    sqlContent += `\n`;
  }

  // Device Units restore
  if (deviceUnits.length > 0) {
    sqlContent += `-- 4. Restore Device Units\n`;
    for (const d of deviceUnits) {
      const escapeStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
      sqlContent += `INSERT INTO device_units (id, variant_id, serial_number, imei_number, login_provider, rebind_status, status, received_at, sold_at)
VALUES (${escapeStr(d.id)}, ${escapeStr(d.variant_id)}, ${escapeStr(d.serial_number)}, ${escapeStr(d.imei_number)}, ${escapeStr(d.login_provider)}, ${escapeStr(d.rebind_status)}, ${escapeStr(d.status)}, ${escapeStr(d.received_at)}, ${escapeStr(d.sold_at)})
ON CONFLICT (id) DO UPDATE SET
  variant_id = EXCLUDED.variant_id,
  serial_number = EXCLUDED.serial_number,
  imei_number = EXCLUDED.imei_number,
  login_provider = EXCLUDED.login_provider,
  rebind_status = EXCLUDED.rebind_status,
  status = EXCLUDED.status,
  received_at = EXCLUDED.received_at,
  sold_at = EXCLUDED.sold_at;
`;
    }
    sqlContent += `\n`;
  }

  sqlContent += `COMMIT;\n`;

  await fs.writeFile(sqlPath, sqlContent, "utf8");
  await fs.writeFile(latestSqlPath, sqlContent, "utf8");

  console.log(`Saved SQL restore script to:`);
  console.log(`  - ${sqlPath}`);
  console.log(`  - ${latestSqlPath}`);
  console.log("\nBackup completed successfully!");
}

runBackup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
