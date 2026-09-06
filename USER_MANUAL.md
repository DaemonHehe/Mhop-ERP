# MH OP User Manual

## Daily opening

1. Sign in at `/login` and open **Command center**.
2. Review pending payments, unfinished orders, and gadget stock warnings.
3. Check **Leads** for unfinished purchases and **Activity logs** for recent changes.
4. Review the operations-bot briefing if the n8n schedules have been configured and activated.

## Products & Stock

Use the compact **Gadget products** and **PUBG accounts** buttons to switch categories. Search applies only to the selected category. Add or edit a listing's name, SKU, category/subcategory, brand, description, image URL, cost price, retail price, and warranty. The category is fixed when the listing is created. Deleting a listing removes it from new sales while preserving previous order records.

### Gadget products

Maintain stock quantity and the low-stock threshold. Cost price is the purchase cost; retail price is the customer selling price. Serialized physical devices can be assigned to orders by serial or IMEI during packing. The listing search searches product details and SKU; serial/IMEI assignment is an order operation.

### PUBG accounts

The owner buys an account and resells it, using the same cost-price and retail-price model as gadgets. Each listing represents one account. There are no seller-information fields, stock quantities, low-stock alerts, or Account Vault screen.

Use **Sale status** to mark a listing Available, Sold, or Withdrawn. Reserved is managed by the linked order. Checkout accepts only one unit of an available account and reserves it. Cancelling that order releases the account; completing the order marks it sold. An account does not require a serialized unit assignment. Put customer-facing account features in the description; do not put passwords or recovery codes in public catalog fields.

## Orders and payment

Customers create orders through the shop. A Telegram payment-slip photo must include the order code in its caption, for example `MHOP-260829-A1B2`. Staff must compare the slip with the payment provider's actual transaction before approving it. A photo alone is not proof of settlement.

In **Orders**, select an order and review its payment evidence. Approval moves the order into packing. While packing a physical order, assign its serial or IMEI if applicable, then mark it packed. Physical dispatch uses the courier/tracking controls. For PUBG-only orders, use the digital handover controls; no courier or shipping fee is required. Mark delivered after confirming completion. Do not assume that changing order status automatically sends a customer tracking message.

## Leads & recovery

Leads are identified customers who made a Telegram catalog/sales inquiry without a subsequent order, or who started an order without finishing payment. Paid, cancelled, and payment-slip-review orders are excluded from the unpaid queue. An order after a Telegram inquiry supersedes that browsing entry. Existing customers can appear again when they start another unfinished purchase.

New private-chat catalog and sales activity is tracked through the customer Telegram bot. Anonymous shop visitors cannot be contacted, and opening the shop does not automatically link a Telegram identity to a checkout.

Use **Send Telegram reminder** on a reachable lead. The app rechecks eligibility and sends through the configured customer sales bot. The customer must have started and not blocked the bot. Customers without a linked Telegram ID have no reminder action. There is no Add lead, Convert, or manual sales-stage pipeline on this page.

The app limits repeated sends to the same chat for one minute per running application process. A successful send is reported in the page and an audit write is attempted. If delivery is uncertain, inspect the chat before retrying. This is not a persistent cross-server contact history or opt-out system.

## Customers, staff, alerts, and logs

**Customers** shows customer records and purchase history. Administrators use **Staff & access** to manage staff roles, passwords, and active status. The final active administrator and the currently signed-in administrator are protected from accidental deactivation. Use the bell for staff alerts. **Activity logs** supports searching and filtering; records are grouped into Monday–Sunday Bangkok calendar weeks, without weekly deletion.

## Receipts and warranty

In **Thermal receipt studio**, choose an order and 58mm or 80mm paper. Check item prices, payment status, serial/IMEI where applicable, and warranty details. In the printer dialog use the matching roll width, 100% scale, and no margins; verify the output on the client's printer.

Use **Warranty & RMA** to record and resolve claims against the original order. Supply the original order code, purchase phone, and the requested identifying details. Review the store policy and evidence before deciding a resolution. PUBG replacements are handled as individual account cases, not gadget stock replacements. Public warranty lookup uses `/warranty`.

## Bundle Sets and ERP

Use **Bundle Sets** for gadget combinations with quantities and a discounted price. Availability comes from the underlying gadget stock; historical orders retain their bundle snapshot. Keep individual PUBG resale accounts outside quantity-based bundle workflows.

In **ERP & Finance**, create suppliers and gadget purchase orders. Confirm physical receipt before selecting **Receive**; receiving updates gadget stock and purchase cost. Record a purchased PUBG account directly as a listing in Products & Stock with its cost price. Record operating expenses separately. Review verified sales, costs, and profit reports against actual payments; the application does not transfer money or pay suppliers.

## AI Creative Studio

Choose a physical gadget with a catalog image, complete the campaign fields, and copy the prompt. Open the reference image and attach it in your preferred image-generation tool. The studio itself does not call an image API, upload files, or generate images. PUBG accounts are excluded from this physical-product tool. Bot Studio has been removed; the customer sales bot still operates independently.

## Telegram and n8n

The application owns incoming customer-bot updates. It handles catalog/shop commands, support, payment photos, and sales questions. AI replies require configured provider credentials; otherwise catalog-based fallback replies remain available. Voice messages currently receive a request to send text; there is no transcription workflow.

The n8n master workflow has four branches: lead recovery, critical staff-event alerts, 09:00/22:00 Asia/Yangon staff digests, and a daily accessory follow-up scan for qualifying older purchases. These run only after credentials, URLs, schedules, and activation have been tested.

Lead recovery scans every 15 minutes and selects linked Telegram customers inactive for at least 15 minutes. It uses the same queue as Leads, deduplicates attempts by lead ID within retained workflow history, and calls the app to recheck eligibility and send the reminder. The app uses its customer bot token; n8n does not send this reminder directly. Changed activity or purchase status causes a skip. An HTTP or Telegram failure needs staff review; automatic reminder-send retries are disabled. Manual reminders and n8n do not share persistent deduplication history.

If messages stop, check application logs, Telegram credentials/webhook, n8n failed executions, internal API authentication, and configured URLs. See README for deployment steps and USER_TESTING for the release checklist.
