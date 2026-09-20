# Document-root migration: English default and Spanish locale

## Scope and provenance

Baseline: current `main` at `b0ae2015790636ca1325640c9d84b670b27fe2e8`,
root tree `2bfac58be00f5672e6fac5eff6082ee756967834`, captured on 2026-09-20
**before changes**. Next.js is locked to 16.3.4; local Node is 24.19.0.
The local production build used the existing property-gallery and static-image
viewer fixtures, without live service credentials.

[`document-roots-baseline.json`](./document-roots-baseline.json) preserves the
normalized route inventory, concrete prerender modes and revalidation, redirects,
104 HTTP observations, SEO/content digests, representative metadata, and SHA-256
provenance for the original manifests and response capture. This is local build
evidence, not a deployment, production crawl, ranking or field-performance result.
It supplements the earlier [SEO/GEO baseline](./BASELINE.md).

Mechanical commit `e6a3c96edbbd95f8ba075cd420ee038eefba9500` contains 145
byte-identical file moves. Review the subsequent implementation diff separately:
it establishes the document roots, adjusts imports and physical-path assertions,
and handles global 404 composition. The mechanical commit is an intermediate
review aid, not an independently deployable checkpoint.

## Layout ownership

| Location | Responsibility |
| --- | --- |
| `src/app/(default)/layout.tsx` | Real English root, `<html lang="en">`; explicitly exports shared `metadata` and `viewport`. |
| `src/app/(default)/(public)` | Existing English public pages, admin UI and public shell. |
| `src/app/(default)/(auth)` | Existing English auth pages and auth shell. |
| `src/app/(default)/(dashboard)` | Existing dashboard layout, access checks and pages. |
| `src/app/(default)/(showcase)` | Existing property/showcase pages. |
| `src/app/(localized)/[locale]/layout.tsx` | Real localized root; generates only `{ locale: "es" }`, rejects other values, uses `dynamicParams = false`, explicitly exports shared `metadata` and `viewport`. |
| `src/app/(localized)/[locale]/(public)` | Existing Spanish public files; shares the original public shell. |
| `src/app/(localized)/[locale]/(auth)` | Existing Spanish login/signup pages; shares original auth shell and form implementations. |
| `src/components/layout/DocumentRoot.tsx` | Original Geist configuration, body classes, CSS import, provider order, analytics, cookie banner and metadata values, reused by the roots. |
| `src/app/global-not-found.tsx` | English global 404 document using the same document infrastructure. |

There is no top-level `src/app/layout.tsx`. Existing URL paths stay unchanged:
English is unprefixed; Spanish remains `/es/**`. No `/en` or other locale is
published. The `[locale]` parameter is build-time route data, not a request-header,
cookie, pathname or geographic lookup. There is no new registry, i18n library,
translation content, middleware locale routing, CMS or environment variable.

All 65 source route-handler files remain byte-identical at their original physical
paths, including handlers inside `(public)` and `(showcase)`. The existing dashboard
proxy is unchanged. Order, upload, pricing, payments, email, Supabase and auth
business logic are unchanged. Two existing intentional full-document links have
line-scoped lint explanations because the new `[locale]` segment overmatches them
in Next's link rule; their existing behavior is retained.

## Before/after evidence

The first operation after establishing the roots was a production build and
comparison of prerender manifests and raw HTTP responses, including 404s.
The 404 issue described below was resolved before the final comparison.

| Contract | Baseline | Final local build |
| --- | --- | --- |
| `/`, `/pricing/virtual-staging` document language | `en` | `en` |
| `/es`, `/es/pricing/virtual-staging` document language | Incorrectly `en` | `es` |
| Concrete prerendered URLs | 96 | Same 96; no added or removed URL |
| Home page `/` | Static, revalidate 300 seconds | Same |
| Spanish home `/es` | Static, no timed revalidation | Same |
| Other concrete prerender entries | Same route type, compute mode, response mode, expiry and initial status | Unchanged |
| 104 sampled HTTP responses | 80 × 200, 9 × 404, 2 × 307, 13 × 308 | All statuses and redirect locations unchanged |
| Successful HTML responses | 78 documents, including 34 Spanish documents | Title, all captured metadata, links, parsed text and JSON-LD identical; Spanish `lang` corrected |
| Robots and sitemap | 200; sitemap has 50 URLs | Exact response bodies unchanged |
| Canonical, hreflang, x-default, icons, manifest and viewport | Captured per response | Identical for successful documents |
| Route configuration | Existing redirects, security headers and rewrites | Exact match |
| Generated font class | Original module-derived hash | Hash changes with source location; Geist options, font variable and body classes retained |

Route-pattern counts in `routes-manifest.json` change from 123 static/51 dynamic
to 98 static/76 dynamic because the physical Spanish patterns now contain
`[locale]`. **This is a routing-pattern change, not request-time rendering.**
The concrete prerender set and its rendering/revalidation fields are unchanged.
English blog/gallery fallback behavior remains unchanged. Spanish gallery
parameters are generated beneath the static `es` parameter.

Existing partially translated text, English social metadata fallbacks and other
localization gaps are deliberately preserved. This migration does not claim that
Spanish content is fully translated.

## Why the experimental global 404 flag is required here

**Observed:** the minimal multiple-root build succeeded, but globally unmatched
URLs lost the original root document: language, font/body setup, shared providers
and root metadata were no longer composed by Next.js. A default-root catch-all
calling `notFound()` was tested and did not restore the raw document consistently;
it was removed.

**Decision:** enable only `experimental.globalNotFound` and supply
`global-not-found.tsx`. The installed Next.js 16.3.4 documentation explicitly lists
multiple root layouts as a reason for this convention. It bypasses normal layout
composition, so it must return the complete document; this implementation reuses
`DocumentRoot` and the shared metadata/viewport. It preserves the existing English
404 message and styles rather than adding a translation or request-time locale
lookup. See the [Next.js not-found convention](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
and the matching installed documentation under
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`.

This is a separately justified exception to the preference against experimental
flags, not a general experimental-rendering migration. It introduces a framework
upgrade risk: on every Next.js upgrade, rerun the unknown-route/raw-document and
prerender checks before accepting the version. Do not remove the flag without
proving that both roots and global 404 composition remain correct.

The six global unmatched cases `/__missing__`, `/es/__missing__`, `/es/blog`,
`/en`, `/fr` and `/fr/pricing/virtual-staging` retain status 404, English fallback,
noindex, captured metadata/content and the shared document wrapper.

**One intentional edge-case difference:** `/es/gallery/__missing__` now uses the
static global English 404 because `dynamicParams = false` rejects an ungenerated
parameter. Its cache-control, title and error-document metadata/text differ from
the previous dynamic fallback; status 404 and noindex remain. All ten generated
Spanish gallery pages are preserved. English `/gallery/__missing__` and
`/property/__missing__` retain their pre-existing Next error-document behavior;
this patch does not repair those unrelated fallbacks.

## Validation and reproducible commands

| Check | Local result |
| --- | --- |
| Production build, TypeScript/build routing and prerender output | Passed |
| Baseline vs final 104-response comparison and manifests | Passed with the documented ES language/font and invalid-gallery differences |
| Existing Node suite, `npm run test:ci` | 2,025 test executions passed; zero failures |
| `npm run typecheck:test` | Passed |
| `npm run lint` | Passed; same nine pre-existing warnings as baseline |
| Existing Playwright API/request tests for global 404 and document-root build contracts | Two passed against the final local production server |
| Full Chromium smoke suite | Pending CI: local Chromium cannot open the managed runtime's required socket |

No new test framework is introduced. Existing source tests are updated to inspect
both physical trees, not made vacuous by looking only at the former paths.
Existing smoke coverage checks raw server language, single html/body ownership,
metadata inheritance, canonical/hreflang, root transitions, unknown locales and
prerendering. Browser assertions for document navigation and existing auth/dashboard
flows must pass in the repository's existing CI before the draft is ready.

From a clean dependency install, with no production credentials:

```sh
npm ci --no-audit --no-fund
PLAYWRIGHT_PROPERTY_GALLERY_FIXTURES=1 PLAYWRIGHT_STATIC_IMAGE_VIEWER_FIXTURES=1 NEXT_TELEMETRY_DISABLED=1 npm run build
npm run typecheck:test
npm run lint
npm run test:ci
npx playwright install --with-deps --no-shell chromium
npm run e2e:smoke
```

The existing Playwright config rebuilds/starts a local production server. To test
an already-built fixture server without a second build, start it in another
terminal and use the existing base-URL override:

```sh
PLAYWRIGHT_PROPERTY_GALLERY_FIXTURES=1 PLAYWRIGHT_STATIC_IMAGE_VIEWER_FIXTURES=1 node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3100
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run e2e:smoke
```

To reproduce a baseline comparison, build the recorded main SHA in a separate
checkout with the same fixture flags; retain `.next/prerender-manifest.json`,
`.next/routes-manifest.json` and `.next/server/app-paths-manifest.json` before
building the candidate. Compare concrete prerender URLs and rendering fields,
not generated chunk identifiers or physical route-group strings. The committed
JSON lists all 104 sampled URLs and defines its semantic digest normalization.
It is an evidence snapshot, not a new snapshot-testing framework.

## Remaining review boundaries

Cross-root navigation intentionally performs a full document load, as required by
Next.js multiple roots. Browser smoke must verify language switching and the
existing URL/query behavior, including navigation between auth/public/dashboard
surfaces. Stateful transient UI can reset across roots; no persistent user-locale
or session model is introduced.

Local fixtures and source tests do not prove live Supabase sessions, OAuth or
email-link callbacks, authenticated production dashboard/admin permissions,
real uploads, order submission, payment checkout/webhooks or transactional email.
Those integrations were not exercised against live services. Vercel preview/CDN
cache behavior, production ISR regeneration, field performance and all responsive
viewports remain unverified by the raw HTTP comparison. This draft does not merge,
promote a deployment, or authorize a production release.

## 2026-09-20 — final acceptance addendum

Starting PR #333 head: `37f3faf0f96599464a35abd1e1ee3eb5bf023f37`.
Main remains `b0ae2015790636ca1325640c9d84b670b27fe2e8`.
The original baseline JSON and all preceding observations above are retained.
This addendum adds test coverage; it does not change document-root architecture,
production code, auth logic, application environment variables or business flows.

### Coverage added without repeating the existing contracts

The existing unknown-route smoke test now loads the seven global 404 cases in
Chromium, including `/es/gallery/__document_root_missing__`. It retains the
existing HTTP/noindex assertions and additionally checks the single raw document,
visible 404 heading/message, English fallback language, body/font setup and the
cookie banner's client effect before checking runtime diagnostics. The two
pre-existing English dynamic gallery/property fallbacks retain their request-only
checks; they are not redefined as global 404s by this patch.

The shared network guard permits only Chromium's exact resource-404 diagnostic
at an explicitly listed URL with an observed main-frame navigation response 404.
It matches events at assertion time, requires no JavaScript console arguments,
and permits at most one diagnostic per navigation. Other console/hydration errors,
uncaught page errors, HTTP 500+ and forbidden API calls still fail. A separate
negative guard assertion proves that application JavaScript emitting even the
same 404 diagnostic text is rejected. This is not a blanket console-error skip.

The new cross-root test reuses `e2e/partner-invites.config.ts` and the existing
loopback Supabase fixture. It visits the real Spanish login page, submits the
real shared LoginForm through the real Supabase SDK, and reaches the English
server-rendered dashboard profile page. The selected destination is:

`/dashboard/profile?onboarding=1&next=%2Fdashboard%2Fjobs`

Assertions cover the outer `redirectTo`, the signup link's retained destination,
`onboarding=1`, nested `next=/dashboard/jobs`, removal of internal `_rsc` from
unauthenticated recovery, SDK-written cookies, the full document transition,
English HTML/noindex/UI, and a server user lookup. Before login and after clearing
cookies, the same destination must redirect to login with its query preserved.
No QA Preview identity, manually injected session cookie, mocked router/dashboard
HTML or production auth bypass is used.

### What the fixture proves, and what it does not

The fixture now has one narrowly scoped password-grant response for a fixed dummy
account/password. Its existing `/auth/v1/user` endpoint accepts only the fixture
token. SDK cookie serialization, the browser navigation, real Next roots, proxy,
server auth gate, profile route and query handling execute unchanged. The fixture
records password sign-ins and authenticated user reads; the test also asserts
that no invitation, password change, profile write, pricing write or unsupported
fixture operation occurred. The profile form is displayed but never submitted.
Unknown backend writes remain rejected. All services use loopback URLs and dummy
keys from the pre-existing test configuration.

This proves integration with a controlled Auth response, not authentication with
real Supabase infrastructure. Real password/CAPTCHA verification, token signatures,
refresh/expiry/revocation, OAuth/email callbacks, production permissions and live
account sessions still require a genuine test session. No real order, upload,
payment, email or database write is exercised. The existing conditional Auth and
QA Preview tests must not be described as covered when their prerequisites cause
them to skip.

### Validation and CI execution

Local `npm run typecheck:test`, `npm run lint` (the same nine existing warnings),
`npm run test:seo` (15 passed), test discovery and `git diff --check` passed.
A normal local Chromium launch was attempted and remains blocked by the managed
runtime's `socket()` restriction; this is not a browser acceptance pass.

The existing E2E workflow runs its normal smoke suite, then invokes only the new
cross-root test through the existing isolated Auth configuration. This extra
invocation is necessary because that configuration is outside the default smoke
`testDir`; it does not replace the normal server or its tests. No new workflow or
test framework is introduced. The existing quality workflow remains unchanged.
Final workflow links and results are recorded in [PR #333](https://github.com/MykhailoLy/real-estate-visual-studio/pull/333),
including skipped tests separately from successful executions.

```sh
npm run typecheck:test
npm run lint
npm run test:seo
npm run e2e:smoke -- e2e/smoke/public-pages.spec.ts --grep 'global 404|expected document 404'
npm run e2e:partner-invites -- --grep 'Spanish login crosses'
```

The two browser commands use their existing localhost production-build fixtures;
they must never target production. The PR remains draft. No merge or deployment
is performed by these acceptance steps.
