# Phase 5D Audit — Client Approval & Per-Image Rework Request Flow

> **Branch:** `audit/client-approval-rework-flow`
> **Status:** Audit only — no code changes to production paths.
> **Date:** 2026-05-31
> **Based on:** PRs #40 (Phase 5B deliverables), #41 (force download), #42 (Phase 5C item assignment) merged.

---

## 1. Files Inspected

| File | Purpose |
|---|---|
| `supabase/schema.sql` | Core DB: `orders`, `order_items`, `order_sequences` |
| `supabase/add-order-deliverables.sql` | Migration: `order_deliverables` table + RLS |
| `supabase/add-client-profiles.sql` | Migration: `client_profiles` table + RLS |
| `src/lib/deliverables-config.ts` | Shared constants: bucket name, TTL, MIME lists, path builder |
| `src/lib/client-deliverables.ts` | Server helper: `getDeliverablesByClientEmail`, `getDeliverableDownloadUrl` |
| `src/lib/client-orders.ts` | Server helper: order fetching, sanitization, status maps |
| `src/components/admin/AdminDeliverableUpload.tsx` | Admin UI: file upload + item_index assignment |
| `src/app/(public)/admin/orders/AdminOrdersClient.tsx` | Admin orders list with Deliverables link per row |
| `src/app/(public)/admin/orders/[orderId]/page.tsx` | Admin order detail + deliverable upload |
| `src/app/(public)/api/admin/orders/[orderId]/deliverables/route.ts` | POST/DELETE deliverables (admin) |
| `src/app/api/client/deliverables/[deliverableId]/download-url/route.ts` | Client signed URL generation |
| `src/app/(dashboard)/dashboard/files/page.tsx` | Client files page |
| `src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx` | Client order detail with delivered files section |
| `src/app/(dashboard)/dashboard/support/page.tsx` | Client support page (static links only) |



---

## 2. Current State of the Deliverables Model

### `order_deliverables` table (from `supabase/add-order-deliverables.sql`)

```sql
id           UUID        PRIMARY KEY DEFAULT gen_random_uuid()
order_id     UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE
order_number TEXT        NOT NULL         -- denormalised for display
item_index   INTEGER                      -- NULL = order-level; 0-based per image
storage_path TEXT        NOT NULL         -- path inside `deliverables` bucket
filename     TEXT        NOT NULL
file_size    INTEGER     NOT NULL
mime_type    TEXT        NOT NULL
uploaded_by  TEXT        NOT NULL DEFAULT 'admin'
uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at   TIMESTAMPTZ                  -- NULL = no expiry
```

**What is absent — relevant to Phase 5D:**

| Missing field | Impact |
|---|---|
| `review_status` | No per-deliverable approval state anywhere |
| `approved_at` | No timestamp for client approval |
| `approved_by_email` | No record of who approved |
| Rework request data | No table, no column, no FK |

### `orders` table status enum

```
pending → confirmed → in-progress → delivered → cancelled
```

No `revision_requested` or `rework_in_progress` status exists in the DB.
The `DashboardJobStatus` TypeScript enum in mock-data had a `revision-requested` entry,
but it was documented as mock-only in the Phase 5A audit and has no DB equivalent.

### `client_profiles` table

Has `user_id UUID REFERENCES auth.users(id)` and full RLS.
**No FK to `orders`** — orders are still email-matched only (Phase 5A limitation).
Cannot be used as ownership proof for rework requests without adding a join or
waiting for the `orders.user_id` migration.



---

## 3. Recommended Data Model

### 3a — New table: `deliverable_reviews`

A separate table is strongly preferred over adding columns to `order_deliverables`.
Reasons:
- A deliverable may go through multiple rework cycles; a single status column
  would lose history. A separate table gives one row per review cycle.
- Keeps `order_deliverables` schema stable (already used in production queries).
- Makes it easy to add indexes, RLS policies, and future fields (attachments,
  ratings) without touching the delivery model.

```sql
CREATE TABLE IF NOT EXISTS deliverable_reviews (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which deliverable is being reviewed
  deliverable_id     UUID        NOT NULL
                     REFERENCES order_deliverables(id) ON DELETE CASCADE,

  -- Denormalised for fast listing queries without extra JOINs
  order_id           UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number       TEXT        NOT NULL,
  item_index         INTEGER,               -- mirrors order_deliverables.item_index

  -- Who submitted this review (email from verified SSR session — Phase 5D)
  -- TODO Phase 5E: switch to user_id FK once orders.user_id is added
  client_email       TEXT        NOT NULL,

  -- Review decision
  -- See §3b for the full status lifecycle
  status             TEXT        NOT NULL DEFAULT 'pending_review'
                     CHECK (status IN (
                       'pending_review',
                       'approved',
                       'rework_requested',
                       'rework_in_progress',
                       'rework_delivered',
                       'resolved'
                     )),

  -- Client's written feedback (required for rework_requested; optional for approved)
  comment            TEXT,

  -- Timestamps
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional: link to a replacement deliverable uploaded for rework
  -- NULL until admin uploads the revised version
  replacement_deliverable_id UUID
    REFERENCES order_deliverables(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_deliverable_id
  ON deliverable_reviews (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_order_id
  ON deliverable_reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_client_email
  ON deliverable_reviews (client_email);
CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_status
  ON deliverable_reviews (status);
```

### 3b — Status lifecycle

```
                        ┌─────────────────┐
                        │  pending_review  │  ← deliverable uploaded by admin
                        └────────┬────────┘
                     ┌───────────┴────────────┐
                     ▼                        ▼
               ┌──────────┐        ┌──────────────────┐
               │ approved │        │ rework_requested  │  ← client submits comment
               └──────────┘        └────────┬─────────┘
                  (terminal)                 │ admin acknowledges
                                             ▼
                                  ┌────────────────────┐
                                  │ rework_in_progress │
                                  └────────┬───────────┘
                                           │ admin uploads replacement
                                           ▼
                                  ┌────────────────────┐
                                  │  rework_delivered  │  ← new deliverable row created
                                  └────────┬───────────┘
                                 ┌─────────┴──────────┐
                                 ▼                     ▼
                           ┌──────────┐    ┌──────────────────┐
                           │ resolved │    │ rework_requested  │  ← client may loop
                           └──────────┘    └──────────────────┘
```

| Status | Set by | Meaning |
|---|---|---|
| `pending_review` | System (on upload) | Deliverable visible to client; awaiting their action |
| `approved` | Client | Client is satisfied; no further action needed |
| `rework_requested` | Client | Client submitted a rework comment |
| `rework_in_progress` | Admin | Admin has acknowledged and is working on it |
| `rework_delivered` | System (on upload) | Admin uploaded a replacement deliverable |
| `resolved` | Admin or System | Admin marks the cycle closed |

**Terminal states:** `approved`, `resolved`. Once reached, the client cannot
submit further rework requests for that deliverable (enforce in API validation).



### 3c — RLS on `deliverable_reviews`

```sql
ALTER TABLE deliverable_reviews ENABLE ROW LEVEL SECURITY;

-- Client: read their own reviews (email-matched through orders)
CREATE POLICY "reviews_client_select_own"
  ON deliverable_reviews FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- Client: insert a review for a deliverable they own
-- Additional business-logic checks (terminal-state guard, one-active-per-deliverable)
-- are enforced in the API route, not here.
CREATE POLICY "reviews_client_insert_own"
  ON deliverable_reviews FOR INSERT
  WITH CHECK (
    client_email = auth.email()
    AND order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- No client UPDATE or DELETE — admin uses service role (bypasses RLS).
```

### 3d — Should `order_deliverables` gain a `review_status` column?

**Recommendation: No.** Keep `order_deliverables` pure delivery metadata.
The current review status of a deliverable is derived by querying the most
recent `deliverable_reviews` row for that `deliverable_id`. This avoids
dual-write consistency issues and keeps the schema clean.

If a denormalised `current_review_status` column is added later for performance,
it should be maintained by a Postgres trigger on `deliverable_reviews`, not
by application code.

---

## 4. Recommended Status Set

The six statuses in §3b are sufficient. Justification for each:

| Status | Keep? | Reason |
|---|---|---|
| `pending_review` | ✅ | Clear default; client knows action is needed |
| `approved` | ✅ | Explicit positive signal; closes the loop |
| `rework_requested` | ✅ | Distinct from in-progress; admin sees unacknowledged requests |
| `rework_in_progress` | ✅ | Lets client know their request was seen |
| `rework_delivered` | ✅ | Triggers a second review cycle cleanly |
| `resolved` | ✅ | Admin escape hatch for edge cases (e.g. client unresponsive) |

**Not recommended:**
- A single `revision_requested` status (loses the in-progress / delivered distinction).
- Merging `rework_delivered` + `pending_review` (confusing — original vs revised).
- Adding `rejected` — this is a B2B tool; admin should never reject, only deliver.



---

## 5. Client UX Recommendation

### 5a — Where the Approve / Request Rework buttons appear

**Primary location: `/dashboard/jobs/[orderId]` — Delivered files section**

This page already renders a `Delivered files` card (added in Phase 5C PR #42).
Each file row currently shows: item label chip · filename · file size · Download button.

Add to each row:
```
[ Image 1 ]  living-room.jpg  2.4 MB   [Download file]  [✓ Approve]  [↩ Request rework]
                                         (existing)      (new)         (new)
```

The `Approve` and `Request rework` buttons should only appear when the review
status for that deliverable is `pending_review` or `rework_delivered`.
They must be hidden once status is `approved` or `resolved`.

**Secondary location: `/dashboard/files`**

The files page lists deliverables across all orders. It currently shows only
a Download button. Add the same Approve / Request rework controls here, with
the same visibility rules.

### 5b — Approve button interaction

- Inline button, no modal required.
- On click: `POST /api/client/deliverables/[deliverableId]/review`
  with `{ action: "approve" }`.
- On success: replace the two action buttons with a green `✓ Approved` badge.
- No comment required for approval.
- Component: `DeliverableReviewButton` (new client component).

### 5c — Request rework interaction

- Button opens a small inline form (expand in place, not a modal):
  ```
  [ Request rework ]
  ┌─────────────────────────────────────────────┐
  │  Please describe what needs to be changed:  │
  │  ┌─────────────────────────────────────┐    │
  │  │ <textarea rows=3 maxlength=1000>    │    │
  │  └─────────────────────────────────────┘    │
  │  [Cancel]  [Submit rework request]           │
  └─────────────────────────────────────────────┘
  ```
- Comment is required (min 10 chars, max 1000 chars) — validated client and server.
- On submit: `POST /api/client/deliverables/[deliverableId]/review`
  with `{ action: "rework_requested", comment: "..." }`.
- On success: replace buttons with amber `↩ Rework requested` badge showing
  truncated comment on hover.
- The same `DeliverableReviewButton` component handles both states via `action` prop.

### 5d — Status badges (client-facing)

| DB status | Badge shown to client | Color |
|---|---|---|
| `pending_review` | — (show Approve / Request rework buttons) | — |
| `approved` | ✓ Approved | Green |
| `rework_requested` | ↩ Rework requested | Amber |
| `rework_in_progress` | 🔄 In progress | Blue |
| `rework_delivered` | New version ready (show Approve / Request rework again) | Purple |
| `resolved` | ✓ Resolved | Green |

### 5e — Optional file/reference attachment (Phase 5E — not now)

The `deliverable_reviews` table schema above has no attachment column.
A reference image can be added in a future phase by adding
`reference_storage_path TEXT` to the table and a separate upload-url route.
Do not implement this in Phase 5D.



---

## 6. Admin UX Recommendation

### 6a — Where admin sees rework requests

**Primary: `/admin/orders/[orderId]`** — the existing order detail page.

The page currently has two columns:
- Left: order summary card
- Right: `AdminDeliverableUpload` (file list + upload control)

Add a third section below the upload component (or as a tab):
**"Rework Requests"** — lists all `deliverable_reviews` rows for this order
where `status IN ('rework_requested', 'rework_in_progress')`.

Each row shows:
```
[ Image 2 ] bedroom.jpg   ↩ Rework requested   2026-05-31
  "The virtual staging feels too dark. Can you brighten the lighting..."
  [Mark In Progress]   [Upload Replacement]
```

**Secondary: `/admin/orders` list page**

Add a small badge/count column or a highlight to orders that have pending
rework requests. The `AdminOrderRow` component can show
`↩ 2 rework` next to the Deliverables link. This requires a lightweight
count query when fetching orders (left join + count).

### 6b — Admin status transitions

| Admin action | Button | New status |
|---|---|---|
| Acknowledge rework request | "Mark In Progress" | `rework_requested` → `rework_in_progress` |
| Upload replacement file | (existing upload UI) | system sets `rework_delivered` |
| Close without rework | "Mark Resolved" | `rework_requested`/`rework_in_progress` → `resolved` |

**"Upload Replacement"** uses the **existing** `AdminDeliverableUpload` flow unchanged.
When the admin uploads a new file for the same `item_index`, the API route
automatically creates a new `deliverable_reviews` row with `status = 'rework_delivered'`
for the new `deliverable_id`. The old review row stays as historical record.

### 6c — New admin API routes needed

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/orders/[orderId]/reviews` | `GET` | List all reviews for an order |
| `/api/admin/orders/[orderId]/reviews/[reviewId]` | `PATCH` | Update review status (in-progress / resolved) |

Both require `isAdminAuthenticated()`. Use service role key. Never expose `client_email`
beyond what admin already sees on the order summary.



---

## 7. Security Model

### 7a — Client-side ownership for review submission

The client review route must use the **same ownership pattern** as the download-URL route:

```
POST /api/client/deliverables/[deliverableId]/review
  └─ getClientUser()                              ← SSR session — never trust body/params
  └─ Verify ownership in single JOIN query:
       SELECT od.id, od.order_id, od.item_index
       FROM order_deliverables od
       JOIN orders o ON o.id = od.order_id
       WHERE od.id = $deliverableId
         AND o.client_email = $verifiedEmail       ← ownership check
  └─ Verify review is not in terminal state
       (approved / resolved → reject with 409)
  └─ Verify no active rework already open
       (rework_requested / rework_in_progress → reject with 409)
  └─ INSERT INTO deliverable_reviews (...)
  └─ Return { ok: true, review: { id, status } }
```

### 7b — What must never happen

| Rule | Enforcement |
|---|---|
| Client cannot approve/rework another client's deliverable | `AND o.client_email = $verifiedEmail` ownership JOIN |
| Client cannot submit a second rework while one is active | API rejects if `status IN ('rework_requested', 'rework_in_progress')` exists for that deliverable |
| Client cannot reopen an approved/resolved review | API rejects if latest review status is terminal |
| `client_email` in review row must match session email | `INSERT` sets `client_email = verifiedEmail` — never from body |
| Admin cannot forge a client approval | Admin routes use different code path (`isAdminAuthenticated()`); `deliverable_reviews.client_email` is set from the session, not an input |
| `storage_path` must never reach client | No change — download-URL route already strips it |
| `deliverable_reviews` admin routes require `isAdminAuthenticated()` | Same guard as all existing admin routes |

### 7c — RLS double-check

`deliverable_reviews` has RLS (proposed in §3c):
- Client `SELECT`: via `order_id IN (SELECT id FROM orders WHERE client_email = auth.email())`
- Client `INSERT`: checks `client_email = auth.email()` AND order ownership
- No client `UPDATE` or `DELETE` — all mutations via server routes with service role

This means even if the API route has a bug, a direct Supabase client call
from the browser cannot read or write another user's reviews.



---

## 8. Risks

### Risk 1 — Duplicate rework requests (HIGH — must guard)

**Scenario:** Client clicks "Submit rework request" twice quickly, or
submits on both `/dashboard/files` and `/dashboard/jobs/[orderId]`.

**Mitigation:**
- API route checks for an active review (`rework_requested` or `rework_in_progress`)
  before inserting. If one exists, return `409 Conflict`.
- Add a `UNIQUE INDEX` on `(deliverable_id, status)` for the active states,
  or add a partial unique index:
  ```sql
  CREATE UNIQUE INDEX deliverable_reviews_one_active
    ON deliverable_reviews (deliverable_id)
    WHERE status IN ('rework_requested', 'rework_in_progress');
  ```
  This makes the DB enforce it atomically even under concurrent requests.
- Client button should disable immediately on click and show a spinner.

### Risk 2 — Approval after a new version is uploaded (MEDIUM)

**Scenario:** Admin uploads a replacement. Client approves the *original* deliverable
(which is now superseded) instead of reviewing the new one.

**Mitigation:**
- When a replacement is uploaded, the system creates a new `deliverable_reviews` row
  with `status = 'rework_delivered'` for the **new** `deliverable_id`.
- The old deliverable's review row is left in `rework_in_progress` state.
- The client UI should only show Approve/Rework buttons for the **most recent**
  deliverable per `item_index` (newest `uploaded_at`). Superseded versions are
  shown as history only, without action buttons.
- Query: `SELECT DISTINCT ON (item_index) * FROM order_deliverables WHERE order_id = $1 ORDER BY item_index, uploaded_at DESC`

### Risk 3 — Multiple deliverables for the same `item_index` (MEDIUM)

**Scenario:** Admin accidentally uploads two files for Image 1. Client sees two
"Approve / Rework" rows for the same image.

**Mitigation:**
- Use the "most recent per item_index" query pattern from Risk 2.
- The admin UI can show a warning if more than one non-superseded deliverable
  exists for the same `item_index`.
- Do not add a unique constraint on `(order_id, item_index)` in `order_deliverables` —
  multiple versions are legitimate and needed for rework cycles.

### Risk 4 — Order-level ZIP vs image-level files (LOW)

**Scenario:** Order has `item_index = null` (a ZIP bundle) AND individual per-image
JPEGs. Client approves the ZIP but requests rework on Image 2's JPG.

**Mitigation:**
- `deliverable_reviews` is per `deliverable_id` (not per `item_index`), so each
  file gets its own independent review. No conflict.
- The admin upload flow and client review UI both display the `item_index` label
  (Order-level / Image N) so the client always knows which file they are reviewing.
- Approval of a ZIP does not auto-approve individual images. Approval is per-file.

### Risk 5 — Client email changes after order submission (LOW)

**Scenario:** A client changes their auth email in Supabase. Their `orders.client_email`
still holds the old email. The ownership JOIN breaks; client cannot review.

**Mitigation (Phase 5D):** Document as a known limitation.
**Mitigation (Phase 5E):** Add `orders.user_id UUID REFERENCES auth.users(id)`.
Once done, switch all ownership JOINs to `user_id = auth.uid()` — immune to
email changes.

### Risk 6 — Admin marks resolved while client is mid-review (LOW)

**Scenario:** Admin clicks "Mark Resolved" just as client submits a rework request.
Race condition: DB ends up with `resolved` + a new `rework_requested` row.

**Mitigation:**
- The unique partial index from Risk 1 prevents a second `rework_requested` if one
  already exists. If admin resolves first, client's submit will see no active review
  and create a new one (which is legitimate behaviour — they can always re-request).
- Consider adding `NOWAIT` lock or optimistic-concurrency `updated_at` check in the
  admin PATCH route.

### Risk 7 — No notification when rework status changes (MEDIUM)

**Scenario:** Client submits a rework request but has no way to know when admin
acknowledges it or delivers the rework.

**Mitigation (Phase 5D):** The client can see the status badge change on next
dashboard load. Document as a known gap.
**Mitigation (Phase 5E):** Add Resend email notifications:
- Admin → `rework_in_progress`: email to client "We've received your feedback and are working on it."
- Admin → `rework_delivered`: email to client "Your revision is ready to review."
This is explicitly out of scope for Phase 5D.



---

## 9. Exact Files Needed in Implementation

### New files

| File | Purpose |
|---|---|
| `supabase/add-deliverable-reviews.sql` | Migration: `deliverable_reviews` table, partial unique index, RLS, grants |
| `src/lib/client-reviews.ts` | Server helper: `getReviewsByClientEmail()`, `getReviewForDeliverable()`, ownership-guarded INSERT |
| `src/app/api/client/deliverables/[deliverableId]/review/route.ts` | `POST` — client submits approve or rework_requested |
| `src/app/(public)/api/admin/orders/[orderId]/reviews/route.ts` | `GET` — admin lists reviews for an order |
| `src/app/(public)/api/admin/orders/[orderId]/reviews/[reviewId]/route.ts` | `PATCH` — admin updates status (in_progress / resolved) |
| `src/components/dashboard/DeliverableReviewButton.tsx` | Client component: Approve + Request Rework inline form |
| `src/components/admin/AdminReworkRequests.tsx` | Admin component: rework requests list for one order |

### Modified files

| File | Change |
|---|---|
| `src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx` | Pass review status per deliverable to `DeliverableReviewButton`; fetch reviews server-side |
| `src/app/(dashboard)/dashboard/files/page.tsx` | Same — add review status fetch + `DeliverableReviewButton` per file |
| `src/lib/client-deliverables.ts` | Extend `ClientDeliverable` type with optional `review_status` field |
| `src/app/(public)/admin/orders/[orderId]/page.tsx` | Add `AdminReworkRequests` below upload section |
| `src/app/(public)/api/admin/orders/[orderId]/deliverables/route.ts` | POST handler: after inserting a deliverable, if an existing `rework_in_progress` review exists for same `item_index`, create a new `deliverable_reviews` row with `status = 'rework_delivered'` automatically |
| `src/app/(public)/admin/orders/AdminOrdersClient.tsx` | (Optional) Add rework request count badge to Deliverables column |

### Files that must NOT be touched

- `src/app/(public)/api/order/route.ts`
- `src/lib/submit-order.ts`
- `src/lib/upload-config.ts`
- `src/lib/server-validation.ts`
- `src/lib/server-pricing.ts`
- `src/lib/email/*`
- `supabase/schema.sql`
- `supabase/add-order-deliverables.sql`
- Any admin auth logic
- Any payment / pricing file
- `deliverables-config.ts` (no changes needed)



---

## 10. PR Split Recommendation

### Option A — One large PR (not recommended)

Putting all of Phase 5D in a single PR creates a large changeset touching
DB migrations, 2 new API routes (client), 2 new API routes (admin), 3 new
components, and 4 modified pages. Review surface is high; a bug in the DB
migration blocks everything.

### Option B — Three focused PRs (recommended)

#### Phase 5D.1 — DB migration + client review buttons
**Scope:** DB only + client-facing action buttons. No admin UI yet.

New / changed:
- `supabase/add-deliverable-reviews.sql` (new)
- `src/lib/client-reviews.ts` (new)
- `src/app/api/client/deliverables/[deliverableId]/review/route.ts` (new)
- `src/components/dashboard/DeliverableReviewButton.tsx` (new)
- `src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx` (add review status + buttons)
- `src/app/(dashboard)/dashboard/files/page.tsx` (add review status + buttons)
- `src/lib/client-deliverables.ts` (extend `ClientDeliverable` type)

**Test:**
- Client can approve a deliverable → status shows ✓ Approved
- Client can submit rework request with comment → status shows ↩ Rework requested
- Duplicate rework request rejected with 409
- Terminal-state guard: cannot re-submit after approved

#### Phase 5D.2 — Admin rework management
**Scope:** Admin sees and manages rework requests. Depends on 5D.1.

New / changed:
- `src/app/(public)/api/admin/orders/[orderId]/reviews/route.ts` (new)
- `src/app/(public)/api/admin/orders/[orderId]/reviews/[reviewId]/route.ts` (new)
- `src/components/admin/AdminReworkRequests.tsx` (new)
- `src/app/(public)/admin/orders/[orderId]/page.tsx` (add `AdminReworkRequests`)
- `src/app/(public)/api/admin/orders/[orderId]/deliverables/route.ts` (auto-create `rework_delivered` review on upload)
- `src/app/(public)/admin/orders/AdminOrdersClient.tsx` (rework count badge, optional)

**Test:**
- Admin sees pending rework requests on order detail page
- Admin clicks "Mark In Progress" → client sees 🔄 In progress badge
- Admin uploads replacement → client sees "New version ready" + action buttons again
- Admin can mark resolved

#### Phase 5D.3 — Email notifications for rework events
**Scope:** Resend email triggers on status transitions. Depends on 5D.2.

New / changed:
- `src/lib/email/rework-acknowledged.ts` (new Resend template)
- `src/lib/email/rework-delivered.ts` (new Resend template)
- `src/app/(public)/api/admin/orders/[orderId]/reviews/[reviewId]/route.ts` (trigger emails on PATCH)

**Test:**
- Rework acknowledged → client receives email
- Rework delivered → client receives email
- No PII beyond order number and first name in email body

**Verdict: implement in this order — 5D.1 → 5D.2 → 5D.3.**
Each PR is fully functional in isolation. 5D.1 gives clients visible approval controls
without requiring any admin UI. 5D.2 gives admins visibility and management tools.
5D.3 closes the notification gap.



---

## 11. Proposed `client-reviews.ts` Interface

```typescript
// Server-only. Never import from "use client" files.
import "server-only";

export type ReviewStatus =
  | "pending_review"
  | "approved"
  | "rework_requested"
  | "rework_in_progress"
  | "rework_delivered"
  | "resolved";

export interface DeliverableReview {
  id: string;
  deliverable_id: string;
  order_id: string;
  order_number: string;
  item_index: number | null;
  client_email: string;
  status: ReviewStatus;
  comment: string | null;
  created_at: string;
  updated_at: string;
  replacement_deliverable_id: string | null;
}

/** Terminal review states — no further client action permitted. */
export const TERMINAL_REVIEW_STATUSES: ReviewStatus[] = ["approved", "resolved"];

/** Active rework states — new rework submission blocked. */
export const ACTIVE_REWORK_STATUSES: ReviewStatus[] = [
  "rework_requested",
  "rework_in_progress",
];

/**
 * Returns all reviews for deliverables owned by this email.
 * Ownership enforced by JOIN: orders.client_email = email.
 */
export async function getReviewsByClientEmail(
  email: string
): Promise<DeliverableReview[]>

/**
 * Returns the most recent review for a single deliverable, ownership-checked.
 * Returns null if not found or wrong owner.
 */
export async function getLatestReviewForDeliverable(
  deliverableId: string,
  email: string
): Promise<DeliverableReview | null>

/**
 * Submit an approve or rework_requested action.
 * Validates ownership, terminal-state guard, and active-rework guard.
 * Returns the new review row on success, or an error string.
 */
export async function submitDeliverableReview(
  deliverableId: string,
  email: string,
  action: "approve" | "rework_requested",
  comment?: string
): Promise<{ ok: true; review: DeliverableReview } | { ok: false; error: string; status: number }>
```

---

## 12. Proposed `POST /api/client/deliverables/[deliverableId]/review` Interface

```
Method:  POST
Auth:    getClientUser() — SSR session required
Params:  deliverableId from URL (untrusted — UUID validated)
Body:    { action: "approve" | "rework_requested"; comment?: string }

Responses:
  200 { ok: true, review: { id, status, created_at } }
  400 comment missing/too short for rework_requested
  401 not authenticated
  404 deliverable not found or wrong owner
  409 active rework already open / terminal state reached
  500 server error
```

Zod schema for the request body:
```typescript
const ReviewBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action:  z.literal("rework_requested"),
    comment: z.string().min(10, "Please describe what needs to change (min 10 characters).")
                       .max(1000, "Comment is too long (max 1000 characters)."),
  }),
]);
```



---

## 13. Summary Table

| Question | Answer |
|---|---|
| New DB table needed? | **Yes** — `deliverable_reviews` (separate from `order_deliverables`) |
| Columns to add to `order_deliverables`? | **None** — review state lives in `deliverable_reviews` |
| Columns to add to `orders`? | **None for Phase 5D** — email-based ownership is sufficient |
| Status set | 6 statuses: `pending_review` → `approved` / `rework_requested` → `rework_in_progress` → `rework_delivered` → `resolved` |
| Client approval location | `/dashboard/jobs/[orderId]` (primary) + `/dashboard/files` (secondary) |
| Rework comment required? | **Yes** — min 10 chars, max 1000 chars |
| File/reference attachment | **Phase 5E** — not in 5D |
| Admin rework view location | `/admin/orders/[orderId]` (new section below upload) |
| Admin order list indicator | Optional rework count badge on Deliverables column |
| How admin triggers `rework_delivered`? | Existing upload flow — system creates the review row automatically |
| Ownership check mechanism | `orders.client_email = verified_session_email` (unchanged from Phase 5B) |
| Duplicate rework guard | Partial unique index on `(deliverable_id)` WHERE status IN active states + API check |
| Approval after replacement | Show only most-recent deliverable per `item_index`; old version read-only |
| Email notifications | **Phase 5D.3** — not in 5D.1 or 5D.2 |
| Split into sub-PRs? | **Yes** — 5D.1 (client buttons) → 5D.2 (admin management) → 5D.3 (emails) |
| `order_deliverables` table changed? | **No** |
| `supabase/schema.sql` changed? | **No** — new `supabase/add-deliverable-reviews.sql` instead |
| Any payment/pricing/order-submission touched? | **No** |

---

## 14. Decision

**Proceed with Phase 5D implementation in three PRs** as described in §10:

- **5D.1** (`feat/deliverable-reviews-client`) — DB migration + client-facing
  Approve / Request Rework buttons on both dashboard pages. No admin UI.
- **5D.2** (`feat/deliverable-reviews-admin`) — Admin rework queue on order
  detail page; automatic `rework_delivered` review on replacement upload.
- **5D.3** (`feat/deliverable-reviews-email`) — Resend email notifications
  for `rework_in_progress` and `rework_delivered` status transitions.

This is fully additive. No existing tables, routes, storage buckets,
admin auth logic, or order submission flows are modified in any phase.
