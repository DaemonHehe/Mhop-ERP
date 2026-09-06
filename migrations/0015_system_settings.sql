CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "description" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
