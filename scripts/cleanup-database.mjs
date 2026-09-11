import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured in .env.local");
}

const sql = neon(process.env.DATABASE_URL);

async function wipeEntireDatabase() {
  console.log("==========================================================");
  console.log("🧹 ABSOLUTE TOTAL DATABASE WIPE");
  console.log("Only single admin login (admin@gmail.com) will remain.");
  console.log("==========================================================\n");

  // 1. Transactional & Order tables
  console.log("1. Deleting orders, line items, payments, settlements...");
  await sql`DELETE FROM order_payments`;
  await sql`DELETE FROM order_bundle_sets`;
  await sql`DELETE FROM tickets`;
  await sql`DELETE FROM order_items`;
  await sql`DELETE FROM courier_settlement_allocations`;
  await sql`DELETE FROM courier_settlement_batches`;
  await sql`DELETE FROM orders`;
  await sql`DELETE FROM customers`;

  // 2. Operational logs, alerts & sessions
  console.log("2. Deleting logs, alerts, bot sessions, expenses...");
  await sql`DELETE FROM staff_alerts`;
  await sql`DELETE FROM bot_sessions`;
  await sql`DELETE FROM expenses`;
  await sql`DELETE FROM purchase_items`;
  await sql`DELETE FROM purchase_orders`;
  await sql`DELETE FROM suppliers`;

  // 3. Products, Variants, Bundles & PUBG Account Units
  console.log("3. Deleting all products, variants, stocks, and bundles...");
  await sql`DELETE FROM device_units`;
  await sql`DELETE FROM product_variants`;
  await sql`DELETE FROM products`;
  await sql`DELETE FROM bundles`;

  // 4. Shipping destinations, payment accounts & receipt settings
  console.log("4. Deleting shipping destinations, payment accounts & receipt settings...");
  await sql`DELETE FROM shipping_destinations`;
  await sql`DELETE FROM payment_accounts`;
  await sql`DELETE FROM receipt_settings`;

  // 5. Media Uploads
  console.log("5. Deleting media uploads in DB and on disk...");
  await sql`DELETE FROM media_uploads`;
  const uploadDir = join(process.cwd(), "public", "uploads");
  try {
    const files = await readdir(uploadDir);
    for (const f of files) {
      if (f.endsWith(".webp") || f.endsWith(".png") || f.endsWith(".jpg")) {
        await unlink(join(uploadDir, f));
      }
    }
  } catch {}

  // 6. Admin Users: Keep ONLY admin@gmail.com with password: adminadminadmin
  console.log("6. Generating fresh verified bcrypt hash for admin@gmail.com...");
  await sql`DELETE FROM admin_users`;
  const adminHash = await bcrypt.hash("adminadminadmin", 10);
  await sql`
    INSERT INTO admin_users (id, name, email, role, password_hash, is_active)
    VALUES (
      'b1000000-0000-4000-8000-000000000001'::uuid,
      'MH OP Administrator',
      'admin@gmail.com',
      'admin',
      ${adminHash},
      true
    )
  `;

  const [verifyUser] = await sql`SELECT email, password_hash FROM admin_users WHERE email = 'admin@gmail.com'`;
  const passwordCheck = await bcrypt.compare("adminadminadmin", verifyUser.password_hash);
  console.log(`   Admin password verification: ${passwordCheck ? "VALID ✅" : "FAILED ❌"}`);

  // 7. Wipe system audit logs at the very end
  console.log("7. Clearing all system audit logs for absolute clean slate...");
  await sql`DELETE FROM system_audit_logs`;

  console.log("\n✅ ABSOLUTE DATABASE WIPE COMPLETED!\n");

  // Summary inspection
  const allTables = [
    ['admin_users', 'Admin Login Accounts'],
    ['products', 'Catalog Products'],
    ['product_variants', 'Product Variants'],
    ['device_units', 'Device / Account Units'],
    ['bundles', 'Product Bundles'],
    ['orders', 'Orders'],
    ['order_items', 'Order Line Items'],
    ['order_payments', 'Order Payments & Slips'],
    ['courier_settlement_batches', 'Courier Settlement Batches'],
    ['courier_settlement_allocations', 'Courier Allocations'],
    ['customers', 'Customer Profiles'],
    ['tickets', 'Support / Warranty Tickets'],
    ['staff_alerts', 'Staff Alerts'],
    ['system_audit_logs', 'System Audit Trail'],
    ['shipping_destinations', 'Shipping Destinations'],
    ['payment_accounts', 'Payment Methods'],
    ['receipt_settings', 'Receipt Settings'],
    ['suppliers', 'Suppliers'],
    ['purchase_orders', 'Purchase Orders'],
    ['purchase_items', 'Purchase Items'],
    ['expenses', 'Expenses'],
    ['bot_sessions', 'Bot Sessions'],
    ['media_uploads', 'Media Uploads in DB']
  ];

  console.log("----------------------------------------------------------");
  console.log("📊 ABSOLUTE TOTAL DATABASE SNAPSHOT");
  console.log("----------------------------------------------------------");
  for (const [table, label] of allTables) {
    const [res] = await sql('select count(*)::int as cnt from ' + table);
    console.log(`${label.padEnd(40)} : ${res.cnt}`);
  }
  console.log("----------------------------------------------------------");
}

wipeEntireDatabase().catch((err) => {
  console.error("Wipe failed:", err);
  process.exit(1);
});
