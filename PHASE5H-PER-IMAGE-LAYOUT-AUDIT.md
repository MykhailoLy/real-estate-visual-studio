# Phase 5H Audit: Per-Image Order Detail Layout

## Goal

Redesign the client and admin order detail pages so each ordered image becomes the primary workflow unit. The target layout should let users see the source upload, request details, delivered result, review state, and available actions for "Image 1", "Image 2", etc. in one card instead of jumping between separate sections.

This audit is planning-only. No implementation is included.

## Current State

The existing order detail pages work technically, but the data is fragmented:

- Client order detail renders order items first, then a separate "Delivered files" list.
- Admin order detail renders order summary, a separate "Client uploaded files" list, a separate deliverable upload/list component, and a separate review status list.
- The common link between order items, source files, deliverables, and reviews is `item_index`.
- Order-level deliverables use `item_index: null`, so the redesign must keep an order-level bucket outside the per-image cards or in a dedicated "Order-level files" card.

## Files Inspected

- `src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx`
- `src/app/(public)/admin/orders/[orderId]/page.tsx`
- `src/components/admin/AdminDeliverableUpload.tsx`
- `src/components/FilePreviewCard.tsx`
- `src/components/BulkDownloadButton.tsx`
- `src/components/dashboard/DeliverableReviewActions.tsx`
- `src/lib/client-orders.ts`
- `src/lib/client-deliverables.ts`
- `src/lib/client-reviews.ts`
- `src/lib/client-deliverable-display.ts`
- `src/lib/admin-source-files.ts`
- `src/app/(public)/api/admin/orders/[orderId]/source-files/[fileId]/download-url/route.ts`
- `src/app/(public)/api/admin/orders/[orderId]/deliverables/[deliverableId]/download-url/route.ts`
- `src/app/api/client/deliverables/[deliverableId]/download-url/route.ts`
- Bulk download routes for admin source files, admin deliverables, and client deliverables.
- `supabase/schema.sql`
- `src/app/(public)/api/order/route.ts`
- `src/lib/upload-config.ts`
- `src/lib/file-preview.ts`

## Data Already Available Per Order Item

The `order_items` table has the right anchor for per-image grouping:

- `id`
- `order_id`
- `item_index`
- `original_photo_path`
- `reference_image_path`
- `subtotal_cents`
- `details`
- `created_at`

The order submission route persists source file metadata inside `order_items.details.uploaded_files`:

- `original.original_filename`
- `original.size_bytes`
- `original.mime_type`
- optional `reference.original_filename`
- optional `reference.size_bytes`
- optional `reference.mime_type`

Admin already uses this through `src/lib/admin-source-files.ts`, which builds safe source file display rows without exposing raw storage paths.

Client currently receives only a sanitized item shape from `getOrderByIdForClient()`:

- `id`
- `item_index`
- `subtotal_cents`
- sanitized `details`

The client helper intentionally does not select or return `original_photo_path`, `reference_image_path`, or `details.uploaded_files`.

## Source File Data For Client Page

Client source preview/download is not available today. The data exists server-side, but the client page strips it by design. That is the correct default because raw storage paths and upload metadata should not leak into the browser.

If client source preview is included in Phase 5H, add a new server-only helper plus a signed URL route instead of expanding the existing client order detail payload with paths.

Recommended route:

`POST /api/client/orders/[orderId]/source-files/[fileId]/download-url`

Recommended behavior:

- Require `getClientUser()`.
- Validate `orderId` and parse `fileId` with the same stable ID pattern used by admin source files: `{orderItemId}-original` or `{orderItemId}-reference`.
- Verify the order belongs to `user.email`.
- Verify the requested `order_items.id` belongs to that order.
- Select `original_photo_path`, `reference_image_path`, and `details` server-side only.
- Generate a short signed URL from the private `order-files` bucket.
- Return only `{ ok: true, signedUrl, filename }`.
- Support the existing `intent: "preview" | "download"` convention used by `FilePreviewCard`.
- Never return raw storage paths.

This mirrors the existing admin source file signed URL route while adding client ownership checks.

## How To Group By Item Index

Use `order.items` as the source of truth for image cards. For each item:

- `item.item_index` defines the card position and title, for example `Image 1 of N`.
- Source files group by `AdminSourceFile.itemIndex` or a client equivalent.
- Deliverables group by `ClientDeliverable.item_index` / `DeliverableRow.item_index`.
- Reviews group by `DeliverableReview.item_index`, with `deliverable_id` as the exact action target.
- Current client-visible deliverables should continue to come from `getCurrentDeliverableRows()` so replacement behavior stays intact.

Recommended grouping shape:

```ts
type OrderImageWorkflow = {
  item: SafeOrderItem | AdminOrderItem;
  itemIndex: number;
  sourceFiles: {
    original?: SourceFileDisplay;
    reference?: SourceFileDisplay;
  };
  deliverables: CurrentDeliverableDisplay[];
  latestReview: DeliverableReview | null;
  latestClientComment: string | null;
  displayReviewState:
    | "awaiting_delivery"
    | "pending_review"
    | "pending_rework"
    | "rework_in_progress"
    | "new_version_ready"
    | "approved"
    | "resolved";
};
```

Keep order-level deliverables in a separate section because they do not map to one image.

## Component Recommendations

Prefer separate client/admin card components because their actions differ:

- `src/components/dashboard/ClientOrderImageCard.tsx`
- `src/components/admin/AdminOrderImageCard.tsx`

Shared low-level pieces can still be reused:

- `FilePreviewCard` for preview/download.
- `BulkDownloadButton` for the existing bulk action.
- `DeliverableReviewActions` for client approve/rework.

Recommended extraction:

- Move the item details renderer from the client page into a shared display component, for example `src/components/order/OrderItemDetails.tsx`.
- Add a small shared grouping helper, for example `src/lib/order-image-workflow.ts`, if both pages can use the same pure grouping rules.
- Avoid putting admin upload, delete, and review mutation logic into a shared component with client UI; keep those capabilities admin-only.

## Files To Change In The Implementation PR

Likely client changes:

- `src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx`
- `src/components/dashboard/ClientOrderImageCard.tsx` new
- `src/components/order/OrderItemDetails.tsx` new
- `src/lib/client-source-files.ts` new, if client source preview/download is included
- `src/app/api/client/orders/[orderId]/source-files/[fileId]/download-url/route.ts` new, if client source preview/download is included

Likely admin changes:

- `src/app/(public)/admin/orders/[orderId]/page.tsx`
- `src/components/admin/AdminOrderImageCard.tsx` new
- `src/components/admin/AdminDeliverableUpload.tsx`
- possibly split `AdminDeliverableUpload` into smaller components so per-image upload/delete does not duplicate logic

Likely shared changes:

- `src/components/FilePreviewCard.tsx` only if the card needs more compact layout variants.
- `src/components/BulkDownloadButton.tsx` should stay in page/card headers and should not need logic changes.
- `src/lib/admin-source-files.ts` can be reused as-is for admin. It may be worth adding a client-safe sibling instead of weakening this helper.
- `src/lib/client-deliverable-display.ts` should be reused, not rewritten.

## Recommended Implementation Sequence

1. Add a pure grouping layer.
   - Build image workflow data from existing order items, source file rows, deliverables, and reviews.
   - Unit-test or manually verify grouping for no deliverables, multiple deliverables, replacement delivered, approved, and order-level files.

2. Extract request details rendering.
   - Move the existing `ItemDetails` display into a shared component.
   - Use it on both client and admin cards.

3. Implement client cards with delivered files first.
   - Group `getCurrentDeliverableRows()` by `item_index`.
   - Keep `DeliverableReviewActions` exactly deliverable-scoped.
   - Keep the delivered files ZIP button at the page or section level.
   - Show pending placeholder when no current deliverable exists for an image.

4. Add client source preview/download only behind a new signed URL route.
   - Do not add raw paths to `getOrderByIdForClient()`.
   - Add client-safe source file metadata rows with stable IDs and filenames.
   - Use `FilePreviewCard` with the new route.

5. Implement admin cards.
   - Fetch order item `subtotal_cents` and details in admin order detail.
   - Group admin source files from `buildAdminSourceFiles()`.
   - Group deliverables and reviews by `item_index`.
   - Preserve source file download, deliverable preview/download/delete, and ZIP bulk downloads.

6. Refactor admin upload carefully.
   - Safest path is to add an optional fixed target mode to `AdminDeliverableUpload` or split it into upload and deliverable-list subcomponents.
   - Per-image cards should pass a fixed `item_index` for upload.
   - Keep the existing replacement upload flow driven by `reviewId` and `replacementReview`.

7. Add order-level files section.
   - Any deliverable with `item_index: null` should remain visible.
   - The section can use `FilePreviewCard` and existing download/delete actions.

8. Verify responsive layout.
   - Cards should stack source/after previews on mobile.
   - Avoid nested card-heavy UI inside existing page cards.
   - Keep button rows compact and non-overlapping.

## Rework State Rules For Cards

Use the latest relevant review state for the card display, but keep action decisions attached to the current deliverable row.

Suggested card labels:

- No deliverable: `Awaiting delivery`
- Current deliverable, no review: `Ready for review`
- `rework_requested`: `Pending Rework`
- `rework_in_progress`: `Rework In Progress`
- `rework_delivered`: `New Version Ready`
- `approved`: `Approved`
- `resolved`: `Resolved`

Show the latest client comment for `rework_requested`, `rework_in_progress`, and `rework_delivered` where available.

## Security Notes

- Do not expose `order_items.original_photo_path`, `order_items.reference_image_path`, or `order_deliverables.storage_path` to client components.
- Continue using server-side signed URL routes for previews/downloads.
- Client identity must come from `getClientUser()`, not from request bodies.
- Admin pages/routes must keep `isAdminAuthenticated()`.
- Do not change bucket settings or make `order-files` / `deliverables` public.
- Do not weaken the sanitizer in `client-orders.ts`; add a separate safe source-file helper instead.

## Risks

- Admin upload/delete state currently lives inside `AdminDeliverableUpload`; moving deliverables into per-image cards can create stale local state if the component is split hastily.
- Replacement deliverables are shown through review state plus `replacement_deliverable_id`; grouping must not accidentally show stale originals as the primary client download.
- `item_index: null` deliverables do not belong to one image and need a separate layout path.
- Client source preview is safe only if implemented through a new ownership-checked signed URL route.
- PDF previews can be browser-dependent; keep download fallback visible.
- Large orders may produce long pages; keep summary and bulk download controls easy to find.

## Rollback Plan

Keep Phase 5H as a layout-only PR:

- No schema changes.
- No bucket policy changes.
- No upload flow changes.
- No payment, pricing, email, or auth internals changes.

If issues appear after release, rollback the layout PR to return to the existing separate sections. Existing signed URL routes, review APIs, deliverable upload/delete routes, and bulk download routes should remain compatible because the redesign should only change how existing data is grouped and rendered.

## Recommended Plan

Implement Phase 5H in two small PRs:

1. Client per-image cards.
   - Add grouping helper and shared details component.
   - Render delivered/current deliverables inside image cards.
   - Preserve approve/request rework and bulk ZIP download.
   - Add client source preview route only if included in this PR; otherwise show source preview as "not available yet" and plan it separately.

2. Admin per-image cards.
   - Reuse the grouping approach.
   - Add source preview/download, request details, deliverable preview/download/delete, review state, and fixed-image upload controls.
   - Preserve replacement upload via `reviewId`.

This keeps the riskiest part, admin upload/delete state refactoring, isolated from the client layout work.
