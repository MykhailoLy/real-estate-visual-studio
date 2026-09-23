# F3 direct order submission recovery — review evidence

## Scope and baseline

Branch: `codex/fix-direct-order-submission-recovery`.
Baseline: `a919468acc0ce9c28f4944be72ce5c3c18606282` (main after F2).
Original reviewed head: `bf9f8c1b1a37a09facd9fbb13fba3b6b9fce278d`.
The patch is published in draft PR #340. Current commit and remote CI evidence
are recorded in that PR. No merge, manual deployment, production SQL, real order,
upload or email was performed.

The pre-existing `.gitignore` modification, untracked `debug.log` and `.codex`
configuration were preserved. F1/F2 payment code, pricing, hashes, auth/RLS,
upload paths/limits, transactional email architecture and draft finalization
behavior were not changed.

## Defects and implementation

1. Storage failure released the lease while retaining `processing`; recovery
   returned only that status. The read-only recovery GET now distinguishes an
   active lease from a released or server-expired lease. Its `retryable` result
   is advisory: PostgreSQL claim/commit still arbitrate every attempt.
2. The browser wrote `ambiguous` only after POST failed. Reload during POST left
   `uploaded`, which recovery skipped. The exact original JSON and `ambiguous`
   are now persisted synchronously before the mutating fetch. Failure to persist
   prevents POST. Recovery also checks legacy `uploaded` records.
3. A 404 previously cleared the ID, including when the first POST had not claimed
   yet. It now retains the context and permits only an explicit replay of the
   saved original request with the same ID. Invalid responses, 5xx, network loss,
   auth loss and pricing/hash rejection of recovery replay retain the context too.
4. Direct retries share final Storage paths. A failed or stale handler no longer
   removes prepared direct final files. Pending sources are removed only after
   confirmed commit; existing identity/signature verification stays in place.
   Draft copy cleanup is unchanged.
5. Direct source/reference path ownership is checked against the verified server
   identity before claim. A user switch while the first POST is still unclaimed
   cannot reserve its ID for the wrong account.

| Browser/server observation | Permitted action |
| --- | --- |
| `allocated`, no POST begun | Existing upload/form flow; no recovery claim |
| `uploaded` or `ambiguous`, committed | Open the existing order ID/number; no POST/upload |
| Active lease | Retain context; manual Check again; no polling |
| Released/expired lease | Explicit Retry original submission, exact saved JSON/ID |
| Valid recovery 404 | Same-ID replay only if original JSON exists; never a new ID |
| 401 | Sign in through the existing login/session boundary; retain context |
| Invalid/unknown/error response | Retain context and block changed/new intent |
| Legacy record without original JSON | Find committed order; otherwise retain/block and explain support recovery |

The existing recovery gate provides the retry action and blocks changed form
intent. No draft/autosave system or new submission stage was added. Storage holds
only JSON metadata/file references, never File bytes, signed upload tokens or
auth tokens. Same-page overlapping calls are guarded; cross-page requests rely
on the existing atomic database contract. Local errors before POST preserve the
mounted form and selected Files.

## Evidence and reproducibility

Red evidence executed production functions, not copies of their algorithms:
actual `submitOrder` at a controlled POST barrier persisted `uploaded`; legacy
recovery returned `none`; 404 deleted the ID. Service tests observed released
lease recovery returning `processing` and a stale handler deleting a shared
final file. A separate red test demonstrated wrong-account pre-claim reservation.
Those cases pass with the patch.

Original pre-review results (2026-09-23; follow-up results below):

| Check | Result |
| --- | --- |
| Focused order-integrity | 219 passed, 0 skipped (118 production service/file-integrity tests) |
| F1 Checkout | 36 passed |
| F2 webhook regressions | 89 passed |
| Full `test:ci` | 2145 passed across 52 invocations, 0 failed/skipped |
| `typecheck:test` | Exit 0 |
| Production `tsc --noEmit` | Exit 0 |
| Lint | Exit 0; 9 existing warnings in unchanged navigation/form files |
| Production build | Exit 0 |
| Focused Chromium | 8 passed |
| Native PostgreSQL | 5 passed, 0 skipped; separate backend sessions |
| `git diff --check` | Exit 0 |

Initial full-suite failures were source-shape assertions expecting the old unsafe
pricing-context clearing and unconditional final-file cleanup. They now assert
the intended retention behavior, with executable coverage alongside them.
Initial lint saw generated browser fixture JavaScript; the fixture now builds
outside the repository in OS temp. No lint rules were disabled. The first build
found stale `.next/dev/types/validator.ts` dated September 13 referencing routes
absent from current main. That generated directory was preserved in OS temp,
and the normal build and production typecheck then completed without changing
source or compiler checks. Logs are retained locally under `test-results/f3-*`.

Validation commands:

```powershell
npm.cmd run test:order-integrity
npm.cmd run test:stripe-checkout
npm.cmd run test:stripe-webhook
npm.cmd run test:ci
npm.cmd run typecheck:test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run e2e:order-submission-recovery
git diff --check
```

The opt-in DB test never accepts a database URL. Set absolute paths to an
installed local PostgreSQL binary directory and an external `pg` module, then:

```powershell
$env:F3_POSTGRES_BIN_DIR = Join-Path $env:TEMP 'picchuspot-f3-postgres-runtime/package/native/bin'
$env:F3_PG_DRIVER_MODULE = Join-Path $env:TEMP 'picchuspot-f3-postgres-runtime/node_modules/pg'
npm.cmd run test:order-submission-db
```

The verification runtime used native PostgreSQL 17.6 and `pg` 8.16.3, installed
only in OS temp. Each run creates and stops its own fresh loopback cluster with
synthetic data. Missing runtime variables report skipped, never passed.

## PR #340 review blockers: red → green

Before changing production code, the actual client functions reproduced both
blockers: a definitive fresh rejection still emitted recovery, and a failed
durable write after `uploaded` emitted recovery despite POST count zero. The
expanded client suite was **12 passed / 14 failed**. The four new browser tests
were **1 passed / 3 failed**: pricing and upgrade rejection hid the form; quota
failure hid the selected File behind support-only recovery. The conservative
replay test already passed. Logs: `test-results/f3-review-client-red.log` and
`test-results/f3-blockers-browser-red.log`.

The production follow-up changes only `src/lib/submit-order.ts`:

- `postStoredOrder` explicitly receives `fresh` or `recovery` from its two
  existing call sites. No new stages, storage fields or backend are introduced.
- A fresh pre-POST durability failure clears only its matching known-unsent
  record. It sends no POST, triggers no recovery gate/background retry and keeps
  the mounted form/File available. A later attempt must persist successfully.
- A fresh, well-formed definitive rejection clears only its matching record.
  The allowlist uses the actual API's status/code contracts: 409 pricing,
  client-upgrade and custom-quote rejections; 422 profile-incomplete; uncoded
  route validation 400 and explicit pre-order input/pricing validation codes.
  `currentPricingSnapshot` is returned unchanged so the existing form can confirm
  the current quote and then start a new logical submission.
- A replay never clears an earlier unknown operation on either failure. An old
  POST may still be running before claim. Network loss, malformed/empty results,
  5xx, unknown codes, active/conflicting/unavailable submissions and ownership
  ambiguity (including `invalid_upload`) also retain the original context.

Final follow-up results (2026-09-23):

| Check | Result |
| --- | --- |
| Actual client submit/recovery functions | 26 passed, including both blockers |
| Focused order-integrity | 235 passed |
| F1 / F2 | 36 / 89 passed |
| Full `test:ci` | 2161 passed across 52 invocations; 0 failed/skipped |
| Chromium F3 | 12 passed (original 8 plus 4 review regressions) |
| PostgreSQL 17.6 | 5 passed, 0 skipped; separate backend connections |
| Test and production typechecks | Both exit 0 |
| Lint / production build | Both exit 0; lint 0 errors, 9 pre-existing warnings |
| `git diff --check` | Exit 0 |

The PostgreSQL rerun again used a fresh synthetic loopback cluster and separate
connections, including distinct backend PIDs 38408 and 44160. Existing active,
released/expired takeover, stale-token, overlapping claim/commit, ownership,
hash/pricing and per-notification outbox-count guarantees passed unchanged.
Browser fixtures establish UI/action order, not DB concurrency or production
traffic. Logs: `test-results/f3-review-*.log` and
`test-results/f3-blockers-browser-green.log`.

The follow-up contains only the client lifecycle change, its client/browser
regressions and this evidence update. It changes no SQL, schema, migrations,
server claim/commit, pricing calculation, auth/RLS or F5 draft finalization.

Evidence boundaries:

- Browser: actual production submit/recovery/gate modules, actual CSS, synthetic
  loopback HTTP/Storage responses. Controlled request barriers verify reload,
  retry, 404 overlap, no polling, duplicate clicks, authorization/error retention
  and no lost File after a pre-POST failure. UI checked at 360, 390, 768, 1024,
  1440 px, including focus, button contrast and overflow. This is not a live
  authenticated application or Storage integration test.
- Service: actual `createProductionOrder` and recovery GET with synthetic
  dependencies; verifies Storage failures/partial success, replay, ownership,
  stale-handler file retention and handling of claim/commit outcomes. Service
  barriers do not themselves prove PostgreSQL concurrency.
- DB: exact repository SQL bodies including the current commit override execute
  in separate native PostgreSQL sessions. Database lock barriers cover active
  refusal, release/expiry takeover, stale token rejection, invisible uncommitted
  claim, concurrent commit/replay, ownership/hash/pricing conflicts. Counts prove
  one order/item/reference and one outbox row for each expected kind separately:
  `admin_notification` and `client_confirmation`. No email provider is invoked.

## Rollout and remaining limitations

No schema change, migration or separate database rollout is required. Ship the
application patch together through normal review/deployment; none was deployed
as part of this task. The SQL under `scripts/fixtures/` is test scaffolding only.
Already-open tabs need to load the new client code; deployment does not rewrite
an older running JavaScript bundle or restore metadata that was never saved.

Historical committed submissions can be found from legacy `uploaded` or
`ambiguous` records. Historical uncommitted records without original metadata
cannot be reconstructed safely from file descriptors or an altered form; they
remain blocked with an explanation and submission ID for support. No blanket
processing/file cleanup or historical backfill was performed.

Session storage remains tab-scoped; closed/cleared browser storage and incomplete
uploads do not gain a new persistence guarantee. No restoration of lost,
never-uploaded File bytes is promised. Retries still enforce immutable hashes
and current pricing. Reconfirming an altered draft after finalization failure
remains F5, outside this patch. Intentionally retained final files from abandoned
attempts may require a separately reviewed cleanup process. The DB test models
the existing SQL contracts, not deployed production migration state.

## Files

Production: `src/lib/submit-order.ts`,
`src/lib/orders/submission-recovery.ts`,
`src/components/order/OrderSubmissionRecoveryGate.tsx`,
`src/lib/orders/create-order-server.ts`,
`src/app/(public)/api/order/submissions/[submissionId]/route.ts`.

Updated test wiring/expectations: `package.json`,
`src/lib/orders/submission-recovery.test.ts`,
`src/lib/orders/direct-order-file-integrity.test.ts`,
`src/lib/orders/atomic-order-migration.test.ts`,
`src/lib/order-drafts/order-draft-finalization.test.ts`.

Added: `src/lib/orders/submit-order-recovery.test.ts`,
`e2e/order-submission-recovery.config.ts`,
`e2e/order-submission-recovery/recovery.spec.ts`,
`e2e/support/order-submission-browser-fixture.ts`,
`scripts/test-order-submission-postgres.mjs`,
`scripts/fixtures/order-submission-postgres.sql`, and this review note.
