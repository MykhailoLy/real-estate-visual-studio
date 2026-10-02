# Client account deletion

This change is narrowly scoped to client account deletion. It does not apply any
production migration, schedule a live job, change secrets, or delete real data.

## Lifecycle

1. The self-service endpoint verifies the current Auth session; the admin endpoint
   verifies the existing PicchuSpot admin cookie and resolves the selected Auth ID.
   Both accept only an exact `confirmationEmail`. Self-service cannot select an ID.
2. `request_client_account_deletion` locks the Auth identity and rechecks its current
   email. In one transaction it binds eligible verified-email legacy orders to
   that Auth ID, persists the pending request, and marks all owned orders with
   `orders.account_deleted_at`. This keeps legacy attachments attributable during
   cleanup. Snapshot email/name/phone/company are untouched.
3. `getClientUser` fails closed for every deletion record (including completed
   records). Restrictive RLS also blocks direct JWT reads/writes of profiles,
   orders and drafts; dependent order/file policies inherit those restrictions.
   The application requests an Auth ban. Self-delete signs out globally on the
   server and locally in the browser, then leaves the dashboard with a full
   navigation to the public confirmation page.
4. Initial cleanup removes only already converted/deleted/expired draft sources.
   Active/converting drafts and direct uploads wait. Initial Auth/Storage failures
   leave a durable locked pending request, never a claim of completed deletion.
5. All four client signing boundaries check account state both before and after
   signing. A signer racing the deletion cannot release a new capability after
   observing the pending record. Capabilities released before the request have
   Supabase's documented two-hour validity. The database sets eligibility to
   request time plus two hours and fifteen minutes, including a safety margin.
6. The dedicated Cron worker claims one eligible account with a ten-minute lease.
   It checks outstanding submission leases, recursively sweeps `drafts/<user-id>`
   and `pending/<user-id>`, removes incomplete rework attachments, and removes
   failed submission destinations only where no commercial order exists.
   Listing uses bounded batches and restarts at offset zero after removal.
7. Before hard deletion, a database preflight verifies the lease, elapsed delay,
   absence of active submissions, historical tombstones, and absence of Storage
   objects owned by that Auth ID. Unexpected owned commercial objects block
   deletion; they are never indiscriminately purged or reassigned.
8. `auth.admin.deleteUser(id, false)` hard-deletes Auth. Existing FK cascades remove
   account-only rows. Orders/reviews/submissions keep their existing SET NULL
   behavior. The request is then marked completed. The durable tombstone disallows
   all legacy-email access and prevents later ownership reassignment of these
   orders, even if the identical email is registered again.

Cross-system Storage, database and Auth operations are not one transaction.
Failures remain pending with a safe error code and a fifteen-minute retry delay.
A worker crash releases through lease expiry; a successful Auth delete followed
by a lost completion write is safely reconciled on retry. Cleanup has a bounded
time budget, so large accounts may require multiple invocations.

## Data retention

Deleted: Supabase Auth identity/sessions; client profile; account pricing and
welcome-offer account records; drafts and their cascading file metadata; temporary
draft/direct-upload objects; incomplete rework attachments; unused failed-order
storage destinations.

Retained: all submitted orders regardless of status, immutable customer/contact
and pricing snapshots, order items and commercial source files, delivered files,
uploaded rework references, reviews, historical submission records, payment/Stripe
history, invoices and email delivery history. No historical email is rewritten.
The small deletion request record retains UUID, timestamps, state, attempts and
safe error codes, without email, passwords, tokens or storage paths.

## Manual rollout (requires separate authorization)

1. Review and manually apply
   `supabase/migrations/20261002095908_client_account_deletion.sql` **before deploying
   the application**. Missing account-state schema deliberately fails closed in
   authenticated routes. The migration adds one table, its pending index, the
   order marker, a dedicated private helper schema, restrictive policies,
   ownership guard, three server-only RPCs, and the existing
   review RPC's deletion predicate. It does not backfill or delete accounts.
2. Deploy through the normal reviewed process. Existing `CRON_SECRET` is reused;
   no new environment variable or secret is needed.
3. Manually apply
   `supabase/migrations/20261002100706_schedule_account_deletion_worker.sql`.
   It follows the existing Supabase pg_cron/pg_net/Vault pattern, reusing
   `picchuspot_order_email_worker_secret` and scheduling the dedicated
   `picchuspot-account-deletions` job every fifteen minutes. The email job is
   unchanged. Exact reruns are no-ops; unexpected existing definitions fail.
4. Confirm the job's queued HTTP request ID against its actual HTTP result, as in
   `docs/f9-email-outbox-retry.md`. Cron scheduling success alone is insufficient.
   Check pending request age, attempts and `last_error_code`. Never manually mark
   a request completed to bypass a cleanup failure.

Production remains unverified by isolated tests: deployed scheduler execution,
Vault/endpoint secret agreement, provider availability, the documented upload TTL,
and cleanup of unexpected historical Storage ownership. The fifteen-minute margin
is not a substitute for the provider's upload-expiry contract. Do not lengthen the
provider's signed-upload lifetime without updating and verifying this delay.
**Before enabling the worker, verify the provider's maximum lifetime for uploads
admitted just before token expiry is below the fifteen-minute margin.** Token
expiry alone does not cancel an already admitted transfer. Without that bound,
a late object can appear after the sweep; production activation is blocked until
the bound is established or the cleanup delay/design is adjusted and retested.
See Supabase's [two-hour signed upload contract](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
and [upload implementation](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts).

## Validation

`npm run test:account-deletion` exercises real application helpers/routes with an
isolated Supabase SDK transport: session/admin checks, exact confirmation, upload
races, cleanup/Auth failures, retries, pagination, retained history and same-email
re-registration. The existing authenticated Playwright fixture covers responsive
confirmation at 360/390/768/1024/1440px, keyboard focus, loading/error/success,
sign-out, lockout and admin worker/listing behavior.

The native PostgreSQL test creates a new loopback-only synthetic cluster, applies
the exact migration twice, tests a real concurrent order/deletion lock barrier,
JWT RLS lockout, TTL claims, tombstone immutability and FK retention. It never
accepts a production connection string. With externally installed PostgreSQL and
the `pg` driver:

```powershell
$env:DELETION_POSTGRES_BIN_DIR = '<absolute directory containing initdb/postgres/pg_ctl>'
$env:DELETION_PG_DRIVER_MODULE = '<absolute path to external pg package>'
npm run test:account-deletion-db
```

Without those explicit paths the database test reports skipped, not passed.

Executed locally for this implementation:

- `npm run test:account-deletion`: 13 passed.
- `npm run test:account-deletion-db`: passed against native PostgreSQL, not skipped.
- `npm run test:ci`: 2,534 passed; no failed/skipped tests.
- `npm run lint`: passed, with nine existing Next.js navigation warnings in
  unchanged components.
- `npm run typecheck:test` and `npx tsc --noEmit --incremental false`: passed.
- `npm run e2e:partner-invites`: 30 passed, one existing CAPTCHA-dependent test
  skipped without its site key. The four account-deletion browser tests were
  rerun after the final cleanup changes and passed.
- `npm run build`: passed as the authenticated browser fixture's production
  build, using isolated local fixture configuration.
- `git diff --check`: passed.

Repository skills used: `picchuspot-debugging`, `picchuspot-frontend`,
`picchuspot-change-verification`, and `picchuspot-ui-qa`. Also consulted the
Supabase and Playwright skills and current Supabase reference documentation.
