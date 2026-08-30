# Welcome Offer rollout and rollback

The initial version of the additive migration in
`supabase/add-welcome-offer-redemptions.sql` has already been applied to
production and read-only verified. It does not backfill or rewrite existing
orders, and the existing `commit_order_submission` RPC remains available for
ordinary-price orders.

## Production incident and targeted hotfix

The initial PR #257 migration is already applied in production, but its
versioned commit function contains the invalid expression
`pg_catalog.coalesce(...)`. PostgreSQL treats `COALESCE` as SQL syntax rather
than a schema-qualified function, so the first real Welcome Offer commit failed
before creating an order or consuming a redemption.

Before retrying that order, apply **only**
`supabase/fix-welcome-offer-rpc-coalesce.sql` manually in production. Do not
rerun the original migration. The targeted hotfix replaces the existing
function in place with valid `COALESCE(...)`; it requires no table or data
migration. No redemption cleanup is required because the failed production
test created no order and consumed no benefit.

After applying the hotfix, run this non-mutating smoke check manually. The
submission and user UUIDs below are intentionally fake. The nonexistent
submission returns before any commit or redemption logic is reached.

```sql
-- This preflight must return zero rows. If it does not, choose a new UUID.
SELECT submission_id
FROM public.order_submissions
WHERE submission_id = '9d4d6f2b-1eb4-4e13-a0cc-6be2c5fd0207'::UUID;

SELECT *
FROM public.commit_order_submission_with_welcome_offer_v1(
  p_user_id => 'a930dceb-7976-4dc0-9f5f-34f703ca7d7f'::UUID,
  p_submission_id => '9d4d6f2b-1eb4-4e13-a0cc-6be2c5fd0207'::UUID,
  p_request_hash => 'welcome-offer-coalesce-hotfix-smoke-check',
  p_lease_token => 'b70b9478-3ac2-413f-a393-f20fe34f9073'::UUID,
  p_client_name => 'Welcome Offer hotfix smoke check',
  p_client_email => 'noreply@example.invalid',
  p_client_phone => '',
  p_client_company => '',
  p_job_title => 'Non-mutating RPC verification',
  p_items => '[]'::JSONB
);
```

Expected result: the function executes successfully with
`result_code = 'not_found'`. It creates no order or redemption and performs no
data mutation. Codex must not run this check against production. Once it passes,
retry the same one-image free Image Enhancement order.

## Production permission follow-up

The initial migration was applied before the final table-grant hardening
correction. If this permission follow-up has not already been completed, apply
this targeted adjustment manually in production. It is independent of, and
does not replace, the required COALESCE hotfix above:

```sql
REVOKE ALL ON TABLE public.welcome_offer_redemptions FROM service_role;

GRANT SELECT, INSERT, DELETE
ON TABLE public.welcome_offer_redemptions
TO service_role;
```

This adjustment changes permissions only. No row or data changes are required,
and the full migration must not be rerun. After applying it, verify that the
table grants are limited to the intended service-role privileges and that the
versioned RPC remains executable only by `service_role`.

## Rollback limitation

PR #257 changes `PRICING_VERSION`. If rollout verification fails, roll the
application back before allowing real customer orders. If the new application
has already created v2-priced orders, first assess those orders' payment state
and stored pricing-snapshot compatibility with the previous application's
strict Checkout eligibility check before reverting application code.

Do not rewrite existing production rows as part of rollout or rollback. Keep
the additive migration objects in place so the previously deployed application
can continue using `commit_order_submission` without depending on the new
Welcome Offer path.
