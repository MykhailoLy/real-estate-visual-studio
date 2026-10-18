# Public service discovery and first-order UX

Research and implementation date: 18 October 2026.
Starting main: `e2edfd70d5c94c9a031cd7752a0ada19c38bee02`.

## Goal

Help a new property photographer or agent understand the result, choose the right
service, and know how to place an order. Preserve PicchuSpot's existing brand,
real portfolio media, canonical EN/ES routes, pricing and authenticated ordering.
These are usability hypotheses; no conversion uplift or ranking gain is claimed.

## Evidence and decisions

The current public homepage, market/language popup and Virtual Staging page were
captured and inspected in the cloud browser. Current repository sources and the
SEO policy were read before implementation. No overlapping open PR was found.

| Observation | Smallest useful change | Reason / limit |
| --- | --- | --- |
| Homepage comparison precedes the offer, with no immediate discovery/first-order action | Move the existing H1 and a shorter introduction before the comparison; add service and first-order anchors | Make the next step visible while keeping the existing media system |
| Ten service cards require sequential browsing | Reuse the existing pricing registry's three service groups and plain jump links | Match the pricing catalogue without another service taxonomy |
| Item Removal card points to Photo Editing despite its dedicated page | Point the card to its existing canonical landing page in both locales | Confirmed destination mismatch, not a speculative ranking diagnosis |
| Language sits inside a combined market/currency popup and is hidden behind the mobile menu | Expose English/Español separately; retain independent market selection | Language follows the actual public URL; shared dashboard preference behavior is preserved |
| Main service summaries and actions follow the hero and use cases | Move the same H1, description, price and order action above the comparison | Preserve content and URLs while reducing the path to a buyer decision |
| Long service pages lack section shortcuts | Add ordinary anchors for examples, styles where available, upload requirements, pricing and FAQ | Server-rendered links, no scroll-observer JavaScript or new routes |
| Virtual Staging example cards are static comparisons | Reuse the existing portfolio lightbox and image stage | Allow full-size, uncropped detail inspection instead of adding a second viewer |
| Public menu claims to be modal but has no focus containment/restoration | Add initial focus, Tab containment, background inertness and focus restoration | Keyboard behavior should match the existing modal semantics |
| `Testimonials.tsx` explicitly labels three hardcoded quotes as placeholders | Remove the section from EN/ES homepages | Publish only confirmed client wording; no substitute testimonials invented |

## Selected references

All links were read on 18 October 2026. The implementations below are first-party
product examples, not evidence of their conversion rates, rankings or revenue.
Competitor text and imagery are not copied into PicchuSpot.

| Reference | Verified useful pattern | Application / boundary |
| --- | --- | --- |
| [Apply Design](https://www.applydesign.io/) | A visible offer and action, before/after results, task-based capability examples and a step-by-step explanation | Keep real PicchuSpot comparisons near the offer; do not borrow DIY AI promises, speed claims or the furniture catalogue |
| [PhotoUp staging](https://www.photoup.net/ai-virtual-staging) | Service-local links to examples, styles, price and ordering | Add concise section navigation to existing service pages; do not introduce subscriptions/credits terminology |
| [Styldod staging](https://www.styldod.com/virtual-staging) | Comparison examples, use cases, styles and an explicit order process on the service page | Retain useful buying information and visual evidence; do not reproduce their repetitive sections or sales-effect statistics |
| [Giraffe360 Spanish experience](https://giraffe360.com/es/home-eu) | A localized Spanish experience and separate country/language choices | Use explicit language names and corresponding page destinations; shipping-country complexity is not needed here |
| [PhotoUp first-order help](https://support.photoup.net/en/articles/4397740-how-do-i-order-ai-virtual-staging) | A concrete ordering question answered with exact actions and an embedded tutorial | Prefer a task-specific recording with a text equivalent over an autoplay promotional video |

## Tutorial decision and recording brief

The first implementation ships a useful, accessible text guide on the existing
homepage rather than a fake video placeholder or an inaccurate recording.
The guide reflects the current flow: choose a service, sign in/create an account,
complete the required name, add inputs/instructions, review and confirm, then
complete payment when requested. Order status and delivery remain in the account.

A later recording should use a dedicated test account and a non-production order:

1. 0–10 seconds: open one service and compare an original/delivered example.
2. 10–20 seconds: choose the service and enter the account/order form.
3. 20–45 seconds: add one approved sample photo, select options and instructions.
4. 45–65 seconds: review the exact files, selections and total; show confirmation
   without a real charge or production order.
5. 65–80 seconds: show where the client tracks the order and finds delivery.

Capture the real interface after this UX change is accepted. Publish only on
explicit playback with a poster, EN/ES captions and the same text steps nearby.
Do not put a heavy autoplay video in the first screen. No authenticated recording,
new account, real upload, payment or production order was performed in this task.

## SEO and product boundaries

- Existing titles, canonical identities, hreflang, structured data and published
  article/service roles remain. The change creates no indexable landing-page clones.
- The corrected service card and section links help users reach existing content;
  they do not establish a measured ranking effect.
- Public order actions retain the authenticated portal destinations. Pricing,
  payment, upload, Auth/API, Supabase data and production configuration are untouched.
- Portfolio publication/location controls and image loaders remain authoritative.
- Query-to-URL relevance, search intent performance and conversion outcomes require
  actual GSC/analytics data; competitor page structure cannot substitute for them.

## Verification

Focused homepage, SEO, brand and legal-copy checks pass. TypeScript and a production
build validate compilation and server/client boundaries. The existing navigation
smoke suite now covers public language/currency independence, page pairing,
responsive access, category navigation and keyboard focus. Additional smoke cases
exercise first-order anchors and service-section targets below the sticky header.

Success screenshots are emitted by the existing smoke runner and retained as the
`public-discovery-review` CI artifact for review. This is screenshot evidence from
the local fixture build, not a production-media or authenticated-order test.
The cloud browser could inspect production/reference pages but could not reach
the local dev server; do not report a local cloud-browser visual pass from that.

Before merging, inspect the generated screenshots at mobile and desktop sizes and
check the final CI result. After release, compare qualified service visits,
service-to-order starts and completed orders over comparable periods; extend the
window when traffic is sparse. Do not attribute every subsequent SEO change to
this UX patch.
