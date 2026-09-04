CREATE TABLE IF NOT EXISTS system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event varchar(80) NOT NULL,
  actor varchar(120) NOT NULL DEFAULT 'system', target_code varchar(100),
  details text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_audit_logs_created_idx ON system_audit_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_user_id varchar(80) UNIQUE NOT NULL,
  language varchar(10) NOT NULL DEFAULT 'en', state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
