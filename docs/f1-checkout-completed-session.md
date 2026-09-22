# F1: completed Checkout Session replacement

Verified locally on 2026-09-22, Node 24.18.0 / Next.js 16.3.4.
Branch: `codex/fix-checkout-completed-session`.
Baseline and unchanged Git HEAD: `3267b7254fa90292be087d0990e6bdea16b681b0`.
Fetched `origin/main` still matches HEAD (0 commits behind).
GitHub's latest Production deployment record, ID `6557076064`, points to this
revision. This establishes source compatibility, not the current live database state.

## Defect and minimal change

`reuseOrExpireOpenCheckout()` previously treated a past `expires_at` as permission
to expire a saved attempt, regardless of Stripe Session status. It now permits
that transition only for an explicit `status="expired"`.

Completed Sessions, unusable open Sessions and unknown statuses preserve the
original attempt and return the existing `checkout-processing` / HTTP 409 response.
Retrieval errors retain their existing controlled 502 response. Normal open
Sessions are reused; confirmed expired Sessions still use conditional writes and
the existing next-attempt idempotency key. No payment is inferred from a redirect
or from `complete` alone. Stripe documents that processing may still be in progress
for a [complete Session](https://docs.stripe.com/api/checkout/sessions/object#checkout_session_object-status).

Production changes are confined to `src/lib/payments/checkout-service.ts`.
Existing checkout and webhook test files provide the regression coverage;
production webhook/repository code, payment validation, pricing and schema are unchanged.

## Red / green evidence

Tests were added before changing production code and invoke the production
Checkout request/service and webhook service with in-memory repositories and Stripe fixtures.

- Baseline: both `complete Session with past expiry ... preserves the original attempt`
  cases (paid/unpaid provider status) failed: Stripe create count was 1 instead of 0.
- Baseline connected test, `late original webhook pays the same payment after completed
  Checkout is blocked, and replay is idempotent`, reproduced HTTP 200 with a replacement
  URL, attempt 2, one expiry write, saved ID `cs_test_replacement`, then a terminal
  webhook failure: `Payment does not match its Checkout Session.`
- After the fix: the connected test returns HTTP 409, with zero Checkout mutations,
  unchanged original Session ID/attempt/payment; the late original event then makes
  that same payment paid. Repeating the event leaves the payment unchanged and the
  financial update count at exactly 1.
- Coverage also includes complete with future/null expiry, unpaid complete,
  open past expiry, missing URL/status, unknown status, retrieval failure, normal
  reuse, confirmed expiry replacement and the existing concurrent-paid protections.
  Assertions inspect Stripe/repository calls and persisted state, not source regexes.

| Local validation | Result |
| --- | --- |
| Checkout + webhook service tests | 59 passed |
| `node --experimental-strip-types --test src/lib/payments/*.test.ts` | 103 passed |
| `npm.cmd run test:ci` | 2040 passed across 52 test processes, 0 failed |
| `npm.cmd run typecheck:test` | Passed |
| `npm.cmd run lint` | Passed; 0 errors, 9 existing warnings in unchanged navigation/form files |
| `npm.cmd run build` | Passed; existing `preferredRegion` deprecation warning |
| `git diff --check` | Passed |

Raw local logs are outside the repository in `%TEMP%/picchuspot-f1-*.log`.
The connected regression's baseline trace is in `picchuspot-f1-red-late-webhook.log`.

## Recovery boundaries

The test proves service-level behavior with mocks/fixtures, not real Stripe delivery,
signature cryptography, Supabase/RLS execution or database race behavior. Existing
signature/validation/race tests remain passing; conditional SQL predicates were
reviewed and left unchanged. No live payments, refunds, SQL, webhook resends,
customer writes or production secrets were used. Browser E2E and remote CI were
not run; UI/API shape did not change. No commit, push, PR, merge or deploy was performed.

If the valid original webhook arrives later while its binding is intact, it can
mark the same payment paid. If it never processes, Checkout remains processing;
this patch supplies no automatic reconciliation.

The existing signed `/api/payments/webhook` path can retry a received event or a
transient failure (`failed` with null `processed_at`). Terminal failed events,
including Session mismatch with non-null `processed_at`, short-circuit on redelivery
in `isFinalEvent()`; replay alone does not repair a replaced Session ID.

Next read-only investigation for potentially affected historical records: compare
`order_payments` bindings/attempts and `stripe_webhook_events` object IDs, failure
messages and processing timestamps against original/replacement Stripe Sessions
and PaymentIntents, their order metadata, mode, amounts and payment status. Establish
whether one or more payments actually succeeded before proposing any correction.
No historical records are automatically rebound by this patch. F2 is outside scope.
