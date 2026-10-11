# PicchuSpot repo-local Agent Skills

These skills add repeatable task workflows for Codex and compatible Agent Skills tooling.

Repository-wide policy remains in the root `AGENTS.md`. A skill does not grant permission to branch, commit, push, merge, deploy, mutate production data, run migrations, or change protected systems. When a skill conflicts with current repository implementation, tests, project policy, or production-compatible behavior, follow the repository sources of truth in `AGENTS.md`.

## Skills

| Skill | Use when |
| --- | --- |
| `picchuspot-frontend` | Implementing or reviewing React / Next.js / Tailwind UI |
| `picchuspot-debugging` | Diagnosing bugs, CI/test failures, runtime errors, regressions |
| `picchuspot-ui-qa` | Verifying rendered UI, responsive behavior, interactions, accessibility |
| `picchuspot-change-verification` | Choosing and running proportionate checks before declaring a code change complete |
| `picchuspot-seo-commercial-audit` | SEO/GEO research, GSC/SE Ranking analysis, commercial content-gap and cannibalization work |
| [`stop-slop`](stop-slop/SKILL.md) | Reviewing English-language user-facing prose; preserving natural voice and claims |

## Deliberate exclusions

Do not duplicate generic Supabase, Stripe, Vercel, or framework documentation here. Use the relevant specialized skill/tool and current vendor documentation when those systems are in scope.

Do not add Storybook, Chromatic, Percy, another test framework, another SEO SaaS, or another crawler merely because a generic skill recommends it. The current repository architecture and existing tooling come first.

## Maintenance

Keep each skill narrow. Put routing-critical instructions in `SKILL.md`; use `references/` only for supporting detail. Prefer updating an existing skill over adding an overlapping one.
