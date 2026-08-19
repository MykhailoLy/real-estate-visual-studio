# Multi-reference files migration runbook

Migration: `supabase/add-multi-reference-files.sql`

This is an additive, manually applied migration. It keeps the legacy singular reference fields and rows for application rollback. It does not move or delete Storage objects and does not change the private `order-files` bucket.

## Application order

1. Review the migration and back up the Supabase database.
2. Apply `supabase/add-multi-reference-files.sql` manually in the target project.
3. Run the read-only verification queries below and record the results.
4. Verify the existing production site still creates, restores and displays orders with one reference.
5. Merge the application PR only after those checks pass.
6. Deploy and test multi-reference selection, saved drafts, final submission and signed downloads.
7. Keep `order_items.reference_image_path`, legacy `order_draft_files` reference rows and both new tables in place for rollback.

The application may be rolled back without rolling back the schema. New writes mirror the first active reference into the legacy singular location. When the first reference is removed, the next active reference becomes the mirror. Older application code will therefore continue to expose one reference while the normalized rows preserve the complete ordered set.

## Read-only verification SQL

```sql
-- Tables exist.
SELECT to_regclass('public.order_draft_item_reference_files') AS draft_references,
       to_regclass('public.order_item_reference_files') AS order_references;

-- Indexes and constraints.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'order_draft_item_reference_files',
    'order_item_reference_files'
  )
ORDER BY tablename, indexname;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
  'public.order_draft_item_reference_files'::regclass,
  'public.order_item_reference_files'::regclass
)
ORDER BY table_name::text, conname;

-- RLS enabled and expected policies present.
SELECT relname, relrowsecurity
FROM pg_class
WHERE oid IN (
  'public.order_draft_item_reference_files'::regclass,
  'public.order_item_reference_files'::regclass
);

SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'order_draft_item_reference_files',
    'order_item_reference_files'
  )
ORDER BY tablename, policyname;

-- Backfill counts. The source and normalized position-zero counts should match.
SELECT
  (SELECT count(*) FROM public.order_draft_files
    WHERE kind = 'reference' AND deleted_at IS NULL AND upload_status = 'uploaded')
      AS legacy_draft_references,
  (SELECT count(*) FROM public.order_draft_item_reference_files
    WHERE position = 0 AND deleted_at IS NULL AND upload_status = 'uploaded')
      AS normalized_draft_position_zero;

SELECT
  (SELECT count(*) FROM public.order_items
    WHERE reference_image_path IS NOT NULL AND btrim(reference_image_path) <> '')
      AS legacy_final_references,
  (SELECT count(*) FROM public.order_item_reference_files WHERE position = 0)
      AS normalized_final_position_zero;

-- Duplicate detection. Both queries must return zero rows.
SELECT draft_id, item_client_id, reference_id, count(*)
FROM public.order_draft_item_reference_files
GROUP BY draft_id, item_client_id, reference_id
HAVING count(*) > 1;

SELECT order_item_id, reference_id, count(*)
FROM public.order_item_reference_files
GROUP BY order_item_id, reference_id
HAVING count(*) > 1;

-- Invalid positions. Both queries must return zero.
SELECT count(*) AS invalid_draft_positions
FROM public.order_draft_item_reference_files
WHERE position NOT BETWEEN 0 AND 9;

SELECT count(*) AS invalid_final_positions
FROM public.order_item_reference_files
WHERE position NOT BETWEEN 0 AND 9;

-- Orphans. Both queries must return zero.
SELECT count(*) AS orphaned_draft_references
FROM public.order_draft_item_reference_files refs
LEFT JOIN public.order_drafts drafts ON drafts.id = refs.draft_id
WHERE drafts.id IS NULL;

SELECT count(*) AS orphaned_final_references
FROM public.order_item_reference_files refs
LEFT JOIN public.order_items items ON items.id = refs.order_item_id
WHERE items.id IS NULL;
```

Do not remove either new table during an application rollback. No destructive rollback SQL is included intentionally.
