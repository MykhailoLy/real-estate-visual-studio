# Phase 5L.1 Dashboard/Admin Polish Audit

## Executive Summary

The client and admin portals are now functionally strong: clients can review orders per image, download and preview delivered/source files, request rework with reference uploads, and navigate useful read-only Files, Invoices, and Support pages. Admins can view source files, deliverables, rework comments, reference files, upload replacements, update rework states, delete deliverables, and use bulk ZIP downloads.

The main remaining work is polish, consistency, and maintainability rather than missing core workflow. The highest-value improvements are:

1. Centralize repeated labels, status maps, date/byte formatting, and item labels.
2. Improve mobile/tablet usability for dense per-image cards and admin tables.
3. Make status language fully consistent across dashboard, order detail, review actions, rework queue, and admin cards.
4. Improve metadata accuracy and wording for uploaded source/reference files.
5. Add small UX affordances for long filenames, comments, disabled states, and preview/download errors.

No major security regression was found in the inspected surfaces. Private files are generally accessed through signed URL routes, client routes use authenticated ownership checks, admin routes use admin authentication, and raw storage paths are intentionally excluded from rendered client/admin components. The remaining security recommendations are defensive consistency checks, not urgent blockers.

## What Is Working Well

- Client dashboard sections are now coherent: Jobs, order detail, Files, Invoices, Support, and Profile all share the dashboard shell.
- Client order detail has a strong per-image workflow model that connects source, delivered output, request details, and review actions.
- Replacement deliverables use current-deliverable logic, so old replaced files do not become primary again.
- File preview/download UX is consistently built around `FilePreviewCard` and signed URL endpoints.
- Bulk downloads now return ZIP files and keep individual preview/download behavior intact.
- Rework reference uploads are best-effort and preserve text-only rework requests.
- Admin order detail has the right workflow ingredients in one place: source files, deliverables, upload/delete, replacement upload, review comments, rework statuses, and client reference files.
- Files page and Invoices page use cautious wording: "Estimated total" and "official downloadable invoices coming later."
- Support page is link-based/read-only and does not imply a ticketing system exists.
- Auth/security patterns are generally aligned with project rules: client identity comes from `getClientUser()`, admin pages/routes use `isAdminAuthenticated()`, and service role use stays server-side.

## High Priority Issues

### 1. Shared label/status helpers are duplicated across many files

Evidence:
- Service label maps exist in `src/lib/client-orders.ts`, `src/app/(public)/admin/orders/page.tsx`, `src/app/(public)/admin/orders/[orderId]/page.tsx`, and email helpers.
- Status maps exist in `StatusBadge`, `ClientOrderImageCard`, `AdminOrderImageCard`, `AdminOrdersClient`, Invoices, Files, and admin order detail.
- `formatBytes`, `formatDate`, and `itemLabel` appear repeatedly across client/admin pages and components.

Risk:
- Labels can drift, especially around `Pending Rework`, `Rework requested`, `New Version Ready`, `Delivered`, `Completed`, and invoice status language.
- New service slugs may be displayed correctly in one area and poorly in another.

Recommendation:
- Add small shared display helpers:
  - `src/lib/display/service-labels.ts`
  - `src/lib/display/status-labels.ts`
  - `src/lib/display/file-format.ts`
- Keep implementation small: maps and pure functions only.

### 2. Mobile/tablet density in per-image workflow cards needs hands-on QA

Evidence:
- Client and admin image cards use three-column desktop grids that stack on smaller screens.
- `FilePreviewCard` can contain preview, filename, metadata, download, extra actions, and errors.
- Admin card includes source, deliverable list, upload controls, review comments, reference files, and status actions in one card.

Risk:
- On mobile, cards may become long and repetitive.
- Long filenames/comments may truncate too aggressively or make it hard to understand which file/action belongs to which image.
- Admin tablet use may feel cramped when managing many deliverables or rework reference files.

Recommendation:
- Run targeted visual QA at 390px, 768px, 1024px, and desktop widths.
- Consider compact section headers, sticky/clear action grouping, and optional collapsible subsections for admin review/reference areas.

### 3. Status language is functionally correct but inconsistent

Examples:
- Client dashboard uses `Pending Rework`, `Rework in Progress`, `New Version Ready`.
- Client review action badge uses `Rework requested`, `In progress`, `New version ready`.
- Admin image card uses `Pending Rework`, `Rework In Progress`, `New Version Ready`.
- Admin rework queue uses `Rework requested`, `In progress`.

Risk:
- Users may wonder whether "Pending Rework" and "Rework requested" are different states.
- Admin and client may discuss the same status with different wording.

Recommendation:
- Decide on a single user-facing vocabulary:
  - Client: `Pending Rework`, `Rework in Progress`, `New Version Ready`, `Approved`, `Resolved`.
  - Admin: same labels, with action buttons `Mark in progress`, `Mark resolved`.
- Apply through shared status display helpers.

### 4. Uploaded source/reference file dates may be approximate

Evidence:
- Client Files page derives uploaded source file date from order creation when source file metadata does not expose a precise uploaded timestamp.
- Source metadata helpers intentionally avoid exposing raw storage paths, which is correct, but available metadata varies.

Risk:
- The Files page may imply a precise upload date when it is really the order date.

Recommendation:
- Adjust wording to `Order submitted` for source files when no true file timestamp exists.
- Consider a future safe metadata helper that exposes `created_at` from order item rows when appropriate.

### 5. Admin order detail still has split behavior between image-level and order-level files

Evidence:
- Image-level flow uses `AdminOrderImageCard`.
- Order-level files still use `AdminDeliverableUpload` plus a separate order-level review area.

Risk:
- This is reasonable technically, but admin operators may have to learn two UI patterns for uploads/reviews.

Recommendation:
- Keep order-level behavior, but polish copy and layout so it reads as a deliberate secondary section rather than a leftover fragment.

## Medium Priority Polish

- Client Jobs table is responsive via horizontal scroll, but job rows could become card-like on mobile for easier scanning.
- Jobs search placeholder says "title, reference, or service"; current mapped title includes service and order number, so this works, but "order number" may be clearer than "reference."
- Dashboard filter chips show only All/Active/Awaiting/Completed; rework counts are visible in sidebar but not top chips. Consider adding Revisions when count > 0.
- Progress on order detail is still derived from `orders.status`, while status badge can be derived from review states. When a rework is active, progress text and progress bar may feel less aligned with the visible status.
- Invoices page is safe, but "Pending / in progress" and order status labels should use the same status helper as Jobs once centralized.
- Support page includes a hardcoded support email. It is already used in email templates, but future polish should centralize public support contact copy.
- File cards use `View order` consistently, which is good. Consider adding `Image N` to the button `aria-label` or title for context in long lists.
- Admin rework queue's `Upload replacement` link goes to the order with `?reviewId=...`, which is good. It could visually indicate whether reference files were attached.
- Admin delete deliverable uses `window.confirm`; a branded confirm modal would be more polished but is not urgent.
- Preview modal is useful and accessible enough for current phase, but Escape-key close and focus return would improve UX.

## Low Priority / Nice-To-Have

- Add a small "last updated" hint to Jobs and Files pages if server data is dynamic enough to benefit.
- Add copy explaining ZIP size/file limits when a bulk download fails.
- Add counts to admin order detail headers: number of source files, deliverables, active reviews, reference files.
- Use more specific empty states for cancelled orders and delivered orders with no current deliverables.
- Add "Copy order number" buttons on client order detail and support page.
- Add a compact "Need help?" link inside rework/reference upload warnings.
- Consider using a single `SupportCard` component only if support cards are reused elsewhere; current local component is fine.

## Security/Privacy Findings

### Good patterns observed

- Client order data is loaded using `getClientUser()` and email ownership helpers.
- Client deliverable signed URL routes use authenticated session and ownership joins.
- Client source file signed URL route validates synthetic file IDs and verifies order ownership before reading storage path server-side.
- Admin pages and admin file routes are guarded by `isAdminAuthenticated()`.
- Admin rework reference files are fetched with safe metadata only; `storage_path` is excluded from React props.
- Bulk ZIP routes fetch private storage bytes server-side and do not return raw storage paths.
- `FilePreviewCard` receives only signed URL endpoints, filenames, MIME type, file size, and display metadata.

### Follow-up checks recommended

- Audit every route that returns `path`, `storage_path`, or signed upload data and confirm only upload-registration flows receive raw storage paths where currently required.
- Admin deliverable upload-url returns `path` to the admin client for registration. This is existing design and admin-only, but it is still the main place where a raw storage path reaches a browser. Consider replacing with an opaque upload token in a future hardening PR.
- Email helper `send-order-emails` logs signed URL generation failures with path values. That is server-side logging, but log retention and visibility should be reviewed.
- Keep checking that no client UI imports admin endpoints or admin-only helpers.

## Mobile/Responsive Findings

- Dashboard shell and mobile drawer are solid, with clear nav labels and sign-out handling.
- Client Jobs table uses horizontal scroll; acceptable, but not as comfortable as stacked cards for phone users.
- Client order detail cards stack predictably but may become lengthy; action grouping should be QA'd with long filenames, comments, and multiple deliverables.
- Files page `FilePreviewCard` rows should be tested with long filenames and multiple metadata chips.
- Invoices page uses stacked cards and should behave well on mobile.
- Support page uses simple cards and should behave well on mobile.
- Admin orders list is table-based with min width; acceptable for admin desktop/tablet, but cramped on small tablets.
- Admin order detail cards are the most mobile-sensitive area because they combine three panels, upload controls, rework state actions, comments, and reference file previews.
- Preview modal uses large viewport height and should be tested on mobile browsers with browser chrome visible.

## Accessibility/Basic UX Findings

- Most actionable buttons include visible text labels, not icons alone.
- Disabled bulk download buttons use visible text such as `No files`, and invoice download uses `Coming soon`.
- File preview modal has `role="dialog"` and a close button with an accessible label.
- Rework form errors and upload warnings are visible.
- Loading states are visible for uploads, downloads, bulk ZIP preparation, status updates, and reference uploads.

Recommended improvements:
- Add Escape-key support and focus return for preview modal.
- Ensure `window.confirm` delete flow is acceptable for admin; a custom modal would allow clearer warning copy.
- Add more specific labels/titles for repeated `Download` buttons in dense lists.
- Avoid relying on hover-only title text for disabled reasons where a visible explanation is important.
- Consider announcing reference upload progress via `aria-live` in a future small accessibility PR.

## Technical Debt / Cleanup

- Repeated service label maps should be centralized.
- Repeated status label/color maps should be centralized.
- Repeated date and byte formatting should be centralized or moved to existing utilities.
- `itemLabel` appears in multiple modules and should be shared.
- `FilePreviewCard` is doing a lot: preview URL loading, modal, download, error display, and unsupported-file display. It is still manageable, but future changes should be careful.
- `ClientOrderImageCard` and `AdminOrderImageCard` intentionally share concepts but not implementation. This is acceptable for now because admin/client behavior differs, but shared display helpers would still reduce drift.
- Some route groups mix `src/app/api/admin/...` and `src/app/(public)/api/admin/...`. It works, but future route additions should choose one convention deliberately.

## Suggested Next PR Sequence

### 5L.2 Client dashboard polish

Scope:
- Improve client Jobs/Files/Invoices/Support wording consistency.
- Add Revisions chip on Jobs if revision count exists.
- Adjust source file date wording to avoid implying a precise upload timestamp when unavailable.
- Add clearer button labels/titles for dense file cards.

Protected areas:
- No API changes, no schema changes, no payment/pricing/email changes.

### 5L.3 Admin order detail polish

Scope:
- Improve admin per-image card density and order-level file section copy.
- Add clearer counts for source files, deliverables, reviews, and reference files.
- Surface reference-file presence in the admin rework queue.
- Review mobile/tablet wrapping for admin action rows.

Protected areas:
- No upload/delete route behavior changes unless strictly UI-only.

### 5L.4 Status/service label consistency

Scope:
- Add shared pure display helpers for service labels, status labels/colors, item labels, date/byte formatting.
- Replace duplicated local maps conservatively.
- Keep behavior identical.

Protected areas:
- No database mutations, no status logic changes, no order status schema changes.

### 5L.5 Mobile/accessibility polish

Scope:
- Add focused mobile improvements for Jobs table, FilePreviewCard modal, long filenames, and action wrapping.
- Add Escape-key close/focus return for preview modal.
- Add `aria-live` for upload/progress warnings where helpful.

Protected areas:
- No backend/API/storage changes.

## Recommended Next PR

Start with **5L.4 status/service label consistency** if the team wants to reduce future drift before more UI work. It is low-risk, mechanical, and will make later polish PRs cleaner.

If the priority is user-visible improvement first, start with **5L.2 client dashboard polish**, especially Jobs/Files wording and mobile/card readability.
