# Phase 5E Email Notification Audit

## Scope

This audit covers the safest way to add email notifications for the deliverable review and rework workflow. It is report-only: no email notification implementation, schema change, storage change, auth change, or env var change is included.

Current workflow reviewed:

- Client can approve a deliverable or request rework.
- Admin can see active rework requests.
- Admin can mark rework as in progress or resolved.
- Admin can upload and link replacement deliverables.
- Client sees replacement files as the current download and can approve or request rework again.

## Existing Email Infrastructure

The project already has a usable Resend foundation:

- `src/lib/email/resend-client.ts`
  - Lazily creates the Resend client.
  - Returns `{ ok: false }` instead of throwing when `RESEND_API_KEY` is absent.
  - Provides `getFromAddress()` and `getAdminAddress()`.
- `src/lib/email/send-order-emails.ts`
  - Sends order confirmation and admin notification after order persistence.
  - Uses best-effort behavior: logs failures, does not break successful order submission.
  - Sends client/admin emails in parallel with `Promise.allSettled`.
- `src/lib/email/order-client-confirmation.ts`
- `src/lib/email/order-admin-notification.ts`
- `src/lib/email/format.ts`
  - Shared formatting and HTML escaping helpers.

Relevant env vars already exist:

- `RESEND_API_KEY` in `.env.example`.
- `ADMIN_EMAIL` in `.env.example` and `README.md`.
- `FROM_EMAIL` is supported by `getFromAddress()` but is not listed in `.env.example`.

`ADMIN_EMAIL` already exists and is the correct recipient source for internal/admin review workflow notifications.

## Recommended Files To Change

Add one workflow-specific email helper:

- `src/lib/email/review-workflow-notifications.ts`

Recommended responsibilities:

- Export one function such as `sendReviewWorkflowEmail(event, payload)`.
- Use `getResendClient()`, `getFromAddress()`, and `getAdminAddress()`.
- Never throw.
- Return `{ sent: boolean; error?: string }`.
- Fetch or receive only the minimum needed safe fields: order number, item index, filename, client email, review comment, and dashboard/admin URLs.
- Escape user-provided values with `escapeHtml()`.

Modify these event routes after successful DB writes:

- `src/app/api/client/deliverables/[deliverableId]/review/route.ts`
  - Trigger admin email when client requests rework.
  - Trigger admin email when client approves a deliverable or replacement.
- `src/app/(public)/api/admin/reviews/[reviewId]/status/route.ts`
  - Optionally trigger client email when admin marks `rework_requested -> rework_in_progress`.
- `src/app/(public)/api/admin/reviews/[reviewId]/replacement/route.ts`
  - Trigger client email when replacement is linked and status becomes `rework_delivered`.

No changes should be needed in:

- Deliverable upload URL route.
- Deliverable registration route.
- Dashboard UI.
- Database schema for the first implementation.

## Recommended Notification Events

### 1. Client Requests Rework

Trigger:

- After `submitDeliverableReview()` successfully inserts a review with `status = rework_requested`.

Recipient:

- `getAdminAddress()` / `ADMIN_EMAIL`.

Subject:

- `Rework requested: {orderNumber} - Image {n}`

Body should include:

- Order number.
- Image label, or order-level label.
- Original deliverable filename.
- Client email.
- Client comment.
- Link to `/admin/rework`.
- Link to `/admin/orders/{orderId}?reviewId={reviewId}`.

Safe data source:

- `client_email` is safe because `submitDeliverableReview()` sets it from the authenticated session, not request body.
- Deliverable ownership is already checked through the `order_deliverables -> orders` join.

### 2. Admin Marks Rework In Progress

Trigger:

- After `/api/admin/reviews/[reviewId]/status` successfully updates `status = rework_in_progress`.

Recipient:

- `deliverable_reviews.client_email`, ideally verified by loading the review from DB.

Subject:

- `Your revision is in progress: {orderNumber}`

Body should include:

- Order number.
- Image label.
- Short note that the team has started the revision.
- Link to `/dashboard/jobs/{orderId}`.

Recommendation:

- Make this optional for Phase 5E. It is useful, but lower value than request/replacement/approval notifications and can add noise if admins toggle status quickly.

### 3. Admin Uploads Replacement

Trigger:

- After `/api/admin/reviews/[reviewId]/replacement` successfully updates:
  - `replacement_deliverable_id = newDeliverableId`
  - `status = rework_delivered`

Recipient:

- `deliverable_reviews.client_email`.

Subject:

- `New version ready: {orderNumber} - Image {n}`

Body should include:

- Order number.
- Image label.
- Replacement filename.
- Original filename if available.
- Link to `/dashboard/jobs/{orderId}`.
- Clear instruction: review the new version, then approve or request another rework if needed.

Safe data source:

- The replacement route already validates that the replacement deliverable belongs to the same order and same item index as the review.
- Do not include raw storage paths. Use dashboard links only.

### 4. Client Approves Deliverable Or Replacement

Trigger:

- After `submitDeliverableReview()` successfully inserts a review with `status = approved`.

Recipient:

- `getAdminAddress()` / `ADMIN_EMAIL`.

Subject:

- `Deliverable approved: {orderNumber} - Image {n}`

Body should include:

- Order number.
- Image label.
- Deliverable filename.
- Client email.
- Whether this looks like a replacement approval, if knowable from current review context.
- Link to `/admin/orders/{orderId}`.

Safe data source:

- Client email comes from authenticated session.
- Deliverable ownership is checked before review insertion.

### 5. Client Requests Rework On Replacement

Trigger:

- Same as Event 1. If the reviewed deliverable is itself a replacement, the admin email can say `Additional rework requested`.

Recipient:

- `getAdminAddress()` / `ADMIN_EMAIL`.

Subject:

- `Additional rework requested: {orderNumber} - Image {n}`

Recommendation:

- Implement as the same code path as normal rework. Detect replacement context only for nicer wording. Do not build separate state machinery.

## Avoiding Duplicate Emails

Use existing state transitions as the first line of defense:

- Client review route only sends after a successful insert.
- Duplicate approvals/rework requests on the same current deliverable are already blocked by terminal/active review guards.
- Admin status route only sends after a valid transition. Repeating the same transition returns conflict.
- Replacement route only sends after a valid link. Repeating the link returns conflict because the review is no longer linkable or already has a replacement.

Recommended implementation pattern:

1. Perform validation and DB write.
2. If DB write succeeds, call email helper.
3. Email helper logs failure and returns; route response remains successful.

Do not send before the DB write.

Do not retry inside the request handler beyond the single Resend call. Without an outbox table, automatic retries can create duplicates.

If stronger exactly-once delivery is later required, add a dedicated audit/outbox table in a separate PR. That is not necessary for the first Phase 5E implementation.

## Synchronous vs Fire-And-Forget

Recommended for Phase 5E:

- Await the best-effort email helper, like existing `sendOrderEmails()`.
- Keep the helper non-throwing.
- Keep route success independent from email success.

Why:

- Serverless fire-and-forget work can be cut short when the response returns.
- Awaiting the helper gives reliable execution and logging.
- These emails are low-volume workflow notifications; the added latency should be acceptable.

If latency becomes noticeable, consider a durable queue/outbox later rather than untracked fire-and-forget.

## Recipient Safety

Admin/internal notifications:

- Use `getAdminAddress()`.
- `ADMIN_EMAIL` already exists in `.env.example` and README.

Client notifications:

- Use `deliverable_reviews.client_email` or order `client_email` loaded server-side from DB.
- For client-triggered events, the source email is safe because it comes from `getClientUser()` and is written by server code.
- Never accept client email from request body.

Reply-To:

- Admin notifications can use client email as `replyTo` where helpful.
- Client notifications should use `getAdminAddress()` or support address as `replyTo`.

## Suggested Email Helper Shape

Recommended helper file:

`src/lib/email/review-workflow-notifications.ts`

Suggested API:

```ts
export type ReviewWorkflowEvent =
  | "client_rework_requested"
  | "client_approved"
  | "admin_rework_in_progress"
  | "admin_replacement_ready";

export async function sendReviewWorkflowEmail(args: {
  event: ReviewWorkflowEvent;
  reviewId: string;
  replacementDeliverableId?: string;
}): Promise<{ sent: boolean; error?: string }>;
```

The helper can load the review, order, original deliverable, and replacement deliverable by `reviewId` using the service role client. Keep all storage paths out of templates.

## Risks

- Email failures: Resend may be unconfigured or temporarily fail. Mitigation: non-throwing helper, server logs, route remains successful.
- Duplicate sends on client retries: current DB guards reduce this because only successful new inserts/transitions should send. Avoid manual retries in the helper.
- Wrong recipient: client notifications must use DB/session-derived email only. Never trust request body.
- Leaking storage paths: templates must include filenames and dashboard/admin links only.
- Notification noise: `rework_in_progress` client email is optional and may be skipped initially.
- Approval ambiguity: approving a replacement is represented as a review on the replacement deliverable. The helper should load context if it wants replacement-specific wording.

## Rollback Plan

Keep Phase 5E in a small PR with email changes isolated to:

- One `src/lib/email/*` helper/template file.
- Three route integration points.

Rollback options:

1. Remove the route-level helper calls; workflow remains functional.
2. Disable sends operationally by removing `RESEND_API_KEY`.
3. If one event is noisy, remove only that event call.

Because no schema or storage changes are recommended for the first implementation, rollback is low risk.

## Recommended Implementation Plan

1. Add `src/lib/email/review-workflow-notifications.ts`.
2. Implement plain text and compact HTML templates for the four core events.
3. Reuse `getResendClient()`, `getFromAddress()`, `getAdminAddress()`, and `escapeHtml()`.
4. Integrate after successful DB writes in:
   - client review route/helper for rework requested and approved;
   - admin status route for optional in-progress notification;
   - admin replacement route for new version ready notification.
5. Log but swallow email errors.
6. Run `npm run lint` and `npm run build`.

Recommended initial event set:

- Must ship: client rework requested -> admin.
- Must ship: admin replacement ready -> client.
- Must ship: client approved -> admin.
- Optional: admin rework in progress -> client.

