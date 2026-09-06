import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured in .env.local");
}

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

async function statementsFrom(path) {
  return splitSql(await readFile(path, "utf8"));
}

const sql = neon(process.env.DATABASE_URL);
const [state] = await sql(
  `select
    to_regclass('public.admin_users') is not null as has_admin_users,
    to_regclass('public.orders') is not null as has_orders,
    to_regclass('public.customers') is not null as has_customers,
    exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name='customer_id'
    ) as has_customer_id`,
);

const [workflowState] = await sql(
  `select exists(
    select 1
    from pg_enum e
    join pg_type t on t.oid=e.enumtypid
    where t.typname='fulfillment_status' and e.enumlabel='packed'
  ) as has_packed_status`,
);

const setup = [];
let mode;
if (!state.has_admin_users && !state.has_orders) {
  mode = "fresh database initialized";
  setup.push(...(await statementsFrom("init.sql")));
} else if (!state.has_admin_users || !state.has_orders) {
  throw new Error(
    "The database has a partial schema. Use a blank database or repair it before seeding.",
  );
} else if (!state.has_customers || !state.has_customer_id) {
  mode = "existing database migrated";
  setup.push(...(await statementsFrom("migrations/0008_customer_master.sql")));
} else {
  mode = "current database detected";
}

if (!workflowState.has_packed_status)
  setup.push(
    ...(await statementsFrom("migrations/0009_guarded_order_workflow.sql")),
  );

setup.push(
  ...(await statementsFrom("migrations/0010_categorized_audit_history.sql")),
);

setup.push(...(await statementsFrom("seed-test.sql")));
await sql.transaction((tx) => setup.map((statement) => tx(statement)));
await import("./migrate-audit.mjs");

const [summary] = await sql(
  `select
    (select count(*)::int from customers where phone like '097700000%') as customers,
    (select count(*)::int from customers where phone like '097700000%' and telegram_user_id is not null) as telegram_customers,
    (select count(*)::int from orders where order_code like 'MHOP-260830-T%') as orders,
    (select count(*)::int from orders o left join customers c on c.id=o.customer_id where o.order_code like 'MHOP-260830-T%' and c.id is null) as orphan_orders,
    (select count(*)::int from products where id::text like 'a1%') as products,
    (select count(*)::int from device_units where serial_number like 'TEST-%') as account_and_serial_units,
    (select count(*)::int from bundles where name like 'Test %') as bundles,
    (select count(*)::int from tickets where ticket_code like 'RMA-TEST-%') as tickets,
    (select count(*)::int from leads where id::text like 'a9%') as leads,
    (select count(*)::int from staff_alerts where target_code like 'TEST-%' or target_code like 'MHOP-260830-T%') as alerts,
    (select count(*)::int from system_audit_logs where target_code='TEST-DATA' or target_code like 'TEST-%' or target_code like 'MHOP-260830-T%') as audit_logs,
    (select count(*)::int from admin_users where email in ('admin@gmail.com','staff@mhop.test','inactive@mhop.test')) as staff_accounts,
    (select count(*)::int from purchase_orders where po_code like 'PO-TEST-%') as purchase_orders,
    (select count(*)::int from expenses where expense_code like 'EXP-TEST-%') as expenses`,
);

console.log(JSON.stringify({ ok: true, mode, ...summary }, null, 2));
