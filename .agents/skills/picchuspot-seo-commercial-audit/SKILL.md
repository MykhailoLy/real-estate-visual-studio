---
name: picchuspot-seo-commercial-audit
description: Research and audit PicchuSpot SEO/GEO with a commercial objective. Use for Google Search Console or SE Ranking analysis, money-page audits, ranking/CTR/indexing questions, cannibalization, competitor SERP research, AI-search visibility, and identifying the highest-value content or page-level gap. Do not use as authorization to implement SEO fixes.
---

# PicchuSpot SEO Commercial Audit

Before work, read:

- `docs/seo/SEO-GEO-POLICY.md`
- `docs/seo/BASELINE.md`
- root `AGENTS.md`

Those files override generic SEO checklists.

## Objective

Improve relevant organic traffic, qualified enquiries, and paid orders — not a composite SEO score.

Default market priority:

1. US
2. Canada
3. UK
4. Australia

Treat Alicante / Costa Blanca local SEO as a separate market and intent.

## Evidence hierarchy

Prefer:

1. current production page/behavior when relevant;
2. GSC observed performance/index evidence;
3. current repository implementation and tests for technical behavior;
4. SE Ranking / SERP / competitor estimates;
5. third-party checklists and generic SEO heuristics.

Missing data is unknown, not zero.

Do not infer indexation from an HTTP 200 alone.

## Commercial audit workflow

### 1. Define the decision

Identify:

- target URL/page cluster;
- target market;
- buyer/search intent;
- business action the page should drive;
- comparison period when performance data is involved.

Do not begin with a generic 40-item checklist unless the user explicitly requests a full-site audit.

### 2. Gather live evidence

When available, use:

- GSC page/query/country/device/search-appearance data;
- current production content and rendered page;
- SE Ranking keyword/SERP/competitor data;
- current repository/tests for technical questions;
- current Google/OpenAI documentation for changing search/AI-search behavior.

Record source and time period.

### 3. Separate problem types

Distinguish:

- crawl/index eligibility;
- canonical/localization/schema/technical issue;
- ranking/relevance issue;
- CTR/snippet issue;
- commercial decision/content gap;
- cannibalization;
- conversion/UX issue that SEO alone will not solve;
- AI-search/GEO observation.

Do not treat a cosmetic audit warning as a commercial priority.

### 4. Analyze intent and cannibalization

For overlapping pages:

- inspect actual queries and landing pages;
- compare intent and funnel role;
- inspect current SERPs when useful;
- distinguish complementary pages from true competition.

Keyword overlap alone is not proof of cannibalization.

### 5. Find the highest-value gap

Unless the user asks for a comprehensive backlog, recommend one primary P1 gap.

Evaluate:

- expected business effect;
- evidence strength;
- confidence;
- implementation effort;
- regression/SEO risk;
- reversibility;
- measurement path.

Prefer the smallest change that can answer the commercial hypothesis.

### 6. GEO / AI-search discipline

Do not treat llms.txt, arbitrary FAQ volume, special AI schema, or a third-party GEO score as a ranking requirement.

Separate:

- brand mention;
- citation/source inclusion;
- referral;
- AI-interface visibility;
- organic click;
- conversion.

A small prompt sample is diagnostic evidence, not total visibility.

### 7. No automatic implementation

An audit finding is not authorization to:

- publish content;
- change pricing;
- alter robots/CDN/hosting;
- modify schema/data;
- merge/deploy;
- change protected systems.

Implementation remains a separate scoped task.

## Output

Lead with one decision-oriented conclusion.

For material findings, include the evidence fields in `references/evidence-framework.md`.

Separate:

- facts;
- inference;
- hypothesis;
- recommendation.

Use confidence labels only when uncertainty is material.

Do not invent traffic, rankings, conversion lift, prices, reviews, turnaround, service availability, or causality.
