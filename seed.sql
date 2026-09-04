INSERT INTO admin_users(name,email,role,password_hash) VALUES
('MH OP Administrator','admin@decantos.com','admin','REPLACE_WITH_A_REAL_BCRYPT_HASH');

INSERT INTO products(id,name,brand,category,subcategory,description,image_url,base_cost) VALUES
('10000000-0000-4000-8000-000000000001','BlackShark V2 X','Razer','Gaming Gadgets','Gaming Headphones','Lightweight esports headset with positional audio',NULL,142000),
('10000000-0000-4000-8000-000000000002','DL05 Phone Cooler','MEMO','Gaming Gadgets','Cooling Fans','Magnetic RGB semiconductor phone cooler',NULL,42000),
('10000000-0000-4000-8000-000000000003','G8 Galileo Controller','GameSir','Gaming Gadgets','Controllers','USB-C mobile controller with Hall Effect sticks',NULL,174000),
('10000000-0000-4000-8000-000000000004','Prime 100W GaN Charger','Anker','Gaming Gadgets','Charging Gear','Three-port GaN charger for mobile gaming setups',NULL,218000),
('10000000-0000-4000-8000-000000000005','CHU II DSP Gaming Earbuds','Moondrop','Gaming Gadgets','Gaming Earbuds','Low-latency USB-C gaming earbuds',NULL,71000),
('10000000-0000-4000-8000-000000000006','PUBG Mobile Starter Account','PUBG Mobile','PUBG Accounts','Starter Accounts','Verified entry-level account with secure rebind handover',NULL,70000),
('10000000-0000-4000-8000-000000000007','PUBG Competitive Account','PUBG Mobile','PUBG Accounts','Competitive Accounts','Verified competitive inventory and secure rebind handover',NULL,490000),
('10000000-0000-4000-8000-000000000008','PUBG Collector Account','PUBG Mobile','PUBG Accounts','Collector Accounts','Verified rare cosmetic collection and secure rebind handover',NULL,1920000);

INSERT INTO product_variants(id,product_id,sku,color,storage,ram,condition,price,cost_price,warranty_months,stock_quantity) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RZR-BSV2X-BLK','Black',NULL,NULL,'Brand New Sealed',189000,142000,6,8),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','MEMO-DL05-RGB','Black',NULL,NULL,'Brand New Sealed',65000,42000,3,18),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','GMS-G8-GALILEO','Silver',NULL,NULL,'Brand New Sealed',225000,174000,6,7),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','ANK-PRIME-100W','Black',NULL,NULL,'Brand New Sealed',329000,218000,18,14),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','MD-CHU2-DSP','Silver',NULL,NULL,'Brand New Sealed',98000,71000,6,11),
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006','PUBG-STARTER-45','Global',NULL,NULL,'Verified Digital Account',95000,70000,1,12),
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007','PUBG-COMP-70','Global',NULL,NULL,'Verified Digital Account',650000,490000,1,4),
('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000008','PUBG-COLLECT-80','Global',NULL,NULL,'Verified Digital Account',2450000,1920000,1,2);

-- Demo account references keep PUBG listing quantities synchronized. Replace these
-- references with the client's real internal IDs; never store passwords here.
INSERT INTO device_units(variant_id,serial_number,login_provider,rebind_status,status)
SELECT '20000000-0000-4000-8000-000000000006', 'PUBG-STARTER-'||lpad(n::text,4,'0'), 'Unassigned', 'ready', 'in_stock' FROM generate_series(1,12) n
UNION ALL SELECT '20000000-0000-4000-8000-000000000007', 'PUBG-COMP-'||lpad(n::text,4,'0'), 'Unassigned', 'ready', 'in_stock' FROM generate_series(1,4) n
UNION ALL SELECT '20000000-0000-4000-8000-000000000008', 'PUBG-COLLECT-'||lpad(n::text,4,'0'), 'Unassigned', 'ready', 'in_stock' FROM generate_series(1,2) n;

INSERT INTO bundles(name,description,bundle_price,savings_amount,items_json) VALUES
('Rank Push Kit','GameSir G8, MEMO DL05 cooler, and Moondrop CHU II DSP earbuds',359000,29000,'[{"sku":"GMS-G8-GALILEO","qty":1},{"sku":"MEMO-DL05-RGB","qty":1},{"sku":"MD-CHU2-DSP","qty":1}]');

INSERT INTO receipt_settings(shop_name,address,phone,header_message,footer_message,paper_size) VALUES
('MH OP',NULL,'09798888123','100% Authentic and Official Store Direct Products','ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ MH OP ကို ယုံကြည်စွာ ရွေးချယ်ပေးသည့်အတွက် ဝမ်းမြောက်ပါတယ်။',80);

INSERT INTO suppliers(name,phone,email,address,notes) VALUES
('Official Gadget Distributor','09700000001','sales@example.invalid','Yangon','Replace with the client''s authorized distributor details before production');

INSERT INTO expenses(expense_code,category,description,amount,payment_method,expense_date) VALUES
('EXP-SEED-0001','Marketing','Opening campaign budget',250000,'KBZPay',now());
