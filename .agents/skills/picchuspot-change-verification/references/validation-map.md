# PicchuSpot validation map

This is a navigation aid. Always verify the current command in `package.json`.

## Common scopes

| Area | Likely focused command |
| --- | --- |
| SEO foundation | `npm run test:seo` |
| Pricing | `npm run test:pricing` |
| Dashboard/navigation/home presentation | `npm run test:dashboard-navigation` |
| Supabase browser client | `npm run test:supabase-browser` |
| Order draft core | `npm run test:order-drafts` |
| Order draft files | `npm run test:order-draft-files` |
| Order finalization | `npm run test:order-draft-finalization` |
| Virtual staging UI/state | `npm run test:virtual-staging-styles` and/or `npm run test:virtual-staging-review` |
| Virtual renovation UI | `npm run test:virtual-renovation-ui` |
| Photo editing review/UI | `npm run test:photo-editing-review` |
| Day-to-dusk UI | `npm run test:day-to-dusk-ui` |
| Public media delivery | `npm run test:public-image-delivery` |
| Static image viewers | `npm run test:static-image-viewers` |
| Property Showcase | `npm run test:property-showcase` |
| Security headers | `npm run test:security-headers` |
| Brand palette | `npm run test:brand-palette` |
| Stripe server/config | `npm run test:stripe-server` |
| Stripe checkout | `npm run test:stripe-checkout` |
| Stripe webhook | `npm run test:stripe-webhook` |
| Order emails | `npm run test:order-emails` |
| Order/data integrity | `npm run test:order-integrity` |
| Admin clients/auth invite | `npm run test:admin-clients` |

## Cross-cutting checks

- `npm run lint`
- production typecheck command currently used by the repository/CI
- `npm run build`
- `npm run e2e:smoke`
- `npm run test:ci`

Use them proportionately.

## Critical-system guidance

For order, upload, payment, pricing, email, auth, API, database/RLS, or migration work, focused checks alone are usually insufficient. Preserve the `AGENTS.md` preflight and run the relevant broader integrity/regression checks.

For SQL/database work, repository tests do not mean production migration execution occurred. Keep those claims separate.
