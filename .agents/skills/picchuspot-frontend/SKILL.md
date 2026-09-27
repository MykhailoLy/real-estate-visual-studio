---
name: picchuspot-frontend
description: Implement or review PicchuSpot frontend UI in the existing Next.js App Router codebase. Use for React components or pages, Tailwind layout/styling, responsive behavior, client interactions, accessibility, rendering, or frontend performance. Do not use as the primary workflow for bug diagnosis, browser-only QA, or SEO research.
---

# PicchuSpot Frontend

Use the root `AGENTS.md` as the authority for repository policy, protected systems, Git workflow, validation, brand, media, and sources of truth.

This skill adds frontend-specific implementation judgment.

## Objective

Deliver the smallest production-safe frontend change that solves the current problem while preserving existing behavior, responsive layout, accessibility, locale behavior, performance, and PicchuSpot's visual system.

## Workflow

1. Read the applicable `AGENTS.md` files.
2. Find the existing page, component, data shape, styling pattern, and relevant tests before designing anything new.
3. For Next.js behavior, read the relevant documentation under `node_modules/next/dist/docs/` for the installed version before relying on remembered framework behavior.
4. Inspect current rendered behavior when visual compatibility matters.
5. Prefer a local extension of the existing implementation over new architecture.
6. Reuse existing components, theme tokens, interaction patterns, and capability/data-shape logic.
7. Implement the minimum reliable change.
8. Hand off validation to `picchuspot-change-verification`; use `picchuspot-ui-qa` when rendered UI behavior matters.

## React and Next.js rules

- Keep Server Components as the default.
- Add or widen a Client Component boundary only when browser APIs, interactive state, effects, or event handlers require it.
- Prefer a small client child over moving an entire page/subtree to the client.
- Keep state minimal. Derive values during render where practical.
- Do not mirror props into state without a concrete synchronization requirement.
- Do not use effects for work that belongs in render or an event handler.
- Prevent avoidable request waterfalls; parallelize independent async work.
- Minimize data serialized into Client Components.
- Lazy-load genuinely heavy or below-the-fold interactive modules when it reduces initial client cost.
- Do not add memoization, caching, or dynamic imports mechanically. Use them when the cost/benefit is concrete.
- Avoid large new dependencies for small UI behavior.

## Component and abstraction rules

Create a new component only when at least one current benefit is clear:

- real reuse exists now;
- it isolates meaningful interaction/rendering logic;
- it materially improves readability;
- or the existing architecture expects that boundary.

Do not extract a component merely to make a file shorter.

Default to no new hook, provider, factory, service layer, configuration system, generalized component API, or universal wrapper. Introduce one only when multiple concrete current call sites or a genuine architectural need justify it.

Small explicit duplication is preferable to a complicated abstraction.

## Styling and visual direction

- Read current theme tokens from `src/app/globals.css`; never restore historical HEX values from memory or old discussions.
- Reuse the current design system and adjacent section patterns.
- Preserve the premium real-estate media / editorial direction.
- Avoid generic SaaS styling: repetitive card grids, excessive pills, decorative gradients, arbitrary shadows, and motion without a communication purpose.
- Use motion only to communicate state, hierarchy, or interaction; respect reduced-motion preferences.

## Responsive and media behavior

- Build for content constraints, not a single screenshot.
- Preserve mobile and desktop behavior.
- Check long English and Spanish copy, wrapping, touch targets, and overflow.
- Primary client Original / Delivered imagery must remain uncropped and have equal visual weight.
- Use appropriate responsive media sizes; do not add blanket `priority` or preload.
- Do not load full-resolution media when an appropriate preview exists.

## Accessibility

Prefer semantic HTML first.

Preserve:

- logical headings;
- native buttons, links, inputs, and labels;
- visible keyboard focus;
- keyboard-operable interactions;
- accessible names and error/help relationships;
- non-color-only state communication;
- reduced-motion support where motion is nonessential.

Use ARIA to supplement semantics, not replace them.

## Dependencies and tooling

Default to no new dependency.

Do not introduce Storybook, Chromatic, Percy, a new design system, a second test framework, or new visual-regression infrastructure unless explicitly requested or already adopted by the repository.

For a detailed review checklist, read `references/frontend-quality-bar.md`.
