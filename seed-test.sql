-- MH OP full-system test dataset
-- TEST DATABASES ONLY. Run after init.sql.
-- The fixed TEST records are upserted so this file can be run again without
-- duplicating its own data. It does not delete unrelated records.

BEGIN;

-- Login accounts. Both use the test password: adminadminadmin
INSERT INTO admin_users (id, name, email, role, password_hash, is_active) VALUES
('b1000000-0000-4000-8000-000000000001', 'MH OP Administrator', 'admin@gmail.com', 'admin', '$2b$12$Tq.wAT2fu2Ja6007OSotN.6/Ia5fXMGT11pkFLUaPlSTa13TOSogm', true),
('b1000000-0000-4000-8000-000000000002', 'Test Sales Staff', 'staff@mhop.test', 'staff', '$2b$12$Tq.wAT2fu2Ja6007OSotN.6/Ia5fXMGT11pkFLUaPlSTa13TOSogm', true),
('b1000000-0000-4000-8000-000000000003', 'Inactive Test Staff', 'inactive@mhop.test', 'staff', '$2b$12$Tq.wAT2fu2Ja6007OSotN.6/Ia5fXMGT11pkFLUaPlSTa13TOSogm', false)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active;

-- Physical gadgets and digital PUBG account listings.
INSERT INTO products (id, name, brand, category, subcategory, description, image_url, base_cost, is_active) VALUES
('a1000000-0000-4000-8000-000000000001', 'HyperX Cloud Earbuds II', 'HyperX', 'Gaming Gadgets', 'Gaming Earbuds', 'Wired mobile gaming earbuds with low-profile 90-degree connector.', NULL, 125000, true),
('a1000000-0000-4000-8000-000000000002', 'MEMO DL05 Phone Cooler', 'MEMO', 'Gaming Gadgets', 'Cooling Fans', 'Magnetic RGB semiconductor phone cooler.', NULL, 42000, true),
('a1000000-0000-4000-8000-000000000003', 'GameSir G8 Galileo', 'GameSir', 'Gaming Gadgets', 'Controllers', 'USB-C mobile controller with Hall Effect sticks.', NULL, 174000, true),
('a1000000-0000-4000-8000-000000000004', 'Anker Prime 100W GaN Charger', 'Anker', 'Gaming Gadgets', 'Charging Gear', 'Three-port GaN charger for mobile gaming setups.', NULL, 218000, true),
('a1000000-0000-4000-8000-000000000005', 'PUBG Mobile Starter Account', 'PUBG Mobile', 'PUBG Accounts', 'Starter Accounts', 'Test digital account listing with secure rebind handover.', NULL, 70000, true),
('a1000000-0000-4000-8000-000000000006', 'PUBG Competitive Account', 'PUBG Mobile', 'PUBG Accounts', 'Competitive Accounts', 'Test competitive account listing.', NULL, 490000, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, brand = EXCLUDED.brand, category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory, description = EXCLUDED.description,
  image_url = EXCLUDED.image_url, base_cost = EXCLUDED.base_cost, is_active = true;

INSERT INTO product_variants (id, product_id, sku, color, storage, ram, condition, price, cost_price, warranty_months, stock_quantity, low_stock_threshold, is_active) VALUES
('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'TEST-HYPERX-EB2', 'Black', NULL, NULL, 'Brand New Sealed', 175000, 125000, 12, 9, 3, true),
('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'TEST-MEMO-DL05', 'Black', NULL, NULL, 'Brand New Sealed', 65000, 42000, 6, 2, 3, true),
('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'TEST-GAMESIR-G8', 'Silver', NULL, NULL, 'Brand New Sealed', 225000, 174000, 12, 5, 2, true),
('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 'TEST-ANKER-100W', 'Black', NULL, NULL, 'Brand New Sealed', 329000, 218000, 18, 0, 3, true),
('a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 'TEST-PUBG-STARTER', 'Global', NULL, NULL, 'Verified Digital Account', 95000, 70000, 1, 2, 1, true),
('a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000006', 'TEST-PUBG-COMP', 'Global', NULL, NULL, 'Verified Digital Account', 650000, 490000, 1, 1, 1, true)
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id, sku = EXCLUDED.sku, color = EXCLUDED.color,
  condition = EXCLUDED.condition, price = EXCLUDED.price, cost_price = EXCLUDED.cost_price,
  warranty_months = EXCLUDED.warranty_months, stock_quantity = EXCLUDED.stock_quantity,
  low_stock_threshold = EXCLUDED.low_stock_threshold, is_active = true;

-- Account Vault records plus physical serials for assignment/RMA testing.
INSERT INTO device_units (id, variant_id, serial_number, imei_number, login_provider, rebind_status, status, received_at, sold_at) VALUES
('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'TEST-HX-AVAILABLE-001', NULL, NULL, NULL, 'in_stock', now() - interval '30 days', NULL),
('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'TEST-HX-SOLD-001', NULL, NULL, NULL, 'sold', now() - interval '60 days', now() - interval '20 days'),
('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000005', 'TEST-PUBG-STARTER-001', NULL, 'Email', 'ready', 'in_stock', now() - interval '10 days', NULL),
('a3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000005', 'TEST-PUBG-STARTER-002', NULL, 'Facebook', 'ready', 'in_stock', now() - interval '9 days', NULL),
('a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000006', 'TEST-PUBG-COMP-001', NULL, 'Email', 'ready', 'in_stock', now() - interval '8 days', NULL),
('a3000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000006', 'TEST-PUBG-COMP-RESERVED', NULL, 'Email', 'handover_pending', 'reserved', now() - interval '20 days', NULL),
('a3000000-0000-4000-8000-000000000007', 'a2000000-0000-4000-8000-000000000006', 'TEST-PUBG-COMP-SOLD', NULL, 'Email', 'completed', 'sold', now() - interval '40 days', now() - interval '15 days')
ON CONFLICT (id) DO UPDATE SET
  variant_id = EXCLUDED.variant_id, serial_number = EXCLUDED.serial_number,
  imei_number = EXCLUDED.imei_number, login_provider = EXCLUDED.login_provider,
  rebind_status = EXCLUDED.rebind_status, status = EXCLUDED.status,
  received_at = EXCLUDED.received_at, sold_at = EXCLUDED.sold_at;

-- Persisted customer profiles. Telegram IDs are stored on the customer master.
INSERT INTO customers (id, name, phone, telegram_user_id, primary_address, notes, is_active, created_at, updated_at) VALUES
('b4000000-0000-4000-8000-000000000001', 'Aung Min Test', '09770000001', 'tg-test-001', 'Kamayut, Yangon', 'Pending-payment test customer.', true, now() - interval '30 days', now()),
('b4000000-0000-4000-8000-000000000002', 'Mya Mya Test', '09770000002', 'tg-test-002', 'Mawlamyine', NULL, true, now() - interval '25 days', now()),
('b4000000-0000-4000-8000-000000000003', 'Ko Zaw Test', '09770000003', NULL, 'Sanchaung, Yangon', NULL, true, now() - interval '20 days', now()),
('b4000000-0000-4000-8000-000000000004', 'May Thu Test', '09770000004', NULL, 'Bago', NULL, true, now() - interval '18 days', now()),
('b4000000-0000-4000-8000-000000000005', 'Aye Chan Test', '09770000005', NULL, 'Hlaing, Yangon', 'Serialized warranty test customer.', true, now() - interval '60 days', now()),
('b4000000-0000-4000-8000-000000000006', 'PUBG Buyer Test', '09770000006', 'tg-test-006', NULL, 'Digital-delivery test customer.', true, now() - interval '45 days', now()),
('b4000000-0000-4000-8000-000000000007', 'Rejected Payment Test', '09770000007', NULL, 'Insein, Yangon', NULL, true, now() - interval '10 days', now()),
('b4000000-0000-4000-8000-000000000008', 'Bundle Customer Test', '09770000008', NULL, 'Tamwe, Yangon', NULL, true, now() - interval '35 days', now())
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name, telegram_user_id = EXCLUDED.telegram_user_id,
  primary_address = EXCLUDED.primary_address, notes = EXCLUDED.notes,
  is_active = true, updated_at = now();

-- Orders cover payment and fulfillment states. Digital orders always have zero delivery fee.
INSERT INTO orders (id, customer_id, order_code, telegram_user_id, customer_name, phone, shipping_address, shipping_zone, shipping_fee, shipping_carrier, payment_method, total_amount, payment_status, fulfillment_status, payment_slip_url, tracking_number, delivered_at, created_at) VALUES
('a4000000-0000-4000-8000-000000000001', (SELECT id FROM customers WHERE phone='09770000001'), 'MHOP-260830-T001', 'tg-test-001', 'Aung Min Test', '09770000001', 'Kamayut, Yangon', 'yangonInner', 0, 'Royal Express', 'kbzpay', 175000, 'pending', 'new', 'telegram-file:TEST-SLIP-001', NULL, NULL, now() - interval '1 hour'),
('a4000000-0000-4000-8000-000000000002', (SELECT id FROM customers WHERE phone='09770000002'), 'MHOP-260830-T002', 'tg-test-002', 'Mya Mya Test', '09770000002', 'Mawlamyine', 'otherCities', 5000, 'Royal Express', 'wavepay', 70000, 'verified', 'confirmed', 'telegram-file:TEST-SLIP-002', NULL, NULL, now() - interval '4 hours'),
('a4000000-0000-4000-8000-000000000003', (SELECT id FROM customers WHERE phone='09770000003'), 'MHOP-260830-T003', NULL, 'Ko Zaw Test', '09770000003', 'Sanchaung, Yangon', 'yangonInner', 0, 'Royal Express', 'bank', 225000, 'verified', 'packing', NULL, NULL, NULL, now() - interval '1 day'),
('a4000000-0000-4000-8000-000000000004', (SELECT id FROM customers WHERE phone='09770000004'), 'MHOP-260830-T004', NULL, 'May Thu Test', '09770000004', 'Bago', 'otherCities', 0, 'Royal Express', 'kbzpay', 329000, 'verified', 'dispatched', NULL, 'REX-TEST-0004', NULL, now() - interval '2 days'),
('a4000000-0000-4000-8000-000000000005', (SELECT id FROM customers WHERE phone='09770000005'), 'MHOP-260830-T005', NULL, 'Aye Chan Test', '09770000005', 'Hlaing, Yangon', 'yangonInner', 0, 'Royal Express', 'kbzpay', 175000, 'verified', 'delivered', NULL, 'REX-TEST-0005', now() - interval '20 days', now() - interval '22 days'),
('a4000000-0000-4000-8000-000000000006', (SELECT id FROM customers WHERE phone='09770000006'), 'MHOP-260830-T006', 'tg-test-006', 'PUBG Buyer Test', '09770000006', 'Secure digital handover', NULL, 0, 'Digital handover', 'wavepay', 650000, 'verified', 'delivered', NULL, NULL, now() - interval '15 days', now() - interval '16 days'),
('a4000000-0000-4000-8000-000000000007', (SELECT id FROM customers WHERE phone='09770000007'), 'MHOP-260830-T007', NULL, 'Rejected Payment Test', '09770000007', 'Insein, Yangon', 'yangonOuter', 0, 'Royal Express', 'kbzpay', 175000, 'rejected', 'new', 'telegram-file:TEST-SLIP-007', NULL, NULL, now() - interval '3 days'),
('a4000000-0000-4000-8000-000000000008', (SELECT id FROM customers WHERE phone='09770000008'), 'MHOP-260830-T008', NULL, 'Bundle Customer Test', '09770000008', 'Tamwe, Yangon', 'yangonInner', 0, 'Royal Express', 'bank', 265000, 'verified', 'delivered', NULL, 'REX-TEST-0008', now() - interval '8 days', now() - interval '10 days')
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id, order_code = EXCLUDED.order_code, telegram_user_id = EXCLUDED.telegram_user_id,
  customer_name = EXCLUDED.customer_name, phone = EXCLUDED.phone,
  shipping_address = EXCLUDED.shipping_address, shipping_zone = EXCLUDED.shipping_zone,
  shipping_fee = EXCLUDED.shipping_fee, shipping_carrier = EXCLUDED.shipping_carrier,
  payment_method = EXCLUDED.payment_method, total_amount = EXCLUDED.total_amount,
  payment_status = EXCLUDED.payment_status, fulfillment_status = EXCLUDED.fulfillment_status,
  payment_slip_url = EXCLUDED.payment_slip_url, tracking_number = EXCLUDED.tracking_number,
  delivered_at = EXCLUDED.delivered_at, created_at = EXCLUDED.created_at;

INSERT INTO order_items (id, order_id, product_id, variant_id, device_unit_id, unit_price, cost_snapshot, quantity) VALUES
('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', NULL, 175000, 125000, 1),
('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', NULL, 65000, 42000, 1),
('a5000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', NULL, 225000, 174000, 1),
('a5000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000004', NULL, 329000, 218000, 1),
('a5000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 175000, 125000, 1),
('a5000000-0000-4000-8000-000000000006', 'a4000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000007', 650000, 490000, 1),
('a5000000-0000-4000-8000-000000000007', 'a4000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', NULL, 175000, 125000, 1),
('a5000000-0000-4000-8000-000000000008', 'a4000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', NULL, 55000, 42000, 1),
('a5000000-0000-4000-8000-000000000009', 'a4000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', NULL, 210000, 174000, 1)
ON CONFLICT (id) DO UPDATE SET
  order_id = EXCLUDED.order_id, product_id = EXCLUDED.product_id,
  variant_id = EXCLUDED.variant_id, device_unit_id = EXCLUDED.device_unit_id,
  unit_price = EXCLUDED.unit_price, cost_snapshot = EXCLUDED.cost_snapshot,
  quantity = EXCLUDED.quantity;

-- Bundle CRUD and a captured bundle snapshot on a delivered receipt.
INSERT INTO bundles (id, name, description, bundle_price, savings_amount, items_json, is_active) VALUES
('a6000000-0000-4000-8000-000000000001', 'Test Mobile Pro Set', 'Controller and cooler test bundle.', 265000, 25000, '[{"sku":"TEST-MEMO-DL05","quantity":1},{"sku":"TEST-GAMESIR-G8","quantity":1}]', true),
('a6000000-0000-4000-8000-000000000002', 'Test Stream Starter Set', 'Earbuds and cooler test bundle.', 220000, 20000, '[{"sku":"TEST-HYPERX-EB2","quantity":1},{"sku":"TEST-MEMO-DL05","quantity":1}]', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  bundle_price = EXCLUDED.bundle_price, savings_amount = EXCLUDED.savings_amount,
  items_json = EXCLUDED.items_json, is_active = true;

INSERT INTO order_bundle_sets (id, order_id, bundle_id, bundle_name, bundle_price, items_json) VALUES
('a7000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000008', 'a6000000-0000-4000-8000-000000000001', 'Test Mobile Pro Set', 265000, '[{"sku":"TEST-MEMO-DL05","quantity":1},{"sku":"TEST-GAMESIR-G8","quantity":1}]')
ON CONFLICT (id) DO UPDATE SET
  order_id = EXCLUDED.order_id, bundle_id = EXCLUDED.bundle_id,
  bundle_name = EXCLUDED.bundle_name, bundle_price = EXCLUDED.bundle_price,
  items_json = EXCLUDED.items_json;

-- Warranty/RMA cards in each actionable workflow column.
INSERT INTO tickets (id, ticket_code, order_code, order_item_id, serial_number, customer_name, phone, category, priority, status, message_text, warranty_start_at, warranty_expires_at, resolution, resolution_cost, refund_amount, replacement_variant_id, resolved_at) VALUES
('a8000000-0000-4000-8000-000000000001', 'RMA-TEST-001', 'MHOP-260830-T005', 'a5000000-0000-4000-8000-000000000005', 'TEST-HX-SOLD-001', 'Aye Chan Test', '09770000005', 'audio', 'high', 'claim_received', 'Right earbud has intermittent audio.', now() - interval '20 days', now() + interval '11 months', NULL, 0, 0, NULL, NULL),
('a8000000-0000-4000-8000-000000000002', 'RMA-TEST-002', 'MHOP-260830-T008', 'a5000000-0000-4000-8000-000000000008', NULL, 'Bundle Customer Test', '09770000008', 'cooling', 'normal', 'inspection', 'Cooler is not reaching expected temperature.', now() - interval '8 days', now() + interval '5 months', NULL, 0, 0, NULL, NULL),
('a8000000-0000-4000-8000-000000000003', 'RMA-TEST-003', 'MHOP-260830-T008', 'a5000000-0000-4000-8000-000000000009', NULL, 'Bundle Customer Test', '09770000008', 'controls', 'normal', 'repaired', 'Trigger calibration repaired and ready to return.', now() - interval '8 days', now() + interval '11 months', 'repair', 12000, 0, NULL, now() - interval '1 day'),
('a8000000-0000-4000-8000-000000000004', 'RMA-TEST-004', 'MHOP-260830-T006', 'a5000000-0000-4000-8000-000000000006', 'TEST-PUBG-COMP-SOLD', 'PUBG Buyer Test', '09770000006', 'handover', 'low', 'refunded', 'Digital handover test refund completed.', now() - interval '15 days', now() + interval '15 days', 'refund', 0, 650000, NULL, now() - interval '2 days')
ON CONFLICT (id) DO UPDATE SET
  ticket_code = EXCLUDED.ticket_code, order_code = EXCLUDED.order_code,
  order_item_id = EXCLUDED.order_item_id, serial_number = EXCLUDED.serial_number,
  customer_name = EXCLUDED.customer_name, phone = EXCLUDED.phone,
  category = EXCLUDED.category, priority = EXCLUDED.priority, status = EXCLUDED.status,
  message_text = EXCLUDED.message_text, warranty_start_at = EXCLUDED.warranty_start_at,
  warranty_expires_at = EXCLUDED.warranty_expires_at, resolution = EXCLUDED.resolution,
  resolution_cost = EXCLUDED.resolution_cost, refund_amount = EXCLUDED.refund_amount,
  replacement_variant_id = EXCLUDED.replacement_variant_id, resolved_at = EXCLUDED.resolved_at;

-- Lead stages for CRM testing.
INSERT INTO leads (id, customer_name, phone, telegram_user_id, cart_items_json, stage, reserve_expires_at) VALUES
('a9000000-0000-4000-8000-000000000001', 'New Lead Test', '09771110001', 'tg-lead-001', '[{"name":"HyperX Cloud Earbuds II","sku":"TEST-HYPERX-EB2"}]', 'new', now() + interval '15 minutes'),
('a9000000-0000-4000-8000-000000000002', 'Contacted Lead Test', '09771110002', 'tg-lead-002', '[{"name":"MEMO DL05 Phone Cooler","sku":"TEST-MEMO-DL05"}]', 'contacted', now() + interval '1 day'),
('a9000000-0000-4000-8000-000000000003', 'Reserved Lead Test', '09771110003', 'tg-lead-003', '[{"name":"PUBG Mobile Starter Account","sku":"TEST-PUBG-STARTER"}]', 'reserved', now() + interval '2 hours'),
('a9000000-0000-4000-8000-000000000004', 'Converted Lead Test', '09771110004', NULL, '[]', 'converted', NULL),
('a9000000-0000-4000-8000-000000000005', 'Lost Lead Test', '09771110005', NULL, '[]', 'lost', NULL)
ON CONFLICT (id) DO UPDATE SET
  customer_name = EXCLUDED.customer_name, phone = EXCLUDED.phone,
  telegram_user_id = EXCLUDED.telegram_user_id, cart_items_json = EXCLUDED.cart_items_json,
  stage = EXCLUDED.stage, reserve_expires_at = EXCLUDED.reserve_expires_at;

-- Alerts, audit log and bot sessions.
INSERT INTO staff_alerts (id, type, title, body, target_code, is_read, created_at) VALUES
('aa000000-0000-4000-8000-000000000001', 'payment.slip_uploaded', 'Test payment slip received', 'Review the pending test payment.', 'MHOP-260830-T001', false, now() - interval '30 minutes'),
('aa000000-0000-4000-8000-000000000002', 'inventory.low_stock', 'Test low stock warning', 'MEMO DL05 has reached its low-stock threshold.', 'TEST-MEMO-DL05', false, now() - interval '2 hours'),
('aa000000-0000-4000-8000-000000000003', 'warranty.claim_created', 'Test warranty claim', 'A warranty claim is waiting for inspection.', 'RMA-TEST-001', true, now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type, title = EXCLUDED.title, body = EXCLUDED.body,
  target_code = EXCLUDED.target_code, is_read = EXCLUDED.is_read,
  created_at = EXCLUDED.created_at;

INSERT INTO system_audit_logs (id, event, actor, target_code, details, created_at) VALUES
('ab000000-0000-4000-8000-000000000001', 'test.seeded', 'system', 'TEST-DATA', 'Full feature test dataset installed.', now()),
('ab000000-0000-4000-8000-000000000002', 'payment.slip_uploaded', 'telegram', 'MHOP-260830-T001', 'Test payment evidence received.', now() - interval '30 minutes'),
('ab000000-0000-4000-8000-000000000003', 'inventory.low_stock', 'system', 'TEST-MEMO-DL05', 'Test low-stock event generated.', now() - interval '2 hours')
ON CONFLICT (id) DO UPDATE SET
  event = EXCLUDED.event, actor = EXCLUDED.actor, target_code = EXCLUDED.target_code,
  details = EXCLUDED.details, created_at = EXCLUDED.created_at;

INSERT INTO bot_sessions (id, telegram_user_id, language, state_json, updated_at) VALUES
('ac000000-0000-4000-8000-000000000001', 'tg-test-001', 'my', '{"step":"awaiting_payment_review","orderCode":"MHOP-260830-T001"}', now()),
('ac000000-0000-4000-8000-000000000002', 'tg-lead-003', 'my', '{"step":"reserved_cart","sku":"TEST-PUBG-STARTER"}', now() - interval '1 hour')
ON CONFLICT (telegram_user_id) DO UPDATE SET
  language = EXCLUDED.language, state_json = EXCLUDED.state_json,
  updated_at = EXCLUDED.updated_at;

-- ERP suppliers, actionable purchase orders and editable expenses.
INSERT INTO suppliers (id, name, phone, email, address, notes, is_active, created_at) VALUES
('ad000000-0000-4000-8000-000000000001', 'Test Official Gadget Distributor', '09772220001', 'sales@supplier.test', 'Yangon', 'Has open test purchase orders.', true, now() - interval '30 days'),
('ad000000-0000-4000-8000-000000000002', 'Test Backup Supplier', '09772220002', 'backup@supplier.test', 'Mandalay', 'No open order; can be edited or archived.', true, now() - interval '20 days')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
  address = EXCLUDED.address, notes = EXCLUDED.notes, is_active = true;

INSERT INTO purchase_orders (id, po_code, supplier_id, status, total_cost, notes, created_at, received_at) VALUES
('ae000000-0000-4000-8000-000000000001', 'PO-TEST-RECEIVE', 'ad000000-0000-4000-8000-000000000001', 'ordered', 420000, 'Use Receive to test atomic stock and cost updates.', now() - interval '2 days', NULL),
('ae000000-0000-4000-8000-000000000002', 'PO-TEST-CANCEL', 'ad000000-0000-4000-8000-000000000001', 'ordered', 250000, 'Use Cancel to test purchase cancellation.', now() - interval '1 day', NULL),
('ae000000-0000-4000-8000-000000000003', 'PO-TEST-RECEIVED', 'ad000000-0000-4000-8000-000000000002', 'received', 174000, 'Completed purchase-order example.', now() - interval '10 days', now() - interval '8 days')
ON CONFLICT (id) DO UPDATE SET
  po_code = EXCLUDED.po_code, supplier_id = EXCLUDED.supplier_id,
  status = EXCLUDED.status, total_cost = EXCLUDED.total_cost,
  notes = EXCLUDED.notes, created_at = EXCLUDED.created_at,
  received_at = EXCLUDED.received_at;

INSERT INTO purchase_items (id, purchase_order_id, variant_id, quantity, unit_cost) VALUES
('af000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 10, 42000),
('af000000-0000-4000-8000-000000000002', 'ae000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 2, 125000),
('af000000-0000-4000-8000-000000000003', 'ae000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1, 174000)
ON CONFLICT (id) DO UPDATE SET
  purchase_order_id = EXCLUDED.purchase_order_id, variant_id = EXCLUDED.variant_id,
  quantity = EXCLUDED.quantity, unit_cost = EXCLUDED.unit_cost;

INSERT INTO expenses (id, expense_code, category, description, amount, payment_method, expense_date, created_at) VALUES
('b2000000-0000-4000-8000-000000000001', 'EXP-TEST-MARKETING', 'Marketing', 'Test social media campaign', 250000, 'KBZPay', current_date - 2, now() - interval '2 days'),
('b2000000-0000-4000-8000-000000000002', 'EXP-TEST-DELIVERY', 'Delivery', 'Test Royal Express courier payment', 45000, 'Cash', current_date - 1, now() - interval '1 day'),
('b2000000-0000-4000-8000-000000000003', 'EXP-TEST-SOFTWARE', 'Software', 'Test monthly software expense', 60000, 'Bank Transfer', current_date, now())
ON CONFLICT (id) DO UPDATE SET
  expense_code = EXCLUDED.expense_code, category = EXCLUDED.category,
  description = EXCLUDED.description, amount = EXCLUDED.amount,
  payment_method = EXCLUDED.payment_method, expense_date = EXCLUDED.expense_date;

INSERT INTO receipt_settings (id, shop_name, address, phone, header_message, footer_message, paper_size, show_barcode, show_qr) VALUES
('b3000000-0000-4000-8000-000000000001', 'Mh OP Gadget Store', 'Yangon, Myanmar', '09798888123', '100% Authentic and Official Store Direct Products', 'ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။', 80, true, true)
ON CONFLICT (id) DO UPDATE SET
  shop_name = EXCLUDED.shop_name, address = EXCLUDED.address,
  phone = EXCLUDED.phone, header_message = EXCLUDED.header_message,
  footer_message = EXCLUDED.footer_message, paper_size = EXCLUDED.paper_size,
  show_barcode = true, show_qr = true;

COMMIT;

-- Quick verification summary.
SELECT 'products' AS dataset, count(*) AS rows FROM products WHERE id::text LIKE 'a1%'
UNION ALL SELECT 'customers', count(*) FROM customers WHERE phone LIKE '097700000%'
UNION ALL SELECT 'orders', count(*) FROM orders WHERE order_code LIKE 'MHOP-260830-T%'
UNION ALL SELECT 'tickets', count(*) FROM tickets WHERE ticket_code LIKE 'RMA-TEST-%'
UNION ALL SELECT 'leads', count(*) FROM leads WHERE id::text LIKE 'a9%'
UNION ALL SELECT 'purchase_orders', count(*) FROM purchase_orders WHERE po_code LIKE 'PO-TEST-%'
UNION ALL SELECT 'expenses', count(*) FROM expenses WHERE expense_code LIKE 'EXP-TEST-%';
