# F2: refund delivery before payment confirmation

Local verification: 2026-09-22, Node 24.18.0 / Next.js 16.3.4.
Branch: `codex/fix-out-of-order-refund-webhook`.
Baseline and Git HEAD: `f6784b8b8a4427835fc93bbe376f9f2dc06fbb66` (includes F1).
Fetched `origin/main` matches HEAD; no commits behind. Changes are uncommitted.

## Root cause and red / green evidence

`processVerifiedStripeWebhook()` previously marked a refund terminal `ignored`
when `getPaymentByPaymentIntent()` found nothing. The later Checkout webhook
persisted the PaymentIntent, but `isFinalEvent()` skipped the refund's repeated ID.
A matching PaymentIntent on a not-yet-paid record also failed the strict Paid check
permanently instead of waiting for confirmation.

Before production edits, three tests called the real service on one shared fixture:
early `charge.refunded`, successful `refund.created`, and successful `refund.updated`.
Each ran refund -> real `checkout.session.completed` -> same refund ID -> repeat.
All failed: the first response was 200/terminal ignored, payment updates were 1,
refund updates were 0, and the final aggregate remained none/0. No test manually
set Paid or the PaymentIntent between these steps. The original trace is in
`%TEMP%/picchuspot-f2-red.log`.

The same tests now pass with these states:

| Step | Refund event | Payment / refund | Successful mutations |
| --- | --- | --- | --- |
| Early refund | failed, processed_at=null; HTTP 500 | checkout_open, original Session, no PI; none/0 | payment 0, refund 0 |
| Valid Checkout webhook | still retryable | paid, original Session and confirmed PI; none/0 | payment 1, refund 0 |
| Same refund event ID | processed; HTTP 200 | same payment and IDs; partial/500 | payment 1, refund 1 |
| Repeated refund | remains processed; HTTP 200 | unchanged | payment 1, refund 1 |

## Matching and lifecycle

- A persisted, confirmed PaymentIntent binding retains the fast path. Historical
  bound payments do not require new metadata or additional Stripe reads.
- Unbound events use `GET PaymentIntent(id)` from the signed event. Metadata's
  `picchuspot_order_id` locates a candidate only. The candidate's saved Session is
  retrieved by ID; object IDs/types, PI, order metadata/reference, mode, currency,
  subtotal and total must agree. Partial refund amount is bounded by the total,
  not required to equal it. A fresh database read detects payment confirmation or
  an identity change during these lookups. Refund processing never binds IDs or
  sets Paid; the existing strict Paid validator and aggregate/CAS logic still apply.
- Missing historical metadata, missing records/bindings, incomplete lookup data,
  unconfirmed Paid, and Stripe/DB failures remain retryable, with sanitized static
  reasons. Missing metadata does not prove a foreign payment. A later confirmed
  direct binding allows replay to succeed.
- Proven ID/mode/currency/amount/metadata conflicts are terminal failed, including
  conflicts accompanied by another missing field. Malformed refund payloads are
  terminal failed. Structurally valid signed Charge/Refund objects explicitly
  containing `payment_intent: null` are unsupported and ignored: they cannot be
  payments created by this application's PaymentIntent-based Checkout. An absent
  or malformed PI field is not treated as this explicit-null case.
- Event rows store existing reconciliation metadata and static errors only.
  The existing retryable-event predicates prevent a losing failed delivery from
  overwriting a processed event. Event persistence failure returns 500; replays
  do not re-add an amount after a successful refund write.

## Coverage and validation boundaries

Final checks completed on the submitted local code:

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --test src/lib/payments/*.test.ts` | 165 passed |
| `npm.cmd run test:ci` | 2102 passed across 52 processes; 0 failed |
| `npm.cmd run typecheck:test` | Passed |
| Production TypeScript check within `npm.cmd run build` | Passed |
| `npm.cmd run lint` | Passed; 0 errors, 9 pre-existing warnings in unchanged files |
| `npm.cmd run build` | Passed; existing `preferredRegion` deprecation warning |
| `git diff --check` and file scope review | Passed |

Logs are outside the repository: `%TEMP%/picchuspot-f2-payments.log` and
`%TEMP%/picchuspot-f2-final-{unit,typecheck,lint,build}.log`.
Changed files: webhook service (matching/retry classification), webhook route
(two read dependencies), existing webhook service tests, existing request/email
test fixture (required dependency stubs only), and this evidence document.
No commit, push, PR, merge, deployment or production operation was performed.

Behavioral tests also cover non-success refund states, partial -> full -> stale
partial, distinct events for the same aggregate, late/repeated payment confirmation,
lookup/DB failures and recovery, foreign/malformed events, identity mismatches,
missing historical metadata, and controlled overlapping deliveries without sleeps.
Payment writes and refund writes are counted separately. F1, raw-body/signature
handling, existing payment/refund validation and admin gate tests remain included.

Repository predicates, SQL, RLS, Checkout/F1, pricing, SDK/API version, environment
files and email architecture are unchanged. In-memory snapshots/hooks exercise
service behavior and conditional-write outcomes; they do not prove SQL concurrency.
No isolated database, real Stripe delivery/cryptographic signature, live data,
production secrets, browser E2E or remote CI was used. No migrations are needed.

## Rollout and recovery limits

The existing server Stripe key must permit reading PaymentIntents and Checkout
Sessions (and the existing Charge lookup). Live permissions were not inspected
or changed. New reads are by known IDs, never account-wide searches. The installed
SDK defaults to `2026-06-24.dahlia` (`node_modules/stripe/cjs/apiVersion.js`);
local generated object/event types and official API references were checked.
The deployed webhook endpoint's actual API version was not inspected.

Stripe does not guarantee delivery order and normally retries live failures for
up to three days. Missing payment confirmation therefore leaves the event retryable;
after Stripe's retry window it remains stored but nothing in this patch schedules
another attempt. See [Stripe delivery/retry documentation](https://docs.stripe.com/webhooks#event-delivery-behaviors).
Event and object semantics were checked against [event types](https://docs.stripe.com/api/events/types),
[Refund](https://docs.stripe.com/api/refunds/object), [Charge](https://docs.stripe.com/api/charges/object?api-version=2026-06-24.dahlia)
and [PaymentIntent](https://docs.stripe.com/api/payment_intents/object?api-version=2026-06-24.dahlia).
Creation alone does not prove refund success; pending/requires_action/failed/canceled
refunds do not increase the successful aggregate.

There is a real non-atomic interval after Paid is stored and before refund replay:
the existing admin gate returns Paid and allows production advancement. The test
explicitly demonstrates this, then confirms partial/full refund blocks advancement.
Late Paid does not erase refund fields. Already advanced orders are not rolled back;
the normal payment-confirmation email path can also run in this interval.

Old terminal ignored/failed events still short-circuit on replay and are not repaired
by deployment. No history is cleared or rebound. The next historical read-only step
is to correlate specific `stripe_webhook_events` IDs/object IDs/status/timestamps
with `order_payments`, original Stripe Events, Refunds, Charges, PaymentIntents and
saved Checkout Sessions; establish identity, successful aggregate and fulfillment
state before proposing an individually reviewed recovery. No recovery endpoint,
scheduler or automatic historical repair is introduced. F3 is outside scope.
