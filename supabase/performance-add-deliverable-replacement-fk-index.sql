-- ============================================================
-- PicchuSpot performance cleanup: deliverable review replacement FK index
-- ============================================================
-- WARNING:
-- - Review this script before running it.
-- - Intended for manual Supabase SQL Editor execution only.
-- - Do not run automatically from application code, CI, the CLI, or migrations.
-- - Stop and investigate if the preflight block fails.
-- - Record every verification result set after COMMIT.
--
-- Purpose:
-- - Adds a covering index for the remaining Supabase Performance Advisor
--   "Unindexed foreign keys" info item on public.deliverable_reviews.
-- - Covers:
--     deliverable_reviews_replacement_deliverable_id_fkey
-- - Target index:
--     idx_deliverable_reviews_replacement_deliverable_id
--     ON public.deliverable_reviews (replacement_deliverable_id)
--
-- Scope:
-- - Creates at most one normal transaction-safe btree index.
-- - Does not alter tables, policies, functions, grants, Storage policies,
--   buckets, auth settings, data, or application code.
-- - No RLS or policy changes are intended.
-- - Does not remove indexes or touch Unused Index advisor items.
-- ============================================================

BEGIN;

-- Fail closed before any mutation if the expected production FK is missing
-- or differs from the expected replacement_deliverable_id relationship.
DO $$
DECLARE
  v_table_reg regclass := to_regclass('public.deliverable_reviews');
  v_ref_table_reg regclass := to_regclass('public.order_deliverables');
  v_target_index_reg regclass :=
    to_regclass('public.idx_deliverable_reviews_replacement_deliverable_id');
  v_fk_column_attnum smallint;
  v_ref_column_attnum smallint;
  v_constraint record;
  v_target_index record;
  v_existing_covering_index text;
BEGIN
  IF v_table_reg IS NULL THEN
    RAISE EXCEPTION
      'Preflight failed: expected table public.deliverable_reviews was not found.';
  END IF;

  IF v_ref_table_reg IS NULL THEN
    RAISE EXCEPTION
      'Preflight failed: expected referenced table public.order_deliverables was not found.';
  END IF;

  SELECT a.attnum::smallint
    INTO v_fk_column_attnum
  FROM pg_catalog.pg_attribute AS a
  WHERE a.attrelid = v_table_reg
    AND a.attname = 'replacement_deliverable_id'
    AND NOT a.attisdropped;

  IF v_fk_column_attnum IS NULL THEN
    RAISE EXCEPTION
      'Preflight failed: public.deliverable_reviews.replacement_deliverable_id was not found.';
  END IF;

  SELECT a.attnum::smallint
    INTO v_ref_column_attnum
  FROM pg_catalog.pg_attribute AS a
  WHERE a.attrelid = v_ref_table_reg
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF v_ref_column_attnum IS NULL THEN
    RAISE EXCEPTION
      'Preflight failed: public.order_deliverables.id was not found.';
  END IF;

  SELECT
    c.oid,
    c.conname,
    c.contype,
    c.conrelid,
    c.confrelid,
    c.conkey,
    c.confkey,
    c.confdeltype,
    c.confupdtype,
    c.confmatchtype,
    c.condeferrable,
    c.condeferred,
    pg_catalog.pg_get_constraintdef(c.oid) AS constraint_def
  INTO v_constraint
  FROM pg_catalog.pg_constraint AS c
  WHERE c.conrelid = v_table_reg
    AND c.conname = 'deliverable_reviews_replacement_deliverable_id_fkey';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Preflight failed: expected FK deliverable_reviews_replacement_deliverable_id_fkey was not found.';
  END IF;

  IF v_constraint.contype IS DISTINCT FROM 'f'
    OR v_constraint.confrelid IS DISTINCT FROM v_ref_table_reg
    OR v_constraint.conkey IS DISTINCT FROM ARRAY[v_fk_column_attnum]::smallint[]
    OR v_constraint.confkey IS DISTINCT FROM ARRAY[v_ref_column_attnum]::smallint[]
    OR v_constraint.confdeltype IS DISTINCT FROM 'n'
    OR v_constraint.confupdtype IS DISTINCT FROM 'a'
    OR v_constraint.confmatchtype IS DISTINCT FROM 's'
    OR v_constraint.condeferrable IS DISTINCT FROM FALSE
    OR v_constraint.condeferred IS DISTINCT FROM FALSE
  THEN
    RAISE EXCEPTION
      'Preflight failed: FK deliverable_reviews_replacement_deliverable_id_fkey has unexpected definition: %',
      v_constraint.constraint_def;
  END IF;

  -- If the target name already exists, it must match the exact intended
  -- one-column btree index shape. Otherwise fail closed before creating
  -- or relying on anything.
  IF v_target_index_reg IS NOT NULL THEN
    SELECT
      idx.relkind,
      table_ns.nspname AS table_schema,
      tbl.relname AS table_name,
      am.amname AS access_method,
      i.indisvalid AS is_valid,
      i.indisready AS is_ready,
      i.indisunique AS is_unique,
      i.indisprimary AS is_primary,
      i.indnkeyatts AS key_column_count,
      i.indnatts AS total_column_count,
      i.indexprs IS NULL AS has_no_expressions,
      i.indpred IS NULL AS has_no_predicate,
      CASE
        WHEN i.indexrelid IS NOT NULL
          THEN pg_catalog.pg_get_indexdef(idx.oid, 1, true)
        ELSE NULL
      END AS first_key_column,
      CASE
        WHEN i.indexrelid IS NOT NULL
          THEN pg_catalog.pg_get_indexdef(idx.oid)
        ELSE NULL
      END AS index_definition
    INTO v_target_index
    FROM pg_catalog.pg_class AS idx
    LEFT JOIN pg_catalog.pg_index AS i
      ON i.indexrelid = idx.oid
    LEFT JOIN pg_catalog.pg_class AS tbl
      ON tbl.oid = i.indrelid
    LEFT JOIN pg_catalog.pg_namespace AS table_ns
      ON table_ns.oid = tbl.relnamespace
    LEFT JOIN pg_catalog.pg_am AS am
      ON am.oid = idx.relam
    WHERE idx.oid = v_target_index_reg;

    IF v_target_index.relkind IS DISTINCT FROM 'i'
      OR v_target_index.table_schema IS DISTINCT FROM 'public'
      OR v_target_index.table_name IS DISTINCT FROM 'deliverable_reviews'
      OR v_target_index.access_method IS DISTINCT FROM 'btree'
      OR v_target_index.is_valid IS DISTINCT FROM TRUE
      OR v_target_index.is_ready IS DISTINCT FROM TRUE
      OR v_target_index.is_unique IS DISTINCT FROM FALSE
      OR v_target_index.is_primary IS DISTINCT FROM FALSE
      OR v_target_index.key_column_count IS DISTINCT FROM 1
      OR v_target_index.total_column_count IS DISTINCT FROM 1
      OR v_target_index.has_no_expressions IS DISTINCT FROM TRUE
      OR v_target_index.has_no_predicate IS DISTINCT FROM TRUE
      OR v_target_index.first_key_column IS DISTINCT FROM 'replacement_deliverable_id'
    THEN
      RAISE EXCEPTION
        'Preflight failed: target index name exists but does not match expected definition. Current definition: %',
        coalesce(v_target_index.index_definition, '<not an index>');
    END IF;
  END IF;

  -- If any valid, ready, non-partial index already has the FK column as
  -- its leading key, the FK is already covered and a duplicate is avoided.
  SELECT idx.relname
    INTO v_existing_covering_index
  FROM pg_catalog.pg_index AS i
  JOIN pg_catalog.pg_class AS idx
    ON idx.oid = i.indexrelid
  WHERE i.indrelid = v_table_reg
    AND i.indisvalid
    AND i.indisready
    AND i.indpred IS NULL
    AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND split_part(i.indkey::text, ' ', 1)::smallint = v_fk_column_attnum
  ORDER BY
    CASE
      WHEN idx.relname = 'idx_deliverable_reviews_replacement_deliverable_id'
        THEN 0
      ELSE 1
    END,
    idx.relname
  LIMIT 1;

  IF v_existing_covering_index IS NOT NULL THEN
    RAISE NOTICE
      'No index created: FK column replacement_deliverable_id is already covered by index %.',
      v_existing_covering_index;
    RETURN;
  END IF;

  EXECUTE
    'CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_replacement_deliverable_id ' ||
    'ON public.deliverable_reviews (replacement_deliverable_id)';

  RAISE NOTICE
    'Created or confirmed index idx_deliverable_reviews_replacement_deliverable_id on public.deliverable_reviews(replacement_deliverable_id).';
END;
$$;

COMMIT;

-- ============================================================
-- Read-only verification queries.
-- Every statement below is SELECT-only.
-- ============================================================

-- 1. Target FK and whether it has a valid covering index.
WITH foreign_keys AS (
  SELECT
    c.oid AS constraint_oid,
    c.conname AS constraint_name,
    c.conrelid,
    pg_catalog.pg_get_constraintdef(c.oid) AS constraint_def,
    array_agg(a.attnum::smallint ORDER BY cols.ordinality) AS fk_column_attnums,
    array_agg(a.attname::text ORDER BY cols.ordinality) AS fk_columns
  FROM pg_catalog.pg_constraint AS c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ordinality)
  JOIN pg_catalog.pg_attribute AS a
    ON a.attrelid = c.conrelid
   AND a.attnum = cols.attnum
  WHERE c.conrelid = to_regclass('public.deliverable_reviews')
    AND c.contype = 'f'
    AND c.conname = 'deliverable_reviews_replacement_deliverable_id_fkey'
  GROUP BY c.oid, c.conname, c.conrelid
)
SELECT
  fk.constraint_name,
  fk.fk_columns,
  fk.constraint_def,
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS i
    WHERE i.indrelid = fk.conrelid
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnkeyatts >= cardinality(fk.fk_columns)
      AND (
        SELECT array_agg(
          split_part(i.indkey::text, ' ', key_position)::smallint
          ORDER BY key_position
        )
        FROM generate_series(1, cardinality(fk.fk_columns)) AS key_position
      ) IS NOT DISTINCT FROM fk.fk_column_attnums
  ) AS has_covering_index,
  coalesce(
    (
      SELECT array_agg(idx.relname::text ORDER BY idx.relname)
      FROM pg_catalog.pg_index AS i
      JOIN pg_catalog.pg_class AS idx
        ON idx.oid = i.indexrelid
      WHERE i.indrelid = fk.conrelid
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts >= cardinality(fk.fk_columns)
        AND (
          SELECT array_agg(
            split_part(i.indkey::text, ' ', key_position)::smallint
            ORDER BY key_position
          )
          FROM generate_series(1, cardinality(fk.fk_columns)) AS key_position
        ) IS NOT DISTINCT FROM fk.fk_column_attnums
    ),
    ARRAY[]::text[]
  ) AS covering_indexes
FROM foreign_keys AS fk;

-- 2. Target index definition from pg_indexes.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'deliverable_reviews'
  AND indexname = 'idx_deliverable_reviews_replacement_deliverable_id';

-- 3. Focused FK coverage result for all public.deliverable_reviews FKs.
WITH foreign_keys AS (
  SELECT
    c.oid AS constraint_oid,
    c.conname AS constraint_name,
    c.conrelid,
    pg_catalog.pg_get_constraintdef(c.oid) AS constraint_def,
    array_agg(a.attnum::smallint ORDER BY cols.ordinality) AS fk_column_attnums,
    array_agg(a.attname::text ORDER BY cols.ordinality) AS fk_columns
  FROM pg_catalog.pg_constraint AS c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ordinality)
  JOIN pg_catalog.pg_attribute AS a
    ON a.attrelid = c.conrelid
   AND a.attnum = cols.attnum
  WHERE c.conrelid = to_regclass('public.deliverable_reviews')
    AND c.contype = 'f'
  GROUP BY c.oid, c.conname, c.conrelid
),
fk_coverage AS (
  SELECT
    fk.constraint_name,
    fk.fk_columns,
    fk.constraint_def,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index AS i
      WHERE i.indrelid = fk.conrelid
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts >= cardinality(fk.fk_columns)
        AND (
          SELECT array_agg(
            split_part(i.indkey::text, ' ', key_position)::smallint
            ORDER BY key_position
          )
          FROM generate_series(1, cardinality(fk.fk_columns)) AS key_position
        ) IS NOT DISTINCT FROM fk.fk_column_attnums
    ) AS has_covering_index
  FROM foreign_keys AS fk
)
SELECT
  constraint_name,
  fk_columns,
  constraint_def,
  has_covering_index
FROM fk_coverage
WHERE constraint_name IN (
  'deliverable_reviews_deliverable_id_fkey',
  'deliverable_reviews_order_id_fkey',
  'deliverable_reviews_replacement_deliverable_id_fkey'
)
ORDER BY
  CASE constraint_name
    WHEN 'deliverable_reviews_deliverable_id_fkey' THEN 1
    WHEN 'deliverable_reviews_order_id_fkey' THEN 2
    WHEN 'deliverable_reviews_replacement_deliverable_id_fkey' THEN 3
    ELSE 99
  END;
