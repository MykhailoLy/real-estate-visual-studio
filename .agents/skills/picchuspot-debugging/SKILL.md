---
name: picchuspot-debugging
description: Diagnose PicchuSpot bugs, failing tests, CI failures, runtime errors, regressions, and inconsistent behavior. Use when something is broken or a check fails. Establish the root cause from evidence before changing production code; distinguish regressions, stale tests, environment/tooling failures, and pre-existing failures.
---

# PicchuSpot Debugging

Use the root `AGENTS.md` for permissions, critical-system preflight, repository workflow, and sources of truth.

## Core rule

Do not guess-fix.

A failing assertion, CI job, error message, or visual symptom is evidence of a problem, not proof of its cause.

## Workflow

### 1. Capture the exact failure

Record:

- user-visible symptom or failed job;
- exact command/test/route involved;
- relevant error/log/stack trace;
- affected environment;
- recent change or commit when known.

Read the complete relevant failure output before proposing a fix.

### 2. Reproduce as narrowly as practical

Prefer the cheapest reliable reproduction:

- one focused test;
- one route/request;
- one component interaction;
- one build/typecheck step;
- or one bounded production-safe read.

Do not broaden scope until the narrow reproduction is understood.

### 3. Classify the failure

Explicitly distinguish:

- regression introduced by current code;
- stale or incorrect test;
- environment/tooling/dependency problem;
- pre-existing failure;
- production/data compatibility issue;
- unknown — evidence still insufficient.

Never change production code merely to satisfy a stale assertion.

### 4. Investigate root cause

- Inspect the failing code path and its inputs.
- Check recent relevant commits/diff.
- Find a working analogue in the repository.
- Compare current implementation, tests, configuration, and installed framework behavior.
- For Next.js uncertainty, read the installed docs under `node_modules/next/dist/docs/`.
- For Supabase, Stripe, or Vercel scope, use the relevant specialized skill/tool and current vendor behavior.

For protected systems, perform the `AGENTS.md` critical-systems preflight before modifying anything.

### 5. Form one falsifiable hypothesis

State the most likely cause and the cheapest test that could disprove it.

Change one meaningful variable at a time during diagnosis. Do not stack speculative fixes.

### 6. Fix the cause

Prefer the smallest change that resolves the verified root cause and preserves compatibility.

Do not:

- weaken unrelated security checks;
- bypass auth;
- suppress type/lint/build errors;
- broaden APIs or schema for convenience;
- refactor adjacent code while debugging;
- introduce fallback behavior that hides a real failure.

### 7. Verify

Run the reproduction again first.

Then use `picchuspot-change-verification` for the proportionate broader checks.

When a UI symptom is involved, use `picchuspot-ui-qa` for rendered behavior.

## CI-specific rules

When CI fails:

1. Read the actual failed job log.
2. Identify the exact failing command/test/step.
3. Reproduce that failure locally when practical.
4. Determine whether CI exposed a regression, stale test, environment/tooling issue, or prior failure.
5. Fix the cause rather than the status indicator.
6. Re-run the focused failing step before broader checks.

## Completion report

State:

- symptom;
- root cause and supporting evidence;
- classification;
- exact change;
- focused reproduction result;
- broader validation result;
- remaining uncertainty or production-only limitation.

If root cause is not established, say so and report the strongest evidence instead of claiming resolution.
