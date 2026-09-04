# MH OP User Manual

## Daily opening

1. Open **Command center** and check unfulfilled orders, pending payment slips, and low-stock items.
2. Compare the 09:00 Telegram briefing with dashboard totals.
3. Resolve critical stock warnings before promoting affected products.

## Products & Stock and serialized devices

Use **Products & Stock** to search by product, SKU, serial, or IMEI. High-value devices should have one `device_units` record per physical unit. Valid lifecycle states are `in_stock`, `reserved`, `sold`, `rma_under_repair`, and `written_off`. Quantity-only accessories use the variant stock quantity and low-stock threshold.

Use **Catalog & stock** to create or edit gadget and PUBG listings. Deleting a listing removes it from the storefront, checkout, bot catalog, and dashboards while preserving historical orders. Use **Account vault** for individual PUBG account references. Available account records are the source of truth for PUBG stock: creating, changing availability, or deleting a record adjusts the published quantity automatically. Never store passwords or recovery codes in the account reference fields.

## Orders and payment slips

Open an order and inspect the uploaded slip. Match merchant, transaction ID, time, and exact total against the payment provider before selecting **Approve**. Reject illegible, duplicate, or mismatched slips and record the reason. Approval is not proof of settlement unless reconciled with the provider account.

For packing, enter the physical device IMEI/serial into **Assign serial / IMEI**, verify the on-screen model matches the box, then mark the order as packing. A serial can only be assigned while its state is `in_stock`.

## Dispatch

Add the carrier and tracking number, confirm the customer address, then mark dispatched. The customer notification should include the tracking link and dispatch time. Mark delivered only from confirmed carrier status or staff verification.

## Receipts

Select an order, then choose 80mm or 58mm in **Thermal receipt studio**. The receipt reads the order's actual items, bundle names, prices, payment state, IMEI/serial, and warranty period. Use the browser print dialog with margins disabled, scale 100%, and the matching roll width.

## Warranty and RMA

Create a claim using the original order code, purchase phone, and device serial or IMEI. The system refuses mismatched claims and takes the customer name from the verified order. Move claims through Claim Received → Inspection → Repaired/Replaced → Dispatched. Inspection synchronizes the device lifecycle to `rma_under_repair`; dispatch restores it to `sold` and the new claim appears in Staff Alerts.

## Leads, staff, and alerts

Use **Leads & recovery** to move abandoned-cart leads through New, Contacted, Reserved, Converted, or Lost. Updates are written to the audit trail. Use **Staff & access** as an administrator to create accounts, assign Staff or Administrator roles, reset passwords, activate access, or deactivate access while preserving history. The final active administrator and the currently signed-in administrator are protected from accidental deactivation. Open the bell icon for payment, order, stock, and warranty events, then mark individual alerts or the full inbox as read.

## Customer shop

The public catalog supports department and subcategory filters, search, comparison, bundles, and checkout.

## Bundle Sets

Use **Bundle Sets** to combine two or more active SKUs, set quantities, and publish a discounted selling price. Combined retail value, customer savings, and maximum available sets are calculated automatically. Checkout locks and consumes every underlying SKU in one transaction, distributes the discount exactly across stored order units, and saves a bundle snapshot so later catalog edits do not rewrite order history. Archiving removes a set from new sales without affecting previous orders.

## ERP and finance

Create suppliers before raising purchase orders. A purchase order does not alter available stock. After the delivered quantity is physically checked, select **Receive**; the purchase status, latest unit cost, and gadget stock are then updated in one transaction. Cancelled or already received purchases cannot be received again. Add individual purchased PUBG accounts through **Account vault** instead, so every account has its own internal reference and lifecycle.

Record operating costs under **Expenses**. Verified sales, gross profit, expenses, net profit, inventory asset value, and open purchases recalculate from the shared ledger. Administrator access is required to delete suppliers or expenses.

## AI Creative Studio

Select a live physical gaming gadget from **Products & Stock**. AI Studio automatically displays the same catalog image used by that stock listing; there is no separate upload or duplicate product record. PUBG accounts are deliberately excluded because they are digital inventory and do not have a physical product image to transform. If the listing has no genuine image, add its HTTPS image in Products & Stock first. Choose a campaign and a curated commercial shortcut. Available shortcuts are limited to useful photoshoot, camera, lighting, advertising, editorial, packaging, branding-mockup, and photorealistic-render directions. Complete the channel, crop, audience, headline, offer, CTA, typography workflow, and optional art direction.

Open the displayed catalog image and attach it directly in ChatGPT Images or another image tool, then select **Copy prompt** and paste the prompt. The generated instructions treat the photo as an immutable source of truth: the environment, lighting, mood, and layout may change, but the product shape, component count, materials, colors, cables, controls, and genuine printed logo must remain accurate. The studio uses no API and never generates, stores, or uploads the image itself.

## Automations

The customer bot handles catalog, warranty, support, payment photo acknowledgements, and free-form sales questions. Customers can describe a device, use case, or budget in Burmese or English. The sales agent searches the live public catalog and bundles, explains store policies, remembers only the latest bounded conversation context, and creates an unread Staff Alert when a person is needed. It cannot place orders, approve payments, expose exact stock or internal costs, reveal PUBG credentials, or approve refunds and warranty claims. Those actions remain staff-controlled.

A payment-slip photo caption must include its order code, for example `MHOP-260829-A1B2`, so the slip can be attached to the correct order. Set a real `OPENAI_API_KEY` to activate model-generated replies; the bot continues with safe catalog matching if that key is absent or the model provider times out. The operations bot sends event cards and scheduled digests. If messages stop, check Telegram credentials, the Telegram webhook, OpenAI credentials, n8n execution history, webhook signature configuration, and the app health endpoint in that order.

The n8n automation has four independent branches: one-time cart recovery reminders, authenticated critical-event alerts, 09:00/22:00 staff digests, and deduplicated 21–30 day cross-sell offers. The application—not n8n—owns incoming customer Telegram updates. In n8n, failed executions are retained while successful production payloads are not, reducing unnecessary storage of customer data. The separate error-handler workflow sends a payload-minimized failure alert to the operations group. After importing a new workflow version, reconnect all four named credentials, test each branch manually with staging data, verify the production event webhook URL, and only then publish it.
