# PicchuSpot Supabase Migration Manifest

## F9 email-outbox retry scheduler — 2026-09-23

Pending manual migration:
`migrations/20260923161749_schedule_order_email_outbox_retry.sql`.
**Production was not changed by this task. Do not apply automatically.**

Enables `pg_cron` (registration in `pg_catalog`) and `pg_net` (registration in
`extensions`, functions in `net`) using Supabase's documented schemas. Preserves
pg_net extension ACLs and assumes the standard Supabase configuration where `net`
is not exposed through the Data API. The transient queue contains resolved HTTP
headers during normal pg_net operation; do not expose or log them. A read-only
Vault preflight aborts if anon/authenticated has schema USAGE or SELECT on
`vault.decrypted_secrets`; no Vault grants or server-side access are modified.
Requires existing encrypted Vault storage and exactly one nonempty secret
named `picchuspot_order_email_worker_secret`, matching Vercel `CRON_SECRET`.
Schedules one `picchuspot-order-email-outbox` job at `*/15 * * * *` to POST to
`https://picchuspot.com/api/internal/order-email-outbox`. The command reads Vault
at execution time; no secret value is embedded or created. Exact reruns are
no-ops; missing prerequisites or a conflicting job definition abort the transaction.
Outbox tables and claim/complete RPCs are unchanged.

Rollout: generate matching secrets → configure Vercel and Vault → deploy worker
health patch → verify authenticated manual POST → apply this migration manually
→ verify job definition, first scheduler run, correlated pg_net HTTP response,
and outbox aggregates. Cron success proves enqueue only, not worker HTTP 200.
See [F9 rollout, evidence and limitations](../docs/f9-email-outbox-retry.md).

## F5 draft submission attempts — 2026-09-23

Pending manual migration:
`migrations/20260923143459_allow_multiple_draft_submission_attempts.sql`.
Production state: **not executed by this task**.

Requires the atomic submission foundation, current four-service draft claim/commit
from `allow-floor-plan-draft-finalization.sql`, and the current Welcome Offer
wrapper (`add-welcome-offer-redemptions.sql` / `fix-welcome-offer-rpc-coalesce.sql`).
Verify this effective state; do not replay historical initializers.

Replaces `order_submissions_source_draft_unique` with the non-unique partial
lookup index `idx_order_submissions_source_draft`. Each immutable draft attempt
uses `finalizationKey` as its `submission_id`; historical attempts may share
`source_draft_id`. Submission primary-key identity, hashes, snapshots, leases,
foreign keys, reserved/order ID uniqueness, RLS/grants and RPC bodies are unchanged.
`orders_source_draft_id_unique` remains the authoritative one-draft-one-order
boundary alongside locked draft owner/version/status/finalization-key checks.
No rows are deleted, rewritten or backfilled.

Rollout order: **manual migration → verify index state → application deployment**.
Migration-first remains compatible with the old application: it still uses
`submission_id = draftId`, protected by the submission primary key. Deploying
the new attempt identity before migration can produce `23505`. The migration
checks prerequisites and accepts an already-correct replacement index on rerun.
See [F5 evidence and read-only operator checklist](../docs/f5-draft-finalization-blocker.md).

## Property Showcase raw-record privacy — 2026-09-19

Pending manual migration: `migrations/20260919175745_harden_property_showcase_raw_access.sql`.
See [preflight, verification and fail-closed recovery](PROPERTY_SHOWCASE_PRIVACY_RUNBOOK.md).
Production has **not** been changed. Browser roles must lose raw table access;
public pages continue through the existing service-role loader and privacy serializer.
The foundation initializer's grant/policy block is corrected solely to prevent
fresh initialization or a later replay from restoring the exposure. This does not
replace the forward migration for existing databases or authorize historical replay.

## Client work-ready emails — 2026-09-09

**Manual Supabase migration required before deploying the application code.**

New migration: `20260909210000_add_order_delivered_email.sql`.
Production application status: **not executed by this task**.

Prerequisites are the current `orders`, `order_deliverables`, `deliverable_reviews`
and `order_email_deliveries` tables, their existing updated-at triggers, and the
outbox claim/completion functions. The outbox definitions originate in
`add-atomic-order-submissions.sql` and `add-payment-confirmation-email.sql`.
Verify prerequisites; do not replay those historical scripts to install this change.

The migration expands the allowed delivery kinds and adds two service-role-only,
`SECURITY INVOKER` functions with a fixed search path:

- `mark_order_delivered_with_email(UUID)` locks the order and atomically updates
  its status and enqueues `order_delivered` on its first observed non-delivered
  to delivered transition. An already-delivered request cannot enqueue a new event.
  The existing unique `(order_id, delivery_kind)` constraint prevents duplicates,
  including later status toggles. The admin route still applies its existing
  authentication and payment gate before calling this function.
- `attach_replacement_with_email(UUID, UUID)` conditionally attaches a replacement
  to an active rework review and enqueues the existing `admin_replacement_ready`
  event in the same transaction. The route verifies the persisted Storage object
  exists with its expected size first; SQL rechecks status, empty replacement slot,
  same order/image assignment, a different original file, and expiry. Its delivery
  kind is `admin_replacement_ready:<review UUID>` so each review cycle has one
  delivery while preserving existing outbox uniqueness and enqueue functions.

Neither function runs at migration installation. There are no new triggers,
historical email backfills, new tables, RLS changes, table-grant changes, Storage
changes, or changes to payment, order submission, or customer upload functions.
Reapplying the migration preserves existing rows and delivery state.

Both routes dispatch after responding through the existing outbox; rework retains
the `sendReviewWorkflowEmail` lifecycle entry point and has no second direct send.
Both payloads use the persisted order's name/email and canonical direct order URL.
The new work-ready renderer uses only public brand artwork, the current theme,
four verified service routes, one primary CTA, and an equivalent plain-text body.

### Recovery and validation limits

The existing outbox retains pending/failed/unknown outcomes, stable Resend keys,
payload hashes, five-minute claim leases and its three-attempt limit. Unknown
outcomes are only reclaimed within the existing 24-hour idempotency window.
F9 adds a separate, pending manual Supabase Cron migration (see above). Until its
rollout, recovery uses the existing dispatcher or authenticated
`POST /api/internal/order-email-outbox` operational path; a repeated
delivered status request also drains existing retryable events. Do not clear sent
rows or regenerate keys to retry. Expired unknown outcomes, exhausted attempts,
and payload-hash mismatches require operator review before any resend.

Repository tests cover rendering, mocked route/claim concurrency, persisted
recipients, failed/unknown provider outcomes, retry keys, separate rework cycles,
and Storage/finalization gating. SQL contracts are checked statically; the migration
has not been executed against PostgreSQL or Supabase. Browser rendering was checked
at 360, 390, 768, 1024 and 1440 px, including keyboard focus and content without
images. Actual Gmail/Outlook delivery and SQL transaction behavior remain manual
rollout checks; no client test email was sent.

Manual rollout checks after migration/application deployment:

- Confirm one outbox event and one email for a test order's first delivery;
  repeated delivered and later status toggles must not duplicate it.
- Finalize a test rework: pending/missing/partial Storage objects must not attach
  or notify; completed attachment must create one event per review cycle.
- Verify provider-failure recovery via the existing worker without changing order
  or review state; confirm both CTA links open the correct authenticated order.
- Inspect both emails in Gmail/Outlook with images enabled and blocked.

> Documentation only. This file does not authorize replaying, reordering, or executing any SQL.

## Purpose

PicchuSpot currently has historical SQL files directly under `supabase/`, while the live Supabase migration ledger contains only a small subset of those changes. This manifest records the best-supported migration lineage, replay hazards, and current repository authority so future database work does not rely on alphabetical file order or memory.

This manifest is pinned to the repository state audited at:

`2398239d963483c914c30d49c8da16838d926f67`

All file classifications below refer to the content present at that commit unless a later migration explicitly supersedes this document.

## Safety rules

1. **Do not run all files in `supabase/` alphabetically.** That order is known to fail on a clean database and can regress an existing database.
2. **Do not replay a file marked `UNSAFE`.** These files contain historical definitions, policies, constraints, or storage behavior that can overwrite newer state.
3. **Treat `CONDITIONAL` as requiring explicit preflight.** Verify prerequisites, live catalog state, and data compatibility before execution.
4. **Do not edit historical SQL in place for new production changes.** Going forward, create a new timestamped immutable migration for each database change.
5. **Do not infer production state from this manifest alone.** The official ledger is incomplete and some historical SQL was applied manually.
6. **Never weaken RLS or add browser policies merely to silence Supabase Advisor.** Several tables are intentionally service-role/server-only.
7. **Never execute a migration automatically from an agent task.** Database execution requires a separately reviewed, explicit production action.

## Evidence model

`Production evidence` uses these values:

- `ledger` — confirmed by the live Supabase migration ledger.
- `repository-doc-claim` — repository documentation claims manual application, but the live catalog was not independently matched to the exact file hash.
- `unknown` — no authoritative production application record is tracked.

`Replay safety` uses:

- `SAFE` — no known target-state regression when prerequisites exist.
- `CONDITIONAL` — requires exact prerequisites, state/data checks, or one-time preflight.
- `UNSAFE` — known to regress current repository semantics or recreate intentionally removed state.
- `UNKNOWN` — insufficient evidence.

## Confirmed live migration ledger

At the audit commit, the live Supabase ledger contained only:

| Version | Name | Repository file |
| --- | --- | --- |
| `20260730142053` | `add_property_showcase_foundation` | `add-property-showcase-foundation.sql` |
| `20260824002916` | `add_atomic_order_submissions` | `add-atomic-order-submissions.sql` |
| `20260825082925` | `add_payment_confirmation_email` | `add-payment-confirmation-email.sql` |
| `20260830053216` | `fix_welcome_offer_rpc_coalesce` | `fix-welcome-offer-rpc-coalesce.sql` |

The ledger is **not** a complete representation of the schema currently required by production application code.

## SQL inventory and lineage

The logical IDs below follow the best-supported historical repository chronology. They are documentation IDs only; they are not Supabase migration versions.

| ID | File | Role | Depends on | Superseded / followed by | Production evidence | Replay safety |
| --- | --- | --- | --- | --- | --- | --- |
| `PS-SQL-001` | `schema.sql` | Consolidated base for orders, items, sequences, numbering, ownership, job title, pricing snapshot, triggers, RLS and grants | Auth schema | Security overlays and later order/draft/submission migrations | `unknown` | `UNSAFE` |
| `PS-SQL-002` | `portfolio.sql` | Consolidated portfolio table, public-read RLS, grants, public bucket UPSERT and storage listing policy | `update_updated_at()`, Storage | Gallery/display-location content absorbed; storage listing later hardened | `unknown` | `UNSAFE` |
| `PS-SQL-003` | `site-media.sql` | Consolidated site media schema, current section check, RLS, grants, public bucket UPSERT and storage listing policy | `update_updated_at()`, Storage | Section patches absorbed; storage listing later hardened | `unknown` | `UNSAFE` |
| `PS-SQL-004` | `add-service-options-section.sql` | Historical site-media section widening for `service-options` | Site media | `add-order-card-section.sql`, current `site-media.sql` | `unknown` | `UNSAFE` |
| `PS-SQL-005` | `add-client-profiles.sql` | Client profile table, own-row policies and update trigger | `auth.users` | Security hardening adjusts policy/function configuration | `unknown` | `UNSAFE` after hardening |
| `PS-SQL-006` | `add-order-deliverables.sql` | Deliverable metadata, indexes, client read policy, service-role writes | Orders | RLS optimization overlay | `unknown` | `CONDITIONAL` |
| `PS-SQL-007` | `add-deliverable-reviews.sql` | Deliverable reviews, active-rework uniqueness, trigger, client read policy | Deliverables, orders, update helper | Policy optimization and replacement-deliverable FK index | `unknown` | `CONDITIONAL` |
| `PS-SQL-008` | `add-deliverable-review-files.sql` | Review-file metadata, FKs/indexes, client read policy, service-role writes | Reviews, deliverables, orders | Policy optimization | `unknown` | `CONDITIONAL` |
| `PS-SQL-009` | `portfolio-gallery-filter.sql` | Historical portfolio gallery filter column/index | Portfolio | Current `portfolio.sql` | `unknown` | `SAFE` |
| `PS-SQL-010` | `portfolio-display-locations.sql` | Historical gallery/service-page flags, backfill and indexes | Portfolio | Current `portfolio.sql` | `unknown` | `CONDITIONAL` |
| `PS-SQL-011` | `order-account-ownership-foundation.sql` | Historical `orders.user_id`, ownership backfill and policies | Orders, `auth.users` | Current `schema.sql`, security hardening | `unknown` | `UNSAFE` |
| `PS-SQL-012` | `add-order-card-section.sql` | Historical site-media section widening for `order-card` | Site media, service-options state | Current `site-media.sql` | `unknown` | `CONDITIONAL` |
| `PS-SQL-013` | `add-order-job-title.sql` | Historical `orders.job_title` and length check | Orders | Current `schema.sql` | `unknown` | `CONDITIONAL` |
| `PS-SQL-014` | `add-order-pricing-snapshot.sql` | Historical immutable pricing snapshot column/check | Orders | Current `schema.sql` | `unknown` | `SAFE` |
| `PS-SQL-015` | `add-order-drafts.sql` | Drafts/files foundation, finalization fields, historical slot uniqueness, RLS/grants | Orders, update helper | Upload foundation replaces old uniqueness; policies later hardened | `unknown` | `UNSAFE` |
| `PS-SQL-016` | `add-order-draft-file-upload-foundation.sql` | Current draft upload RPCs and uploaded-only uniqueness | Draft tables, update helper | Current for upload RPC/index behavior | `unknown` | `CONDITIONAL` |
| `PS-SQL-017` | `add-order-draft-finalization.sql` | `orders.source_draft_id`; claim/release/recover/complete finalization RPCs | Orders, drafts, files | Compatibility chain widens claim behavior; complete ambiguity fix | `unknown` | `UNSAFE` |
| `PS-SQL-018` | `fix-order-draft-finalization-complete-ambiguity.sql` | Historical qualified-reference fix for complete-finalization RPC | Draft finalization | Current foundation body is semantically equivalent | `unknown` | `SAFE` |
| `PS-SQL-019` | `security-hardening-function-and-table-grants.sql` | Function search-path and execute/table privilege hardening with strict preflight | Named tables/helpers; external `rls_auto_enable()` assumption | Current security overlay | `unknown` | `CONDITIONAL` |
| `PS-SQL-020` | `security-hardening-public-bucket-listing.sql` | Removes broad public `storage.objects` listing policies without privatizing public buckets | Exact bucket/policy state | Current security overlay | `unknown` | `CONDITIONAL` |
| `PS-SQL-021` | `security-hardening-rls-auth-init-plan.sql` | Rewrites auth policy expressions to scalar subqueries | Exact pre-hardening policies | Current security overlay | `unknown` | `CONDITIONAL` |
| `PS-SQL-022` | `performance-add-deliverable-replacement-fk-index.sql` | Fail-closed preflight and replacement-deliverable FK index | Deliverable reviews | Current | `unknown` | `CONDITIONAL` |
| `PS-SQL-023` | `add-stripe-payment-data-model.sql` | Payment records and Stripe webhook idempotency tables; RLS-zero-policy server-only design | Orders, update helper | Current | `unknown` | `SAFE` on expected schema |
| `PS-SQL-024` | `add-property-showcase-foundation.sql` | Property Showcase document table, update trigger and published-read policy | `pgcrypto` | Leads and analytics extensions | `ledger` | `SAFE` |
| `PS-SQL-025` | `add-property-leads.sql` | Private property lead table, checks/indexes, RLS-zero-policy | Property Showcase | Current | `unknown` | `SAFE` |
| `PS-SQL-026` | `add-property-showcase-analytics.sql` | Private property analytics events, checks/indexes, RLS-zero-policy | Property Showcase | Current | `unknown` | `SAFE` |
| `PS-SQL-027` | `add-multi-reference-files.sql` | Normalized draft/final reference tables, constraints, backfills, RLS/grants | Drafts/files, orders/items, update helper | Current; atomic commit depends on it | `unknown` | `CONDITIONAL` |
| `PS-SQL-028` | `add-atomic-order-submissions.sql` | Durable submission ledger, outbox, claim/release/commit RPCs, leases/idempotency and server-only tables | Current orders/drafts/source-draft state, normalized references, numbering | Photo → renovation → floor-plan compatibility chain replaces commit definition | `ledger` | `UNSAFE` |
| `PS-SQL-029` | `add-payment-confirmation-email.sql` | Extends outbox kind check and adds verified-paid enqueue RPC | Atomic outbox, payment tables | Current | `ledger` | `CONDITIONAL` |
| `PS-SQL-030` | `allow-photo-editing-draft-finalization.sql` | Widens claim/commit support from staging to staging + photo editing | Atomic + draft finalization | Renovation then floor-plan compatibility | `unknown` | `UNSAFE` |
| `PS-SQL-031` | `allow-virtual-renovation-draft-finalization.sql` | Widens claim/commit to staging + photo editing + renovation | Previous compatibility state | Floor-plan compatibility | `unknown` | `UNSAFE` |
| `PS-SQL-032` | `allow-floor-plan-draft-finalization.sql` | Final four-service claim/commit compatibility | Atomic + prior compatibility + normalized references | Current repository authority for claim/commit allowlists | `unknown` | `SAFE` with prerequisites |
| `PS-SQL-033` | `add-welcome-offer-redemptions.sql` | Welcome Offer redemption table, uniqueness and versioned commit wrapper | Atomic submission, orders, final commit definition | Historical COALESCE hotfix; current file body already corrected | `repository-doc-claim` | `CONDITIONAL` |
| `PS-SQL-034` | `fix-welcome-offer-rpc-coalesce.sql` | Historical hotfix for Welcome Offer wrapper plus grants | Welcome table, atomic/final commit | Current historical authority; current foundation body is equivalent | `ledger` | `SAFE` with prerequisites |
| `PS-SQL-035` | `20260909191236_add_deliverable_review_file_upload_status.sql` | Forward-only F-001 lifecycle foundation; backfills historical rows and preserves the pre-Phase-2 writer as uploaded | Review-file table | Phase 2 application behavior switch | `unknown` | `SAFE` with prerequisite table |

## Historical repository lineage

This is chronology documentation, **not a replay instruction**:

1. `schema.sql`
2. `portfolio.sql`
3. `site-media.sql`
4. `add-service-options-section.sql`
5. `add-client-profiles.sql`
6. `add-order-deliverables.sql`
7. `add-deliverable-reviews.sql`
8. `add-deliverable-review-files.sql`
9. `portfolio-gallery-filter.sql`
10. `portfolio-display-locations.sql`
11. `order-account-ownership-foundation.sql`
12. `add-order-card-section.sql`
13. `add-order-job-title.sql`
14. `add-order-pricing-snapshot.sql`
15. `add-order-drafts.sql`
16. `add-order-draft-file-upload-foundation.sql`
17. `add-order-draft-finalization.sql`
18. `fix-order-draft-finalization-complete-ambiguity.sql`
19. `security-hardening-function-and-table-grants.sql`
20. `security-hardening-public-bucket-listing.sql`
21. `security-hardening-rls-auth-init-plan.sql`
22. `performance-add-deliverable-replacement-fk-index.sql`
23. `add-stripe-payment-data-model.sql`
24. `add-property-showcase-foundation.sql`
25. `add-property-leads.sql`
26. `add-property-showcase-analytics.sql`
27. `add-multi-reference-files.sql`
28. `add-atomic-order-submissions.sql`
29. `add-payment-confirmation-email.sql`
30. `allow-photo-editing-draft-finalization.sql`
31. `allow-virtual-renovation-draft-finalization.sql`
32. `allow-floor-plan-draft-finalization.sql`
33. `add-welcome-offer-redemptions.sql`
34. `fix-welcome-offer-rpc-coalesce.sql`
35. `20260909191236_add_deliverable_review_file_upload_status.sql` — forward-only; apply only after the review-file table exists.

The exact production execution order for non-ledgered files is **unknown**.

## Provisional clean-database effective sequence

This is the smallest non-regressive sequence supported by the audited repository structure. The read-only live catalog comparison was completed on 2026-09-08; this sequence remains **provisional until an empty-database integration exercise is completed**.

1. `schema.sql`
2. `portfolio.sql`
3. `site-media.sql`
4. `add-client-profiles.sql`
5. `add-order-deliverables.sql`
6. `add-deliverable-reviews.sql`
7. `add-deliverable-review-files.sql`
8. `20260909191236_add_deliverable_review_file_upload_status.sql`
9. `performance-add-deliverable-replacement-fk-index.sql`
10. `add-order-drafts.sql`
11. `add-order-draft-file-upload-foundation.sql`
12. `add-order-draft-finalization.sql`
13. `add-multi-reference-files.sql`
14. `add-stripe-payment-data-model.sql`
15. `add-property-showcase-foundation.sql`
16. `add-property-leads.sql`
17. `add-property-showcase-analytics.sql`
18. `add-atomic-order-submissions.sql`
19. `add-payment-confirmation-email.sql`
20. `allow-photo-editing-draft-finalization.sql`
21. `allow-virtual-renovation-draft-finalization.sql`
22. `allow-floor-plan-draft-finalization.sql`
23. `add-welcome-offer-redemptions.sql`
24. Apply security overlays only after their exact preconditions are verified.
25. Apply `security-hardening-public-bucket-listing.sql` only after all expected buckets exist and their intended visibility is verified.

Historical files whose current content has been absorbed into consolidated foundations should be omitted from a future clean baseline:

- `order-account-ownership-foundation.sql`
- `add-order-job-title.sql`
- `add-order-pricing-snapshot.sql`
- `portfolio-gallery-filter.sql`
- `portfolio-display-locations.sql`
- `add-service-options-section.sql`
- `add-order-card-section.sql`

The two fix files remain important historical evidence even where the amended foundation currently contains equivalent logic.

## Why alphabetical replay is prohibited

Concrete known failures include:

- `add-atomic-order-submissions.sql` sorts before its required order/draft/reference foundations and cannot initialize an empty database.
- `add-order-draft-file-upload-foundation.sql` sorts before `add-order-drafts.sql` even though it alters draft indexes/functions.
- Replaying `add-order-drafts.sql` after the upload foundation recreates the obsolete `order_draft_files_one_active_kind_per_item` restriction.
- Finalization compatibility must end with floor-plan support. Alphabetical order does not preserve the photo → renovation → floor-plan lineage.
- `add-service-options-section.sql` can remove `order-card` support if replayed after the later order-card state.
- `site-media.sql` and `portfolio.sql` can recreate broad storage listing policies removed by later security hardening.

## Authoritative function lineage

### `claim_order_draft_finalization(uuid, uuid, integer, uuid)`

Lineage:

1. `add-order-draft-finalization.sql` — Virtual Staging only.
2. `allow-photo-editing-draft-finalization.sql` — adds Photo Editing.
3. `allow-virtual-renovation-draft-finalization.sql` — adds Virtual Renovation.
4. `allow-floor-plan-draft-finalization.sql` — adds Floor Plans.

**Current repository authority:** `allow-floor-plan-draft-finalization.sql`.

Replaying any earlier definition afterward narrows supported draft services.

### `commit_order_submission(...)`

The current function has the established 13-argument application contract; see the SQL source for the exact parameter list.

Lineage:

1. `add-atomic-order-submissions.sql` — staging draft compatibility.
2. `allow-photo-editing-draft-finalization.sql` — adds Photo Editing.
3. `allow-virtual-renovation-draft-finalization.sql` — adds Virtual Renovation.
4. `allow-floor-plan-draft-finalization.sql` — final four-service behavior.

**Current repository authority:** `allow-floor-plan-draft-finalization.sql`.

Replaying the atomic foundation or an earlier compatibility file afterward is a known regression.

### `complete_order_draft_finalization(uuid, uuid, uuid, uuid, jsonb)`

Lineage:

1. `add-order-draft-finalization.sql`
2. `fix-order-draft-finalization-complete-ambiguity.sql`

**Historical authority:** `fix-order-draft-finalization-complete-ambiguity.sql`.

The current audited foundation body is semantically equivalent, so the fix file should be retained as history rather than replayed blindly.

### `commit_order_submission_with_welcome_offer_v1(...)`

Lineage:

1. `add-welcome-offer-redemptions.sql`
2. `fix-welcome-offer-rpc-coalesce.sql`

**Historical authority:** `fix-welcome-offer-rpc-coalesce.sql`.

The current audited Welcome Offer foundation already contains the corrected body, but production historically required the hotfix.

### Baseline helpers affected by hardening

`generate_order_number(text)`, `update_updated_at()`, and `update_client_profile_updated_at()` have functional bodies in their foundation files and later security configuration in `security-hardening-function-and-table-grants.sql`.

Replaying a foundation after that overlay can undo terminal hardening even if the function body appears unchanged.

## Access and RLS expectations

Zero-policy RLS is intentional for several server-only tables. Do not add browser policies merely to remove Advisor informational findings.

| Table | Expected access | Repository policy intent |
| --- | --- | --- |
| `orders` | Primarily trusted server; authenticated own-row read as defense-in-depth | Own-order read policy |
| `order_items` | Primarily trusted server; owned-order read | Read through owned order |
| `order_sequences` | Service-role/server only | No repository browser policy; live RLS provenance remains untracked |
| `client_profiles` | Authenticated own-row read/write | Own SELECT/INSERT/UPDATE |
| `order_deliverables` | Server writes; client read via server/signed URL path | Client read policy, service-role writes |
| `deliverable_reviews` | Server-controlled writes | Client read defense-in-depth |
| `deliverable_review_files` | Server-controlled writes and signed access | Client read defense-in-depth |
| `order_drafts` | Server mutations; optional authenticated own read | Own read, service-role writes |
| `order_draft_files` | Server mutations; signed upload/preview | Owned read, service-role writes |
| `order_draft_item_reference_files` | Server mutations | Owned read, service-role writes |
| `order_item_reference_files` | Server/admin and signed download flow | Owned read, service-role writes |
| `order_submissions` | Service-role/server only | RLS + zero policies + browser revoke |
| `order_email_deliveries` | Internal worker/service-role only | RLS + zero policies + browser revoke |
| `order_payments` | Service-role/server only | RLS + zero policies + browser revoke |
| `stripe_webhook_events` | Webhook/server only | RLS + zero policies + browser revoke |
| `welcome_offer_redemptions` | Service-role/server only | RLS + zero policies + browser revoke |
| `portfolio_items` | Public published reads; admin server writes | Published-read policy |
| `site_media_items` | Public published reads; admin server writes | Published-read policy |
| `property_showcases` | Server-only raw documents; public pages serialize server-loaded published rows | RLS + browser/PUBLIC revoke (pending 2026-09-19 hardening; not yet applied to production) |
| `property_leads` | Validated server endpoint only | RLS + zero policies + browser revoke |
| `property_analytics_events` | Validated server endpoint only | RLS + zero policies + browser revoke |

## Storage expectations and replay hazards

| Bucket | Intended state | Tracked repository behavior | Governance note |
| --- | --- | --- | --- |
| `portfolio` | Public | `portfolio.sql` UPSERTs `public=true` and historically creates a broad listing policy | Replay can restore a policy removed by hardening |
| `site-media` | Public | `site-media.sql` UPSERTs `public=true` and historically creates a broad listing policy | Same replay hazard |
| `order-files` | Private | Creation/configuration is not tracked as a reproducible migration | Production reproducibility gap |
| `deliverables` | Private | Creation/configuration is not tracked as a reproducible migration | Production reproducibility gap |

Review reference files use `order-files`; there is no separate review bucket in the audited design.

## Order, draft, and submission invariants

Current repository behavior relies on multiple complementary idempotency boundaries:

- `order_drafts.finalization_key` is unique when non-null.
- `order_drafts.converted_order_id` is unique when non-null.
- `orders.source_draft_id` is uniquely indexed when non-null.
- `order_submissions.submission_id` is the logical request key.
- Reserved order IDs, reserved order numbers, and committed order IDs are unique.
- A draft can have at most one submission claim through `order_submissions.source_draft_id`.
- Submission claims use advisory and row locks plus leases for safe retry/recovery.
- Atomic commit creates the order, items, normalized references, draft conversion and initial email outbox records in one transaction.
- Welcome Offer redemption is guarded by `(user_id, benefit_key)` uniqueness around ordinary atomic commit behavior.

These invariants are part of the reason historical finalization/submission SQL must not be replayed out of order.

## Known separate order-number risk

The audited `generate_order_number()` formats the numeric suffix with a fixed width of four using `LPAD(..., 4, '0')`.

PostgreSQL truncates input longer than the target width, so counter `10000` would format as `1000` and collide with a previously issued order number. Unique constraints should fail closed rather than issue a duplicate, but order creation for that service would then be blocked.

This is **not** fixed by this manifest.

Before any service counter approaches 10,000, create a separate reviewed migration that preserves four-digit padding below 10,000 while allowing wider numbers above it, and test the 9,998–10,001 boundary without renumbering historical orders.

## Production reproducibility gaps

The audit identified these gaps. Item 12 was resolved by the read-only live comparison completed on 2026-09-08; the remaining items are still open unless explicitly noted otherwise:

1. No immutable timestamped migration directory or complete tracked manifest existed before this file.
2. Historical foundation files were amended after initial introduction.
3. The four-entry live ledger cannot rebuild the prerequisites of atomic submission.
4. The ledgered Welcome Offer hotfix depends on a non-ledgered redemption foundation.
5. The ledgered payment-email migration depends on non-ledgered Stripe payment tables.
6. Photo Editing, Virtual Renovation and Floor Plan draft compatibility are non-ledgered.
7. Multi-reference tables required by current commit logic are non-ledgered.
8. Private bucket creation/configuration is manual and untracked.
9. Live RLS on `order_sequences` has no corresponding repository statement.
10. `rls_auto_enable()` and its event trigger are referenced by hardening SQL but not defined by tracked repository SQL.
11. No test currently proves the effective clean sequence against an empty PostgreSQL/Supabase database.
12. **Resolved 2026-09-08:** exact live function bodies, constraints, indexes, policies, grants, triggers and bucket visibility were matched read-only against this repository state; see the live comparison below.

## Historical read-only production verification checklist — completed 2026-09-08

This point-in-time checklist was completed during the read-only live catalog comparison. Future migration-governance or schema-changing work must repeat the relevant checks against then-current production state.

- [x] Confirm live migration ledger entries and timestamps.
- [x] Export exact definitions for repeated RPCs, especially `claim_order_draft_finalization`, `commit_order_submission`, `complete_order_draft_finalization`, and the Welcome Offer wrapper.
- [x] Verify `generate_order_number()` and helper function configuration/search paths.
- [x] Record current `order_sequences.last_number` values without modifying them.
- [x] Export relevant table constraints and CHECK definitions.
- [x] Export current indexes, especially draft uniqueness, source-draft uniqueness, submission uniqueness and replacement-deliverable FK indexes.
- [x] Export RLS enabled state and all policies for the public application tables.
- [x] Export grants/revokes for `anon`, `authenticated`, `service_role` and relevant functions/tables.
- [x] Export triggers and confirm the origin/state of `rls_auto_enable()` and any associated event trigger.
- [x] Record bucket existence and public/private state for `portfolio`, `site-media`, `order-files`, and `deliverables`.
- [x] Export relevant `storage.objects` policies and compare them with hardening expectations.
- [x] Confirm whether the three security-hardening scripts are reflected in live catalog state.
- [x] Do not mutate data, policies, grants, buckets, Auth configuration or migration history during verification.

## Supabase Advisor interpretation at audit time

The audit classified the current Advisor findings as:

| Finding | Classification | Reason |
| --- | --- | --- |
| `order_email_deliveries` — RLS enabled, zero policies | Expected | Internal worker only |
| `order_payments` — RLS enabled, zero policies | Expected | Server-only payment state |
| `order_sequences` — RLS enabled, zero policies | Likely expected | Server-only numbering; RLS origin still untracked |
| `order_submissions` — RLS enabled, zero policies | Expected | Server-only submission ledger |
| `property_analytics_events` — RLS enabled, zero policies | Expected | Validated server endpoint |
| `property_leads` — RLS enabled, zero policies | Expected | Contains private contact data |
| `stripe_webhook_events` — RLS enabled, zero policies | Expected | Server webhook idempotency/audit |
| `welcome_offer_redemptions` — RLS enabled, zero policies | Expected | Server-controlled eligibility/redemption |
| Supabase Auth leaked-password protection disabled | Real separate issue | Auth configuration hardening, not a migration-policy defect |

The leaked-password setting must be handled as a separate reviewed Auth configuration task; this manifest makes no Auth change.

## Going-forward migration governance

The minimum governance rule is intentionally simple:

1. Existing historical SQL files remain in place as evidence.
2. This manifest records their lineage and replay status.
3. New production database changes use new timestamped immutable migration files; do not amend an already-applied historical migration.
4. Each new migration documents dependencies, rollback/fail-closed behavior, and whether browser/service-role access changes.
5. Schema/RLS/storage/Auth changes require production compatibility review before execution.
6. A future integration test should prove a clean effective sequence in an ephemeral environment; do not use production as the migration test environment.

A new migration framework is not required merely to satisfy this documentation step.

## F-001 rework upload lifecycle rollout contract

`20260909191236_add_deliverable_review_file_upload_status.sql` is a manual,
forward-only Phase 1 migration. It adds `deliverable_review_files.upload_status`
with exactly two values: `pending` and `uploaded`.

Historical rows are backfilled to `uploaded`. The column remains `NOT NULL` with
an `uploaded` default so the application deployed before Phase 2 can continue
inserting rows without naming the new column. This is an intentional rollout
compatibility bridge: it prevents migration-first deployment from hiding valid
uploads created by the old writer. Phase 1 does not change any application read
or write path.

The `DEFAULT 'uploaded'` exists only to protect the pre-Phase-2 writer during
this migration-first rollout. It is not the desired long-term fail-safe default.
After Phase 2 is fully deployed and every production writer explicitly creates
new upload slots as `pending`, a separate manually reviewed forward migration
should change the default to `pending` or remove the default. PR #299 must not
perform that follow-up migration.

The later Phase 2 application PR must:

1. Make new rework-file rows explicitly use `pending`.
2. Preserve server-side Storage verification in completion.
3. Set the row to `uploaded` only after verification succeeds.
4. Make list/read paths expose only `uploaded` rows.
5. Keep completion idempotent.
6. Leave interrupted or failed uploads as `pending`.
7. Keep historical `uploaded` rows visible.
8. Keep stale-pending cleanup as separate future work; no TTL, cron, automatic deletion, or Storage cleanup belongs to F-001 Phase 1.

This migration must be applied manually only after review and approval. It does
not authorize replaying historical flat SQL files.

## Historical next safe database step — completed 2026-09-08

The previously required read-only live catalog comparison against the audit commit/current `main` was completed on 2026-09-08. The options below are retained as historical context; the current recommendation is in `Updated next safe database step` below.

The completed comparison was intended to determine whether the project should later:

- freeze a clean baseline,
- add timestamped forward-only migrations,
- add an ephemeral migration integration test,
- or fix a confirmed production/schema drift item.

## Live catalog comparison — 2026-09-08

The read-only production comparison described above was completed against repository `main` at:

`42bb46524f60ce2474a5982492011ba05a784498`

No SQL migration, DDL, data mutation, RLS change, grant change, Storage change, Auth change, or production configuration change was performed during this comparison.

### Confirmed live state

- The Supabase migration ledger still contains exactly the four entries listed in this manifest.
- The current application surface contains 21 relevant `public` tables, with RLS enabled on all 21.
- The live policy set matches the repository access model: public published-read policies exist for portfolio/site-media/Property Showcase, authenticated ownership policies exist where expected, and the eight server-only tables reported by Advisor have zero browser policies.
- Critical order RPC execution is denied to `PUBLIC`, `anon`, and `authenticated` and available to `service_role` where expected.
- Live `claim_order_draft_finalization(...)` and `commit_order_submission(...)` include Virtual Staging, Photo Editing, Virtual Renovation, and 3D Floor Plans, matching the final four-service repository authority in `allow-floor-plan-draft-finalization.sql`.
- Live `commit_order_submission_with_welcome_offer_v1(...)` matches the corrected Welcome Offer behavior represented by `fix-welcome-offer-rpc-coalesce.sql`.
- The current `generate_order_number(text)` body still uses fixed-width `LPAD(..., 4, '0')`; the >9999 risk therefore remains real but non-urgent at current counters.
- At comparison time the counters were: `virtual-staging=21`, `photo-editing=9`, `virtual-renovation=2`, `3d-floor-plans=2`.
- Live bucket visibility is: `portfolio` public, `site-media` public, `order-files` private, `deliverables` private.
- No `storage.objects` policies remain, matching the public-bucket-listing hardening intent.
- The function/table grant hardening is reflected in live privileges, and browser-facing RLS predicates use the optimized scalar `auth.uid()` / `auth.email()` form expected by the RLS hardening overlay.

### Confirmed untracked production dependency

Production contains:

- `public.rls_auto_enable()` — `SECURITY DEFINER`, fixed `search_path`, no browser/service-role EXECUTE grant.
- enabled event trigger `ensure_rls` on `ddl_command_end`, owned by `postgres`, invoking `public.rls_auto_enable()`.

The function automatically enables RLS for newly created tables in the `public` schema.

Neither the function definition nor creation of `ensure_rls` is present in the tracked repository SQL. The repository hardening script only requires `rls_auto_enable()` to already exist. This is therefore a **confirmed reproducibility gap**, not merely an inference.

Do not recreate, replace, or drop either object until its provenance and desired forward-governance treatment are reviewed separately.

### Drift verdict

No critical schema drift was found in the inspected order, draft, reference-file, submission, payment, email-outbox, Welcome Offer, portfolio, site-media, Property Showcase, leads, analytics, deliverable, or review database surfaces.

The important remaining gaps are governance/reproducibility gaps rather than evidence of a currently broken production schema:

1. The migration ledger remains incomplete relative to live production.
2. `rls_auto_enable()` and `ensure_rls` exist in production but are untracked by repository SQL.
3. Private bucket creation/configuration remains outside a reproducible tracked migration.
4. The provisional clean-database sequence still has not been proven in an ephemeral Supabase/PostgreSQL environment.
5. The order-number >9999 boundary remains a separate future migration issue.

### Advisor interpretation after live comparison

The eight `RLS Enabled No Policy` findings are confirmed as expected server-only behavior under the current architecture:

- `order_email_deliveries`
- `order_payments`
- `order_sequences`
- `order_submissions`
- `property_analytics_events`
- `property_leads`
- `stripe_webhook_events`
- `welcome_offer_redemptions`

Do not add browser policies merely to remove these informational findings.

Supabase Auth leaked-password protection remains disabled and is still a real, separate Auth configuration hardening item. It was not changed during this comparison.

### Updated next safe database step

The read-only comparison is complete. The preceding `Historical next safe database step` section is retained only as context.

Do **not** execute database changes merely because the live catalog is better understood.

The next database-governance decision should be whether PicchuSpot wants to make the existing `rls_auto_enable()` + `ensure_rls` protection reproducible as a reviewed forward-only migration. Before any such DDL is written or applied:

1. confirm that these objects are intended PicchuSpot infrastructure rather than externally managed state;
2. design a migration that is a no-op when the exact expected objects already exist and fails closed on mismatched definitions;
3. test it only in an ephemeral Supabase/PostgreSQL environment first;
4. keep production execution manual and separately approved.

The Auth leaked-password setting and the order-number boundary should remain separate tasks.

## Deferred ephemeral validation decision — 2026-09-08

Managed ephemeral Supabase/PostgreSQL validation is intentionally deferred while PicchuSpot remains early-stage and the additional branch cost is not justified. This is a budget decision, not evidence that production should be used as a substitute test environment.

Until this decision is revisited:

- do not create a paid Supabase development branch merely for migration-governance validation;
- do not use production as the clean-database or migration test environment;
- continue repository review and read-only production inspection where necessary;
- require explicit manual approval before any production database execution;
- do not add or apply forward DDL for `rls_auto_enable()` / `ensure_rls` before isolated validation is available.

Re-evaluate ephemeral validation before the first significant future schema migration, migration-baseline consolidation, or broader database-governance rollout. At that point the isolated environment should prove the effective clean sequence, verify forward-only migrations, validate RLS/grants/triggers/RPC assumptions, and test the `rls_auto_enable()` + `ensure_rls` behavior without production writes.

### `rls_auto_enable()` / `ensure_rls` provenance note

The live `public.rls_auto_enable()` function and `ensure_rls` event trigger match the documented Supabase pattern for automatically enabling RLS on newly created `public` tables. Their exact creation event in this project remains historically untracked: they are absent from the repository migration history and the official production migration ledger, but they were already present by the 2026-07-03 security-hardening audit.

Treat both objects as existing PicchuSpot production security infrastructure for operational purposes, but do not recreate, replace, drop, or claim repository reproducibility for them until their forward-only treatment has been tested in an isolated environment. This section supersedes the preceding `Updated next safe database step` only with respect to timing: the proposed forward DDL remains deferred until ephemeral validation is economically justified.
