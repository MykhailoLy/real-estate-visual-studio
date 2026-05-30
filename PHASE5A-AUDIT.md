# Phase 5A Audit — Client Dashboard Orders (Read-Only)

> **Branch:** `audit/client-orders-dashboard-readonly`
> **Status:** Audit only — no code changes to production paths.
> **Date:** 2026-05-30

---

## 1. Files Inspected

| File | Purpose |
|---|---|
| `supabase/schema.sql` | Live DB schema — `orders`, `order_items`, `order_sequences` |
| `src/types/index.ts` | TypeScript order types (`Order`, `OrderItem`, `OrderStatus`, etc.) |
| `src/app/(public)/api/order/route.ts` | `POST /api/order` — order submission handler |
| `src/app/(public)/api/upload-url/route.ts` | `POST /api/upload-url` — signed Storage URL issuer |
| `src/lib/submit-order.ts` | Client-side order submission flow |
| `src/lib/server-validation.ts` | Zod schemas for order payload validation |
| `src/lib/upload-config.ts` | Shared file size/MIME/path constants |
| `src/lib/supabase.ts` | Legacy `getSupabaseBrowser()` / `createServerClient()` |
| `src/lib/client-dashboard/mock-data.ts` | `DashboardJob` interface + mock data |
| `src/components/dashboard/JobsTable.tsx` | Jobs table component + column layout |
| `src/components/dashboard/StatusBadge.tsx` | Status badge component + status config |
| `src/components/dashboard/DashboardStatCard.tsx` | Stat card component |
| `src/app/(dashboard)/dashboard/jobs/page.tsx` | `/dashboard/jobs` page (currently mock) |
| `src/app/(dashboard)/dashboard/files/page.tsx` | `/dashboard/files` page (currently mock) |
| `src/app/(dashboard)/dashboard/invoices/page.tsx` | `/dashboard/invoices` page (currently mock) |
| `src/app/(public)/admin/portfolio/page.tsx` | Admin portfolio page (no order view) |
| `src/app/(public)/admin/portfolio/PortfolioAdminClient.tsx` | Admin portfolio client |
| `src/app/(public)/admin/media/MediaAdminClient.tsx` | Admin media client |

---

## 2. Current Order Data Model

### `orders` table

```sql
id                     UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_number           TEXT UNIQUE NOT NULL          -- e.g. "VS-0041"
service_type           TEXT NOT NULL                 -- 'virtual-staging' | 'virtual-renovation'
                                                     -- | '3d-floor-plans' | 'photo-editing'
status                 TEXT NOT NULL DEFAULT 'pending'
                       -- 'pending' | 'confirmed' | 'in-progress' | 'delivered' | 'cancelled'

-- Client identity (manually typed at order time, NO auth link)
client_name            TEXT NOT NULL
client_email           TEXT NOT NULL                 -- ⚠️  sole identity signal
client_phone           TEXT NOT NULL
client_company         TEXT

-- Pricing
item_count             INTEGER NOT NULL              -- = imageCount equivalent
estimated_total_cents  INTEGER NOT NULL DEFAULT 0
currency               TEXT NOT NULL DEFAULT 'USD'

created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### `order_items` table

```sql
id                     UUID PRIMARY KEY
order_id               UUID REFERENCES orders(id) ON DELETE CASCADE
item_index             INTEGER NOT NULL
original_photo_path    TEXT                          -- Storage path: <orderNumber>/<i>-original.<ext>
reference_image_path   TEXT                          -- Storage path: <orderNumber>/<i>-reference.<ext>
subtotal_cents         INTEGER NOT NULL DEFAULT 0
details                JSONB NOT NULL DEFAULT '{}'   -- service-specific item details
created_at             TIMESTAMPTZ
```

`details` JSONB contains per-service fields (room name, style, addon labels, etc.) plus
embedded `delivery_preferences`, `terms_acceptance`, `portfolio_permission`, and
`uploaded_files` metadata.

### Storage

- Bucket: `order-files` (private, no public access)
- Final path layout: `<orderNumber>/<itemIndex>-original.<ext>` / `…-reference.<ext>`
- Access: service role key only (no signed read URLs generated yet for clients)

### RLS

**None.** The `orders` and `order_items` tables have no Row Level Security policies.
All current reads/writes go through the service role key in API routes.

---

## 3. How Orders Identify the Customer

**Short answer: email only. There is no `user_id` column.**

The order submission system (`/api/order`) pre-dates client auth. At submission time the
user types their name, email, phone, and optional company into the `ContactDetails` form
component. These fields are stored verbatim in `orders.client_name` / `client_email`.

There is:
- ❌ No `user_id` / `auth_user_id` FK referencing `auth.users`
- ❌ No session token or cookie tied to a row
- ❌ No RLS that could enforce per-user visibility
- ✅ `client_email` TEXT — the only stable link to an auth user

**Implication for Phase 5A:**
Matching orders to the authenticated dashboard user must be done via
`WHERE client_email = <auth user email>`. This is safe for *reading* as long as:
1. The email is read server-side from the verified Supabase session (never from the client).
2. The query uses the **service role key** (since there is no RLS to rely on), scoped
   strictly to that one email with no possibility of horizontal data leak.
3. Or alternatively, RLS is added first (see §6 below).

---

## 4. Dashboard ↔ Real Orders: Field Mapping

The dashboard's `DashboardJob` interface is currently driven by mock data. Here is the
full field-by-field mapping to the real `orders` table:

| `DashboardJob` field | Real `orders` column | Gap / Notes |
|---|---|---|
| `id` | `id` (UUID) | ✅ Direct |
| `reference` | `order_number` | ✅ Direct — already formatted `VS-0041` |
| `serviceType` (human label) | `service_type` (slug) | ⚠️ Needs translation function |
| `status` (dashboard enum) | `status` (DB enum) | ⚠️ Different sets — see §4a |
| `submittedDate` | `created_at` | ✅ Use `created_at::date` |
| `estimatedCompletion` | ❌ Not in DB | ❌ Missing — no ETA field |
| `progress` (0–100) | ❌ Not in DB | ❌ Missing — no numeric progress |
| `costCents` | `estimated_total_cents` | ✅ Direct |
| `imageCount` | `item_count` | ✅ Direct |
| `title` (free text) | ❌ Not in DB | ❌ Missing — must be derived |

### 4a — Status Mapping

| DB `status` | Dashboard `DashboardJobStatus` | Notes |
|---|---|---|
| `pending` | → `"awaiting-submission"` | Closest match: submitted but not confirmed |
| `confirmed` | → `"in-progress"` | No separate "confirmed" state on dashboard |
| `in-progress` | → `"in-progress"` | ✅ Direct |
| `delivered` | → `"completed"` | ✅ Semantically equivalent |
| `cancelled` | → `"cancelled"` | ✅ Direct |
| _(none)_ | `"revision-requested"` | ❌ No DB equivalent — mock-only status |

`revision-requested` does not exist in the DB schema. It is mock-only. Real orders will
never show this status unless a `revision_requested` status is added to the DB later.

### 4b — Missing Fields

Two `DashboardJob` fields have no DB equivalent at all:

- **`estimatedCompletion`**: The DB has no ETA column. Options:
  - Derive a rough ETA by adding a fixed business-day offset to `created_at`
    (e.g. `created_at + interval '2 days'`) — cosmetic only, not a real commitment.
  - Return `null` / omit and hide the column for real orders.
  - Add an `estimated_delivery_date` column to `orders` in a future migration.

- **`progress`**: The DB has no numeric progress field. Options:
  - Derive from status: `pending`→0, `confirmed`→10, `in-progress`→50, `delivered`→100
  - Return 0 for all non-delivered, 100 for delivered — cosmetic.
  - Add a `progress_percent` column later.

- **`title`**: The DB has no free-text title. Must be derived. Safe option:
  - `service_type_label + " — " + order_number` → "Virtual Staging — VS-0041"
  - Or use `client_name + " — " + order_number` if that reads better.

---

## 5. Recommended Phase 5A Implementation Plan

### Guiding principles
1. **Read-only.** No changes to order submission, upload, payment, or email.
2. **Server-side only.** Email lookup happens in a server component or server action,
   never exposed to client JavaScript.
3. **No new migrations yet.** Use the existing schema as-is. Missing fields
   (ETA, progress, title) are derived or omitted gracefully.
4. **Safe client access.** Either use service role key with a strict
   `WHERE client_email = $1` server-side query, OR add RLS first. See §6.

### Recommended approach: server-side service-role query with email guard

```
Server component (dashboard/jobs/page.tsx)
  └─ getClientUser()                         ← validated SSR session
  └─ getOrdersByClientEmail(user.email)      ← new helper in src/lib/client-orders.ts
       └─ createClient(url, SERVICE_ROLE_KEY)
       └─ .from('orders')
          .select('id, order_number, service_type, status,
                   item_count, estimated_total_cents, created_at')
          .eq('client_email', email)          ← strict email guard
          .order('created_at', { ascending: false })
  └─ mapOrdersToDashboardJobs(orders)        ← translation helper
  └─ <JobsTable jobs={realJobs} />
```

### Step-by-step implementation tasks for the next PR

#### Step 1 — New server helper: `src/lib/client-orders.ts`
- `getOrdersByClientEmail(email: string): Promise<ClientOrder[]>`
  - Uses service role key (server-side only, never imported from client)
  - `WHERE client_email = email` — strict guard, no wildcard
  - Returns only fields needed for the dashboard (no JSONB details blob)
- `mapOrderToDashboardJob(order: ClientOrder): DashboardJob`
  - `title`: `serviceTypeToLabel(service_type) + " — " + order_number`
  - `serviceType`: translate slug → human label via a lookup object
  - `status`: translate DB status → `DashboardJobStatus` via mapping in §4a
  - `estimatedCompletion`: `created_at + 2 business days` (ISO string) OR empty string
  - `progress`: derive from status (0 / 10 / 50 / 100)
  - All other fields: direct column mappings

#### Step 2 — Update `src/app/(dashboard)/dashboard/jobs/page.tsx`
- Convert from `"use client"` to a server component (or hybrid)
- Call `getClientUser()` + `getOrdersByClientEmail(user.email)`
- Pass real jobs to `<JobsTable>`
- Keep status filter chips working — either pass count from real data or compute client-side
- Handle empty state gracefully (no orders yet)

#### Step 3 — Update `src/app/(dashboard)/dashboard/page.tsx`
- Already calls `getClientProfile()` + `getClientUser()` server-side
- Add `getOrdersByClientEmail(user.email)` call
- Replace `MOCK_JOBS` with real orders for stats cards and "next steps" panel
- Keep `getDashboardStats()` helper — it works on any `DashboardJob[]`

#### Step 4 — Update `src/lib/client-dashboard/mock-data.ts`
- Keep `MOCK_JOBS` and `MOCK_CLIENT` in place (used by files/invoices pages still)
- Remove `MOCK_JOBS` imports only from pages that switch to real data
- Add a note that `revision-requested` status is mock-only

#### Step 5 — (Optional but recommended) Update `DashboardJobStatus` type
- Add `"pending"` and `"confirmed"` as real DB-sourced variants
- Or keep the existing enum and map everything through the translation in Step 1
- **Do not** add `revision-requested` to the DB schema yet

#### Step 6 — Verify `JobsTable` still works
- `JobsTable` accepts `DashboardJob[]` — no interface change needed
- Column rendering for `estimatedCompletion` may show a derived value or be hidden
- `progress` column will show derived values — acceptable for Phase 5A

---

## 6. Security Considerations and Risks

### Risk 1 — Email-only matching (HIGH — must address before shipping)

**Problem:** `client_email` is a free-text field typed by the user at order time. It is not
cryptographically linked to the Supabase auth user. Two scenarios create a leak:
- A bad actor creates an auth account with someone else's email and sees their orders.
- A legitimate user typed their email slightly differently (typo, alias) and sees zero orders.

**Mitigation options (choose one):**

**Option A — Require email confirmation before showing orders (recommended)**
Supabase already requires email confirmation (PR #31). The auth user's email is confirmed
by Supabase. Query is `WHERE client_email = confirmed_auth_user.email`. Only the confirmed
email owner can see orders. This is acceptable for Phase 5A.

**Option B — Add RLS + `user_id` FK to `orders` (ideal long-term)**
Add `ALTER TABLE orders ADD COLUMN user_id UUID REFERENCES auth.users(id)`. Backfill
where possible. Add RLS policy `USING (client_email = auth.email() OR user_id = auth.uid())`.
Future orders submitted while logged in would store `user_id` too. This is Phase 5B work.

**Option C — Do nothing and only show orders if `client_profiles` email matches**
Already done in Phase 4: `client_profiles` is linked to `auth.users` via `user_id`. Could
cross-reference: only show orders where `client_email` = profile user's auth email. Same as
Option A but makes the check explicit in the query layer.

**Recommendation for Phase 5A:** Use Option A (confirmed-email guard, server-side only).
Document the limitation clearly in code. Plan Option B for a later PR.

### Risk 2 — No RLS on `orders` (MEDIUM)

The `orders` table has no RLS. Currently only the service role key can query it.
For Phase 5A, the dashboard query uses the service role key server-side with a strict
`WHERE client_email = $1`. This is safe **as long as** the email value comes exclusively
from the server-validated session — never from a request parameter, cookie, or client input.

**Do not** add a client-side route (e.g. a `GET /api/orders?email=…`) that accepts email
as input without server-session validation.

### Risk 3 — `revision-requested` status does not exist in DB (LOW)

The dashboard type `DashboardJobStatus` includes `"revision-requested"` as a value.
Real orders will never have this status. `StatusBadge` and `STATUS_LABELS` handle it
correctly if passed, but since it will never appear in real data it is safe to leave as-is.
Document it as mock-only.

### Risk 4 — `getSupabaseBrowser()` legacy client (LOW — intentional)

`src/lib/supabase.ts` exports `getSupabaseBrowser()` (plain `@supabase/supabase-js`,
localStorage-based, no SSR). This is still used by:
- `src/lib/submit-order.ts` — for `uploadToSignedUrl()` (Storage, not Auth)
- `PortfolioAdminClient.tsx` — for `uploadToSignedUrl()` (Storage, not Auth)
- `MediaAdminClient.tsx` — for `uploadToSignedUrl()` (Storage, not Auth)

These are Storage-only operations that do not use `supabase.auth.*`, so the old client
is safe here. **Do not** use it for dashboard data fetching. The new dashboard query
helper must use the service role key via `createClient(url, SERVICE_ROLE_KEY)`.

### Risk 5 — `estimated_total_cents` vs actual billed amount (LOW)

`estimated_total_cents` is computed server-side from the pricing logic at submission time.
It is the estimated total, not a confirmed invoice amount. Displaying it in the dashboard
as "Cost" is acceptable, but it should be labelled as "Estimated" until a payment system
is connected.

### Risk 6 — `jobs/page.tsx` is currently `"use client"` (LOW)

The jobs page uses `useState` for the status filter. Converting it to a server component
would require moving filter state to URL search params or wrapping with a client shell.
For Phase 5A the simplest approach is to keep the outer page as a server component that
fetches jobs, then pass jobs as props to a `ClientJobsShell` client component that owns
the `useState` filter. This is a clean pattern already established by `ClientProfileForm`.

---

## 7. Exact Files to Change in Next Implementation PR

| File | Change Type | What Changes |
|---|---|---|
| `src/lib/client-orders.ts` | **Create new** | `getOrdersByClientEmail()`, `mapOrderToDashboardJob()`, translation helpers |
| `src/app/(dashboard)/dashboard/jobs/page.tsx` | **Rewrite** | Server component wrapper + real data; client shell for filter state |
| `src/app/(dashboard)/dashboard/page.tsx` | **Edit** | Replace `MOCK_JOBS` with `getOrdersByClientEmail()` result |
| `src/lib/client-dashboard/mock-data.ts` | **Edit (minor)** | Remove `MOCK_JOBS` usage from pages that switch to real data; add comment that `revision-requested` is mock-only |

**Files that must NOT be touched:**
- `src/app/(public)/api/order/route.ts`
- `src/lib/submit-order.ts`
- `src/lib/upload-config.ts`
- `src/lib/server-validation.ts`
- `src/lib/server-pricing.ts`
- `supabase/schema.sql`
- `src/app/(public)/api/upload-url/route.ts`
- Any payment / Resend / email file
- Any admin auth file

---

## 8. Proposed `src/lib/client-orders.ts` Interface (for next PR)

```typescript
// Server-only. Never import from "use client" files.

import { createClient } from "@supabase/supabase-js";
import type { DashboardJob, DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

export interface ClientOrder {
  id: string;
  order_number: string;
  service_type: "virtual-staging" | "virtual-renovation" | "3d-floor-plans" | "photo-editing";
  status: "pending" | "confirmed" | "in-progress" | "delivered" | "cancelled";
  item_count: number;
  estimated_total_cents: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all orders for a confirmed auth user, matched by email.
 * Uses service role key — MUST be called server-side only.
 * Email MUST come from a verified Supabase session, never from client input.
 */
export async function getOrdersByClientEmail(email: string): Promise<ClientOrder[]>

/**
 * Translate a ClientOrder to the DashboardJob shape the UI expects.
 * Fields with no DB equivalent (estimatedCompletion, progress) are derived.
 */
export function mapOrderToDashboardJob(order: ClientOrder): DashboardJob

// --- Translation maps ---

const SERVICE_TYPE_LABELS: Record<ClientOrder["service_type"], string> = {
  "virtual-staging":   "Virtual Staging",
  "virtual-renovation": "Virtual Renovation",
  "3d-floor-plans":    "Floor Plans",
  "photo-editing":     "Photo Editing",
};

const DB_STATUS_TO_DASHBOARD: Record<ClientOrder["status"], DashboardJobStatus> = {
  "pending":    "awaiting-submission",
  "confirmed":  "in-progress",
  "in-progress": "in-progress",
  "delivered":  "completed",
  "cancelled":  "cancelled",
};

const STATUS_TO_PROGRESS: Record<ClientOrder["status"], number> = {
  "pending":    0,
  "confirmed":  15,
  "in-progress": 50,
  "delivered":  100,
  "cancelled":  0,
};
```

---

## 9. Summary

| Question | Answer |
|---|---|
| Can real orders be safely shown in the dashboard? | **Yes, with conditions** |
| What is the matching key? | `client_email` (server-validated from SSR session) |
| Is there a `user_id` FK? | **No** — email-only, pre-auth design |
| Is RLS in place? | **No** — service role key query required, server-side only |
| Are all dashboard fields available? | **No** — `title`, `estimatedCompletion`, `progress` must be derived |
| Status mapping 1:1? | **No** — 5 DB statuses vs 5 dashboard statuses, different names |
| `revision-requested` in DB? | **No** — mock-only status |
| Is it safe to implement Phase 5A now? | **Yes** — read-only, server-side, email-guarded |
| Migrations needed for Phase 5A? | **No** — existing schema is sufficient |
| Migrations recommended before Phase 5B? | **Yes** — add `user_id` FK + RLS to `orders` |

---

## 10. Decision

**Proceed with Phase 5A implementation** using the approach in §5:
- New `src/lib/client-orders.ts` server helper
- Service role key, strict `WHERE client_email = $1`, server-side only
- Derived `title`, `progress`, `estimatedCompletion` — no schema changes
- No changes to order submission, upload, payment, or email flows
- Document email-only matching limitation in code; plan `user_id` FK for Phase 5B

This is safe, minimal, and fully reversible.
