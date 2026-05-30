# Phase 5B Audit — Client Deliverables / Files Download System

> **Branch:** `audit/client-deliverables-files`
> **Status:** Audit only — no code changes to production paths.
> **Date:** 2026-05-30
> **Based on:** PR #38 merged (admin order status update)

---

## 1. Files Inspected

| File | Purpose |
|---|---|
| `supabase/schema.sql` | DB schema — `orders`, `order_items`, storage comment |
| `src/lib/upload-config.ts` | Bucket name, path helpers, MIME lists |
| `src/app/(public)/api/upload-url/route.ts` | Signed upload URL issuance for client order files |
| `src/app/(public)/api/order/route.ts` | Order submission — file move + DB insert |
| `src/lib/submit-order.ts` | Client-side order submission flow |
| `src/app/(dashboard)/dashboard/files/page.tsx` | Dashboard files page (currently 100% mock data) |
| `src/lib/client-orders.ts` | Server-side order fetch + JSONB sanitizer |
| `src/lib/admin-auth.ts` | Admin HMAC cookie auth |
| `src/lib/supabase.ts` | `getSupabaseBrowser()` / `createServerClient()` |
| `src/app/(public)/api/admin/media/route.ts` | Admin media upload pattern (service-role + signed URL) |
| `src/app/(public)/api/admin/portfolio/upload-url/route.ts` | Admin portfolio upload-URL pattern |
| `src/app/(public)/admin/orders/AdminOrdersClient.tsx` | Admin orders list (PR #38) |

---

## 2. Current File / Upload Model

### 2a — Storage bucket

A single private bucket `order-files` is used for **all** file operations.
It is configured as private (no public access) and accessed exclusively via
the Supabase service role key — no RLS policies exist on it.

### 2b — Path namespaces inside `order-files`

The bucket currently has two path namespaces, both mixing client source
files in one place:

```
order-files/
├── pending/<pendingToken>/
│   ├── 0-original.<ext>     ← temporary; client browser uploads here first
│   ├── 0-reference.<ext>    ← optional reference image
│   ├── 1-original.<ext>
│   └── ...
│
└── <orderNumber>/            ← finalized after /api/order confirms
    ├── 0-original.<ext>     ← client's source photo (e.g. VS-0041/0-original.jpg)
    ├── 0-reference.<ext>    ← client's reference image (optional)
    ├── 1-original.<ext>
    └── ...
```

The `pending/` prefix is transient — files are moved to `<orderNumber>/`
by the order submission API and cleaned up on failure.

The `<orderNumber>/` prefix is permanent. These are the **client's raw
source files** uploaded at order time. They are the input to the
PicchuSpot editing team's work.

### 2c — DB storage references

`order_items` stores the storage paths in two columns:

```sql
original_photo_path   TEXT   -- e.g. "VS-0041/0-original.jpg"
reference_image_path  TEXT   -- e.g. "VS-0041/0-reference.jpg"
```

These columns are intentionally **excluded** from every client-facing query
in `client-orders.ts` (Phase 5A). The JSONB `details` blob also contains
`uploaded_files` metadata (filename, size, MIME) which is stripped by
`sanitizeDetails()` before any data reaches the client.

### 2d — What does NOT exist yet

- ❌ No `order_deliverables` table (or equivalent)
- ❌ No deliverables path in `order-files` or any other bucket
- ❌ No admin UI for uploading finished files
- ❌ No client-facing download API
- ❌ No signed read-URL generation for clients
- ❌ `/dashboard/files` is 100% mock data

---

## 3. Why Client Source Files Must NOT Be Exposed Directly

The files stored under `<orderNumber>/` in `order-files` are the **raw
photos uploaded by the client at order submission time**. They must not
be exposed via the client dashboard for several reasons:

### 3a — Wrong files at the wrong time

The client uploaded these files *to us* as inputs. They already have
them. What they want back are the **finished deliverables** — the
retouched, staged, or rendered outputs produced by the editing team.
Serving `<orderNumber>/0-original.jpg` back to the client would just
give them their own photo.

### 3b — Security boundary confusion

Exposing source file paths conflates two distinct roles:
- **Admin/team access**: needs the originals to do the editing work.
- **Client access**: only needs the finished outputs.

If clients can read `<orderNumber>/` paths, a compromised or confused
implementation could accidentally surface another client's source files
(since both live under the same bucket with the same path scheme).

### 3c — No per-client ownership enforced at the bucket level

`order-files` has no RLS. Any signed URL for any path in this bucket
would be valid. The only ownership check is the email guard in
`client-orders.ts`, which is enforced in application code — not at the
storage layer. Keeping client downloads in a separate, purpose-built
bucket makes it structurally impossible to accidentally issue a download
URL for a source file.

### 3d — Reference images may be third-party copyrighted

`<orderNumber>/0-reference.jpg` may be a reference photo the client
submitted (e.g., a Pinterest screenshot, a competitor's listing). These
should never be re-served publicly or even privately via the portal.

### 3e — JSONB `uploaded_files` metadata

The `details` JSONB blob stores `uploaded_files.original.bucket`,
`.mime_type`, `.size_bytes`, and `.original_filename`. Phase 5A's
`sanitizeDetails()` already strips all of this. Any Phase 5B
implementation must continue to honour that sanitization contract.

---

## 4. Recommended Phase 5B Architecture

### 4a — New DB table: `order_deliverables`

A new table tracks each finished file the admin uploads for an order.
One row = one deliverable file.

```sql
CREATE TABLE order_deliverables (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number  TEXT        NOT NULL,   -- denormalised for display without JOIN
  item_index    INTEGER,                -- NULL = order-level file (e.g. a zip)
  storage_path  TEXT        NOT NULL,   -- path inside the `deliverables` bucket
  filename      TEXT        NOT NULL,   -- display filename shown to client
  file_size     INTEGER     NOT NULL,   -- bytes
  mime_type     TEXT        NOT NULL,
  uploaded_by   TEXT        NOT NULL DEFAULT 'admin',
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ             -- optional: NULL = no expiry
);

-- Indexes
CREATE INDEX ON order_deliverables (order_id);
CREATE INDEX ON order_deliverables (order_number);
```

**Why not reuse `order_items`?**
`order_items` rows are created at order submission and represent *inputs*.
Deliverables are outputs — they can be uploaded at a different time,
in different quantities, and may include zip archives that span multiple
items. A separate table is cleaner and avoids complicating the existing
order schema.

**RLS on `order_deliverables`:**

```sql
ALTER TABLE order_deliverables ENABLE ROW LEVEL SECURITY;

-- Clients can SELECT rows for their own orders only
-- (matched via orders.client_email = auth.email())
CREATE POLICY "deliverables_client_read"
  ON order_deliverables
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE client_email = auth.email()
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated clients — admin only via service role
```

This is the correct long-term model. For Phase 5B it provides a meaningful
safety net even before `user_id` FK is added to `orders`.

### 4b — New Supabase Storage bucket: `deliverables`

**Recommendation: create a new private `deliverables` bucket** rather
than adding a prefix to `order-files`.

| Option | Pros | Cons |
|---|---|---|
| New `deliverables` bucket | Clean permission boundary; impossible to accidentally read source files; separate retention policy possible; RLS can be added per bucket | One more bucket to create in dashboard |
| `order-files/deliverables/<orderNumber>/` prefix | Zero new bucket | Source files and deliverables share the same bucket; one compromised signed URL generation could cross namespaces; harder to apply different bucket-level policies; requires code to distinguish path prefixes |

**Chosen: new `deliverables` bucket, private, no public access.**

Path layout inside `deliverables` bucket:

```
deliverables/
└── <orderNumber>/
    ├── 0-delivered.jpg      ← per-item deliverable
    ├── 1-delivered.jpg
    └── all-files.zip        ← optional bundle
```

### 4c — Ownership model

**Phase 5B (email-based, consistent with existing orders):**
- Client can download a file if: the `order_deliverables.order_id` maps
  to an `orders` row where `client_email = verified_session_email`
- Checked server-side only, via `getClientUser()` email
- Same pattern as Phase 5A `getOrderByIdForClient()`

**Phase 5C (future, after `user_id` FK added to `orders`):**
- Switch to `user_id` check in RLS policy

### 4d — Admin upload flow

Mirrors the existing `portfolio` and `media` admin upload patterns exactly:

```
Admin selects file in /admin/orders/[orderId]/deliverables
  → POST /api/admin/orders/[orderId]/deliverables/upload-url
      └─ isAdminAuthenticated()                  ← HMAC cookie check
      └─ validate: orderId exists, filename, MIME, size
      └─ createClient(SERVICE_ROLE_KEY)
      └─ deliverables bucket: createSignedUploadUrl(path)
      └─ return { bucket, path, token, signedUrl }
  → Browser uploads file directly to Supabase Storage
      (bytes never pass through Vercel / Next.js API)
  → POST /api/admin/orders/[orderId]/deliverables
      └─ isAdminAuthenticated()
      └─ validate path belongs to correct orderNumber
      └─ INSERT INTO order_deliverables (...)
      └─ Optionally: update orders.status = 'delivered' if all items covered
  → Admin sees upload confirmation in UI
```

**Allowed MIME types for deliverables:**
- `image/jpeg`, `image/png`, `image/webp`, `image/tiff` (final retouched photos)
- `application/pdf` (floor plans, reports)
- `application/zip`, `application/x-zip-compressed` (bundles)

### 4e — Client download flow

```
Client visits /dashboard/files
  → Server component: getClientUser() → user.email
  → getDeliverablesByClientEmail(email) [new server helper]
      └─ createClient(SERVICE_ROLE_KEY)
      └─ SELECT od.* FROM order_deliverables od
         JOIN orders o ON o.id = od.order_id
         WHERE o.client_email = email   ← strict ownership check
         ORDER BY od.uploaded_at DESC
      └─ Returns [] on error (never crashes the page)
  → Client clicks Download button
  → POST /api/client/deliverables/[deliverableId]/download-url
      └─ getClientUser()                          ← SSR session
      └─ Verify deliverable ownership: 
         SELECT od.id, od.storage_path, od.order_id
         FROM order_deliverables od
         JOIN orders o ON o.id = od.order_id
         WHERE od.id = deliverableId
           AND o.client_email = verified_email    ← ownership check
      └─ createClient(SERVICE_ROLE_KEY)
      └─ deliverables bucket: createSignedUrl(path, 300 seconds)
      └─ Return { signedUrl } — expires in 5 minutes
  → Client browser redirects to signedUrl → file downloads
```

### 4f — Signed URL strategy

| Decision | Recommendation | Rationale |
|---|---|---|
| URL type | Short-lived signed read URL | Never permanent public URLs; bucket stays private |
| TTL | 300 seconds (5 minutes) | Long enough to survive a slow download; short enough to limit exposure if leaked |
| Generation | Server-side only, in a dedicated API route | URL generation requires service role key; must not happen in client JS |
| Caching | Do NOT cache signed URLs | They expire; caching creates false "link available" states |
| Direct storage path to client | Never | Client always hits the API route, which checks ownership before generating |

---

## 5. Exact Files Needed in the Next Implementation PR

### New files

| File | Purpose |
|---|---|
| `supabase/add-order-deliverables.sql` | Migration: `order_deliverables` table + RLS |
| `src/lib/client-deliverables.ts` | Server helper: `getDeliverablesByClientEmail()`, `getDeliverableDownloadUrl()`, `ClientDeliverable` type |
| `src/app/(public)/api/admin/orders/[orderId]/deliverables/upload-url/route.ts` | Admin: issue signed upload URL for a deliverable |
| `src/app/(public)/api/admin/orders/[orderId]/deliverables/route.ts` | Admin: POST to register uploaded file in `order_deliverables`; DELETE to remove |
| `src/app/api/client/deliverables/[deliverableId]/download-url/route.ts` | Client: ownership-checked signed read URL generation |
| `src/components/admin/AdminDeliverableUpload.tsx` | Admin UI: file picker + upload flow for one order |
| `src/app/(public)/admin/orders/[orderId]/page.tsx` | Admin order detail page with deliverable upload section |
| `src/app/(dashboard)/dashboard/files/page.tsx` | Replace mock data with real `getDeliverablesByClientEmail()` |

### Modified files

| File | Change |
|---|---|
| `src/lib/client-orders.ts` | (optional) Re-export order-number helper for file page cross-reference |
| `src/app/(public)/admin/orders/AdminOrdersClient.tsx` | Add "Deliverables" link per order row → `/admin/orders/[orderId]` |

### Files that must NOT be changed

- `src/app/(public)/api/order/route.ts`
- `src/lib/submit-order.ts`
- `src/lib/upload-config.ts` (may need minor extension for deliverable MIME list)
- `src/lib/server-validation.ts`
- `src/lib/server-pricing.ts`
- `src/lib/email/*`
- `supabase/schema.sql` (add a new file, not modify the existing one)
- Any admin auth logic
- Any existing order/order_items table structure

---

## 6. Risks and Security Rules

### Risk 1 — Signed URLs forwarded or shared (MEDIUM)

A client could copy a generated signed URL and share it. With a 5-minute
TTL this window is small but non-zero.

**Mitigation:** Keep TTL short (300s). For sensitive deliverables
(floor plans with address data, etc.) the admin can choose to use a
shorter TTL (60s). Never log the signed URL server-side.

### Risk 2 — Admin path-injection (HIGH — must guard)

The admin upload route receives `filename` from the admin browser. If
not sanitized, a crafted filename could create a path like
`../../orders/VS-0001/0-original.jpg` in Storage, overwriting source
files or escaping the deliverables namespace.

**Mitigation:** The path is always constructed server-side:
`buildDeliverablePath(orderNumber, sanitizedFilename)` — never use raw
client-supplied strings as Storage paths.

```typescript
function buildDeliverablePath(orderNumber: string, filename: string): string {
  // Strip any path components, keep only the basename
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orderNumber}/${Date.now()}-${safe}`;
}
```

### Risk 3 — Client email spoofing for download (HIGH — already mitigated)

The download-URL API route must never accept `email` or `orderId` from
the client request body/query-string. Both the deliverable ID (from URL)
and the email (from `getClientUser()`) must come from trusted sources,
and both must be cross-referenced in a single server-side query.

**Mitigation (same contract as `getOrderByIdForClient`):**
```sql
SELECT od.storage_path
FROM order_deliverables od
JOIN orders o ON o.id = od.order_id
WHERE od.id = $deliverableId
  AND o.client_email = $verifiedEmail   -- from SSR session only
```

### Risk 4 — Over-large deliverable files (LOW)

Finished TIFF or ZIP files can be 100 MB+. The existing 20 MB cap in
`upload-config.ts` applies only to client order uploads. Admin uploads
need a separate, higher cap (e.g. 200 MB per file).

**Mitigation:** Define `ADMIN_DELIVERABLE_MAX_BYTES` separately. Do not
reuse `MAX_FILE_SIZE_BYTES`.

### Risk 5 — No expiry on `order_deliverables` rows (LOW)

If an order is cancelled or refunded, the deliverable files remain
accessible indefinitely. The `expires_at` column in the proposed schema
allows per-file expiry, but it needs a cron/function to enforce it.

**Mitigation (Phase 5B):** Leave `expires_at` nullable; set it to NULL
(no expiry) for all initial uploads. Document as Phase 5C work.

### Risk 6 — MIME type mismatch between upload and storage (LOW)

The admin browser may report `application/octet-stream` for a ZIP file
depending on OS. The server must check file extension in addition to
`content_type` for MIME validation.

### Risk 7 — `order-files` bucket still accessible via service role (LOW)

Since `order-files` uses service-role access (no RLS), and the service
role key is used server-side, there is no structural guard against an
admin accidentally generating a signed URL for `order-files` instead of
`deliverables`.

**Mitigation:** The download-URL API route hardcodes the `deliverables`
bucket name constant — never accepts it from client input. The
`deliverables` bucket constant is defined in a new `deliverables-config.ts`
file, not reused from `upload-config.ts`.

---

## 7. Security Rules Summary (for Implementation PR)

```
✓ deliverables bucket: private, no public access, no anon key access
✓ Storage paths always constructed server-side from orderNumber + safe filename
✓ Admin upload: requires isAdminAuthenticated() before signed URL issuance
✓ Client download: requires getClientUser() + ownership cross-reference in DB
✓ Signed read URLs: 300s TTL, generated only in dedicated server route
✓ Signed URL never logged, never cached, never forwarded in JSON to page
✓ deliverable ID in download-URL route comes from URL param (untrusted)
✓ client email in download-URL route comes from SSR session (trusted)
✓ Both must match a single server-side JOIN query before URL is generated
✓ original_photo_path and reference_image_path remain stripped from all client responses
✓ order_deliverables table: RLS SELECT policy for confirmed email; no client INSERT/DELETE
✓ Admin MAX file size: new constant, not shared with client upload cap
✓ No public URLs, no permanent URLs, no URL generation in client JS
```

---

## 8. Summary Table

| Question | Answer |
|---|---|
| Where are client source files stored? | `order-files/<orderNumber>/<i>-original.<ext>` |
| Should client see source files? | **No** — these are inputs, not outputs |
| Does a deliverables system exist? | **No** — nothing in DB or Storage yet |
| Recommended new Storage bucket? | **Yes** — new private `deliverables` bucket |
| New DB table needed? | **Yes** — `order_deliverables` with RLS |
| Ownership model for Phase 5B? | Email match via `orders.client_email = verified_session_email` |
| Ownership model for Phase 5C? | Switch to `user_id` FK + RLS after Phase 5B migration |
| Admin upload pattern available? | **Yes** — mirror `portfolio` or `media` signed-URL pattern |
| Signed URL TTL? | 300 seconds |
| Migrations needed? | **Yes** — `supabase/add-order-deliverables.sql` |
| `dashboard/files` currently? | 100% mock data — will be replaced in implementation PR |
| New env vars needed? | **No** — reuses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

---

## 9. Decision

**Proceed with Phase 5B implementation** using the architecture in §4:

1. Create `supabase/add-order-deliverables.sql` migration
2. Create new `deliverables` private Storage bucket (manual, Supabase Dashboard)
3. Build admin upload flow: `/admin/orders/[orderId]` detail page + upload UI
4. Build admin API: upload-url issuance + deliverable registration
5. Build client download API: ownership-checked signed read URL generation
6. Build `src/lib/client-deliverables.ts` server helper
7. Replace mock data in `/dashboard/files` with real `order_deliverables` rows
8. Add "Deliverables" column/link to `/admin/orders` table

This is fully additive — no existing tables, routes, or upload flows are modified.
