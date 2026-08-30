# Welcome Offer rollout and rollback

The migration in `supabase/add-welcome-offer-redemptions.sql` is additive and
must be applied manually before deploying the application in PR #257. It does
not backfill or rewrite existing orders, and the existing
`commit_order_submission` RPC remains available for ordinary-price orders.

After applying the migration, verify the new table and versioned RPC, then
deploy the application and complete rollout checks before allowing real
customer orders.

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
