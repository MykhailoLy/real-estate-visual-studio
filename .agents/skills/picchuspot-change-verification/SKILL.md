---
name: picchuspot-change-verification
description: Select and run proportionate validation for a PicchuSpot code change before it is reported complete or proposed for merge. Use after implementation, when reviewing a PR's verification coverage, or when deciding which focused tests, typecheck, lint, build, and Playwright checks are relevant.
---

# PicchuSpot Change Verification

Use the root `AGENTS.md` as the authority for validation policy.

This skill turns that policy into a repeatable verification workflow.

## Rule

Validation must match the change's blast radius.

Do not run everything as ceremony, and do not claim completion from one narrow test when shared or critical behavior changed.

## Workflow

### 1. Inspect the actual diff

Identify:

- changed files;
- user-visible behavior;
- shared modules;
- routes/server-client boundaries;
- critical/protected systems touched;
- config/dependency/schema changes;
- tests already changed or present.

Check the final diff for accidental files before declaring completion.

### 2. Choose the smallest focused checks

Use current `package.json` as the command source of truth.

Read `references/validation-map.md` as navigation, not as a substitute for checking current scripts.

Start with the most specific existing test(s) that exercise the changed behavior.

Do not add a test that only repeats implementation details to satisfy process.

### 3. Add cross-cutting checks when justified

Run typecheck/lint/build based on impact:

- TypeScript/interface/server-client changes: relevant typecheck.
- Lint-sensitive React/Next.js changes: lint when useful.
- Routing, rendering, server/client boundary, config, metadata, or production-output changes: production build.
- User-flow changes: relevant Playwright smoke when practical.
- Shared/critical-system changes: broader regression suite and, when justified, `test:ci`.

Do not use `test:ci` by default for a tiny isolated presentation change.

### 4. Handle failures correctly

If a check fails:

- record the exact command and failure;
- determine whether it is a regression, stale test, environment/tooling issue, or pre-existing failure;
- use `picchuspot-debugging` if root cause is not obvious;
- do not weaken unrelated checks to turn CI green.

### 5. Completion gate

Before reporting completion, verify:

- requested behavior is covered by actual evidence;
- relevant focused checks passed;
- broader checks required by blast radius passed or are explicitly not run;
- final diff contains only intended files;
- no unverified claim of push/merge/deploy/migration is made.

## Report format

Keep it concise:

- focused checks: command → result;
- broader checks: command → result;
- not run: check → reason;
- pre-existing/stale/environment failures: clearly separated;
- final diff scope;
- residual risk.
