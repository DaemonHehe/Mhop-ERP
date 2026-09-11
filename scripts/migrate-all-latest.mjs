import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  "migrations/0017_bot_message_templates.sql",
  "migrations/0018_ai_sales_qa.sql",
  "migrations/0019_customer_points_and_tiers.sql",
  "migrations/0020_customer_code_and_telegram_username.sql",
  "migrations/0021_drop_leads_table.sql",
];

try {
  for (const file of migrations) {
    console.log(`Applying ${file}...`);
    const sql = await readFile(file, "utf8");
    await pool.query(sql);
    console.log(`Successfully applied ${file}`);
  }
  console.log("All migrations successfully applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
