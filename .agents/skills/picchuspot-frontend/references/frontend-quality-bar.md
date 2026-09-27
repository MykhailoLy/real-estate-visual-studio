# Frontend quality bar

Use this reference for non-trivial PicchuSpot UI implementation or review.

## Visual hierarchy

Prefer:

- strong property imagery;
- clear editorial hierarchy;
- deliberate whitespace;
- restrained containers and borders;
- current PicchuSpot theme tokens;
- consistent typography and spacing with adjacent sections.

Avoid:

- interchangeable SaaS cards;
- decorative gradients;
- unnecessary badges/pills;
- novelty animation;
- a second visual language inside one page.

## Responsive review

Check the relevant subset of:

- 360 px
- 390 px
- 768 px
- 1024 px
- 1440 px

Look for:

- horizontal overflow;
- clipped content;
- accidental overlap;
- unstable media aspect ratios;
- unexpected wrapping;
- overly stretched desktop content;
- fixed/sticky controls obscuring content.

## Interaction/state

Prefer one source of truth and explicit reachable states.

Check loading, empty, error, disabled, success, and retry states only where the feature can actually reach them.

Do not add optimistic behavior that can corrupt an order or customer action.

## Performance

Prioritize user-visible impact:

- remove avoidable async waterfalls;
- reduce unnecessary hydration/client JavaScript;
- avoid oversized client props;
- use appropriate preview media;
- keep layout stable;
- lazy-load heavy below-the-fold interaction where justified;
- avoid dependency additions for trivial behavior.

Do not perform speculative micro-optimizations that make maintenance harder.

## Public copy and localization

For public UI:

- use natural professional English;
- follow the existing Spanish localization architecture;
- keep copy concise and concrete;
- do not invent prices, service availability, turnaround, guarantees, statistics, reviews, or outcomes;
- preserve approved pricing unless the task explicitly changes it.
