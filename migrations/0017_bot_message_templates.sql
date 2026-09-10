-- Migration 0017: Bot & Automation Message Templates
-- Stores editable customer communication templates with dynamic placeholder tokens

CREATE TABLE IF NOT EXISTS bot_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(80) NOT NULL UNIQUE,
  label varchar(160) NOT NULL,
  description text,
  trigger_source varchar(80) NOT NULL DEFAULT 'manual',
  content text NOT NULL,
  placeholders jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(120)
);

CREATE INDEX IF NOT EXISTS bot_message_templates_key_idx ON bot_message_templates(key);

-- Insert factory default templates
INSERT INTO bot_message_templates (key, label, description, trigger_source, content, placeholders, updated_by)
VALUES
  (
    'welcome',
    'Telegram Bot Welcome Greeting (/start)',
    'Delivered immediately when a customer opens the Telegram bot or sends /start command.',
    'telegram_bot_start',
    'မင်္ဂလာပါ။ MH OP Store မှ ကြိုဆိုပါတယ်။\n\nMobile Gadgets များနဲ့ PUBG Mobile Account များကို စျေးနှုန်းမှန်ကန်စွာနဲ့ 100% authentic အာမခံဖြင့် ရရှိနိုင်ပါမယ်ခင်ဗျာ။\n\nအောက်ပါ Menu မှတဆင့် စတင်ကြည့်ရှုနိုင်ပါသည်—\n• /catalog — ရရှိနိုင်သော Gadgets များနှင့် Account စျေးနှုန်းများ ကြည့်ရန်\n• /support — Customer Service နှင့် တိုက်ရိုက်ဆက်သွယ်ရန်\n• Payment Slip ပုံပေးပို့၍ အော်ဒါအတည်ပြုရန်',
    '[]'::jsonb,
    'system'
  ),
  (
    'cart_recovery_unpaid',
    'Cart Recovery: Unpaid Order Reminder (15 Min)',
    'Sent automatically to customers who generated an order code but have not submitted a transfer slip after 15 minutes.',
    'n8n_cart_recovery',
    'မင်္ဂလာပါခင်ဗျာ။ MH OP မှ {order_code} အတွက် ဝယ်ယူမှု မပြီးဆုံးသေးပါ။ ဝယ်ယူမှုဆက်လက်လုပ်ဆောင်ရန် သို့မဟုတ် အကူအညီလိုပါက ဒီ bot ကို စာပြန်ပေးနိုင်ပါတယ်။ ငွေလွှဲပြီးပါက payment slip ပေးပို့ပေးပါခင်ဗျာ။',
    '["{customer}", "{order_code}"]'::jsonb,
    'system'
  ),
  (
    'cart_recovery_browsing',
    'Lead Recovery: Catalog Inquirer (15 Min)',
    'Sent to customers who browsed the catalog or sales options in Telegram without placing an order.',
    'n8n_cart_recovery',
    'မင်္ဂလာပါခင်ဗျာ။ MH OP မှာ ကြည့်ရှုထားတဲ့ ပစ္စည်းများကို စိတ်ဝင်စားသေးပါသလား။ /catalog ဖြင့် ပြန်ကြည့်နိုင်ပြီး ဝယ်ယူရန် အကူအညီလိုပါက ဒီ bot ကို စာပြန်ပေးနိုင်ပါတယ်ခင်ဗျာ။',
    '["{customer}"]'::jsonb,
    'system'
  ),
  (
    'slip_acknowledgment',
    'Payment Slip Review Acknowledgment',
    'Delivered immediately after a customer sends a bank transfer receipt or payment screenshot.',
    'telegram_slip_upload',
    'ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ လူကြီးမင်းပေးပို့ထားသော Payment Slip ကို Admin Team မှ စစ်ဆေးနေပါပြီ။\n\nငွေလွှဲအတည်ပြုပြီးပါက Tracking Code နှင့် Delivery အချက်အလက်များကို အကြောင်းကြားပေးပါမည်။',
    '["{order_code}"]'::jsonb,
    'system'
  ),
  (
    'manager_morning_briefing',
    'Morning Operations Briefing (08:30)',
    'Sent by n8n at 08:30 to the Manager & Staff group summarizing orders, pending payments, revenue, and stock.',
    'n8n_daily_briefing',
    'GOOD MORNING · MH OP\nUnshipped orders: {unshipped}\nPending payments: {pending_slips}\nCumulative verified revenue: {revenue} MMK\nLow-stock listings: {low_stock_count}\n\n{low_stock_list}',
    '["{unshipped}", "{pending_slips}", "{revenue}", "{low_stock_count}"]'::jsonb,
    'system'
  ),
  (
    'manager_financial_digest',
    'Nightly Financial Digest (22:00)',
    'Sent by n8n at 22:00 to the Manager & Staff group summarizing verified revenue, gross profit, and pending fulfillment.',
    'n8n_financial_digest',
    'NIGHTLY SNAPSHOT · MH OP\nCumulative verified revenue: {revenue} MMK\nCumulative gross profit: {gross_profit} MMK\nOpen fulfillment: {unshipped}\nPending payments: {pending_slips}',
    '["{revenue}", "{gross_profit}", "{unshipped}", "{pending_slips}"]'::jsonb,
    'system'
  ),
  (
    'manager_staff_alert',
    'Real-Time Operational Alert',
    'Instant notification sent to the Manager & Staff group when orders, verified payments, low stock, or tickets occur.',
    'n8n_event_alert',
    'MH OP · {title}\n{body}\nReference: {target_code}\n{timestamp}',
    '["{title}", "{body}", "{target_code}", "{timestamp}"]'::jsonb,
    'system'
  )
ON CONFLICT (key) DO NOTHING;

DELETE FROM bot_message_templates WHERE key = 'accessory_follow_up';
