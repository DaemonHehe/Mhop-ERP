CREATE TABLE IF NOT EXISTS payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name varchar(120) NOT NULL,
  account_holder varchar(120) NOT NULL,
  account_number varchar(120) NOT NULL,
  instructions text,
  qr_code_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_accounts_active_idx ON payment_accounts(is_active);
CREATE INDEX IF NOT EXISTS payment_accounts_order_idx ON payment_accounts(display_order);

-- Seed default bank accounts from clientConfig if not already present
INSERT INTO payment_accounts (bank_name, account_holder, account_number, instructions, display_order)
SELECT 'KBZPay (KPay)', 'Ko Ko Kyaw', '09798888123', 'ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါ', 1
WHERE NOT EXISTS (SELECT 1 FROM payment_accounts WHERE bank_name = 'KBZPay (KPay)');

INSERT INTO payment_accounts (bank_name, account_holder, account_number, instructions, display_order)
SELECT 'WavePay', 'OS Official', '09798888123', 'ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါ', 2
WHERE NOT EXISTS (SELECT 1 FROM payment_accounts WHERE bank_name = 'WavePay');

INSERT INTO payment_accounts (bank_name, account_holder, account_number, instructions, display_order)
SELECT 'KBZ Bank', 'Ko Ko Kyaw', '0123456789012', 'ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါ', 3
WHERE NOT EXISTS (SELECT 1 FROM payment_accounts WHERE bank_name = 'KBZ Bank');
