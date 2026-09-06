# MH OP Commerce Operations

Developed by **Daemon**.

MH OP is a Next.js 15 omnichannel commerce and operations platform for gaming gadgets and verified PUBG Mobile accounts: a customer storefront, ERP operations, payment-slip review, serial/IMEI assignment, secure digital handover, RMA, thermal receipts, and an AI-assisted Telegram sales channel.

Client-specific identity, Telegram copy, payment destinations, Royal Express delivery rules, and reminder settings live in `lib/client-config.ts`. Apply `migrations/0003_mhop_client_setup.sql` to an existing database before using the updated checkout.

## Run locally

Requirements: Node.js 20+, npm, and PostgreSQL 15+ (or Neon).

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The root route sends customers to `/shop`; staff sign in at `/login`. The storefront can display demonstration catalog data without a database, but authentication, orders, stock synchronization, ERP, customer records, and integrations require `DATABASE_URL`.

## Access model

- `/shop`, `/shop/compare`, `/shop/checkout`, and `/warranty` are customer-facing routes.
- `/dashboard` and all operational routes require a valid signed staff session in every environment.
- `/staff` additionally requires the `admin` role.
- `/api/internal/*` is for authenticated n8n service-to-service traffic and is never a browser-admin shortcut.
- Telegram customers use the bot and hosted Mini App storefront; they never receive access to the ERP dashboard.

## Database

For a new PostgreSQL database, run the consolidated schema and choose one seed:

```bash
psql "$DATABASE_URL" -f init.sql
psql "$DATABASE_URL" -f seed.sql       # starter catalog
# or
psql "$DATABASE_URL" -f seed-test.sql  # complete interactive test dataset
```

`seed-test.sql` is for development or staging only. It can be rerun to restore
its predefined test records after exercising the UI. For an existing
installation, apply the numbered migrations in order through
`migrations/0011_business_change_audit.sql`, then run
`node scripts/migrate-pubg.mjs` for the current PUBG resale status migration.
The migration helper corrects the earlier brokerage model and preserves order history;
do not rerun the historical 0012 SQL directly on a current installation.

After fresh initialization with `init.sql`, run `node scripts/migrate-audit.mjs`
to install the business-change audit triggers. This command also upgrades existing
audit history safely. Activity logs retain their original timestamps and are
displayed in Monday–Sunday Bangkok calendar weeks (UTC+7). No weekly deletion is performed.
Detailed field changes start when the triggers are installed; older summaries
cannot reconstruct historical field values. Application summaries identify the
signed-in staff member; database snapshots are explicitly labeled database change.

Or generate/manage migrations from `db/schema.ts` with Drizzle Kit. Before running `seed.sql`, generate the administrator hash with `node scripts/hash-password.mjs "your-long-password"` and replace `REPLACE_WITH_A_REAL_BCRYPT_HASH` in the seed file.

## Routes

- `/dashboard` command center and financial snapshot
- `/shop`, `/shop/compare`, `/shop/checkout` customer commerce surfaces
- `/warranty` public order-and-phone warranty lookup
- `/inventory`, `/orders`, `/receipts`, `/tickets` live core operations and verified RMA intake
- `/bundles` bundle-set catalog, pricing, and availability management
- `/erp` suppliers, purchasing, stock receiving, expenses, and profitability
- `/ai-studio` no-API commercial image prompt composer
- `/customers`, `/leads`, `/logs` customer records, purchase recovery, and audit views
- `/staff`, `/alerts` role-based staff administration and operational alert inbox
- `/login` secure staff authentication
- `/api/n8n/webhook` signed automation ingress
- `/api/telegram/webhook` Telegram command/media ingress
- `/api/events` live Server-Sent Event stream
- `/api/internal/*` authenticated n8n adapters for briefings, recovery, cross-sell, and AI replies

## Automation

Import `gadgetos-error-handler.json` and `gadgetos-master-suite.json` into n8n. Both workflows are intentionally inactive on import. Configure the following credentials before testing:

- `MH OP Internal API`: HTTP Header Auth with name `Authorization` and value `Bearer <ADMIN_API_TOKEN>`.
- `MH OP Event Webhook`: HTTP Header Auth with name `x-mhop-automation-key` and value matching `N8N_WEBHOOK_SECRET`.
- `MH OP Customer Telegram`: the customer bot credential, used for accessory follow-up messages. Lead recovery is sent by the application customer bot token.
- `MH OP Ops Telegram`: the operations bot credential for staff alerts, briefings, digests, and failure alerts.

Set `GADGETOS_URL` and `TELEGRAM_STAFF_CHAT_ID` in the n8n environment. Activate the error handler first, then select it under **MH OP Operations Automation → Workflow Settings → Error Workflow**. Attach the matching credential to every imported node, test each trigger branch, publish the primary workflow, and set `N8N_WEBHOOK_URL` in the application to the primary workflow's production `/webhook/mhop-operations-events` URL. Production webhook URLs must use HTTPS.

The application is the sole inbound Telegram webhook owner for the customer bot. Do not add a Telegram Trigger using the same bot token in n8n. Application events use pre-execution Header Auth and also include `x-gadgetos-signature`, an HMAC-SHA256 digest of the raw body. Event delivery has a ten-second timeout and three attempts. n8n read calls use credential-based authentication, 15-second timeouts, and transient retries. The reminder-send call has a 25-second timeout and no automatic retries. Lead reminders, business events, and accessory follow-ups deduplicate processing attempts within retained workflow history. This is not guaranteed delivery. Lead reminder sends use the app endpoint without automatic retries; the app rechecks eligibility immediately before sending. No redeemable voucher feature is implemented.

Free-form customer Telegram messages are routed to the shared sales agent. It uses the OpenAI Responses API with live customer-safe catalog and policy tools, a bounded conversation history in `bot_sessions`, per-customer rate limiting, a 15-second provider timeout, and staff handoff alerts for payment disputes, refunds, complaints, warranty decisions, or explicit human requests. Exact quantities, costs, margins, internal IDs, and PUBG credentials are not supplied to the model. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (defaults to `gpt-5.4-mini`) to enable AI replies. Without a configured key or when the provider is unavailable, deterministic catalog search and human handoff remain operational.

## Deployment and Telegram Mini App

Host the Next.js application, PostgreSQL database, and n8n on stable HTTPS endpoints before production bot testing. Configure the Telegram bot menu button or Web App button with the public `/shop` URL; Telegram Mini Apps cannot use `localhost` on customer devices. Validate Telegram `initData` on the server before trusting a Telegram identity or attaching it to a customer record.

Keep `.env.local` and all service credentials outside Git. Start from `.env.example`, configure the production database and integration URLs in the hosting provider, apply the schema or migrations once, and use staging data for acceptance testing before activating real customer webhooks.

## Security baseline

- Secrets are ignored and represented only by generic placeholders.
- Protected staff routes always require a signed, HTTP-only session cookie and bcrypt-verified account.
- Role checks prevent non-admin staff and misrouted customers from opening administrative screens.
- Webhook input is signed and event types are allow-listed.
- Serial assignment uses a row lock and transaction to prevent double allocation.
- Payment state changes and staff alerts are committed together.
- Database-backed pages are rendered dynamically so current stock, orders, receipts, alerts, and financial data cannot be frozen into a build.
- Production deployments must still add object-storage upload scanning, distributed rate limits, CSRF review, audit retention, and encrypted backups.

See `USER_MANUAL.md` for operations and `USER_TESTING.md` for acceptance checks. Open `CLIENT_ONBOARDING_FORM.html` directly in a browser for the implementation intake.

Run `npm run check` for lint, type, and unit checks. Run `npm run test:e2e` against a development or staging database to verify customer and staff workflows. Run `scripts/api-smoke.ps1` while the development server is active to verify the daily-stats adapter, Telegram catalog command, and rejection of unsigned n8n traffic.

Run `npm run test:n8n` after editing either exported workflow to validate JSON, node identity, connections, authentication, retries, timeouts, execution settings, and the single-Telegram-webhook rule. Run `npm run build` before deployment.

The AI Creative Studio does not call an image API or store prompts. Its product selector and reference image come directly from live physical gaming-gadget listings in Products & Stock; digital PUBG accounts are excluded and there is no redundant local upload. Its curated shortcuts cover commercial photography, camera and lighting direction, advertising layouts, editorial design, packaging, branding mockups, and photorealistic visualization. The administrator opens the catalog image, attaches it in their preferred image generator, and pastes the reference-aware prompt, which locks product identity while allowing the surrounding campaign environment, lighting, composition, and copy layout to change.


### PUBG account resale

The owner buys accounts and resells them using normal catalog details, cost price, and retail price. Each listing represents one account, with no seller-information fields, stock quantity, or account vault. Checkout reserves the listing, cancellation releases it, and completed handover marks it sold. Gadget stock remains quantity-based.

Run `node scripts/migrate-pubg.mjs` when upgrading an existing database to add sale status while preserving historical order records.

## Leads and recovery automation

Leads now come from private Telegram catalog/sales activity and unfinished payments, not the legacy manual lead table. The page has individual Telegram reminder buttons; no Add lead or Convert controls remain. Anonymous shop visitors are not identifiable, and web checkout is not automatically associated with Telegram Mini App identity.

`GET /api/internal/leads/recoverable` requires the internal bearer credential and returns only `id`, `stage`, `telegramUserId`, and `activityAt` from the current recovery queue. Only valid Telegram recipients with activity at least 15 minutes old qualify. Paid, cancelled, and payment-review orders are excluded.

The n8n recovery branch runs every 15 minutes, filters duplicate recipients in a scan, and deduplicates attempts by lead ID with a 10,000-key retained history. It calls `POST /api/internal/leads/remind` with `{ id, activityAt }` using the same internal credential. The app rechecks current eligibility and activity, then sends through `TELEGRAM_CUSTOMER_BOT_TOKEN`. Checkout confirmation uses the same bot to send a generated branded PNG receipt instead of a long text receipt. Changed records return a successful skipped result; malformed or unauthorized calls fail. Send failures are not automatically retried because a timeout can occur after Telegram accepted the message.

The manual button and scheduled branch share an in-process one-minute recipient throttle, not durable global contact history. Opt-out preferences and cross-server deduplication are not implemented. Review these limits with the client before enabling scheduled customer messaging.

## Updating an existing local n8n workflow

The checked-in JSON exports are importable templates and remain inactive. For the known local `MH OP Master Suite` instance, `node scripts/sync-n8n-workflow.mjs` creates a private backup and reports the current version and missing credentials without changing the workflow. Apply a reviewed inactive-workflow update using `--apply --expected-version <versionId>`. The helper preserves matching credentials and the webhook path, refuses active/concurrently changed workflows, and verifies its write. Recovery HTTP sending uses the internal API credential, not a Telegram credential. This helper targets only the configured local instance; it does not deploy the app or activate schedules.

## Handover status

Use USER_MANUAL.md for current operation and USER_TESTING.md for acceptance evidence. Browser tests still include obsolete manual-lead flows and need updating before the complete suite can be claimed passing. Real Telegram delivery, deployment, printing, backup restore, and client acceptance are separate from code/build validation. Do not label the project production-ready solely because unit tests and the build pass.
