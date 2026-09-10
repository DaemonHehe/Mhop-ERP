import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured in .env.local");
}

const sql = neon(process.env.DATABASE_URL);

function splitSql(source) {
  const statements = [];
  let buffer = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      buffer += character;
      if (character === "\n") lineComment = false;
      continue;
    }
    if (!singleQuoted && !doubleQuoted && character === "-" && next === "-") {
      lineComment = true;
      buffer += character;
      continue;
    }
    if (!doubleQuoted && character === "'") {
      buffer += character;
      if (singleQuoted && next === "'") {
        buffer += next;
        index += 1;
        continue;
      }
      singleQuoted = !singleQuoted;
      continue;
    }
    if (!singleQuoted && character === '"') {
      doubleQuoted = !doubleQuoted;
      buffer += character;
      continue;
    }
    if (!singleQuoted && !doubleQuoted && character === ";") {
      const statement = buffer.trim();
      if (statement && !/^(BEGIN|COMMIT)$/i.test(statement))
        statements.push(statement);
      buffer = "";
      continue;
    }
    buffer += character;
  }

  const remainder = buffer.trim();
  if (remainder && !/^(BEGIN|COMMIT)$/i.test(remainder))
    statements.push(remainder);
  return statements;
}

async function run() {
  console.log("Seeding authentic MH OP catalog from seed.sql...");
  const raw = await readFile("seed.sql", "utf8");
  const statements = splitSql(raw);
  for (const s of statements) {
    if (s.includes("INSERT INTO admin_users")) continue; // avoid overwriting active admin hash
    await sql(s);
  }
  console.log("✅ Catalog seeded successfully!");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
