<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# PicchuSpot Agent Instructions

## Project

PicchuSpot is a real-estate visual services website.

Repository:

`MykhailoLy/real-estate-visual-studio`

Production:

`https://picchuspot.com`

Technology:

* Next.js App Router
* TypeScript
* Tailwind CSS
* Supabase
* Vercel

## Git workflow

Always begin new work from the latest remote `main`.

For each new task:

1. Fetch the latest `origin/main`.
2. Create a new focused branch.
3. Make only task-related changes.
4. Run validation.
5. Commit and push the branch.
6. Open one pull request into `main`.
7. Do not merge unless the user explicitly asks.

Do not continue an old branch or pull request unless the user explicitly requests it.

When continuing an existing pull request, update its existing branch rather than creating a duplicate PR.

Before finishing, confirm whether the branch is behind `origin/main`.

## Required validation

Always run:

```bash
npm.cmd run lint
npm.cmd run build
```

Do not report that validation passed unless both commands actually completed successfully.

## Final report

Always include:

1. Summary
2. Exact implementation
3. Files changed
4. Lint result
5. Build result
6. Commit hash
7. Pull request link
8. Risks or deferred work
9. Confirmation that the PR was not merged

## Scope discipline

Make the smallest focused change that satisfies the task.

Do not refactor unrelated code.

Do not rename routes, files, database columns, API fields, storage paths, or public URLs unless explicitly requested.

Preserve:

* English and Spanish routes
* responsive layouts
* accessibility
* navigation
* authentication redirects
* SEO metadata
* existing mobile and desktop behavior

## Protected systems

Do not modify these systems unless the task explicitly requires it:

* Supabase order tables
* order submission logic
* order numbering
* customer upload flow
* storage buckets or object paths
* payment logic
* pricing calculations
* Resend or transactional email logic
* environment variables
* admin authentication
* client authentication
* API routes
* RLS policies
* production secrets

Never execute a Supabase SQL migration automatically.

When SQL is required:

* create an idempotent migration file;
* explain exactly what it changes;
* clearly state that it must be executed manually;
* do not execute it.

## Authentication and security

Never trust `user_id`, email, role, price, or ownership values supplied by the browser.

Use the verified server session as the source of authenticated identity.

Never expose service-role keys, API secrets, environment values, or private storage URLs.

Preserve administrator access and compatibility with historical orders.

## Orders

Use one shared backend order system, shared upload flow, and shared payment architecture.

Different services may use different frontend forms.

Do not create a separate backend for every service.

Public service pages should direct unauthenticated users to registration or login.

New order forms belong inside the authenticated client portal.

Do not restore anonymous public order submission unless explicitly requested.

## Routes

The public `/portfolio` route redirects permanently to `/gallery`.

Do not restore a separate public portfolio page.

The admin `/admin/portfolio` route remains valid.

The public `/order` route may remain a public service catalogue, while actual new-order forms belong inside the client dashboard.

## Portfolio visibility

Portfolio display locations are controlled independently:

* Gallery
* Service Page
* Homepage
* Published

Preserve this behavior:

* Gallery ON / Service OFF: gallery only
* Gallery OFF / Service ON: service page only
* both ON: both locations
* Published OFF: nowhere publicly
* Homepage operates independently while the item is published

## Brand

Brand colors:

* Navy: `#0B1F3A`
* Gold: `#B88A44`

Visible wordmark:

* `Picchu` is navy on light backgrounds and white on dark backgrounds
* `Spot` is gold
* do not add `.com`

Reuse the existing shared components:

* `PicchuSpotLogo`
* `BrandWordmark`

Do not duplicate branding markup when a shared component exists.

Do not redraw, recolor, crop, stretch, or regenerate supplied brand artwork.

Brand assets live under:

* `public/brand/`
* `public/icons/`
* `src/app/favicon.ico`

## Media

Use `next/image` for ordinary public images where appropriate.

Preserve source aspect ratios.

Do not add blanket `priority` to images.

Only genuinely critical above-the-fold images may use priority.

Avoid unnecessary image duplication.

## Code quality

Follow the existing project style and architecture.

Reuse existing components and utilities before creating new ones.

Keep TypeScript types explicit.

Avoid `any` unless unavoidable and documented.

Do not suppress lint, TypeScript, or build errors merely to pass validation.

## Visual QA

For user-interface changes, verify behavior conceptually at:

* 360 px
* 390 px
* 768 px
* 1024 px
* 1440 px

Check:

* no clipping
* no layout shift
* no overlapping controls
* no unexpected wrapping
* visible keyboard focus
* functional mobile and desktop navigation

Final response must include:

* branch name
* files added
* confirmation that the existing `.codex` file was preserved
* lint result
* build result
* commit hash
* PR link
* confirmation that the PR was not merged
