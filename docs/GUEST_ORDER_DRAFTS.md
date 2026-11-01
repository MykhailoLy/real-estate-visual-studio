# Guest Virtual Staging drafts

The server flag defaults to `false`. Enabling it also opens the guest configuration form at `/order/virtual-staging`. Guests confirm a saved version and estimate before signing in. The dashboard then loads the claimed draft, recalculates account pricing and asks for the original photos.

On create or save, the compact JSON encoding of `draft` may use up to 261,120 UTF-8 bytes before field trimming. The complete HTTP body, including outer fields, JSON whitespace and escape sequences, may use up to 262,144 bytes. Exceeding either limit returns HTTP 400 with `invalid_input` and a message identifying the exceeded limit.

## Apply the database changes

Apply the scripts manually in the target project's Supabase SQL Editor, in this order. If the prerequisites are already installed, verify them and continue from the first missing script.

1. `supabase/schema.sql` provides the shared tables and triggers.
2. `supabase/add-order-drafts.sql` provides authenticated order drafts.
3. `supabase/add-guest-order-drafts.sql` adds the guest table, its grants and the save and claim functions.

## Enable guest drafts

1. Complete the migration with `GUEST_ORDER_DRAFTS_ENABLED=false`.
2. Configure the server-only `GUEST_DRAFT_COOKIE_SECRET` with at least 32 random characters. Generate it with `openssl rand -base64 48` or the Node command in `.env.example`. Configure the existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the same environment. Writes return HTTP 503 if the limiter is unavailable.
3. When ready to enable the guest form and endpoints, set `GUEST_ORDER_DRAFTS_ENABLED=true` and redeploy. To disable them, set it back to `false` and redeploy.

## Weekly cleanup

Run `supabase/cleanup-guest-order-drafts.sql` manually each week. It deletes up to 5,000 expired guest rows per run and skips locked rows. If it returns 5,000 IDs, repeat the batch the same day until it returns fewer. Claimed dashboard drafts and files are retained.

## Rotate the signing secret

If the secret is compromised, replace it immediately and redeploy with the new value. Cookies signed with the old secret become invalid, and their holders lose access to unclaimed drafts. This loss is acceptable and must never delay rotation. Users can still open already-claimed drafts from their authenticated dashboard.

## Run the local integration test

Set `F3_POSTGRES_BIN_DIR` to the PostgreSQL binary directory, `F3_PG_DRIVER_MODULE` to a local installation of the Node `pg` module, and `GUEST_POSTGREST_BIN` to the PostgREST executable. All three paths must be absolute. Run `npm run test:guest-order-drafts-db` to start a temporary loopback cluster and test through PostgREST.

Run `npx playwright test --config e2e/guest-order-drafts.config.ts` for the local browser flow. It builds the app, tests both flag settings and uses synthetic auth and draft responses.
