# Client account deletion

This PR is limited to client account deletion. Neither migration has been applied
by this task. Production Auth, Storage, data, configuration and Cron are untouched.

## Lifecycle and scheduling

1. Self deletion verifies the server Auth session; admin deletion verifies the
   existing admin cookie and resolves the selected Auth ID. Both require the exact
   current email. The request RPC rechecks Auth under a lock.
2. The request transaction binds eligible verified-email legacy orders, persists
   `account_deletion_requests`, tombstones owned orders, and captures temporary
   cleanup targets. Account access and new signed upload URLs are blocked at once.
   Self deletion signs out globally on the server and locally in the browser.
   The initial best-effort sweep removes only converted/deleted/expired drafts.
3. `pending` becomes eligible after the existing **2 hours 15 minutes** initial
   delay. This is an admission-expiry delay, **not a maximum transfer duration**.
   The worker sweeps currently visible temporary files, checks outstanding
   submission leases, verifies the DB/Auth preconditions, and hard-deletes Auth.
4. The durable record transitions to **`reconciling`**, with `auth_deleted_at` and
   `last_reconciled_at`. It remains claimable indefinitely. Every subsequent full
   scan revisits the temporary targets even if previous scans were empty.
5. The existing Supabase Cron job invokes one account per call every 15 minutes.
   `retry_after` is the durable next-run time: failures retry after 15 minutes;
   successful full scans back off for 24 hours. A ten-minute lease recovers crashes.
   Pending Auth deletions have priority over recurring scans; oldest due work wins
   within each state. Failures move behind other already-due requests. Monitor
   backlog age: due times are eligibility, not a promised completion SLA, and a
   sustained pending backlog can delay recurring work.
6. A server-only `cleanup_cursor` checkpoints each completed target. Interrupted
   scans resume, so a long target list need not fit in one invocation. A full pass
   resets the cursor before Auth/preflight, even if those later operations fail.
   Future passes revisit every target to catch late arrivals behind the cursor.

There is no terminal Storage-cleanup state, fixed reconciliation end date, or
finite number of empty scans that stops the worker. No generic queue is added.
A lost Auth response/completion write is retried with Auth already absent.

Supabase documents [two-hour signed upload validity](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).
The [standard signed-upload handler](https://github.com/supabase/storage/blob/76b70ba80e7c171d6b534db3c65430467a82f4bd/src/http/routes/object/uploadSignedObject.ts)
checks the token before consuming the upload. The [uploader](https://github.com/supabase/storage/blob/76b70ba80e7c171d6b534db3c65430467a82f4bd/src/storage/uploader.ts)
can finish later. No authoritative finite hosted transfer-duration bound was
established; the design does not depend on one. PicchuSpot uses standard uploads,
not TUS.

## Durable temporary targets

Only the private `order-files` bucket is used for deletion cleanup:

| Temporary data | Durable association after Auth/metadata deletion |
| --- | --- |
| Draft sources and draft references | Reconstruct `drafts/<account UUID>/...` from the deletion record. |
| Direct upload staging | Reconstruct `pending/<account UUID>/...`. |
| Pending rework references | Store each exact path in `account_deletion_cleanup_targets`; never sweep the whole review folder. |
| Previously retired pending rework references | A deletion-specific BEFORE DELETE trigger retains the exact path and stable order ID before existing rework retry cleanup removes metadata. The deletion request binds these targets to its account UUID. |
| Failed/incomplete submission copies | Capture the reserved order-number prefix when no actual order exists. No dependency on the later SET NULL/deleted submission row. |

The target table is server-only, RLS-enabled, and unreadable to browser roles.
It contains UUIDs, kind and path, never signed capabilities, credentials or email.
Its account link references the durable deletion record, not Auth. Retired rework
paths may exist with only their stable order ID before deletion is requested;
these rows do not schedule work or lock the account. No metadata FK erases targets.

Deletion-specific guards serialize new rework file inserts/completion and
submission claims against lockout. Legacy NULL-owner orders are serialized by an
order-row lock before target capture. This prevents a previously admitted handler
from adding an uncaptured path or committing a captured temporary reference.
Uploaded references are not captured. Before removing a saved rework target the
worker also checks that it has no uploaded metadata; before sweeping a submission
prefix it rechecks that no commercial order uses it.

Storage removal uses the Storage API, never SQL deletion of Storage metadata.
Unknown Auth-owned commercial objects block Auth deletion for investigation; they
are not indiscriminately purged or reassigned.

## Stale JWT and retained history

[Deleting an Auth user does not instantly invalidate their JWT](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users).
`getClientUser` denies every durable deletion record, including `reconciling`.
Restrictive RLS on `orders`, `client_profiles` and `order_drafts` also denies direct
JWT access. Native PostgreSQL tests load the actual permissive policies and prove
that the email-based deliverable/review policies apply the parent `orders` RLS;
no additional child policies or broader grants are needed.

The tests first prove positive authenticated access, then reuse the same JWT sub
and email during pending deletion and after Auth deletion. They verify denial on
`orders`, `order_items`, `order_deliverables`, `deliverable_reviews`,
`deliverable_review_files`, `order_drafts`, `order_draft_files`,
`order_draft_item_reference_files`, `order_item_reference_files`, and
`client_profiles`. `client_order_reviews` and the deletion tables remain
server-only. The same-email replacement account cannot read retained history.

Deleted: Auth identity/sessions; profile; account pricing and welcome-offer account
rows; drafts and their cascading file metadata; temporary Storage, including late
arrivals; pending rework metadata. Existing cascades/SET NULL behavior is preserved.

Retained: all submitted orders regardless of status, contact/pricing snapshots,
order items and commercial sources, deliverables, uploaded rework references,
reviews, submission history, payments/Stripe history, invoices and email history.
The immutable `orders.account_deleted_at` marker prevents email-based reclamation
or assignment to a future identity. No historical email is rewritten.

## Exact manual rollout (separate authorization required)

1. **Schema migration first:** review and manually apply
   `supabase/migrations/20261002095908_client_account_deletion.sql`. This adds the
   two deletion-specific tables/indexes, order tombstone, private helpers,
   restrictive policies, ownership/temporary-target guards, server-only RPCs and
   the existing client-review RPC's deletion predicate. Installation deletes no
   data and creates no deletion requests. Both migration files are unapplied;
   this revision edits them directly rather than adding corrective migrations.
2. **Deploy the matching application** through the normal reviewed process.
   Reuse `CRON_SECRET`; no new environment variables or secrets. **Application
   before schema is prohibited:** the account-state query fails closed for all
   authenticated portal clients, causing login redirects and gated API failures.
   This is not a claim that Supabase Auth itself or every direct API stops working.
3. **Production smoke with a controlled account**, before enabling the scheduler:
   verify ordinary portal access, exact-email confirmation, durable lockout/targets,
   self sign-out, dashboard/order/upload denial after request, selected-client admin
   behavior, and retention of expected commercial data. Use actual production
   authentication; preview QA fallbacks are not evidence. Observe the real initial
   delay; do not bypass it or manually mark a request finished.
4. **Only then manually apply the Cron scheduler migration**
   `supabase/migrations/20261002100706_schedule_account_deletion_worker.sql`.
   It reuses pg_cron/pg_net/Vault and `picchuspot_order_email_worker_secret`, with
   the dedicated `picchuspot-account-deletions` job every 15 minutes. The email job
   is unchanged. Exact reruns are no-ops; unexpected definitions fail closed.
5. **Verify actual worker HTTP execution and result.** Match the queued pg_net
   request ID to its HTTP response, as in `docs/f9-email-outbox-retry.md`. Confirm
   controlled-account Auth removal, `reconciling`, `last_reconciled_at`, durable
   targets/cursor, future `retry_after`, retained commercial records, and subsequent
   scheduled scans. Cron registration alone is insufficient. Monitor error codes,
   failed/overdue requests and recurring-scan lag; do not bypass failures manually.

Production-only uncertainty: deployed scheduler/secret agreement, provider
availability and actual historical Storage ownership still require this rollout
verification. Targets whose ownership metadata was already destroyed before this
schema existed cannot be reconstructed from this ledger; any pre-existing orphan
rework objects require a separate evidence-based inventory. No unknown commercial
namespace is purged to compensate. The unknown in-flight upload lifetime no longer
blocks this design: known temporary targets remain reconcilable indefinitely.

## Validation

`npm run test:account-deletion` uses the real Supabase SDK with isolated transport.
It covers request/auth boundaries, delayed admission, late upload after Auth and
metadata deletion via Cron, repeated empty scans, retries, checkpoint resumption,
pagination and commercial preservation.

`npm run test:account-deletion-db` creates native loopback-only PostgreSQL, applies
the exact schema migration twice, loads actual table/RLS SQL, and tests target
retention before/after metadata deletion, account/order lock races, stale JWTs,
same-email non-reclamation, grants, FK retention, pending priority, retries and
lease recovery. It never accepts a production connection string:

```powershell
$env:DELETION_POSTGRES_BIN_DIR = '<absolute directory containing initdb/postgres/pg_ctl>'
$env:DELETION_PG_DRIVER_MODULE = '<absolute path to external pg package>'
npm run test:account-deletion-db
```

Without those explicit paths it reports skipped, not passed. Playwright uses the
existing local fixtures. Admin keyboard order is pricing switch -> Delete account
-> next client's pricing switch, with visible focus and reverse navigation across
360/390/768/1024/1440px. The separate authenticated browser suite exercises the
interactive confirmation, failure/retry, sign-out, lockout and admin/worker flow.

Final execution results are recorded in PR #355. Repository skills used:
`picchuspot-debugging`, `picchuspot-frontend`, `picchuspot-change-verification`, and
`picchuspot-ui-qa`; also Supabase and Playwright skills/current vendor docs.
