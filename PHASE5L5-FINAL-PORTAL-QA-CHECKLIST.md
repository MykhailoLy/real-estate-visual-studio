# Phase 5L.5 Final Portal QA Checklist

## 1. Executive summary

### What is now ready

The PicchuSpot client/admin portal is ready for a full QA pass across the Phase 5 portal workflow:

- Client Jobs page and order detail workflow
- Per-image client and admin workflow cards
- Source/original file preview and download
- Delivered file preview and download
- Bulk ZIP downloads
- Client rework requests with optional reference uploads
- Admin rework queue, replacement uploads, and rework reference display
- Client Files hub, Invoices summary page, and Support center
- Shared display helpers and final client/admin UI polish

### What this checklist is for

Use this checklist before considering Phase 5 portal work stable. It is intended to catch data ownership issues, broken links, confusing copy, mobile layout problems, upload/download regressions, and rework workflow gaps.

### What is intentionally not included yet

This checklist does not validate future features that are intentionally deferred, including real Stripe payments, legal downloadable invoices, support tickets, advanced admin filtering, or deeper auth/RLS migrations.

## 2. Client portal pages to test

### /dashboard/jobs

- [ ] Page loads for a signed-in client.
- [ ] Jobs list shows only orders for the authenticated client.
- [ ] Search works by title, order number, and service.
- [ ] Status filters update results without losing page state unexpectedly.
- [ ] Empty state appears when the client has no orders.
- [ ] Empty filtered state appears when search/filter results are empty.
- [ ] Job rows link to the correct order detail page.
- [ ] Mobile/tablet layout remains readable, including horizontal table behavior.
- [ ] No admin-only data appears.

### /dashboard/jobs/[orderId]

- [ ] Order detail opens for an order owned by the signed-in client.
- [ ] Unknown or unauthorized order IDs do not expose data.
- [ ] Header shows service label, order number, status badge, and copy order number action.
- [ ] Copy order number button works where clipboard permissions allow.
- [ ] Summary and progress sections match the order state.
- [ ] Per-image workflow cards render for each order item.
- [ ] Original/source area does not expose raw storage paths.
- [ ] Delivered files preview/download correctly.
- [ ] Approve and Request rework actions remain available in expected states.
- [ ] Order-level files render separately when present.
- [ ] Download all ZIP button works when delivered files exist.
- [ ] Empty/pending states are clear when no deliverable exists.
- [ ] Mobile cards stack cleanly and actions wrap.

### /dashboard/files

- [ ] Page loads for a signed-in client.
- [ ] Delivered files list contains only files from the authenticated client's orders.
- [ ] Uploaded/source files list contains only files from the authenticated client's orders.
- [ ] Delivered file preview/download uses the existing client signed URL route.
- [ ] Source/original file preview/download uses the existing client signed URL route.
- [ ] Uploaded/source file date wording does not imply exact upload timestamp when the value is order-created date.
- [ ] Empty state appears when there are no files.
- [ ] Delivered empty state appears when only uploaded files exist.
- [ ] Uploaded empty state appears when only delivered files exist.
- [ ] Long filenames and service labels truncate without breaking layout.
- [ ] View order links navigate to the correct order.

### /dashboard/invoices

- [ ] Page loads for a signed-in client.
- [ ] Billing summaries show only the authenticated client's orders.
- [ ] Amounts are labeled "Estimated total".
- [ ] Page does not imply payment was completed.
- [ ] Page does not describe summaries as legal tax invoices.
- [ ] Invoice download button is disabled or clearly "Coming soon".
- [ ] Empty state appears when no orders exist.
- [ ] View order links navigate correctly.
- [ ] Mobile cards stack without cramped table behavior.

### /dashboard/support

- [ ] Support page loads inside the client dashboard layout.
- [ ] Order, file, billing, and general support sections are clear.
- [ ] Links to Jobs, Files, Invoices, and Contact work.
- [ ] FAQ answers match current portal behavior.
- [ ] Signed-in client email appears only if intended.
- [ ] Mobile layout is readable.

### /dashboard/profile

- [ ] Profile page loads if included in the dashboard navigation.
- [ ] Current client identity is shown safely.
- [ ] No admin-only fields or service role data appears.
- [ ] Navigation back to other dashboard pages works.

## 3. Client order workflow QA

- [ ] New or existing order appears in Jobs for the correct client.
- [ ] Order detail opens from Jobs.
- [ ] Source/original files preview correctly when previewable.
- [ ] Source/original files download correctly.
- [ ] Delivered image files preview correctly.
- [ ] Delivered PDFs preview or fall back correctly.
- [ ] Unsupported delivered files show a clear preview fallback and remain downloadable.
- [ ] Single delivered file download works.
- [ ] Bulk delivered ZIP download works.
- [ ] Request rework works without reference files.
- [ ] Request rework works with one reference file.
- [ ] Request rework works with multiple reference files up to the configured limit.
- [ ] Selected reference file can be removed before submit.
- [ ] Invalid reference file type is rejected client-side.
- [ ] Oversized reference file is rejected client-side.
- [ ] Text-only rework request still submits successfully.
- [ ] If reference upload fails after rework submission, the rework request remains submitted and a warning is shown.
- [ ] After submit, status updates to Pending Rework.
- [ ] Admin replacement upload causes client to see New Version Ready.
- [ ] Replacement deliverable is the current visible file.
- [ ] Old replaced file does not become primary again.
- [ ] Client can approve a delivered file or replacement.
- [ ] Client can request rework again after approved/resolved/rework_delivered when expected.

## 4. Admin portal pages to test

### /admin/orders

- [ ] Page requires admin authentication.
- [ ] Orders list loads newest orders first.
- [ ] Status labels are readable.
- [ ] Service labels are readable.
- [ ] Inline status control still works.
- [ ] Links open correct order detail pages.
- [ ] Mobile/tablet layout remains usable.
- [ ] Non-admin users cannot access the page.

### /admin/orders/[orderId]

- [ ] Page requires admin authentication.
- [ ] Order summary shows correct order/client details.
- [ ] Summary counters match visible source files, deliverables, active reviews, and reference files.
- [ ] Bulk source ZIP download works.
- [ ] Bulk deliverables ZIP download works.
- [ ] Per-image workflow cards render source, deliverable, request details, and actions.
- [ ] Order-level files section is clear and actions still work.
- [ ] Reference files appear under the correct review/image card.
- [ ] Raw storage paths are not rendered.
- [ ] Mobile/tablet layout stacks without breaking actions.

### /admin/rework

- [ ] Page requires admin authentication.
- [ ] Active rework requests are listed.
- [ ] Rows show order number, image/order-level label, filename, status, comment, client email, and date.
- [ ] Reference file count appears when reference files are attached.
- [ ] Upload replacement link opens the correct admin order detail target.
- [ ] Mark in progress works.
- [ ] Mark resolved works and removes the row from active queue.
- [ ] Long filenames/emails wrap or truncate cleanly.

### /admin/media

- [ ] Page requires admin authentication.
- [ ] Existing media management behavior still works if relevant.
- [ ] Navigation back to admin pages works.
- [ ] No portal file-storage behavior regressed.

### /admin/portfolio

- [ ] Page requires admin authentication.
- [ ] Existing portfolio management behavior still works if relevant.
- [ ] Navigation back to admin pages works.
- [ ] No portal file-storage behavior regressed.

## 5. Admin order workflow QA

- [ ] Admin can preview client source files.
- [ ] Admin can download client source files.
- [ ] Admin can upload a deliverable assigned to an image.
- [ ] Admin can preview uploaded deliverables.
- [ ] Admin can download uploaded deliverables.
- [ ] Admin can delete a deliverable.
- [ ] Admin can upload an order-level deliverable.
- [ ] Order-level deliverable preview/download/delete still works.
- [ ] Order-level bulk ZIP download works.
- [ ] Source files bulk ZIP download works.
- [ ] Deliverables bulk ZIP download works.
- [ ] Per-image individual download behavior remains unchanged.
- [ ] Replacement upload from the rework queue links to the correct review.
- [ ] Replacement upload changes the client-visible current file.
- [ ] Mark in progress works from the order detail card.
- [ ] Mark resolved works from the order detail card.
- [ ] Client reference files are visible inside the correct review/image card.
- [ ] Reference file previews/downloads use signed URL routes.
- [ ] Rework queue reference file count appears when references exist.
- [ ] Admin order detail counters look correct after upload/delete/rework actions.

## 6. Security and privacy checklist

- [ ] Client sees only their own orders.
- [ ] Client sees only their own delivered files.
- [ ] Client sees only their own source/original files.
- [ ] Client signed URL routes enforce ownership.
- [ ] Client identity comes from authenticated session, not request body.
- [ ] Admin routes require admin authentication.
- [ ] Private storage buckets remain private.
- [ ] Raw `storage_path` is not rendered in client UI.
- [ ] Raw `storage_path` is not rendered in admin UI.
- [ ] Raw `storage_path` is not returned by reference file routes.
- [ ] No public bucket assumptions are introduced.
- [ ] No service role data is exposed to client components.
- [ ] No admin routes are used in client UI.
- [ ] No env vars or secrets are exposed.
- [ ] Signed URLs remain short-lived.
- [ ] Failed or unauthorized file requests return safe errors.

## 7. Payments/invoices safety checklist

- [ ] Invoices page uses "Estimated total" wording.
- [ ] Invoices page uses "Billing summary" or equivalent safe language.
- [ ] Page does not claim payment was completed.
- [ ] Page does not describe summaries as legal invoices or tax invoices.
- [ ] Invoice download is "Coming soon" and disabled.
- [ ] No Stripe/payment implementation exists in Phase 5L.
- [ ] Pricing calculations were not changed.
- [ ] Order totals shown match existing stored order totals.

## 8. Email/rework notification checklist

- [ ] Existing email notification behavior is smoke-tested if already implemented.
- [ ] Client rework request still triggers existing admin/internal notification if previously implemented.
- [ ] Admin replacement ready still triggers existing client notification if previously implemented.
- [ ] Client approval still triggers existing admin/internal notification if previously implemented.
- [ ] No new Resend/email changes were introduced in Phase 5L.
- [ ] Rework workflow still triggers existing notifications after UI polish.
- [ ] Do not add email changes without a separate audit/PR.

## 9. Mobile/responsive QA checklist

- [ ] Client jobs table horizontal behavior is usable on small screens.
- [ ] Client order detail cards stack cleanly.
- [ ] Client image workflow cards do not feel cramped.
- [ ] Client preview cards are usable on mobile.
- [ ] Long filenames truncate instead of breaking layout.
- [ ] Long order numbers and service labels do not overflow.
- [ ] Action buttons wrap cleanly.
- [ ] File preview modal can be closed on mobile.
- [ ] Admin image cards stack cleanly.
- [ ] Admin action rows wrap on tablet/mobile.
- [ ] Admin rework queue rows wrap long filenames/emails.
- [ ] Bulk download buttons remain reachable on mobile.

## 10. Browser QA

- [ ] Chrome desktop.
- [ ] Chrome responsive dev tools/mobile viewport.
- [ ] Safari desktop if available.
- [ ] Safari/iPhone if possible.
- [ ] Edge optional.
- [ ] Clipboard copy button works in supported browsers.
- [ ] Clipboard copy button fails gracefully if browser permissions block it.
- [ ] File preview modal behaves consistently across browsers.
- [ ] ZIP downloads trigger a single file download across browsers.

## 11. Known limitations / intentionally deferred

- Real payment/Stripe implementation.
- Legal downloadable invoices.
- Support ticket system.
- Client file delete/rename.
- Advanced admin filtering/search if not already implemented.
- User ID/RLS migration for orders if orders are still primarily email-based.
- Further hardening of admin deliverable upload path/token if still using existing behavior.
- Exact source file `uploaded_at` if currently represented by `order.created_at`.
- Automated cross-browser test coverage.
- Database outbox/retry queue for email notifications.

## 12. Recommended next phases

- Phase 5M: Launch readiness audit.
- Phase 5N: SEO/content polish.
- Phase 5O: Real invoices/payment audit only.
- Phase 5P: Support tickets audit only.
- Phase 5Q: Analytics/conversion tracking audit.
