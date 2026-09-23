# F5: immutable draft finalization attempts

Branch: `codex/fix-draft-finalization-after-edit`.
Baseline / unchanged HEAD: `0fb6cc94a3b976c7003eb6ff5c213437309bed0b`.
Date: 2026-09-23. Local review only: no commit, push, PR, merge or deployment.
**Local patch and forward migration validated; ready for independent review.**
**Production migration has NOT been applied by this task.**

## Scope and preflight

Continued the existing F5 worktree and diagnostic changes after explicit approval
of the migration blocker. Fetch confirmed the requested baseline remained current
`origin/main`; the only open PR was unrelated #337. Applicable AGENTS.md, the
Supabase skill, CLI help and installed Next.js guides were read. Existing source
checkout changes (`.gitignore`, `debug.log`) and `.codex` were preserved.

Inspected effective SQL: atomic submissions, final four-service claim/commit in
`allow-floor-plan-draft-finalization.sql`, Welcome redemption foundation and
`fix-welcome-offer-rpc-coalesce.sql`, later migrations and the manifest. No later
tracked migration removed the submission source-draft unique index. The native
PostgreSQL harness loads the exact effective function bodies, including Welcome.
No live production catalog or customer data was queried during this task.

Critical risks covered: duplicate production orders; old handler committing after
edit/takeover; immutable financial snapshot mutation; stale files/pricing entering
new attempts; lost retry identity; and permanent editing/finalization lock.

## Root cause and implementation

Previously, `submissionId = draftId` coupled a mutable draft lifecycle to one
immutable request/quote snapshot. Released processing rows remained. Changed
intent produced `payload_conflict`; changed authoritative pricing produced
`pricing_changed` even when the client reviewed the current price. A new key did
not change the submission identity. Replacing the identity alone was also blocked
by `order_submissions_source_draft_unique` (actual PostgreSQL error `23505`).

Target identities:

| Identity | Meaning |
| --- | --- |
| `order_drafts.id` / `draftId` | Mutable draft lifecycle |
| `order_submissions.submission_id = finalizationKey` | One immutable attempt |
| `order_submissions.source_draft_id = draftId` | Link from every attempt to draft |
| `orders.source_draft_id` unique | At most one resulting production order |

CLI generated
`supabase/migrations/20260923143459_allow_multiple_draft_submission_attempts.sql`
after `supabase --help`, `supabase migration --help`, and
`supabase migration new --help`. The CLI was invoked through `npx --yes supabase`;
no repository dependency was added and no timestamp was invented.

The migration creates non-unique partial index
`idx_order_submissions_source_draft`, then drops only
`order_submissions_source_draft_unique`, in one transaction. Fail-closed checks
verify expected old/new index definitions, required order uniqueness, other
source-draft uniqueness and required RPC signatures. A rerun accepts the correct
replacement index. It changes no rows, columns, foreign keys, submission primary
key, reserved/order uniqueness, hashes, snapshots, leases, RLS, grants or RPC bodies.
Historical SQL files are untouched. No cleanup or backfill is introduced.

The shared finalization server uses `input.finalizationKey` as submission ID;
`sourceDraftId`, `draftExpectedVersion` and `draftFinalizationKey` retain their
existing trusted values. All four durable services use this same path. Direct
order identity and pricing formulas are unchanged.

```text
active D, version N
  -> draft claim(owner, D, N, K)
  -> validate live state/files and current authoritative quote
  -> submission claim(K, source=D), immutable hash/quote/reservation
  -> verify bytes and prepare server-generated file copies
  -> atomic commit: lock submission + draft, verify owner/service/route/N/status/K
  -> insert order/items/references/outbox + convert draft in same transaction
  -> remove source files only after confirmed DB success
```

Before submission claim, rejection releases the draft without a new reservation.
After submission claim, precommit Storage failure releases the submission lease
and draft claim while retaining historical snapshot and source files. Ambiguous
commit retains recovery context and looks up committed state. A source order is
reconciled before making another attempt; current commit converts the draft
atomically, while the interrupted-completion shape remains supported for history.

## Editing lock and client compatibility

Root cause: all Storage errors were classified as ambiguous, even when the server
had confirmed release and no order existed. Thus retry context kept editing locked.
The minimal change carries optional `draftReleased: true` through the existing
result/API/client types. It is emitted only for a precommit `storage_error` after
an exact successful release response for that draft. RPC failure, malformed data,
wrong draft ID, an existing order, or ambiguous commit do not grant this signal.

The shared classifier clears retry context only for HTTP 500 + `storage_error` +
literal `draftReleased === true`. All four forms pass this field to the existing
classifier/clear path. They already generate a new UUID after context clearing and
saving the current draft version. There is no new framework or UI component.
Generic status `active` alone does not authorize clearing an unknown in-flight
attempt; existing status/reconciliation behavior stays conservative.
An active submission's `in_progress` (including commit lease conflict) now returns
`finalization_conflict` before any draft release. Its handler, claim and browser
key stay intact. Previously the fallback produced `invalid_status`, which would
clear an unknown attempt and could rotate to another reservation under the new
identity model. The new case was reproduced red before this mapping change.

| Lifecycle | Behavior |
| --- | --- |
| Unknown/network/malformed/ambiguous response | Keep K1 and version; same-attempt retry |
| Confirmed released precommit Storage failure | Clear stale key/context, unlock editing |
| Edit and save N -> N+1, fresh finalization | Generate K2, current live state/quote |
| Existing source order / lost success response | Return/reconcile same order |
| Old response lacking new field | Preserve conservative retry behavior |

All forms already persist `{draftId, expectedVersion, finalizationKey}` in
sessionStorage; no storage schema conversion is required. The submit API accepts
only the strict existing body, derives owner from the verified server session,
and sets source identity server-side. Stale versions/keys remain rejected.
Old browser bundles already send UUID keys, but need refresh to consume the new
editing-unlock signal. Existing saved contexts can retry against the new server;
no historical submission deletion is needed to recover a D-keyed stuck draft.
Session storage remains best-effort and tab-scoped.

## Evidence and boundaries

Prior to the fix, unchanged production finalization/order-creation functions
reproduced both intended-success failures after controlled Storage.copy failure:
changed title/instructions -> `payload_conflict`; reviewed authoritative quote
950 -> 1900 USD cents -> `pricing_changed`. Logs:
`test-results/f5-service-red.log`. A loader-only one-line identity experiment also
hit the modeled unique conflict. Native PostgreSQL separately proved the actual
`23505`, so the schema diagnosis did not rely on a regex or mocked SQL algorithm.

Tracked production-function tests reproduced the payload/pricing RED before the
server edit (`test-results/f5-tracked-service-red.log`, 0/2 passed); they are now
part of the existing focused/CI suite. Final service result: **28/28 GREEN**
(`test-results/f5-tracked-service-green.log`):

- Released post-reservation Storage failure -> title/instruction/item edit ->
  K2 success with new request hash; K1 row stays unchanged.
- Newly reviewed authoritative price 950 -> 1900 cents gets a K2 snapshot while
  K1 retains its historical snapshot. No browser price becomes authoritative.
- Original and normalized reference replacement copies/commits only current live
  files. Old objects are not silently selected or removed by the new attempt.
- All four services use common K1/K2 identity with unchanged source draft/owner.
- Same unchanged K1 reuses its reservation. Reusing K1 after editing still fails
  immutable payload checks. Ownership/version/key/file-owner mismatches reject.
- Historical `submission_id=draftId` remains intact beside successful K2.
- Already-created order and historical interrupted completion run the real
  source reconciliation path, returning the same order without new submission,
  items, references or outbox rows.
- Exact release grants editing; nine malformed/error/existing-order release
  shapes and ambiguous commit withhold that signal. Preclaim original/reference
  verification failures use the same confirmed-release rule.
- Active same-key lease retains the draft claim and returns a retry-preserving
  conflict, with no new row, copy or release.

Client/API red -> green: the release bridge initially failed (15 passed / 1
failed), then all 16 API tests passed. Four extracted production form callbacks
prove unknown K1 stability, confirmed release clearing ref/state/sessionStorage,
edited version N+1 creating K2, and unchanged K2 retry. Removing only signal
forwarding in memory reproduced the former lock in all four forms; that temporary
test was removed. No UI layout, route or navigation markup was changed. Existing
responsive/focus behavior was reviewed conceptually at 360/390/768/1024/1440px;
no mounted-browser or pixel-layout verification is claimed.

Native PostgreSQL **17.6: 15 passed, 0 failed, 0 skipped**. Log:
`test-results/f5-postgres-red-green.log`; distinct backend PIDs 13972 and 25528.
The same run preserves pre-migration RED, applies the exact migration twice,
then proves GREEN:

- Missing order uniqueness or malformed replacement index fails closed with
  rollback. Both valid applications preserve complete synthetic rows and the
  protected indexes/constraints, RPC definitions/ACLs, table grants and RLS.
- Historical D-keyed row coexists unchanged with K2; new quote is stored and K2
  commits. Repeated K2 retains the reservation; old immutable state is untouched.
- Separate-connection lock barrier makes stale K1 wait for K2 takeover, then
  receive `draft_conflict`; current K2 succeeds. Wrong owner/version/key reject.
- A direct second order INSERT fails `23505` specifically on
  `orders_source_draft_id_unique`, proving the surviving database boundary.
- Overlapping commit/replay yields one order/item/reference and exactly one
  `client_confirmation` and `admin_notification` outbox row each.
- All four services and the unchanged versioned Welcome wrapper pass. Welcome
  replay creates no extra redemption; current loser cleanup preserves historical
  and winning attempts; reviewed K3 then succeeds.

Service tests run production orchestration, hashes, pricing, file verification and
preparation with synthetic transport/persistence/Storage/email. They establish
current live file/quote selection and safe signal propagation; they do not prove
PostgreSQL locking. Client tests run actual client functions and extracted real
form callbacks with controlled state/transport; they do not claim a live browser
or Supabase integration. PostgreSQL tests execute repository SQL and the real
forward migration in a fresh native local cluster using separate backend sessions
and observed lock barriers, not sleeps. No real upload/order/email is sent.

The existing Welcome wrapper stays unchanged. It keys locks/replay by
`p_submission_id`; its pre-existing definitive redemption-loser cleanup targets
only that current processing submission and reserved order. F5 adds no cleanup of
historical attempts. Wrapper replay, redemption uniqueness and loser isolation
must pass in the same real PostgreSQL run.

## Required rollout order (not performed)

1. An operator manually applies only the reviewed F5 migration.
2. Verify old/new index state, preserved order uniqueness and unchanged row counts.
3. Deploy the application patch together, including release-signal consumers.

Migration-first is backwards compatible: old servers continue using `draftId` as
submission ID and the primary key still serializes their old logical attempt.
New application code must not deploy first: new K2 could otherwise hit `23505`.
Existing tables take normal DDL locks while the small index change runs; plan the
manual operation accordingly. Do not replay historical initializers afterward:
that could recreate the obsolete submission uniqueness or replace current RPCs.
No automatic rollback, cleanup of abandoned attempts, or production rollout is
performed or promised.

## Read-only operator checklist

The following statements are documentation for the future operator. They have not
been run against production. They expose catalog definitions and aggregate counts
only, never client data. Capture counts immediately before and after the manual
migration during a controlled write window; ordinary concurrent traffic may also
change counts. The isolated test compares complete synthetic rows as well.

Before applying, verify required tables and all relevant RPC signatures:

```sql
BEGIN READ ONLY;
SELECT to_regclass('public.order_submissions') AS submissions,
       to_regclass('public.orders') AS orders;

SELECT signature, to_regprocedure(signature) IS NOT NULL AS present
FROM (VALUES
  ('public.claim_order_submission(uuid,uuid,text,smallint,text,uuid,uuid,text,text,text,integer,jsonb)'),
  ('public.release_order_submission(uuid,uuid,uuid,text)'),
  ('public.claim_order_draft_finalization(uuid,uuid,integer,uuid)'),
  ('public.release_order_draft_finalization(uuid,uuid,uuid)'),
  ('public.complete_order_draft_finalization(uuid,uuid,uuid,uuid,jsonb)'),
  ('public.commit_order_submission(uuid,uuid,text,uuid,text,text,text,text,text,jsonb,integer,uuid,jsonb)'),
  ('public.commit_order_submission_with_welcome_offer_v1(uuid,uuid,text,uuid,text,text,text,text,text,jsonb,integer,uuid,jsonb,text[])')
) AS required(signature);

-- Review every unique index/constraint, including unexpected expression keys.
SELECT t.relname AS table_name, c.relname AS index_name,
       i.indisunique, i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
WHERE i.indrelid IN ('public.order_submissions'::regclass, 'public.orders'::regclass)
ORDER BY t.relname, c.relname;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('public.order_submissions'::regclass, 'public.orders'::regclass)
  AND contype IN ('p', 'u', 'f')
ORDER BY conrelid::regclass::text, conname;

SELECT (SELECT count(*) FROM public.order_submissions) AS submission_count,
       (SELECT count(*) FROM public.orders) AS order_count;
COMMIT;
```

Expected before: `order_submissions_source_draft_unique` is a valid unique
single-key partial index on `source_draft_id IS NOT NULL`;
`orders_source_draft_id_unique` has the same unique partial shape on orders.
There must be no additional uniqueness definition that still forbids multiple
attempts for one source draft. Confirm effective claim/commit bodies match the
manifest and preserve owner/service/route/version/status/key checks.

After applying, rerun the catalog/count queries and this read-only summary:

```sql
SELECT to_regclass('public.order_submissions_source_draft_unique') IS NULL
         AS obsolete_index_absent,
       to_regclass('public.idx_order_submissions_source_draft') IS NOT NULL
         AS lookup_index_present;
SELECT c.relname, i.indisunique, i.indisvalid, pg_get_indexdef(i.indexrelid)
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.oid IN (
  to_regclass('public.idx_order_submissions_source_draft'),
  to_regclass('public.orders_source_draft_id_unique')
);
```

Expected after: old unique absent; new lookup valid and non-unique with the same
partial predicate; order index still valid and unique; submission/order counts
unchanged by migration. Missing prerequisites, unexpected index definitions or
another blocking unique key require investigation before application deployment.

## Validation and remaining limits

| Check | Final result |
| --- | --- |
| Draft finalization (including new service + client cases) | 312 passed in final CI |
| Finalization API | 16 passed |
| Draft files / file API / staging draft files | 60 / 17 / 38 passed |
| Order integrity including F3/F4 and Welcome | 251 passed |
| F1 checkout / F2 webhook | 36 / 89 passed |
| Pricing / Welcome relevant suite | 72 passed |
| Native PostgreSQL F3/F5 migration/concurrency/Welcome | 15 passed, none skipped |
| Full `test:ci` | 2227 passed, 52 invocations, none failed/skipped |
| `npm.cmd run typecheck:test` | Exit 0 |
| Production `npx.cmd tsc --noEmit` | Exit 0 |
| `npm.cmd run lint` | Exit 0; 0 errors, 9 pre-existing navigation warnings |
| `npm.cmd run build` | Exit 0 |
| `git diff --check` | Exit 0 |

Final logs are under `test-results/f5-final-*`; focused checks use
`test-results/f5-green-*`. PostgreSQL runtime is installed outside the repo.
Reproduce with the existing opt-in harness (no production URL is accepted):

```powershell
$env:F3_POSTGRES_BIN_DIR = Join-Path $env:TEMP 'picchuspot-f3-postgres-runtime/package/native/bin'
$env:F3_PG_DRIVER_MODULE = Join-Path $env:TEMP 'picchuspot-f3-postgres-runtime/node_modules/pg'
npm.cmd run test:order-submission-db
```

The harness creates/stops a fresh loopback cluster; missing runtime variables
report skipped, never passed. No dependency manifest or lockfile changed.
Independent reviews checked migration/SQL fences and the release signal; the
preclaim Storage and active-lease findings were addressed with focused cases.

Changed production files: `src/lib/order-drafts/finalization-server.ts`,
`finalization.ts`, `finalization-api.ts`, `finalization-client.ts`, and one signal
forwarding line in each Virtual Staging, Photo Editing, Virtual Renovation and
Floor Plans form. Updated tests: `order-draft-finalization.test.ts`,
`order-draft-finalization-api.test.ts`, `scripts/test-order-submission-postgres.mjs`.
Updated documentation: `supabase/MIGRATION_MANIFEST.md`.

Added files:

- `supabase/migrations/20260923143459_allow_multiple_draft_submission_attempts.sql`
- `src/lib/order-drafts/finalization-attempts.test.ts`
- `src/lib/order-drafts/order-draft-finalization-client.test.ts`
- `docs/f5-draft-finalization-blocker.md` (this existing local diagnostic report,
  updated for the completed patch; not previously committed).

Final fetch still resolves `origin/main` to the baseline: HEAD is 0 commits ahead
and 0 behind. `.codex` and original checkout changes are preserved.
Remaining rollout limits: manual migration/index verification must precede app
deployment; actual deployed schema/Storage/browser integration is not exercised;
old running bundles require refresh to consume the new release signal. Historical
abandoned attempts remain; their automatic cleanup is outside F5.

No production migration/data changes, real orders/uploads, commits, pushes, PRs,
merges or deployment are authorized or performed. No F6 pending-reference repair,
pricing formula change, direct recovery change or unrelated system is included.
