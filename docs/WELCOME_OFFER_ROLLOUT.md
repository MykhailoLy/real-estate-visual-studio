# Welcome Offer rollout and rollback

The initial version of the additive migration in
`supabase/add-welcome-offer-redemptions.sql` has already been applied to
production and read-only verified. It does not backfill or rewrite existing
orders, and the existing `commit_order_submission` RPC remains available for
ordinary-price orders.

## Production permission follow-up

The initial migration was applied before the final table-grant hardening
correction. Before merging or deploying the application, apply this targeted
permission adjustment manually in production:

```sql
REVOKE ALL ON TABLE public.welcome_offer_redemptions FROM service_role;

GRANT SELECT, INSERT, DELETE
ON TABLE public.welcome_offer_redemptions
TO service_role;
```

This adjustment changes permissions only. No row or data changes are required,
and the full migration must not be rerun. After applying it, verify that the
table grants are limited to the intended service-role privileges and that the
versioned RPC remains executable only by `service_role`. Then deploy the
application and complete rollout checks before allowing real customer orders.

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
