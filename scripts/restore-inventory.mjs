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

async function runRestore() {
  const targetFile = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(process.cwd(), "backups", "products-and-stocks-backup-latest.json");

  console.log(`Restoring Products & Stocks data from:\n  ${targetFile}\n`);

  const fileExists = await fs.access(targetFile).then(() => true).catch(() => false);
  if (!fileExists) {
    console.error(`Backup file not found: ${targetFile}`);
    process.exit(1);
  }

  const raw = await fs.readFile(targetFile, "utf8");
  const backup = JSON.parse(raw);
  const { tables } = backup;

  if (!tables || !tables.products || !tables.productVariants) {
    console.error("Invalid backup structure. Missing products or productVariants.");
    process.exit(1);
  }

  console.log(`Found in backup:`);
  console.log(`  - Products: ${tables.products.length}`);
  console.log(`  - Product Variants: ${tables.productVariants.length}`);
  console.log(`  - Device Units: ${tables.deviceUnits?.length || 0}`);
  console.log(`  - Media Uploads: ${tables.mediaUploads?.length || 0}`);

  // 1. Restore Media Uploads
  if (tables.mediaUploads && tables.mediaUploads.length > 0) {
    console.log("Restoring media uploads...");
    for (const m of tables.mediaUploads) {
      await sql`
        INSERT INTO media_uploads (id, filename, mime_type, size_bytes, data, created_at)
        VALUES (${m.id}, ${m.filename}, ${m.mime_type}, ${m.size_bytes}, ${m.data}, ${m.created_at})
        ON CONFLICT (id) DO UPDATE SET
          filename = EXCLUDED.filename,
          mime_type = EXCLUDED.mime_type,
          size_bytes = EXCLUDED.size_bytes,
          data = EXCLUDED.data;
      `;
    }
  }

  // 2. Restore Products
  if (tables.products.length > 0) {
    console.log("Restoring products...");
    for (const p of tables.products) {
      const imageUrls = Array.isArray(p.image_urls) ? JSON.stringify(p.image_urls) : "[]";
      await sql`
        INSERT INTO products (id, name, brand, category, subcategory, description, image_url, image_urls, base_cost, is_active, waiting_time, sort_order)
        VALUES (${p.id}, ${p.name}, ${p.brand}, ${p.category}, ${p.subcategory}, ${p.description}, ${p.image_url}, ${imageUrls}::jsonb, ${p.base_cost}, ${p.is_active}, ${p.waiting_time ?? null}, ${p.sort_order ?? 0})
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
  }

  // 3. Restore Product Variants
  if (tables.productVariants.length > 0) {
    console.log("Restoring product variants...");
    for (const v of tables.productVariants) {
      await sql`
        INSERT INTO product_variants (id, product_id, sku, color, storage, ram, condition, price, cost_price, warranty_months, stock_quantity, listing_status, low_stock_threshold, is_active)
        VALUES (${v.id}, ${v.product_id}, ${v.sku}, ${v.color}, ${v.storage}, ${v.ram}, ${v.condition}, ${v.price}, ${v.cost_price}, ${v.warranty_months}, ${v.stock_quantity}, ${v.listing_status}, ${v.low_stock_threshold}, ${v.is_active})
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
  }

  // 4. Restore Device Units
  if (tables.deviceUnits && tables.deviceUnits.length > 0) {
    console.log("Restoring device units...");
    for (const d of tables.deviceUnits) {
      await sql`
        INSERT INTO device_units (id, variant_id, serial_number, imei_number, login_provider, rebind_status, status, received_at, sold_at)
        VALUES (${d.id}, ${d.variant_id}, ${d.serial_number}, ${d.imei_number}, ${d.login_provider}, ${d.rebind_status}, ${d.status}, ${d.received_at}, ${d.sold_at})
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
  }

  console.log("\nProducts & Stocks recovery completed successfully!");
}

runRestore().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
