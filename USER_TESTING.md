# MH OP Acceptance Testing

Use a staging database and non-production Telegram bots. Record evidence and tester initials for every result.

Initialize a fresh test database with `init.sql`, then run `seed-test.sql`. The
seed is rerunnable and restores its predefined records to their starting states.
Use `admin@gmail.com` / `adminadminadmin` only in the test environment.

Key actionable records:

- `MHOP-260830-T001`: pending payment with a linked slip for Approve/Reject.
- `MHOP-260830-T002`: verified physical order with a delivery fee.
- `MHOP-260830-T003`: packing order for shipment testing.
- `MHOP-260830-T005`: delivered serialized purchase for warranty lookup/RMA.
- `MHOP-260830-T006`: delivered PUBG account with zero delivery fee.
- `RMA-TEST-001`: claim ready for inspection.
- `RMA-TEST-002`: claim ready for resolution.
- `RMA-TEST-003`: repaired claim ready for dispatch.
- `PO-TEST-RECEIVE` and `PO-TEST-CANCEL`: actionable purchase orders.
- `TEST-HX-AVAILABLE-001`: available serial for assignment testing.

Database-backed UI flows are covered by the mock records. Telegram delivery,
n8n schedules, OpenAI calls, object storage, and physical printing still require
their real external services or hardware.

## Application

- [ ] All documented routes render at desktop and 390px mobile widths.
- [ ] Store search and category filters can be combined and cleared.
- [ ] Comparison accepts up to three devices and shows price, condition, memory, warranty, and specs.
- [ ] Cart count updates when a product is added.

## Inventory and orders

- [ ] Duplicate serial and IMEI values are rejected by PostgreSQL.
- [ ] Two concurrent attempts cannot assign the same device unit.
- [ ] A payment can be approved or rejected and creates an audit/staff event.
- [ ] Packing requires an available device for serialized variants.
- [ ] Low-stock threshold generates exactly one actionable alert per threshold crossing.

## Receipts

- [ ] 80mm output prints at 302px-equivalent width with no clipping.
- [ ] 58mm output prints at 219px-equivalent width with no clipping.
- [ ] Order barcode scans correctly on target printer output.
- [ ] IMEI/serial and warranty expiry match the assigned device and sale date.
- [ ] Return policy and shop tax details are readable.

## Webhook and automation

- [ ] Unsigned and incorrectly signed webhook calls return HTTP 401.
- [ ] Invalid JSON returns HTTP 400; unsupported events return HTTP 422.
- [ ] Each allowed event reaches only its intended Telegram destination.
- [ ] Morning briefing runs at 09:00 Asia/Yangon and nightly digest at 22:00.
- [ ] Cart recovery excludes expired, converted, opted-out, and recently contacted leads.
- [ ] Voice messages in Burmese and English are transcribed with human correction available.

## Security and recovery

- [ ] Staff routes require authentication and enforce role permissions before production launch.
- [ ] Uploaded slips reject executable content and private objects use signed URLs.
- [ ] Logs redact tokens, credentials, and sensitive payment data.
- [ ] Rate limiting covers login, bot, upload, and webhook endpoints.
- [ ] A database restore drill succeeds and serialized inventory reconciles after restore.

## Release gate

Run `npm run typecheck` and `npm run build`. Do not approve production launch until all critical checks above pass against the real database, Telegram bots, n8n instance, object storage, and physical receipt printers.

For a local API contract smoke test, start the application and run `./scripts/api-smoke.ps1` from PowerShell.
