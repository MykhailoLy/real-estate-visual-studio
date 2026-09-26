# F7: rework attachments are part of submission

Date: 2026-09-26. Branch: `codex/fix-rework-attachment-atomic-submit`.
Baseline and unchanged Git HEAD: `c64a0b417760f213126864a692fdff2a2a9fa90a`.
Final fetch confirmed `origin/main` at the same SHA. All implementation changes
are local and uncommitted. No push, PR, merge, deployment, Supabase migration or
production data mutation was performed. F8/F11/F10/F9 work was not started.

## Preflight and root cause

The initial working tree was clean. No existing F7 branch or open PR was found.
Read AGENTS.md, the installed Next.js route-handler guide, Supabase skill,
current database-function documentation, signed-upload implementation/docs and
the current Supabase changelog (including the September 25 PostgreSQL advisory).
Read-only live catalog checks confirmed the allowed statuses, cascade FK,
unchanged `deliverable_reviews_one_active_rework` partial unique index and
service_role SELECT/INSERT/UPDATE/DELETE rights on both review tables.
`pending_review` had no intentional application writer or conflicting reader
meaning; it appeared only in the existing type/schema. No stop gate was triggered.

The old review POST immediately inserted `rework_requested` and invoked the
review-workflow email. The component subsequently caught individual attachment
failures, then unconditionally displayed success, closed the form and cleared
selected files. Its app-level read/count/insert upload slot also could not
serialize against a future finalization transaction.

Before production edits, executed the actual `submitRework` and
`uploadReferenceFile` function bodies extracted from the component using the
installed TypeScript parser. Synthetic HTTP failures at Storage PUT and complete
both failed the intended assertions: actual active=true, status=rework_requested,
form=false, selected=[]. **RED: 0 passed / 2 failed.** Evidence:
`test-results/f7-client-red.log`. No production request or auth bypass was used.

## Behavior and boundaries

- `reference_file_count > 0` creates an internal `pending_review` preparation.
  Ownership, deliverable and comment validation remain server-side. An explicit
  query checks every active review; the latest row cannot mask an older active one.
- Before a new preparation, collect prior pending file paths server-side, delete
  only still-pending parents, and let the FK cascade remove their metadata.
  Storage removal happens afterward and only for parents confirmed deleted.
  Database failure aborts preparation. Storage failure produces a constant safe
  warning and never restores metadata. A concurrent commit prevents deletion.
- New slot requests carry validated `submission_mode: pending_rework`. The
  server creates a UUID/path, signs with upsert=false, calls the strict locked
  RPC, and returns the signed capability only after successful reservation.
  There is no fallback from strict mode to legacy active-review insertion.
- Complete still uses the unchanged `verifyStoredUploadContent()` lifecycle,
  including actual signature and object identity checks. Failed verification
  stays pending and cannot count toward finalization. Retry retires the attempt.
- Finalize verifies session, UUID, ownership and count, then calls the atomic RPC.
  Only a successful pending→requested transition invokes the existing email
  function. Public final review fields are only id/status/comment/created_at.
- On any upload-url, PUT or complete failure, the client does not finalize or
  change visible review state. The form, comment and files remain retryable.
  Success closes/clears the form only after the finalization response.
- Count zero or an omitted count preserves the old single review POST and
  best-effort email. It does not use Storage or finalization. Missing upload mode
  preserves historical active-review uploads for old browser bundles.
- Client history/latest, admin order detail and the bulk-download review lookup
  exclude pending preparations. Admin attachment totals exclude their files.
  The admin queue's explicit requested/in-progress filter is unchanged.
- No raw storage_path or separate token fields are added to API responses or
  errors. The existing authorized signed upload URL is intentionally returned;
  it is not logged. No private live row content was included in evidence.

## Manual migration and concurrency evidence

CLI-generated file:
`supabase/migrations/20260926134104_f7_atomic_rework_submission.sql`.
It creates/replaces only these functions and their EXECUTE grants:

1. `public.prepare_rework_reference_file_upload(uuid, uuid, text, text, bigint, text)`
2. `public.finalize_rework_review_submission(uuid, integer)`

Both use SECURITY INVOKER and `search_path = pg_catalog, public`. Existing
service_role table rights are sufficient. EXECUTE is revoked from PUBLIC, anon
and authenticated and granted to service_role. No new table, column, index,
policy, bucket, trigger, dependency or generic workflow layer is introduced.

Both functions lock the same review row FOR UPDATE and require pending_review.
Slot insertion derives order/deliverable/item fields from that locked row and
enforces five files under lock. Finalization requires a count of 1–5, exactly
that many rows, all uploaded and zero pending. The existing unique active-rework
index remains authoritative; conflicts do not promote the preparation.

`scripts/test-rework-submission-postgres.mjs` follows the existing external
F3/F5 native runtime pattern in an independent fresh loopback-only cluster.
It loads the actual historical review schemas and exact new migration twice;
it asserts that the protected table/index/policy/grant catalog is unchanged.
The external runtime was PostgreSQL 17.6 with pg 8.16.3, installed only in OS temp.
No hosted connection string is accepted. Each run stops its temporary cluster.

**11/11 passed, zero skipped**, with distinct backends 39316 and 37876 and
observed `pg_stat_activity` lock barriers. Covers:

- Slot locks first: concurrent finalization waits and sees the committed slot.
- Finalization locks first: late strict slot waits, then rejects without insertion.
- Pending files, mismatched counts and out-of-range/null counts reject.
- Exact uploaded count promotes once; a concurrent second finalization rejects.
- An existing active review and racing separate preparations hit the unique guard.
- Concurrent slots cannot exceed the five-file cap.
- Cleanup racing finalization cannot delete committed reference metadata.
- Retired preparations cascade metadata and cannot be resurrected by either RPC.
- PUBLIC/anon/authenticated cannot execute; service_role can; invoker mode and
  search_path are correct after an idempotent rerun.

Evidence: `test-results/f7-postgres.log`. Reproduce using external tools:

```powershell
$env:F7_POSTGRES_BIN_DIR = Join-Path $env:TEMP 'picchuspot-f7-postgres-runtime/node_modules/@embedded-postgres/windows-x64/native/bin'
$env:F7_PG_DRIVER_MODULE = Join-Path $env:TEMP 'picchuspot-f7-postgres-runtime/node_modules/pg'
node --test scripts/test-rework-submission-postgres.mjs
```

The migration was executed only in that disposable test cluster. It has **not**
been applied to Supabase. Future rollout requires manual function installation
and grant verification before normal application deployment. Deploying first
fails closed for strict attachment slots/finalization; text-only rework remains
available. Do not replay historical schema initializers on production.

## Validation

| Check | Result |
| --- | --- |
| `npm run test:rework-upload-migration` | 38/38, including client orchestration, real server helpers/routes, signature rejection, reads/ownership, cleanup and migration contracts |
| Native F7 PostgreSQL test | 11/11, no skipped cases |
| `npm run test:ci` | Passed, 2,361 reported test executions; includes client order review and review workflow email regressions |
| `npm run typecheck:test` | Passed |
| `npx tsc --noEmit --incremental false` | Passed |
| `npm run lint` | Passed, zero errors, nine pre-existing navigation warnings in untouched files |
| `npm run build` | Passed, 122 static pages; new finalize route included; existing preferredRegion deprecation warning |
| `git diff --check` | Passed |
| Playwright | Not run: no existing safe authenticated rework-form fixture; no auth bypass added |

One existing legal-content test asserted the old latest-only guard's source
spelling. It now checks the any-active-row query; executable tests also prove
repeated review cycles after approved/resolved remain allowed. No legal copy
changed. An initial build found a leftover removed-warning setter; this was
fixed, followed by successful full validation. Logs use `test-results/f7-*`.
No new runtime abstraction or production test instrumentation was required.

## Exact changed files

| File | Change |
| --- | --- |
| `src/components/dashboard/DeliverableReviewActions.tsx` | Prepare/upload/complete/finalize ordering and retryable failure state |
| `src/lib/client-reviews.ts` | Internal preparations, active guard, cleanup, filtered readers, owned finalization helper |
| `src/lib/rework-reference-files.ts` | Strict RPC slot mode, unique paths, signed URL ordering; legacy compatibility |
| `src/app/api/client/deliverables/[deliverableId]/review/route.ts` | Validated reference count; existing status-gated email now skips preparations |
| `src/app/api/client/reviews/[reviewId]/reference-files/upload-url/route.ts` | Validated explicit submission mode |
| `src/app/api/client/reviews/[reviewId]/finalize/route.ts` | Owned atomic commit followed by existing email call |
| `src/app/(default)/(public)/admin/orders/[orderId]/page.tsx` | Hide pending reviews and their attachment totals |
| `src/app/api/client/orders/[orderId]/deliverables/bulk-download/route.ts` | Exclude internal review rows from existing display selection |
| `src/components/dashboard/deliverable-rework-submit.test.ts` | Real component-handler RED→GREEN tests |
| `src/lib/rework-submission.test.ts` | Real server-helper/API/read-query tests against synthetic boundaries |
| `src/lib/rework-reference-files-migration.test.ts` | Function contracts and existing CI entry-point integration |
| `src/lib/legal-content.test.ts` | Update stale latest-only active guard expectation |
| `scripts/test-rework-submission-postgres.mjs` | Independent native PostgreSQL concurrency/grant verification |
| `supabase/migrations/20260926134104_f7_atomic_rework_submission.sql` | Two function-only definitions and restricted grants |
| `supabase/MIGRATION_MANIFEST.md` | Manual rollout and compatibility notes |
| `docs/f7-rework-attachment-atomic-submit.md` | This implementation/evidence report |

## Production aggregate and limitations

Read-only aggregate repeated once at the end, 2026-09-26:

| Table | Status | Count |
| --- | --- | ---: |
| deliverable_reviews | approved | 5 |
| deliverable_reviews | resolved | 2 |
| deliverable_reviews | rework_delivered | 5 |
| deliverable_reviews | pending_review | 0 |
| deliverable_reviews | rework_requested | 0 |
| deliverable_reviews | rework_in_progress | 0 |
| deliverable_review_files | uploaded | 2 |
| deliverable_review_files | pending | 0 |

No client identifiers, paths, filenames or emails were read into the report.
The count baseline is unchanged. Production data and Storage were not mutated.

A delayed signed upload can create an unreachable orphan after its preparation
was retired; a failed Storage removal can also leave such an object. Neither can
restore review metadata or reserve active rework. No scheduler is added. Old
bundles intentionally retain the historical upload path during rollout. If a
finalize response is lost after commit, the UI may need refresh to see the
committed state; the active index prevents duplicate rework. Email remains
best-effort after commit, as before. Actual hosted Storage/network behavior and
authenticated browser rendering were not exercised.

Payments, pricing, order creation/finalization, email architecture/F9, F8/F11,
authentication, environment files, package/lockfile, RLS, bucket policies and
Property Showcase are untouched. Stop after local F7 review; no commit is made.
