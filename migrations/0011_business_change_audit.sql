-- Row changes and their audit record commit or roll back together.
-- Keep operational summaries from the application alongside these snapshots.
CREATE OR REPLACE FUNCTION mhop_audit_business_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous jsonb;
  current_row jsonb;
  changes jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN current_row := to_jsonb(NEW); END IF;
  -- Never duplicate authentication secrets or payment-image credentials in logs.
  previous := previous - ARRAY['password_hash','payment_slip_url'];
  current_row := current_row - ARRAY['password_hash','payment_slip_url'];
  IF TG_TABLE_NAME = 'admin_users' AND TG_OP = 'UPDATE' THEN
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
      previous := previous || jsonb_build_object('password_changed',false);
      current_row := current_row || jsonb_build_object('password_changed',true);
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND previous = current_row THEN RETURN NEW; END IF;
  SELECT jsonb_object_agg(k, jsonb_build_object('before', previous->k, 'after', current_row->k))
  INTO changes
  FROM (SELECT jsonb_object_keys(coalesce(previous,'{}') || coalesce(current_row,'{}')) AS k) keys
  WHERE previous->k IS DISTINCT FROM current_row->k;
  INSERT INTO system_audit_logs(category,event,actor,target_code,details)
  VALUES (TG_ARGV[0], TG_ARGV[1] || '.' || lower(TG_OP),
    'database change',
    coalesce(current_row->>'order_code',previous->>'order_code',current_row->>'po_code',previous->>'po_code',current_row->>'sku',previous->>'sku',current_row->>'id',previous->>'id'),
    jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP,'changes',changes)::text);
  RETURN coalesce(NEW, OLD);
END;
$$;

DO $$
DECLARE item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ['products','inventory','catalog'], ['product_variants','inventory','inventory'],
    ['device_units','inventory','device'], ['bundles','inventory','bundle'],
    ['orders','orders','order'], ['order_items','orders','order_item'],
    ['order_bundle_sets','orders','order_bundle'], ['customers','crm','customer'],
    ['leads','crm','lead'], ['tickets','warranty','ticket'],
    ['suppliers','finance','supplier'], ['purchase_orders','finance','purchase'],
    ['purchase_items','finance','purchase_item'], ['expenses','finance','expense'],
    ['admin_users','access','staff'], ['receipt_settings','system','receipt_settings']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS mhop_business_audit ON %I',item[1]);
    EXECUTE format('CREATE TRIGGER mhop_business_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION mhop_audit_business_change(%L,%L)',item[1],item[2],item[3]);
  END LOOP;
END;
$$;
