# Partner client invitations before registration

Admins can invite a future client from **Admin → Clients → Invite Partner client**. The account receives the existing fixed 10% Partner Pricing before any order is needed.

## Implementation and authority

`POST /api/admin/clients/invite-partner` accepts only `{ "email": "client@example.com" }`. Both the route and server helper verify the existing signed admin session. Zod rejects extra fields and invalid emails, then trims/lowercases the email. The request cannot supply a user ID, Partner flag, percentage, metadata or redirect URL.

The existing server-only Supabase admin client calls `auth.admin.inviteUserByEmail`. After a successful response, the helper checks the returned account/email and passes **that returned `user.id`** to `setAdminClientPartner(id, true, supabase)`. This is the same authenticated, identity-checked account-pricing upsert used by Clients and Order Detail. It writes `account_pricing.user_id` and `partner_client = true` without requiring an order. Only `{ "success": true }` is returned; no Auth user/metadata or privileged credentials are exposed. API responses use `Cache-Control: no-store`.

The configured `NEXT_PUBLIC_SITE_URL` (existing setting), or the existing production-domain fallback, determines the `/auth/invite` redirect. Browser-supplied Host, Origin and body values cannot change it.

## Acceptance and onboarding

Verified against installed `@supabase/supabase-js` / `@supabase/auth-js` **2.106.1**, `@supabase/ssr` **0.10.3**, and Next.js **16.3.4**:

- `inviteUserByEmail(email, { redirectTo })` returns `{ data: { user }, error }`. Its installed documentation explicitly says admin invites do **not** support PKCE, because the accepting browser differs from the inviting browser.
- Supabase's standard invite email uses `{{ .ConfirmationURL }}`. Auth verifies the invite and redirects with the access/refresh tokens and `type=invite` in the URL fragment.
- `/auth/invite` removes the fragment from browser history, explicitly calls the existing browser client's `setSession`, and verifies the user with `getUser`. It rejects missing, invalid, expired or non-invite fragments with safe copy. Tokens never become URL query parameters or API response fields.
- Analytics scripts and page views are excluded from this invitation landing page so its token-bearing URL is not sent to analytics.
- The existing password form sets a password for future logins. Its default recovery behavior remains unchanged; the invitation provides a sanitized continuation URL.
- `/auth/callback?type=invite` verifies the cookie session with Auth before reading the profile. A URL marker or email is never authorization and never grants Partner status. Missing/incomplete profiles use the existing `/dashboard/profile?onboarding=1` flow; complete profiles reach the safe intended destination, defaulting to `/dashboard`.
- Existing signup, confirmation, recovery and default magic-link PKCE code exchanges remain in place.

Sources: [Supabase admin invite API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [Auth invite implementation](https://github.com/supabase/auth/blob/master/internal/api/invite.go), [Auth verification redirect implementation](https://github.com/supabase/auth/blob/master/internal/api/verify.go), [Supabase email template variables](https://supabase.com/docs/guides/auth/auth-email-templates).

## Existing accounts and failure recovery

- Provider `email_exists` / `user_already_exists` errors return HTTP 409: **This email already has an account. Enable Partner Pricing from the client row.** No email-search system or duplicate account is created.
- Supabase may return/re-invite an existing **unconfirmed** account. Its returned ID remains authoritative; repeating the account-pricing upsert keeps one row per account.
- Invite failure returns a safe HTTP 503 and does not write Partner state. An uncertain transport result instructs the admin to check Clients before retrying because an account/invitation may already exist.
- If invitation creation succeeds but identity/Partner assignment cannot be confirmed, HTTP 503 carries `code: "partner-assignment-unconfirmed"` and: **Invitation created, but Partner Pricing could not be confirmed. Reload Admin Clients and enable Partner Pricing before the client places an order.** The UI provides a reload link. The Auth account is retained and its existing Clients toggle is the repair path.
- There is no automatic invite retry, Auth-user deletion or destructive compensation. Auth invitation delivery and the pricing write are separate operations, not a cross-system transaction. An admin must resolve the explicit partial state before the client orders.

## Email and manual dashboard checks

Only Supabase Auth sends the invitation. Existing Resend order/transactional emails are unchanged. No production settings, schema, environment variables, real records or email templates were changed. The hosted project's current Invite User template and redirect allowlist were **not** available for authenticated inspection; repository/SDK and local fixture verification do not prove live email delivery.

Before rollout, an operator must verify in Supabase **Authentication → URL Configuration** that the intended site has `/auth/invite` allowed (production: `https://picchuspot.com/auth/invite`). Add that exact redirect manually if the existing allowlist does not already allow it. For staging, use its existing site URL setting and allow that site's corresponding path. Do not point a preview's invitations at a different deployment unless deliberately testing that deployment.

The standard Invite User template with `{{ .ConfirmationURL }}` works with this code. Partner-specific wording is an optional **manual** update to **Authentication → Email Templates → Invite user**; preserve the standard confirmation link. This template is global to all Supabase admin invitations, so confirm its use by any other operators before changing its copy.

Recommended subject:

```text
You’re invited to PicchuSpot Partner Pricing
```

Recommended HTML body (the placeholder is verified in Supabase's template documentation):

```html
<h2>You’ve been invited to PicchuSpot Partner Pricing.</h2>
<p>Create your PicchuSpot account using this email address to receive
10% off eligible digital services.</p>
<p><a href="{{ .ConfirmationURL }}">Create account</a></p>
```

An existing custom template that bypasses `ConfirmationURL` must be reviewed manually for this redirect; do not silently assume it is equivalent. No custom email sender or duplicate invitation email is needed.

## Verification

- `npm.cmd run test:admin-clients`: real signed admin-cookie checks, strict invite payload, normalization, authoritative ID, conflicts, provider/partial failures, metadata isolation, zero-order accounts, idempotent Partner rows, existing toggles, and callback/onboarding/recovery regressions.
- `npm.cmd run test:order-integrity`: new invitation → actual profile-save API → first-order API → existing `createProductionOrder` and pricing engine → atomic order commit against the existing isolated fixture. Checks 2-image Welcome + Partner ($26.60; Partner $1.90) and 10-image Welcome + Volume + Partner ($148.01; Partner $15.39). No previous order exists in either scenario.
- `npm.cmd run e2e:partner-invites`: builds the real app with loopback-only synthetic configuration, starts an isolated Supabase HTTP fixture, and runs browser tests for admin authorization, request/loading/success/conflict/partial states, the existing toggle, widths 360/390/768/1024/1440, and acceptance in a separate browser with no PKCE verifier. The real installed SDK persists cookies, updates the password and completes existing onboarding. No external invitations are sent.
- Existing Admin Clients and Partner Pricing smoke tests, full `test:ci`, test/application typechecks, lint and build are also required before review.

The pricing rate, formulas/version, eligible services, Welcome/Volume ordering, Stripe, committed/historical snapshots, schema and RLS remain unchanged. No migration is required. After PR review and separately authorized release, the remaining operational check is a controlled staging invitation using a real test inbox, followed by onboarding and first eligible order review.

### Recorded results — 2026-09-09

| Check | Result |
| --- | --- |
| Focused Admin Clients/invite/callback tests | 27 passed |
| Invite/callback + direct-order integrity regression run | Passed, including both first-order proofs |
| Full `npm.cmd run test:ci` | 1,958 passed, zero failures/skips |
| `npm.cmd run typecheck:test` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| `npm.cmd run lint` | Passed: zero errors, nine existing warnings in unchanged files |
| `npm.cmd run build` | Passed; 116 static pages generated |
| `npm.cmd run e2e:partner-invites` | 7 passed |
| Existing Admin Clients + Partner Pricing smoke tests | 5 passed |
| Responsive/browser QA | 360, 390, 768, 1024 and 1440 px; no horizontal overflow; keyboard focus and controls checked; 360/1440 screenshots visually inspected |
| `git diff --check` | Passed |

Pre-existing warnings: nine Next.js internal-navigation lint warnings in SignOutButton and existing order-form/redirect files; deprecated `preferredRegion` build configuration. Node tests also emit the repository's existing module-type warning, and Playwright emits the environment's NO_COLOR/FORCE_COLOR warning. Dependency installation reported the existing `node-domexception` deprecation and npm install-script notices. No dependencies or lockfile were changed to suppress these warnings.

### Files in this change

Added:

- `docs/partner-client-invitations.md`
- `e2e/partner-invites.config.ts`
- `e2e/partner-invites/partner-invitations.spec.ts`
- `e2e/support/partner-invite-auth-fixture.ts`
- `src/app/(auth)/auth/invite/InviteAcceptance.tsx`
- `src/app/(auth)/auth/invite/page.tsx`
- `src/app/(public)/api/admin/clients/invite-partner/route.ts`
- `src/components/admin/AdminPartnerInviteForm.tsx`
- `src/lib/auth-invite-callback.test.ts`

Updated:

- `package.json` (test scripts only)
- `src/app/(auth)/reset-password/ResetPasswordForm.tsx` (reusable continuation, unchanged recovery default)
- `src/app/(public)/admin/clients/page.tsx` (invite section)
- `src/app/auth/callback/route.ts` (verified invite-session onboarding)
- `src/components/analytics/GoogleAnalytics.tsx` (exclude invite landing)
- `src/lib/admin-clients-server.ts` (invite orchestration and safe error codes)
- `src/lib/admin-clients-server.test.ts` (invite/security regression coverage)
- `src/lib/orders/direct-order-file-integrity.test.ts` (invite-to-first-order regression coverage)

The original checkout's `.codex` directory and unrelated `.gitignore`/`debug.log` changes were preserved. Work was isolated on `codex/partner-client-invitations` from `origin/main` commit `510554045bea69f0d1ea300c5188ba6047df2c6e`. No merge or deployment was performed.
