# SEO/GEO control baseline — 2026-09-20

## Evidence boundary

Repository inspected: `MykhailoLy/real-estate-visual-studio`.
Base main: `5e2d12e8d49c7170a528b09784b09b9d22737c87`.
Root tree: `0d19a4d0fb10974461c41f4e4d267bc5393707ed`.
Open pull requests: none returned at inspection.

This is a source/control inventory, not a production crawl result or a ranking
baseline. Container HTTP fetches and the web fetch tool could not retrieve the
selected production URLs during preparation. That is an access/tooling limitation,
not a diagnosed site outage, robots block or indexation defect.
GSC, GA4 and SE Ranking measurements were not queried for this implementation.
Do not carry forward the earlier conversational "35 AI impressions" or conflicting
price snippets as a measured baseline for this change.

## Existing implementation reviewed

| Source | Observation | Interpretation |
| --- | --- | --- |
| `AGENTS.md` | Inspect current main, preserve existing work, minimal changes, protected systems and explicit merge permission. | This policy supplements, not replaces, these boundaries. |
| `src/lib/seo-foundation.test.ts` | Source-text assertions for canonical/language mappings, service pages, registered blog content, sitemap and links. First test also fixes root HTML to literal `lang="en"` while prohibiting global dynamic language handling. | Useful regression checks, not proof of production output or correct Spanish document language. Preserve static-delivery guardrails; review the literal lang assertion with the eventual language fix. |
| `e2e/smoke/public-pages.spec.ts` | Existing browser and raw-response assertions include metadata, JSON-LD, sitemap, EN-only blog behavior and content/service links. | There is already runtime SEO coverage. Do not create a parallel framework or claim runtime tests were absent. |
| `playwright.config.ts` | Builds/starts localhost on port 3100; blocks production; uses Chromium and one worker. | Reuse it unchanged. Production HTML diagnostics need a separate read-only entry point, not permission to run account smoke flows live. |
| `.github/workflows/e2e-smoke.yml` | Existing dependency install, Chromium install and E2E command; failure-only artifacts. | Add only small SEO-report uploads on success/failure. Keep existing jobs and permissions. |
| `src/lib/localized-routes.ts` | Real EN/ES pairs; login/signup and dynamic gallery detail exclusions. | No generated country pages or invented ES blog variants. |
| `e2e/smoke/public-pages.spec.ts` (blog tests) | Both cost guide and `what-is-virtual-staging` explainer are already represented. | V1 samples existing articles instead of proposing their recreation. |

Source permalinks use the base commit above, for example:
https://github.com/MykhailoLy/real-estate-visual-studio/blob/5e2d12e8d49c7170a528b09784b09b9d22737c87/src/lib/seo-foundation.test.ts
https://github.com/MykhailoLy/real-estate-visual-studio/blob/5e2d12e8d49c7170a528b09784b09b9d22737c87/e2e/smoke/public-pages.spec.ts

## Initial backlog — not automatic fixes

**Primary: establish a completed HTML baseline.** Run the new bounded audit against
the local build, then explicitly against production after review. Record timestamp,
coverage and report, not only the exit code. Investigate any P0 before content work.

**Language consistency, P2 / production unverified.** Root source/test expects en;
check each sampled ES response. This is not evidence that Google misidentifies the
page language. A later fix must preserve static/CDN delivery, EN/ES navigation,
metadata and the dashboard-only proxy. Do not introduce `headers()` globally or a
client-only language hack to make a test appear green.

**Commercial content / factual consistency, pending evidence.** Compare visible
service, article and schema facts with the current authoritative price/offer
implementation. No finding of conflicting production prices is made here. Do not
modify pricing calculations, checkout or terms in this control-system patch.

**Broader coverage, deferred.** Full-site link graph/orphans, all service URLs,
robots bot-group semantics, genuine crawler/CDN access, schema semantics, field CWV,
GSC indexing and AI visibility are outside this 15-page sample. Use connected data
and existing audits first; add a tool only for a demonstrated uncovered requirement.

## V1 boundaries and acceptance

No application page, metadata builder, route, price, image, style, account, API,
Supabase object, environment secret or production configuration is changed.
No content is published, no merge is authorized, and no scheduled crawl is enabled.

Existing source tests are not replaced. Focused Node tests cover the new audit's
rules and safe request boundaries. The existing E2E suite runs those tests and the
new bounded HTML contract after its build. P1-P3 findings remain visible rather
than being hidden to force a clean score. Setup/network/coverage failures are
reported as incomplete, not as an SEO pass.

Preparation validation and later GitHub CI results belong in the PR report. Do not
mark the production baseline complete until a production report actually exists.
