import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

neonConfig.webSocketConstructor = ws;

type DatabasePoolGlobal = typeof globalThis & {
  mhopDatabasePool?: Pool;
};

const databaseGlobal = globalThis as DatabasePoolGlobal;
const pool = connectionString
  ? (databaseGlobal.mhopDatabasePool ??
    new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 10_000,
    }))
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  databaseGlobal.mhopDatabasePool = pool;
}

export const db = pool ? drizzle(pool, { schema }) : null;
