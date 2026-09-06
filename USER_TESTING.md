# MH OP Acceptance Testing

Use a dedicated staging database and test Telegram bots. Record the date, tester, environment, and evidence for each result. An unchecked item is not a claim that the feature passed.

## Setup

- Initialize staging with `init.sql`, then `seed-test.sql`; apply audit triggers with `node scripts/migrate-audit.mjs`. Existing installations must follow the README migration sequence.
- The development seed uses `admin@gmail.com` / `adminadminadmin`. Never use those credentials or the test dataset in production.
- Seed files contain historical serialized PUBG fixtures. Create fresh PUBG listings through the current form to test the current single-listing lifecycle; do not use old stock counts as availability.
- Set `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and optionally `E2E_BASE_URL` for browser tests. Tests can create/delete fixtures, so do not point them at client production data.

## Automated checks

- [ ] `npm run check` passes lint, types, unit tests, and exported n8n workflow validation.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes on staging. Some existing browser tests still cover removed manual lead controls; update those tests before treating the suite as a release gate.
- [ ] `scripts/api-smoke.ps1` is reviewed and run against staging. Bot command smoke tests can send Telegram replies; use a test bot/chat.

## Catalog and stock

- [ ] Gadget and PUBG category buttons filter independently on desktop and mobile.
- [ ] Gadget create/edit/delete, prices, stock quantity, and low-stock threshold work.
- [ ] PUBG create/edit/delete uses normal cost and retail prices; no seller fields, stock inputs, or Vault are shown.
- [ ] PUBG Available/Withdrawn/Sold status affects purchase availability; Reserved is order-managed.
- [ ] Two concurrent checkouts cannot buy the same account; quantity greater than one is rejected.
- [ ] Cancelling a PUBG order releases the listing without increasing stock; delivery marks it sold.
- [ ] Public catalog and bot replies do not expose costs or internal account data.
- [ ] Archived listings cannot be purchased; previous orders and receipts remain intact.

## Purchase and fulfillment

- [ ] Shop search, filters, comparison, gadget bundles, and checkout work at desktop and 390px widths.
- [ ] Payment evidence attaches to the intended order; staff approval/rejection updates the order and alerts.
- [ ] Payment verification is checked against the provider by staff.
- [ ] Physical serial assignment rejects wrong variants, reused serials, and concurrent duplicate allocation.
- [ ] Unverified payments cannot be fulfilled; physical dispatch requires tracking.
- [ ] PUBG handover requires no stock-unit assignment, courier, or shipping fee.
- [ ] Warranty lookup/claim checks reject mismatched order and phone details.
- [ ] 58mm/80mm receipts print without clipping on the client printer; barcodes scan and totals match.

## Leads and reminders

- [ ] A private Telegram `/catalog`, `/shop`, or sales inquiry appears in Leads.
- [ ] Unpaid orders appear; verified, cancelled, and payment-review orders are excluded.
- [ ] Anonymous visitors and unlinked checkout customers cannot be messaged through Telegram.
- [ ] Manual reminders reach only the chosen test customer through the customer sales bot.
- [ ] The app reports missing bot configuration, blocked chats, and uncertain delivery accurately.
- [ ] n8n fetches the same recovery queue, excluding activity newer than 15 minutes and customers without a valid Telegram ID.
- [ ] Duplicate lead attempts are suppressed by retained n8n history; only one lead per chat is selected per scan.
- [ ] Pay an order or submit its slip after fetching the queue but before sending: the app skips the stale reminder.
- [ ] New customer activity after the scan causes a skip.
- [ ] Unauthorized fetch/send calls fail; malformed send requests fail without sending.
- [ ] Failed or ambiguous sends are reviewed without blindly retrying. Verify manual-versus-scheduled reminder behavior; persistent shared deduplication is not implemented.

## n8n and Telegram deployment

- [ ] Import both JSON workflows, reconnect credentials, and configure the error handler.
- [ ] The app alone owns the inbound customer Telegram webhook.
- [ ] Recovery sends use the app's `/api/internal/leads/remind` endpoint and customer token; no automatic HTTP send retries are enabled.
- [ ] Critical alerts go to the operations destination; unrelated events do not trigger them.
- [ ] 09:00 and 22:00 digests use Asia/Yangon; verify accessory follow-up timing in the imported schedule.
- [ ] Event Header Auth rejects incorrect secrets. n8n checks that header; it does not additionally verify the HMAC field.
- [ ] Voice messages receive the supported text-request response.
- [ ] Production app URL is HTTPS and reachable from n8n and customer devices.

## Client handover gate

- [ ] Production staff credentials, secrets, and payment destinations are verified without test defaults.
- [ ] The exact release and migration sequence have been tested on a fresh database and an upgrade copy.
- [ ] Staff permissions and public/private route boundaries are verified.
- [ ] Backups and a restore drill succeed; client ownership and recovery access are documented.
- [ ] Telegram/n8n behavior is proven with test chats before activation for customers.
- [ ] Client printer checks, operating instructions, and staff training are complete.

Build/unit success alone does not establish production readiness. File validation does not prove that workflows are installed, credentialed, active, or successfully delivering messages.
