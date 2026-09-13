# Blog editorial hub design QA

## Evidence

- Source visual truth: `C:\Users\Virtual Staging\.codex\generated_images\01a09a57-8c91-7541-9807-31f0a1767f17\exec-707a65c9-3a4c-48c4-9aac-e4c0aa47095c.png`
- Implementation URL: `http://localhost:3000/blog`
- Implementation screenshot path: Codex in-app browser capture attached to this task; the browser tool did not expose a filesystem path.
- Viewport: 1440 × 1024 CSS px, device pixel ratio 1.
- Source pixels: 1488 × 1058, rendered at the matching 1440 × 1024 aspect ratio.
- Implementation pixels: 1440 × 1024 browser capture.
- State: English public blog, guest header state, one published article.
- Same-input comparison: the corrected reference and rendered implementation were emitted together in one browser QA result.
- Focused evidence: the article visual and caption were captured in place under “AI virtual staging versus professional virtual staging”; 360 px DOM measurements confirmed the image and CTA remain inside the content width.
- Primary interactions checked: article title link, “Read article”, and “See Virtual Staging pricing” expose the expected destinations; focus-ring styles remain present.
- Console: no application runtime errors. The development-only CSP warning about React `eval()` remained; the production build is the authoritative check for that environment.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the implementation uses the established PicchuSpot Geist stack, weights, hierarchy, and wrapping. The featured title wraps to two lines at 1440 px and remains readable at mobile widths.
- Spacing and layout rhythm: the hero and editorial section use compact 2rem vertical padding. The measured desktop featured-card tracks are 477.45 px and 849.89 px, or 35.96% text and 64.04% image. The DOM keeps the image first for mobile and uses responsive order utilities to place text left on desktop.
- Colors and tokens: the hero and cards remain white. The editorial surface intentionally overrides the warmer mock color with the user-specified established `dashboard-canvas` token, computed as `rgb(248, 248, 246)` / `#F8F8F6`. Navy text and restrained gold accents remain intact.
- Image quality and asset fidelity: the existing 1200 × 450 PicchuSpot Before/After asset is rendered with `next/image`, its intrinsic ratio, meaningful alt text, and no stretching. The embedded BEFORE/AFTER labels remain visible.
- Copy and content: the hub uses registry content unchanged. The article retains its pricing, structure, metadata, and methodology while adding the approved sentence-level editorial pass, one contextual image/caption, and one restrained pricing CTA.

## Responsive checks

- 360 px: no horizontal document overflow; featured image is first, text follows; article image and CTA fit the content width.
- 390 px: no horizontal document overflow; image-first stack and readable metadata/title wrapping confirmed.
- 768 px: no horizontal document overflow; stacked feature layout remains intact.
- 1024 px: no horizontal document overflow; desktop text-left/image-right split activates without clipping.
- 1440 px: no horizontal document overflow; measured 35.96%/64.04% split matches the requested 36/64 target.

## Comparison history

1. Initial implementation used image left and text right. User correction identified this as a major orientation mismatch. Fixed by retaining image-first DOM order for mobile while applying desktop order utilities and a 1fr/1.78fr grid.
2. The first corrected render retained the warmer ivory surface and more generous vertical spacing. The final brief required `#F8F8F6` and a compact presentation. Fixed by reusing `bg-dashboard-canvas` and reducing hero/section padding.
3. Post-fix evidence confirmed the required orientation, exact surface color, measured proportions, compact layout, and responsive behavior. No actionable P0/P1/P2 findings remained.

## Implementation checklist

- [x] Text left / image right at desktop 36/64 proportions.
- [x] Image first / text below on mobile.
- [x] White hero and cards on exact `#F8F8F6` editorial surface.
- [x] Category pill, metadata, gold divider, and CTA treatment preserved.
- [x] Future articles continue in a two-column editorial grid.
- [x] Article Before/After visual and pricing CTA verified.
- [x] Keyboard focus styling and responsive overflow reviewed.

final result: passed
