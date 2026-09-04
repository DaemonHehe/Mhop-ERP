ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zone varchar(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method varchar(40);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory varchar(80);
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS login_provider varchar(60);
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS rebind_status varchar(40) DEFAULT 'pending';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE receipt_settings SET
  shop_name='MH OP',
  address=NULL,
  phone='09798888123',
  header_message='100% Authentic and Official Store Direct Products',
  footer_message='ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ MH OP ကို ယုံကြည်စွာ ရွေးချယ်ပေးသည့်အတွက် ဝမ်းမြောက်ပါတယ်။';

INSERT INTO products(id,name,brand,category,subcategory,description,image_url,base_cost) VALUES
('10000000-0000-4000-8000-000000000006','PUBG Mobile Starter Account','PUBG Mobile','PUBG Accounts','Starter Accounts','Verified entry-level account with secure rebind handover',NULL,70000),
('10000000-0000-4000-8000-000000000007','PUBG Competitive Account','PUBG Mobile','PUBG Accounts','Competitive Accounts','Verified competitive inventory and secure rebind handover',NULL,490000),
('10000000-0000-4000-8000-000000000008','PUBG Collector Account','PUBG Mobile','PUBG Accounts','Collector Accounts','Verified rare cosmetic collection and secure rebind handover',NULL,1920000)
ON CONFLICT (id) DO NOTHING;

UPDATE products SET subcategory=CASE category
  WHEN 'Game Accounts' THEN 'Starter Accounts'
  WHEN 'Smartphones' THEN 'Gaming Gadgets'
  WHEN 'Audio' THEN 'Gaming Headphones'
  WHEN 'Charging' THEN 'Charging Gear'
  ELSE coalesce(subcategory,'Gaming Gadgets')
END WHERE subcategory IS NULL;

ALTER TABLE products ALTER COLUMN subcategory SET NOT NULL;

INSERT INTO product_variants(id,product_id,sku,color,condition,price,cost_price,warranty_months,stock_quantity) VALUES
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006','PUBG-STARTER-45','Global','Verified Digital Account',95000,70000,1,12),
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007','PUBG-COMP-70','Global','Verified Digital Account',650000,490000,1,4),
('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000008','PUBG-COLLECT-80','Global','Verified Digital Account',2450000,1920000,1,2)
ON CONFLICT (id) DO NOTHING;
