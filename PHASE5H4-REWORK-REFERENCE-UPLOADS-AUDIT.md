# Phase 5H.4A — Audit: Rework Reference Image Uploads

**Status:** Planning / Audit only. No app code changed.  
**Branch:** `claude/audit-rework-reference-uploads`  
**Date:** 2026-06-02  
**Codebase state:** after Phase 5H.3 (Approve button removed, rework always available)

---

## 0. Critical Blocker Found in Phase 5H.3

Before implementing reference uploads, one server-side bug must be fixed.

### Problem

`src/lib/client-reviews.ts` — `submitDeliverableReview()` contains a terminal-state guard:

```typescript
export const TERMINAL_REVIEW_STATUSES: ReviewStatus[] = ["approved", "resolved"];

// inside submitDeliverableReview():
if ((TERMINAL_REVIEW_STATUSES as string[]).includes(latest))
  return { ok: false, error: "This deliverable has already been approved or resolved.", status: 409 };
```

Phase 5H.3 removed the Approve button from the UI and now shows "Request rework" even after `approved` or `resolved` state. But the **server still rejects** rework submissions when the latest review is `approved` or `resolved`. The client will see a 409 error.

### Fix required (small, single-line)

In `submitDeliverableReview`, the terminal guard should only apply to the `approve` action, not to `rework_requested`:

```typescript
// BEFORE (blocks both approve and rework_requested after terminal state):
if ((TERMINAL_REVIEW_STATUSES as string[]).includes(latest))
  return { ok: false, error: "...", status: 409 };

// AFTER (only block rework if there is already an ACTIVE rework):
// (the active rework guard below already handles duplicates)
// Remove or scope the terminal guard to action === "approve" only.
```

The existing unique partial index `deliverable_reviews_one_active_rework` already prevents a second active rework from being inserted. The terminal-state guard is redundant for `rework_requested` and must be removed or scoped.

**This fix belongs either in Phase 5H.3 follow-up or as the very first commit of Phase 5H.4.**

---

## 1. Goal

Allow clients to attach reference images or files (e.g., inspiration photos, annotated screenshots) to a rework request. Admin sees these references inside the per-image card alongside the rework comment.

---

## 2. Existing Infrastructure Audit

### 2.1 Tables

| Table | Relevant columns | Notes |
|-------|-----------------|-------|
| `orders` | `id`, `order_number`, `client_email` | Ownership anchor for all client data |
| `order_items` | `id`, `order_id`, `item_index`, `original_photo_path`, `reference_image_path` | Source files live here |
| `order_deliverables` | `id`, `order_id`, `order_number`, `item_index`, `storage_path`, `filename`, `file_size`, `mime_type`, `uploaded_by` | Admin-uploaded deliverables |
| `deliverable_reviews` | `id`, `deliverable_id`, `order_id`, `order_number`, `item_index`, `client_email`, `status`, `comment`, `replacement_deliverable_id` | One row per review cycle |

### 2.2 Storage Buckets

| Bucket | Purpose | Visibility | Who uploads |
|--------|---------|------------|------------|
| `order-files` | Client source files (originals + references at order time) | Private | Client browser via signed upload URL |
| `deliverables` | Admin-finished deliverable files | Private | Admin browser via signed upload URL |

### 2.3 Signed URL Pattern

Both buckets follow the same server-side signed URL pattern:

```
POST /api/.../download-url
  → getClientUser() or isAdminAuthenticated()
  → ownership JOIN via orders.client_email = email
  → supabase.storage.from(BUCKET).createSignedUrl(path, 300, options)
  → returns { signedUrl, filename } — never the raw storage_path
```

Upload URL pattern (admin deliverables):

```
POST /api/admin/orders/[orderId]/deliverables/upload-url
  → isAdminAuthenticated()
  → build storage path server-side from orderNumber + sanitized filename
  → supabase.storage.createSignedUploadUrl(path)
  → returns { signedUrl, path, token } — client PUTs bytes directly to storage
```

Raw `storage_path` is **never returned** to the browser. This pattern must be preserved for rework references.

### 2.4 Upload Config (`src/lib/upload-config.ts`)

```typescript
ORDER_FILES_BUCKET = "order-files"
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  // 20 MB
ALLOWED_REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
```

### 2.5 Deliverables Config (`src/lib/deliverables-config.ts`)

```typescript
DELIVERABLES_BUCKET = "deliverables"
ADMIN_DELIVERABLE_MAX_BYTES = 200 * 1024 * 1024  // 200 MB
ALLOWED_DELIVERABLE_MIME_TYPES = [jpeg, png, webp, tiff, pdf, zip, octet-stream]
SIGNED_URL_TTL_SECONDS = 300  // 5 minutes
```

### 2.6 Review Model (`src/lib/client-reviews.ts`)

- `submitDeliverableReview()` verifies deliverable ownership via `orders!inner(client_email)` JOIN — the same join pattern should be used for reference file ownership.
- Unique partial index `deliverable_reviews_one_active_rework` enforces one active rework per deliverable at the DB level. Reference files should be linked to the review row, not to the deliverable directly, to avoid ambiguity across rework cycles.

### 2.7 AdminOrderImageCard Review Display

The right column in `AdminOrderImageCard` renders each `AdminReview` row, showing:
- Status badge
- Client `comment`
- "Mark in progress" / "Mark resolved" buttons

Reference files need to be fetched and displayed in this same per-review section.

---

## 3. Data Model Recommendation

### Option A — New table: `deliverable_review_files`

✅ **Recommended.**

Each uploaded reference file gets one row. FK to `deliverable_reviews.id`. Clean deletion cascade. Individual file management (list, download, delete). No JSON parsing required. Supports future features (admin deleting a specific reference, client viewing what they submitted).

### Option B — JSONB metadata on `deliverable_reviews`

❌ Not recommended.

Storing `[{filename, size, mime, path}]` in a JSONB column works for simple cases but:
- Cannot cascade-delete individual files from storage
- No FK integrity
- Harder to index or query individual files
- Awkward to add file-level metadata later
- Requires app code to manage file list mutations

### Option C — Storage paths only, no DB rows

❌ Not recommended.

- Cannot list files without scanning the storage bucket
- Cannot verify ownership per-file
- No audit trail
- Orphan files impossible to detect

---

## 4. Recommended Table Design

```sql
-- ============================================================
-- MIGRATION: add_deliverable_review_files
-- Phase 5H.4: reference images/files attached to rework requests
--
-- One row per file the client uploads alongside a rework request.
-- Linked to deliverable_reviews so files are scoped to one
-- review cycle and cascade-deleted if the review is deleted.
--
-- All writes go through the server (service role key).
-- No direct client INSERT access.
-- Raw storage_path never returned to client or admin browser.
-- ============================================================

CREATE TABLE IF NOT EXISTS deliverable_review_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The review this file is attached to.
  review_id       UUID        NOT NULL
    REFERENCES deliverable_reviews(id) ON DELETE CASCADE,

  -- Denormalized for fast listing without extra JOINs.
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  deliverable_id  UUID        NOT NULL
    REFERENCES order_deliverables(id) ON DELETE CASCADE,
  item_index      INTEGER,                          -- mirrors review item_index

  -- Storage path inside the `order-files` bucket.
  -- Constructed server-side only; NEVER returned to browser.
  -- Format: rework/<reviewId>/<timestamp>-<safe-filename>
  storage_path    TEXT        NOT NULL,

  -- Display filename (sanitized server-side).
  filename        TEXT        NOT NULL,

  -- Bytes (display only).
  file_size       INTEGER     NOT NULL,

  -- MIME type (validated against allowlist on upload).
  mime_type       TEXT        NOT NULL,

  -- Who uploaded. Always 'client' for rework references.
  uploaded_by     TEXT        NOT NULL DEFAULT 'client',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_review_files_review_id
  ON deliverable_review_files (review_id);

CREATE INDEX IF NOT EXISTS idx_review_files_order_id
  ON deliverable_review_files (order_id);

CREATE INDEX IF NOT EXISTS idx_review_files_deliverable_id
  ON deliverable_review_files (deliverable_id);

-- RLS — enabled, no authenticated write access.
ALTER TABLE deliverable_review_files ENABLE ROW LEVEL SECURITY;

-- Clients may SELECT their own reference files (read-only).
CREATE POLICY "review_files_client_select_own"
  ON deliverable_review_files
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- Service role grants (writes always go through server API).
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.deliverable_review_files TO service_role;
```

### Rationale for field choices

| Field | Why |
|-------|-----|
| `review_id` | Primary association — scopes file to a single rework cycle |
| `order_id` | Denormalized — fast admin listing without JOINs |
| `deliverable_id` | Denormalized — verify ownership and correlate to image card |
| `item_index` | Denormalized — place file in the correct image card on admin side |
| `storage_path` | Private path in `order-files` bucket — never returned to browser |
| `filename` | Sanitized display name |
| `file_size` | Display/validation only |
| `mime_type` | Controls preview vs download on admin side |
| `uploaded_by` | `'client'` for all rework references; reserved for future use |
| `created_at` | Audit trail and ordering |

No `updated_at` needed — reference files are write-once.  
No `expires_at` needed — they live as long as the review row.

---

## 5. Storage Recommendation

### Bucket

**Reuse `order-files`.** Rationale:
- Avoids a new bucket to configure in Supabase Dashboard.
- Consistent with existing client-upload pattern.
- All client-side file uploads (order source files + rework references) in one bucket.
- Access control is via signed URLs + service role only — no bucket-level public access.
- Admin access uses same signed URL pattern as admin source file downloads.

### Path convention

```
rework/<reviewId>/<timestamp>-<safeFilename>
```

Example:
```
rework/a1b2c3d4-e5f6-7890-abcd-ef1234567890/1717123456789-inspiration-photo.jpg
```

- `reviewId` scopes the file to one rework cycle
- `timestamp` prevents filename collisions
- `safeFilename` is sanitized server-side (strip path, replace unsafe chars, cap length)
- Path is **built server-side** from server-controlled inputs — never assembled from raw client input

### Path builder (to add in `src/lib/upload-config.ts`)

```typescript
export function buildReworkReferencePath(
  reviewId: string,
  originalFilename: string
): string {
  const safeBase = originalFilename
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const ts = Date.now();
  return `rework/${reviewId}/${ts}-${safeBase}`;
}
```

### File constraints

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max file size | 20 MB | Matches existing `order-files` cap |
| Max files per rework | 5 | Prevents abuse; enough for reference images |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf` | Images for visual reference; PDF for annotated docs |
| Previewable types | JPEG, PNG, WebP, GIF | `FilePreviewCard` handles these natively |
| Non-previewable | PDF | Download only; `FilePreviewCard` shows download-only state |
| Total per rework | 100 MB max (5 × 20 MB) | Acceptable for reference images |

---

## 6. API Route Plan

### 6.1 Upload flow overview

```
1. Client selects reference files (UI only — nothing uploaded yet)
2. Client fills in rework comment
3. Client submits form:
   a. POST /api/client/deliverables/[deliverableId]/review
      Body: { action: "rework_requested", comment: "..." }
      → server creates deliverable_reviews row
      → returns { reviewId, ... }
   b. For each file:
      POST /api/client/reviews/[reviewId]/reference-files/upload-url
        Body: { filename, content_type, file_size }
        → server verifies review ownership
        → builds storage path server-side
        → returns { signedUrl, fileRecordId }
      PUT <signedUrl> ← browser uploads directly to Supabase Storage
      POST /api/client/reviews/[reviewId]/reference-files
        Body: { fileRecordId } (or path+metadata if simpler)
        → server marks file as uploaded / registers row
```

**Why submit review first, then upload files?**
- Review ID is needed to build the storage path (`rework/<reviewId>/...`).
- If files fail to upload, the rework request is still submitted (with comment). Admin sees the rework immediately. Files are supplementary.
- Avoids pre-generating review IDs or using a separate `pending` state.

**Why not upload files first, then submit?**
- Without a review ID, files would need a temporary identifier as path prefix.
- Creates orphaned files when the form is abandoned before submit.
- More complex cleanup logic.

### 6.2 Client-facing API routes (new)

#### `POST /api/client/reviews/[reviewId]/reference-files/upload-url`

```
Auth:    getClientUser()
Purpose: Issue signed upload URL for one reference file
Guard:   Verify review ownership:
           JOIN deliverable_reviews → order_deliverables → orders
           WHERE orders.client_email = user.email
         Verify review is in rework_requested status (only upload to active rework)
         Enforce max-5-files limit (count existing rows for this review_id)

Body:    { filename: string, content_type: string, file_size: number }
Returns: { signedUrl: string, storagePath: string (opaque token, not raw path) }
```

**Note:** `storagePath` returned here should be an opaque identifier (or just the path, since it does not reveal anything sensitive to a client who already owns the order). It is used in the register step.

#### `POST /api/client/reviews/[reviewId]/reference-files`

```
Auth:    getClientUser()
Purpose: Register an uploaded reference file in deliverable_review_files
Guard:   Same ownership check as upload-url route
         Verify file was actually uploaded (storage.head() check)

Body:    { storagePath: string, filename: string, file_size: number, mime_type: string }
Returns: { ok: true, file: { id, filename, file_size, mime_type, created_at } }
```

### 6.3 Admin-facing API routes (new)

#### `POST /api/admin/orders/[orderId]/reviews/[reviewId]/reference-files/[fileId]/download-url`

```
Auth:    isAdminAuthenticated()
Purpose: Issue signed download/preview URL for a reference file
Guard:   Verify review belongs to orderId
         Verify file row exists and belongs to reviewId

Body:    { intent: "preview" | "download" }
Returns: { signedUrl: string, filename: string }
TTL:     300 seconds (matching existing pattern)
```

#### `GET /api/admin/orders/[orderId]/reviews/[reviewId]/reference-files` *(optional convenience)*

```
Auth:    isAdminAuthenticated()
Purpose: List reference files for a specific review
Returns: [{ id, filename, file_size, mime_type, created_at }]
         (no storage_path in response)
```

Alternatively, reference file metadata can be fetched alongside reviews in the admin detail page query — no separate endpoint needed.

### 6.4 Modification to existing `submitDeliverableReview`

The terminal-state guard must be removed or scoped (see §0 above):

```typescript
// Remove this block entirely, OR scope it to action === "approve":
if ((TERMINAL_REVIEW_STATUSES as string[]).includes(latest))
  return { ok: false, error: "...", status: 409 };
```

No other changes to the existing review route are needed — files are uploaded separately after the review is created.

---

## 7. UI Plan

### 7.1 Client — `DeliverableReviewActions.tsx`

**Changes inside the existing rework form:**

```
┌─────────────────────────────────────────┐
│ Describe what needs to change:          │
│ ┌─────────────────────────────────────┐ │
│ │ textarea (existing)                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Attach reference images (optional)      │
│ ┌─────────────────────────────────────┐ │
│ │ [+ Add files] (up to 5, 20 MB each) │ │
│ └─────────────────────────────────────┘ │
│ selected files:                         │
│   • inspiration.jpg  (1.2 MB) [✕]      │
│   • sketch.png       (0.8 MB) [✕]      │
│                                         │
│ [Submit rework request]  [Cancel]       │
└─────────────────────────────────────────┘
```

**State additions to `DeliverableReviewActions`:**

```typescript
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [uploadProgress, setUploadProgress] = useState<string | null>(null);
// loading state already handles "rework"
```

**Submit flow (new multi-step):**

1. Validate comment (existing validation, unchanged).
2. Validate files (count ≤ 5, each ≤ 20 MB, allowed MIME).
3. POST review → get `reviewId`.
4. For each file: POST upload-url → PUT → POST register.
5. On complete: show rework_requested badge + file count badge.
6. On partial upload failure: show warning but keep status as rework_requested.

**File selection UI:**

- Hidden `<input type="file" multiple accept="image/*,.pdf" />`
- Show file list with name, size, remove button
- Client-side validation before submit (MIME, size, count)
- File picker styled to match existing button design

**After submit, show:**

```
[Rework requested]  2 references attached
"The lighting on the left…"
```

### 7.2 Admin — `AdminOrderImageCard.tsx`

**Where to show:** Inside the per-review section of the right column ("Request details & Admin actions").

**Current review row renders:**
```
[Image N badge] [status badge]
"client comment"
[Mark in progress] [Mark resolved]
```

**With references:**
```
[Image N badge] [status badge]  ● 2 references
"client comment"
┌─────────────────────────────┐
│ inspiration.jpg (1.2 MB)    │
│ [Preview] [Download]        │
│ sketch.png (0.8 MB)         │
│ [Download]                  │
└─────────────────────────────┘
[Mark in progress] [Mark resolved]
```

**Admin reference file data fetching:**

Option A — Fetch alongside reviews in the admin page server component (`/admin/orders/[orderId]/page.tsx`):
```typescript
const { data: reviewFiles } = await supabase
  .from("deliverable_review_files")
  .select("id, review_id, filename, file_size, mime_type")
  .eq("order_id", orderId);
```
Group by `review_id` and pass per-review. No new API route needed for the initial display.

Option B — Lazy-load when a review card is expanded (client-side fetch).

**Recommendation:** Option A — include in the server query already done in the admin page. Adds one DB query; no extra API route for display.

**Preview/download behavior:**

- Images (JPEG, PNG, WebP, GIF): use existing `FilePreviewCard` with `signedUrlEndpoint` pointing to the new admin download-url route.
- PDF: show download-only card (existing `FilePreviewCard` handles this via `getFilePreviewKind`).
- No lightbox needed at this stage; `FilePreviewCard` modal preview is sufficient.

---

## 8. Security Analysis

### 8.1 Client upload ownership chain

```
POST /api/client/reviews/[reviewId]/reference-files/upload-url
  getClientUser() → user.email (verified SSR session)
  → SELECT deliverable_reviews WHERE id = reviewId
       JOIN order_deliverables ON deliverable_id = order_deliverables.id
       JOIN orders ON order_id = orders.id
       WHERE orders.client_email = user.email
  → If no row found → 404 (client cannot probe other orders)
  → If found but status ≠ rework_requested → 409 (cannot upload to completed review)
```

No raw storage paths in response. Path built server-side.

### 8.2 Admin access

```
POST /api/admin/orders/[orderId]/reviews/[reviewId]/reference-files/[fileId]/download-url
  isAdminAuthenticated() → cookie-based admin session
  → SELECT deliverable_review_files WHERE id = fileId AND order_id = orderId
  → If not found → 404
  → createSignedUrl(storage_path, 300, options) — path never returned to browser
```

### 8.3 What is never exposed

- `storage_path` is never in any JSON response to client or admin browser.
- Signed URLs are short-lived (5 min TTL).
- Client cannot see reference files for other clients' orders.
- Client cannot upload reference files to another client's review.
- Client cannot upload reference files after a rework has been resolved or is in progress (status check on upload-url endpoint).

### 8.4 Validation layers

| Layer | Check |
|-------|-------|
| Client-side (UI) | MIME, size, count — fail fast before upload |
| Server (upload-url) | MIME allowlist, size cap, count cap, ownership, review status |
| Server (register) | Storage HEAD check (file actually uploaded), ownership re-verify |
| DB | FK constraints on `review_id`, `order_id`, `deliverable_id` |
| DB | RLS policy (client SELECT own only; service role for writes) |

---

## 9. Implementation Sequence (Suggested PRs)

### PR 1 — Prerequisites & schema

**Branch:** `claude/5h4-schema-rework-ref-files`

1. Fix terminal-state guard in `src/lib/client-reviews.ts` for `rework_requested` action.
2. Add `buildReworkReferencePath()` to `src/lib/upload-config.ts`.
3. Add `REWORK_REFERENCES_MAX_FILES`, `REWORK_REFERENCE_MAX_BYTES`, `ALLOWED_REWORK_REFERENCE_MIME_TYPES` to a new `src/lib/rework-references-config.ts`.
4. Write migration SQL: `supabase/add-deliverable-review-files.sql`.
5. **Apply migration to Supabase** (manual step via Dashboard SQL Editor).
6. No UI changes.

**Risk:** Low. The terminal-state guard fix is tiny. The migration is additive.

### PR 2 — Client upload + submit API routes

**Branch:** `claude/5h4-client-upload-api`

1. `POST /api/client/reviews/[reviewId]/reference-files/upload-url/route.ts`
2. `POST /api/client/reviews/[reviewId]/reference-files/route.ts` (register)
3. Update `src/lib/client-reviews.ts` to expose a helper `getReviewWithOwnership(reviewId, email)` for the new routes.
4. No UI changes yet.

**Test:** API routes with curl / Postman before wiring UI.

### PR 3 — Client UI

**Branch:** `claude/5h4-client-ui`

1. Update `DeliverableReviewActions.tsx` to add file picker + preview + multi-step submit.
2. Add `src/lib/rework-reference-upload.ts` — client-side upload helper (mirrors `AdminDeliverableUpload` pattern).
3. Update `ClientOrderImageCard.tsx` if needed to show file count badge after rework.

### PR 4 — Admin display

**Branch:** `claude/5h4-admin-display`

1. Update admin page server component to fetch `deliverable_review_files` alongside reviews.
2. Add `POST /api/admin/orders/[orderId]/reviews/[reviewId]/reference-files/[fileId]/download-url/route.ts`.
3. Update `AdminOrderImageCard.tsx` to show reference file list inside each review row.

### PR 5 — Polish and edge cases

**Branch:** `claude/5h4-polish`

1. Error states: partial upload failure, network retry.
2. Empty state: no reference files — no UI change (files are optional).
3. Review with files from previous rework cycle — show only files for the current review row.
4. Accessibility: file input labeling, aria-live for upload progress.

---

## 10. Risks and Mitigations

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|---------|-----------|
| Orphaned storage files if client submits review then browser closes before file upload | Medium | Low | Files are supplementary; review is still valid. A background cleanup job can delete orphaned paths under `rework/` older than 24 hours with no matching DB row. |
| Client uploads files to a review that gets resolved while upload is in progress | Low | Low | Upload-url endpoint checks review status; late registrations are rejected with 409. |
| 5-file / 20 MB per-file limit bypassed via direct API call | Low | Medium | Enforced server-side on upload-url and register routes. DB file count check per review_id. |
| Unsupported MIME types previewed incorrectly | Low | Low | `getFilePreviewKind()` in `FilePreviewCard` already handles graceful fallback to download-only. |
| `deliverable_reviews_one_active_rework` unique index causes errors if client submits two reworks quickly | Low | Medium | Already handled — 409 returned with user-friendly message. No change needed. |
| Admin sees reference files from an old (resolved) rework cycle mixed with new rework | Medium | Medium | Files fetched by `review_id` — each review card shows only its own files. Ordering by `created_at DESC` on reviews ensures current cycle is prominent. |
| Large reference files slow down the rework submit UX | Medium | Medium | Enforce 20 MB / 5 file limits. Show per-file upload progress bar. Upload in parallel (Promise.all). |
| `storage_path` accidentally leaked in API response | Low | High | Template for all new routes: never include `storage_path` in any JSON response. Reviewed in PR code review gate. |

---

## 11. Rollback Plan

All changes are additive. Rollback at each PR is independent:

| PR | Rollback |
|----|--------|
| PR 1 (schema) | `DROP TABLE IF EXISTS deliverable_review_files;` in Supabase SQL Editor. Revert `client-reviews.ts` guard fix. No data loss (table is new). |
| PR 2 (API) | Delete new route files. No state change to existing tables. |
| PR 3 (client UI) | Revert `DeliverableReviewActions.tsx` to previous version. Rework still works without files. |
| PR 4 (admin display) | Remove reference file rendering from `AdminOrderImageCard`. Admin still sees rework comment and status. |

The existing `deliverable_reviews` table, `order-files` bucket, and all other tables are **never modified** — only a new table and new API routes are added.

---

## 12. Files Expected to Change

| File | Change type | PR |
|------|------------|-----|
| `src/lib/client-reviews.ts` | Remove terminal-state guard for `rework_requested` | 1 |
| `src/lib/upload-config.ts` | Add `buildReworkReferencePath()` | 1 |
| `src/lib/rework-references-config.ts` | New — shared constants | 1 |
| `supabase/add-deliverable-review-files.sql` | New migration | 1 |
| `src/app/api/client/reviews/[reviewId]/reference-files/upload-url/route.ts` | New | 2 |
| `src/app/api/client/reviews/[reviewId]/reference-files/route.ts` | New | 2 |
| `src/components/dashboard/DeliverableReviewActions.tsx` | Add file picker + multi-step submit | 3 |
| `src/lib/rework-reference-upload.ts` | New — client upload helper | 3 |
| `src/app/(public)/admin/orders/[orderId]/page.tsx` | Add review files query | 4 |
| `src/app/(public)/api/admin/orders/[orderId]/reviews/[reviewId]/reference-files/[fileId]/download-url/route.ts` | New | 4 |
| `src/components/admin/AdminOrderImageCard.tsx` | Show reference files per review | 4 |

---

## 13. Summary of Recommendations

| Dimension | Decision |
|-----------|---------|
| Data model | New table `deliverable_review_files` with FK to `deliverable_reviews` |
| Storage bucket | Reuse `order-files`; new path prefix `rework/<reviewId>/` |
| Upload flow | Submit review first → upload files linked to reviewId |
| Max files | 5 per rework request |
| Max file size | 20 MB per file |
| Allowed types | JPEG, PNG, WebP, GIF, PDF |
| Signed URL TTL | 300 seconds (matches existing pattern) |
| Path exposure | Never — paths built and held server-side only |
| Client auth | `getClientUser()` + ownership JOIN (matches existing pattern) |
| Admin auth | `isAdminAuthenticated()` (matches existing pattern) |
| First action | Fix terminal-state guard in `submitDeliverableReview` before any UI work |
| Implementation | 5 small focused PRs |
