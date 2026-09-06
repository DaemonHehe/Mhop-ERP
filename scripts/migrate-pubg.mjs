import { readFile } from 'node:fs/promises';
import nextEnv from '@next/env';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
nextEnv.loadEnvConfig(process.cwd());
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='product_variants' AND column_name='listing_status'");
  if (!rows.length) await pool.query(await readFile('migrations/0012_brokered_pubg_listings.sql', 'utf8'));
  const legacy = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='product_variants' AND column_name='broker_details'");
  if (legacy.rows.length) await pool.query(await readFile('migrations/0013_simple_pubg_resale.sql', 'utf8'));
  console.log('PUBG resale listing migration applied; historical account records preserved.');
} finally { await pool.end(); }
