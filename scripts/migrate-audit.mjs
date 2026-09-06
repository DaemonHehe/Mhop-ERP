import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const path of [
    "migrations/0010_categorized_audit_history.sql",
    "migrations/0011_business_change_audit.sql",
  ]) {
    await pool.query(await readFile(path, "utf8"));
    console.log(`Applied ${path}`);
  }
} finally {
  await pool.end();
}
