# F8: atomic admin replacement uploads

Date: 2026-09-26. Branch: `codex/fix-admin-replacement-atomic-commit`.
Baseline and unchanged Git HEAD: `c798df755d18d651178cf0501e01c6aa2258e549`.
Implementation is local and uncommitted. No push, PR, merge, manual deployment,
Supabase migration, ledger write, Storage mutation or production data mutation
was performed. F11/F10 were not started.

## Preflight and RED evidence

Started from a clean checkout and the latest fetched main; no F8 branch or open
PR existed. Read AGENTS.md, installed Next.js route-handler docs, Supabase skill,
current function/Storage docs, installed Storage SDK, changelog and migration
manifest. The September 25 PostgreSQL advisory concerns extension/operator
features not used by this function. Read-only live catalog checks confirmed:

- Explicit UUIDs are supported by order_deliverables.id; gen_random_uuid is only
  its default. No custom deliverable triggers or hidden unique indexes conflict.
- Existing metadata/default contract: uploaded_by=admin, uploaded_at=now(),
  expires_at=NULL, nullable item_index, integer file_size.
- Service-role table privileges suffice for SECURITY INVOKER.
- attach_replacement_with_email matches repository SQL, uses the hardened search
  path, denies PUBLIC/anon/authenticated and allows service_role.

Both AdminOrderImageCard and AdminDeliverableUpload registered the uploaded file
through generic POST /deliverables before PATCH linked it to the review.
Before changing production code, executed both actual component handlers via the
installed TypeScript parser with synthetic HTTP boundaries. Storage PUT and
generic registration succeeded; replacement PATCH failed. Repeating the upload
left **two registered rows instead of zero in each component**. RED: **0 passed,
2 failed**. Evidence: `test-results/f8-client-red.log`.

## Implementation

New replacements use the existing replacement endpoint:

1. POST authenticates admin, validates metadata/current active review, creates a
   server UUID and signs a no-upsert upload to the private deliverables bucket.
2. The browser PUTs bytes directly to Storage.
3. PATCH with explicit `mode: atomic_upload` reconstructs the deterministic path
   from server-owned review data and the candidate UUID/filename. It verifies
   object existence and exact positive size before the RPC.
4. One RPC locks the review, inserts the candidate deliverable, attaches it,
   marks rework_delivered and enqueues the existing outbox event atomically.
5. Only a committed/already_committed result schedules the existing
   sendReviewWorkflowEmail lifecycle entry point and permits visible UI success.

The replacement-only helper is shared by the two existing call sites. It never
calls generic registration. A transport error, server error or unreadable commit
response gets one bounded retry of the identical candidate/payload. It never
prepares or uploads a second candidate for reconciliation. If both outcomes stay
unknown, the message says confirmation failed and asks for an order refresh;
it does not claim rollback. Known failures say the replacement was not finalized.
The image card updates its own review status/replacement ID after success.

Same-candidate retries require matching persisted order/item/path/metadata and
return the same deliverable without re-enqueue. Different candidates conflict
before insertion. The SQL derives assignment from the locked review, checks its
order/original consistency, and rejects the original deliverable as a candidate.

Missing PATCH mode retains the legacy attach_replacement_with_email flow.
Malformed atomic mode cannot fall back. Ordinary uploads keep signed URL → PUT
→ generic registration. Generic routes and deletion behavior are unchanged.

## Migration and security

CLI-generated migration:
`supabase/migrations/20260926155032_f8_atomic_replacement_deliverable_commit.sql`.
It adds/replaces only:

`public.commit_rework_replacement_upload(uuid, uuid, text, text, bigint, text)`

and its EXECUTE grants. SECURITY INVOKER; search_path=pg_catalog,public; EXECUTE
revoked from PUBLIC/anon/authenticated and granted to service_role. No table,
column, index, RLS, table-grant, bucket/policy, backfill or legacy-function change.
Migration is required and **NOT APPLIED to Supabase**. It was executed only in
the fresh disposable native PostgreSQL test cluster, twice to prove idempotence.

Admin authentication remains first. No browser order/user/email/item fields are
accepted by the new mode; browser storage_path is rejected. Preparation returns
only ok/candidate ID/intended signed upload URL. Finalization returns an explicit
safe deliverable schema, excluding storage_path and private DB fields. Current
file-size and MIME rules, private Storage, no-upsert and no-overwrite are preserved.
No Resend call, scheduler, claim/completion RPC or other F9 architecture changes.

## Native PostgreSQL evidence

`scripts/test-admin-replacement-postgres.mjs` uses the existing external native
PostgreSQL pattern in a fresh loopback-only cluster. It loads actual repository
deliverable/review/outbox DDL, the existing replacement function and the exact new
migration. It asserts protected schema/ACLs and the legacy function are unchanged.

**11/11 passed, zero skipped**, PostgreSQL 17.6, distinct backend sessions
29756/27940. pg_stat_activity/pg_blocking_pids barriers prove review-row locking:

- Same candidate: the second connection waits, then returns already_committed
  with identical metadata/timestamp; one deliverable and one event.
- Different candidates: second waits, then conflicts; only the winner is inserted.
- Lost-response retry returns the same row and preserves the event/idempotency key.
- A synthetic failing outbox trigger, after registration and review update,
  proves full transaction rollback: zero candidate rows/events, active review.
- Lifecycle, original-ID, wrong path/order/item, invalid size, metadata mismatch
  and existing candidate-ID guards reject safely.
- Legacy attachment still works; ordinary metadata/defaults remain intact.
- EXECUTE is denied to PUBLIC/anon/authenticated and available to service_role.

Reproduction (external runtime; no repository dependency):

```powershell
$env:F8_POSTGRES_BIN_DIR = Join-Path $env:TEMP 'picchuspot-f7-postgres-runtime/node_modules/@embedded-postgres/windows-x64/native/bin'
$env:F8_PG_DRIVER_MODULE = Join-Path $env:TEMP 'picchuspot-f7-postgres-runtime/node_modules/pg'
node --test scripts/test-admin-replacement-postgres.mjs
```

## Validation

| Check | Result |
| --- | --- |
| Focused client/route/migration tests | 25 passed |
| Native PostgreSQL F8 | 11 passed, zero skipped |
| Admin upload regressions | 31 passed, including F8 |
| Review/order email, outbox and F9 regressions | 44 passed |
| F7 regressions | 38 passed |
| Client order review/display | 16 passed |
| Full test:ci | Passed, 2,386 reported test executions |
| Test typecheck | Passed |
| Production typecheck | Passed |
| npm run lint | Passed, 9 pre-existing navigation warnings, no errors |
| npm run build | Passed |
| git diff --check | Passed |
| Playwright | Not run: no existing safe authenticated admin replacement fixture |

Initial checks caught a missing optional legacy mode field, the RPC result's
untyped SDK boundary, and a reserved test variable name. These were corrected;
final focused checks/typechecks/full CI/lint/build pass. No auth bypass was added.
The React checklist confirmed existing event-handler/state conventions and
unchanged rendering/layout. Actual authenticated browser/hosted Storage behavior
was not exercised. Logs are under ignored `test-results/f8-*`.

## Read-only production aggregates

Repeated 2026-09-26, aggregate output only:

| Measure | Count |
| --- | ---: |
| Reviews with replacement | 4 |
| Distinct referenced replacement deliverables | 4 |
| Replacement IDs referenced by multiple reviews | 0 |
| Suspicious unlinked deliverables uploaded after same-order/item rework | 0 |
| Historical rework_delivered without replacement | 1 |
| admin_replacement_ready outbox rows | 0 |

The suspicious-row heuristic counts unreferenced deliverables uploaded after a
same-order/item rework review, excluding that review's original deliverable.
Counts match the supplied baseline. The historical null replacement was left
unchanged; no emails were backfilled. No customer identifiers, filenames, paths
or emails were included in the report.

## Scope, limitations and later rollout

Uncommitted files: replacement route, both admin upload components, deliverables
config, new replacement client helper, two focused test files, existing admin
upload test entry point, native F8 harness, function migration, migration manifest
and this report. Customer routes/F7, ordinary deliverable APIs, F9 internals,
F11/F10, Stripe, pricing, customer orders/drafts, auth architecture, env,
package/lockfile and Property Showcase are untouched.

An abandoned or losing upload may leave an unreachable Storage object. It cannot
create an orphan/duplicate DB deliverable through the new commit. There is no
cleanup scheduler or automatic deletion. Legacy browser bundles intentionally
retain their old non-atomic registration/link behavior during compatibility rollout.
After two unknown HTTP outcomes, the admin may need a refresh to see a committed
result; no second candidate is uploaded by the helper.

Later rollout: PR reviewed + CI green → manually apply migration → verify function
and EXECUTE grants plus unchanged aggregates → register ledger if manual SQL did
not → merge app PR → Vercel READY → post-deploy read-only checks. Migration-first
is backwards-compatible because old application code does not call the new RPC.
This task stops at local F8 implementation: **no commit, push, PR, merge, deployment
or production SQL execution**.
