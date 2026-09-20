# PicchuSpot SEO / GEO policy

Version 1. Reviewed 2026-09-20. Owner: PicchuSpot.

Read this document before changing public routes, metadata, sitemap, robots controls,
structured data, service copy, blog content or SEO checks. This is an acceptance
standard, not permission to modify application behavior or production services.
Root `AGENTS.md` still governs permissions, safety and sources of business truth.

## Goal and scope

Optimize for relevant organic visitors, qualified enquiries and paid orders, not a
composite SEO/GEO score. Prioritize US, then Canada, UK and Australia. Use shared
international English service pages unless observed intent and SERPs justify a
separate country page. Keep Alicante / Costa Blanca local SEO separate. Spanish
routes are real language variants, not an instruction to manufacture translations.

A money page sells a service. Supporting articles explain decisions and link to the
appropriate service. A cost guide and service price section may coexist when their
roles differ; overlapping words alone do not establish cannibalization. Review
actual queries, SERPs and the page receiving traffic before merging or rewriting.

## Evidence before action

Every finding must state: URL; observation; source and time; priority; confidence;
expected business effect; smallest proposed change; risk; and validation.

Distinguish observed facts, inferences, hypotheses and recommendations. A source
check, local build, preview and production fetch are different evidence. A 200
response does not establish indexation. A tool-access failure is not proof the site
is down or Google is blocked. Missing data is unknown, never zero.

Production-compatible business facts and authoritative implementation remain the
source for prices, currencies, discounts, turnaround, revisions and legal terms.
Do not replace them from memory, a search snippet or this document. Inspect any
conflict and obtain approval before touching protected systems.

## Priority and gates

| Priority | Definition | Examples / response |
| --- | --- | --- |
| P0 | Confirmed technical regression threatening crawl/index eligibility or intended canonical identity | New noindex on a public money page; wrong canonical; intended canonical route returning 404. Block the deterministic local contract; diagnose before fixing. |
| P1 | Material commercial/ranking or buyer-decision problem | Missing relevant service coverage; broken money-page link; misleading offer; incorrect hreflang pairing. Review evidence before escalation. |
| P2 | Meaningful opportunity or technical improvement | Image/HTML weight; missing sitemap entry; isolated HTML-language mismatch; schema defect without an indexation consequence. |
| P3 | Cosmetic / low-impact warning | Heading convention or snippet-length warning without demonstrated user/search impact. |

Business priority and CI enforcement are not the same thing. V1 blocks only its
P0 HTML contract findings; P1-P3 remain visible in reports. Coverage/tooling errors
fail separately rather than passing an incomplete audit. No automatic baselining
of all warnings and no global suppression. Any future exception needs a specific
rule + URL, evidence, owner, review date and expiry; never hide accidental noindex.

These are project operational priorities, not Google's severity labels.

## Public-page acceptance

- Intended canonical marketing pages: successful HTML response; correct canonical
  identity; no unintended robots meta or X-Robots-Tag exclusion. Inspect HTTP Link
  canonicals and genuine crawler access separately; do not impersonate Googlebot
  and assume its infrastructure can reach the page.
- Sitemap: use existing published route/article registries; exclude drafts,
  redirect-only, authenticated and admin routes. A sitemap omission is not proof
  of non-indexation. Preserve canonical URL and language mappings.
- English/Spanish: correct self-canonical and reciprocal links only to existing
  variants. Do not fabricate `/es/blog/**`. Expect English `lang` on English pages
  and Spanish `lang` on Spanish pages. Preserve static rendering/CDN delivery; do
  not add global `headers()`, cookies or broaden the proxy merely to change lang.
- Titles, descriptions and headings: accurately describe the page and intent.
  Do not force arbitrary word counts, keyword density or character limits as
  ranking guarantees. Multiple H1s require review, not automatic P0 classification.
- Structured data: truthful, valid and consistent with visible facts. Reuse the
  existing builders. JSON parsing alone is not schema.org validation or proof of
  eligibility. Never invent reviews, ratings, author credentials or statistics.
- Internal links: meaningful crawlable links; supporting content points to the
  correct service. A contextual service-to-guide link is useful when it helps the
  decision, not mandatory merely to move a score. Distinguish redirects from 404s.
- Media/performance: original before/after examples, appropriate alt text and
  responsive media. Lab scores are not field Core Web Vitals. Do not enlarge pages
  or destabilize caching for speculative SEO gains.

Google explicitly says it determines page language from visible content, not the
HTML `lang` attribute [2]. Correct lang still matters for accessibility [5]. Thus
an isolated ES lang mismatch is not evidence of ranking loss. Escalate only when
other evidence demonstrates a more serious localization problem.

## GEO / AI search

Google's guidance requires the usual search eligibility and useful content; special
AI schema or a new AI text file is not required [1]. Do not treat llms.txt, more FAQs,
forced chunk lengths or a third-party GEO score as acceptance criteria.

For PicchuSpot, review concrete service facts, real examples, scope/limitations,
authorship, transparent comparisons and relevant independent references. Do not
invent sales results, recommendations, testimonials or synthetic third-party
endorsements. Manual review checks factual consistency; automation cannot establish
expertise, search intent or whether an AI system will recommend the business.

OpenAI distinguishes OAI-SearchBot for search from GPTBot for training [3]. Do not
change a training permission as a side effect of search optimization. Review
robots groups and CDN rules together, preserving protected-path restrictions.
No automatic robots/CDN/hosting changes.

## Existing controls and the v1 audit

Reuse `npm run test:seo`, the current Node test runner, and the existing Playwright
smoke build/configuration. Do not add a second test framework or another SEO SaaS.
See `BASELINE.md` for the inspected source state and limitations.

`scripts/seo-audit.mjs` samples 15 explicit public EN/ES/service/blog routes plus
robots.txt and sitemap.xml. It fetches initial server HTML and parses it in an
inert Chromium document, without running site JS. Existing Playwright tests still
cover hydrated UI behavior. The CLI is not a full discovery crawler.

Safety: only loopback origins by default; production needs an explicit flag; only
17 allowlisted GET requests; redirects never followed; no credentials, forms,
JS, assets, third-party requests or private/API routes. Production requests are
sequential with a one-second pause. Each response has a ten-second timeout and a
2 MiB body limit. No GSC, database, payment or account writes.

Outputs: `seo-audit.json` and `seo-audit.md`, with UTC time, target, fetched scope,
findings and unknowns. Exit 0 = completed report (not "perfect SEO"); exit 1 = P0
findings when `--gate` is supplied; exit 2 = incomplete/tooling/usage error. The
existing E2E job publishes the small reports even when the test fails.

### Commands

Use the repository's existing dependency lock and installed Chromium. On Windows,
use `npm.cmd` / `npx.cmd` where PowerShell execution policy requires it.

```sh
# No network or browser needed for these rule/safety tests.
node --test scripts/seo-audit.test.mjs

# Existing test framework starts its local production build.
npm run e2e:smoke -- e2e/smoke/seo-audit.spec.ts

# An already-running local build; fail on deterministic P0 regressions.
node scripts/seo-audit.mjs --base-url http://127.0.0.1:3100 --gate

# Explicit, read-only production sample; no production Playwright smoke flows.
node scripts/seo-audit.mjs --base-url https://picchuspot.com --production
```

Do not point the existing smoke suite at production or weaken its production
protection. Production output is report-only unless an operator explicitly adds
`--gate`. Nothing here deploys, merges or schedules a recurring run.

Full graph/orphan/asset checks remain in SE Ranking Website Audit. SiteOne Crawler
is a candidate for a later bounded full crawl if it closes a demonstrated gap;
review/pin its version and safe configuration then. Do not install SiteOne and
Unlighthouse merely to duplicate existing checks.

## Measurement and improvement loop

Before an improvement, record a baseline for the affected page/cluster, country,
date window and branded/non-branded segment. Preserve raw evidence privately.

GSC supplies observed search data and URL inspection. SE Ranking supplies estimated
keyword/competitor metrics and sampled SERPs/AI tracking. GA4 supplies configured
session/conversion measurements; verify what is actually instrumented. Do not
replace GSC with SE Ranking estimates when GSC is available.

As documented in the checked Google AI-features guide, AI-feature traffic is included
in Search Console Web performance [1]. Do not invent a separate API metric or UI
setting. An available dedicated account report needs its own verified definition,
period and export. Third-party AI prompt checks are samples, not total impressions;
brand mentions, source citations, referrals and conversions are different metrics.

For a small AI panel, record engine/interface, prompt, country/language, date,
search mode, exact answer/source URLs, brand mention, citation and factual errors.
Separate neutral commercial prompts from branded diagnostic prompts. Repeat a
fixed panel rather than interpreting one answer as a ranking. API responses need
not reproduce the consumer interface. No automated visibility promises.

The review loop is: baseline -> one prioritized hypothesis -> smallest approved
patch -> focused tests/build -> explicit merge approval -> measured outcome.
Review technical delivery immediately after release and business trends over
comparable windows (initially 28 days; extend when volumes are small). A 4-8 week
review is a planning checkpoint, not a guaranteed SEO response time or causal proof.

A useful experiment record contains: page/cluster; evidence; user question; proposed
change; expected effect; business metric; guardrail; review date; outcome; and next
decision. Prioritize commercial-page coverage above cosmetic audit warnings.

## Sources and review

Primary references checked 2026-09-20. Recheck when changing the policy; external
README checklists are discovery aids, not authorities on search ranking.

1. Google, AI features and your website: https://developers.google.com/search/docs/appearance/ai-features
2. Google, Managing multi-regional and multilingual sites: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
3. OpenAI, Overview of OpenAI crawlers: https://developers.openai.com/api/docs/bots
4. Google, Robots meta tag and X-Robots-Tag specifications: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
5. W3C, Understanding Language of Page: https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html
