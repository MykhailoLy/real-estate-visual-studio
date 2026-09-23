-- F9: MANUAL rollout only, after the worker patch and matching production secrets.
-- Neither this migration nor cron.job contains a secret value.
BEGIN;

-- Registration schemas follow current Supabase installation documentation.
-- The extensions themselves create cron and net respectively.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

DO $migration$
DECLARE
  v_name CONSTANT TEXT := 'picchuspot-order-email-outbox';
  v_schedule CONSTANT TEXT := '*/15 * * * *';
  v_command CONSTANT TEXT := $command$
DO $worker$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO STRICT v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'picchuspot_order_email_worker_secret';
  IF v_secret IS NULL OR length(btrim(v_secret)) = 0 THEN
    RAISE EXCEPTION 'Order email worker secret is unavailable';
  END IF;
  SELECT net.http_post(
    url := 'https://picchuspot.com/api/internal/order-email-outbox',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 65000
  ) INTO v_request_id;
  -- Correlate this run with net._http_response without logging headers/payloads.
  RAISE LOG 'picchuspot-order-email-outbox request_id=%', v_request_id;
END;
$worker$;
$command$;
  v_existing cron.job%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault')
     OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'F9 requires Supabase Vault';
  END IF;
  -- Read-only prerequisite: unexpected Vault exposure needs separate review.
  -- Do not modify Vault or pg_net extension ACLs, including server-side access.
  IF has_schema_privilege('anon', 'vault', 'USAGE')
     OR has_schema_privilege('authenticated', 'vault', 'USAGE')
     OR has_table_privilege('anon', 'vault.decrypted_secrets', 'SELECT')
     OR has_table_privilege('authenticated', 'vault.decrypted_secrets', 'SELECT') THEN
    RAISE EXCEPTION 'F9 requires separate security review of browser-role Vault access';
  END IF;
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION 'F9 requires the supported pg_net HTTP POST signature';
  END IF;
  IF (SELECT count(*) FROM vault.decrypted_secrets
       WHERE name = 'picchuspot_order_email_worker_secret') <> 1
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets
       WHERE name = 'picchuspot_order_email_worker_secret'
         AND length(btrim(decrypted_secret)) > 0) THEN
    RAISE EXCEPTION 'F9 requires one nonempty order email worker Vault secret';
  END IF;

  -- Disable cron.job RLS filtering for this transaction: if the operator cannot
  -- see all same-name jobs, fail rather than silently creating another owner's job.
  PERFORM set_config('row_security', 'off', true);
  SELECT count(*) INTO v_count FROM cron.job WHERE jobname = v_name;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'F9 found duplicate scheduler jobs';
  ELSIF v_count = 1 THEN
    SELECT * INTO STRICT v_existing FROM cron.job WHERE jobname = v_name;
    IF v_existing.schedule IS DISTINCT FROM v_schedule
       OR v_existing.command IS DISTINCT FROM v_command
       OR v_existing.database IS DISTINCT FROM current_database()
       OR v_existing.username IS DISTINCT FROM current_user
       OR v_existing.active IS DISTINCT FROM true
       OR v_existing.nodename IS DISTINCT FROM current_setting('cron.host')
       OR v_existing.nodeport IS DISTINCT FROM current_setting('port')::integer THEN
      RAISE EXCEPTION 'F9 found an unexpected scheduler definition; review manually';
    END IF;
    -- Exact expected job: rerun is a no-op, including its job ID.
    RETURN;
  END IF;
  PERFORM cron.schedule(v_name, v_schedule, v_command);
END;
$migration$;

COMMIT;
