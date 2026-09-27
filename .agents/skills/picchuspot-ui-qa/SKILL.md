---
name: picchuspot-ui-qa
description: Verify PicchuSpot rendered UI after a frontend change or during visual review. Use for responsive layout, browser interactions, console/runtime errors, keyboard/focus behavior, accessibility checks, design-reference comparison, and regression QA. This is a verification workflow, not the primary implementation workflow.
---

# PicchuSpot UI QA

Use the root `AGENTS.md` for repository policy and the current implementation as the source of truth.

Use the existing Playwright/browser setup where practical. Do not create a second browser-test framework.

## Objective

Verify what the user actually sees and can do, not just what source code appears to imply.

## Scope first

Before testing:

1. Identify the changed route/component and intended behavior.
2. Identify affected English/Spanish variants.
3. Identify whether authenticated state is required.
4. Identify the minimum critical journey.
5. Use a local/preview environment by default.

Do not point protected account/order smoke flows at production unless explicitly authorized and safe.

## Browser checks

For the affected surface, check the relevant subset:

- page loads without runtime/hydration errors;
- no unexpected console errors;
- critical network requests succeed when in scope;
- navigation/CTA/form interaction works;
- loading, error, empty, and disabled states work when reachable;
- keyboard navigation and activation work;
- focus is visible and logical;
- modal/dropdown focus does not become trapped incorrectly;
- interactive elements have accessible names;
- no important state is communicated by color alone.

## Responsive checks

Verify the relevant widths from project policy:

- 360 px
- 390 px
- 768 px
- 1024 px
- 1440 px

Check:

- horizontal overflow;
- clipping;
- overlapping controls;
- unexpected wrapping;
- touch target usability;
- sticky/fixed elements obscuring content;
- media aspect-ratio stability;
- layout shifts;
- overly stretched desktop composition.

When public localized copy is affected, test long English and Spanish text where applicable.

## PicchuSpot media checks

For primary client Original / Delivered views:

- preserve the full image;
- maintain equal visual weight;
- do not introduce unintended `cover` cropping;
- avoid layout shift;
- verify appropriate preview/responsive media behavior.

## Visual comparison

If a reference screenshot/design exists, compare:

- hierarchy;
- spacing;
- alignment;
- typography;
- component dimensions;
- responsive intent;
- interaction states.

Do not create Storybook/Chromatic/Percy infrastructure merely to compare one change. Screenshots and existing Playwright evidence are sufficient unless the repository adopts a broader system deliberately.

## Reporting

Report only material findings.

For each issue include:

- route/state/viewport;
- observed behavior;
- expected behavior;
- severity: Blocker / Major / Minor;
- reproducible steps;
- likely code area when known.

Do not modify production code during a read-only audit unless the task explicitly includes fixing the findings.
