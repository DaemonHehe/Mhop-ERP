import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
nextEnv.loadEnvConfig(process.cwd());
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const {
    rows: [product],
  } = await client.query(
    `INSERT INTO products(name,brand,category,subcategory,base_cost) VALUES ('Audit verification','Test','Gaming Gadgets','Test',10) RETURNING id`,
  );
  await client.query("UPDATE products SET base_cost=20 WHERE id=$1", [
    product.id,
  ]);
  await client.query("DELETE FROM products WHERE id=$1", [product.id]);
  const { rows } = await client.query(
    "SELECT category,event,details FROM system_audit_logs WHERE target_code=$1 ORDER BY created_at,id",
    [product.id],
  );
  assert.equal(rows.length, 3);
  assert(rows.every((row) => row.category === "inventory"));
  const changed = JSON.parse(
    rows.find((row) => row.event === "catalog.update").details,
  );
  assert.equal(changed.changes.base_cost.before, 10);
  assert.equal(changed.changes.base_cost.after, 20);
  const {
    rows: [week],
  } = await client.query(
    `SELECT to_char(date_trunc('week', timezone('Asia/Bangkok', '2026-09-06T17:00:00Z'::timestamptz)),'YYYY-MM-DD') AS start`,
  );
  assert.equal(week.start, "2026-09-07");
  await client.query("ROLLBACK");
  const {
    rows: [count],
  } = await client.query(
    "SELECT count(*)::int AS n FROM system_audit_logs WHERE target_code=$1",
    [product.id],
  );
  assert.equal(count.n, 0);
  console.log(
    "PASS: categorized insert/update/delete snapshots, before/after values, Bangkok week boundary, transaction rollback. No test data retained.",
  );
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
