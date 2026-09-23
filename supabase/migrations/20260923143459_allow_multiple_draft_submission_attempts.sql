-- F5: one immutable submission per attempt, at most one order per draft.
-- Manual rollout: apply this migration, verify index state, then deploy the app.
-- No rows, snapshots, RPCs, grants or order-level uniqueness are changed.
BEGIN;

DO $preflight$
DECLARE
  v_expected record;
  v_index oid;
BEGIN
  IF pg_catalog.to_regclass('public.order_submissions') IS NULL
     OR pg_catalog.to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'F5 prerequisites missing: atomic order submissions and orders';
  END IF;

  -- Permit a rerun only when the replacement index already exists. Do not
  -- silently accept an unknown schema with neither old nor new boundary.
  IF pg_catalog.to_regclass('public.order_submissions_source_draft_unique') IS NULL
     AND pg_catalog.to_regclass('public.idx_order_submissions_source_draft') IS NULL THEN
    RAISE EXCEPTION 'F5 expected submission source index is missing';
  END IF;

  FOR v_expected IN
    SELECT * FROM (VALUES
      ('orders_source_draft_id_unique', 'orders', true, true),
      ('order_submissions_source_draft_unique', 'order_submissions', true, false),
      ('idx_order_submissions_source_draft', 'order_submissions', false, false)
    ) AS expected(index_name, table_name, is_unique, required)
  LOOP
    v_index := pg_catalog.to_regclass('public.' || v_expected.index_name);
    IF v_index IS NULL AND v_expected.required THEN
      RAISE EXCEPTION 'F5 required order uniqueness index is missing';
    END IF;
    IF v_index IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM pg_catalog.pg_index AS i
        JOIN pg_catalog.pg_class AS t ON t.oid = i.indrelid
        JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
        JOIN pg_catalog.pg_attribute AS a
          ON a.attrelid = t.oid AND a.attname = 'source_draft_id'
       WHERE i.indexrelid = v_index
         AND n.nspname = 'public' AND t.relname = v_expected.table_name
         AND i.indisunique = v_expected.is_unique
         AND i.indisvalid AND i.indisready
         AND i.indnatts = 1 AND i.indnkeyatts = 1
         AND i.indkey[0] = a.attnum
         AND i.indexprs IS NULL
         AND pg_catalog.pg_get_expr(i.indpred, i.indrelid) = '(source_draft_id IS NOT NULL)'
    ) THEN
      RAISE EXCEPTION 'F5 unexpected definition for index %', v_expected.index_name;
    END IF;
  END LOOP;

  -- Another unique key containing source_draft_id needs operator review;
  -- removing this one index must actually permit another immutable attempt.
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_index AS i
      JOIN pg_catalog.pg_attribute AS a ON a.attrelid = i.indrelid
     WHERE i.indrelid = 'public.order_submissions'::regclass
       AND a.attname = 'source_draft_id'
       AND i.indisunique AND a.attnum = ANY(i.indkey)
       AND i.indexrelid <> COALESCE(
         pg_catalog.to_regclass('public.order_submissions_source_draft_unique'), 0::oid
       )
  ) THEN
    RAISE EXCEPTION 'F5 unexpected additional submission source uniqueness; review before rollout';
  END IF;

  IF pg_catalog.to_regprocedure('public.claim_order_submission(uuid,uuid,text,smallint,text,uuid,uuid,text,text,text,integer,jsonb)') IS NULL
     OR pg_catalog.to_regprocedure('public.claim_order_draft_finalization(uuid,uuid,integer,uuid)') IS NULL
     OR pg_catalog.to_regprocedure('public.commit_order_submission(uuid,uuid,text,uuid,text,text,text,text,text,jsonb,integer,uuid,jsonb)') IS NULL
     OR pg_catalog.to_regprocedure('public.commit_order_submission_with_welcome_offer_v1(uuid,uuid,text,uuid,text,text,text,text,text,jsonb,integer,uuid,jsonb,text[])') IS NULL THEN
    RAISE EXCEPTION 'F5 required submission/draft/Welcome commit RPC signature is missing';
  END IF;
END;
$preflight$;

CREATE INDEX IF NOT EXISTS idx_order_submissions_source_draft
  ON public.order_submissions (source_draft_id)
  WHERE source_draft_id IS NOT NULL;

DROP INDEX IF EXISTS public.order_submissions_source_draft_unique;

COMMIT;
