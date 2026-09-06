ALTER TABLE system_audit_logs
  ADD COLUMN IF NOT EXISTS category varchar(40) NOT NULL DEFAULT 'system';

UPDATE system_audit_logs
SET category = CASE
  WHEN event LIKE 'order.%' OR event LIKE 'payment.%' THEN 'orders'
  WHEN event LIKE 'catalog.%' OR event LIKE 'inventory.%' OR event LIKE 'device.%'
    OR event LIKE 'account.%' OR event LIKE 'bundle.%' THEN 'inventory'
  WHEN event LIKE 'supplier.%' OR event LIKE 'purchase.%' OR event LIKE 'expense.%' THEN 'finance'
  WHEN event LIKE 'ticket.%' OR event LIKE 'warranty.%' THEN 'warranty'
  WHEN event LIKE 'lead.%' OR event LIKE 'customer.%' THEN 'crm'
  WHEN event LIKE 'staff.%' OR event LIKE 'auth.%' OR event LIKE 'security.%' THEN 'access'
  WHEN event LIKE 'bot.%' OR event LIKE 'telegram.%' OR event LIKE 'n8n.%' THEN 'automation'
  ELSE 'system'
END
WHERE category = 'system';

CREATE INDEX IF NOT EXISTS audit_logs_category_created_idx
  ON system_audit_logs(category, created_at DESC);
