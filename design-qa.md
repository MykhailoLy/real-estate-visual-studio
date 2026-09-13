# Blog editorial hub and article proof-block design QA

## Evidence

- Source visual truth: `C:\Users\Virtual Staging\.codex\generated_images\01a09a57-8c91-7541-9807-31f0a1767f17\exec-707a65c9-3a4c-48c4-9aac-e4c0aa47095c.png`.
- Supplied article images: `110-1 Neighbourhood Ln, Etobicoke 028.jpg` and `110-1 Neighbourhood Ln, Etobicoke 028+.jpg` from the user-provided paths.
- Implementation URL: `http://localhost:3000/blog` and `http://localhost:3000/blog/virtual-staging-cost`.
- Desktop blog screenshot: `C:\Users\Virtual Staging\.codex\visualizations\2026\09\13\01a09a57-8c91-7541-9807-31f0a1767f17\blog-desktop-1440.png`.
- Mobile blog screenshot: `C:\Users\Virtual Staging\.codex\visualizations\2026\09\13\01a09a57-8c91-7541-9807-31f0a1767f17\blog-mobile-390.png`.
- Desktop article screenshot: `C:\Users\Virtual Staging\.codex\visualizations\2026\09\13\01a09a57-8c91-7541-9807-31f0a1767f17\article-before-after-desktop-1440.png`.
- Mobile article screenshot: `C:\Users\Virtual Staging\.codex\visualizations\2026\09\13\01a09a57-8c91-7541-9807-31f0a1767f17\article-before-after-mobile-390.png`.
- Same-input comparison boards: `C:\Users\Virtual Staging\.codex\visualizations\2026\09\13\01a09a57-8c91-7541-9807-31f0a1767f17\qa-blog-comparison.png` and `C:\Users\Virtual Staging\.codex\visualizations\2026\09\13\01a09a57-8c91-7541-9807-31f0a1767f17\qa-article-comparison.png`.
- Source blog pixels: 1488 × 1058. Desktop implementation: 1440 CSS px viewport at device pixel ratio 1; full-page capture is 1424 × 1274 after scrollbar exclusion. Mobile implementation: 390 × 844 pixels at a 390 × 844 CSS viewport and device pixel ratio 1.
- Article implementation captures: 1440 × 1024 desktop and 390 × 844 mobile at matching CSS sizes and device pixel ratio 1.
- State: English public blog, logged-out header state, one published article. Header differences from the earlier reference are authentication state only and were not treated as design drift.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the established PicchuSpot Geist stack, navy hierarchy, weights, line heights, and wrapping remain intact. `Latest Insights` uses the approved capitalization. The featured title stays visually strong without increasing the card height.
- Spacing and layout rhythm: the hero is unchanged; the editorial section and featured card remain compact. At 1024 and 1440 px, measured tracks are 35.97% text and 63.98% image. The desktop text is left and image right; at 360, 390, and 768 px the image precedes full-width text. Borders remain subtle, shadow remains `shadow-sm`, and the gold divider is a single slim border.
- Colors and tokens: the hero and cards compute to `rgb(255, 255, 255)`. The listing section computes to `rgb(248, 248, 246)` through the existing `bg-dashboard-canvas` token. The divider and CTA accents use the existing PicchuSpot secondary gold token; typography uses primary navy. No new neutral or global palette migration was introduced.
- Image quality and asset fidelity: the featured preview image is unchanged. The supplied bedroom photos retain their full 3:2 framing, matching heights, and source order. They are optimized to 2400 × 1600 without cropping and rendered through `next/image` with responsive `sizes`. The desktop article block is a balanced two-column pair; 360 and 390 px stack BEFORE then AFTER with no overflow.
- Copy and content: the hub copy and hero remain unchanged. The article retains its thesis, heading structure, pricing, methodology, metadata, schema, and publication data. The replacement caption is neutral and the CTA remains singular and contextual.
- Interaction and accessibility: article and hub links preserve keyboard focus styles. The filled pricing CTA computes to gold `rgb(199, 169, 78)` with navy `rgb(7, 26, 43)` text, and its focused state exposes a solid 2 px navy outline. BEFORE/AFTER labels fit at every checked width and both images have meaningful alt text.
- Responsiveness: browser measurements at 360, 390, 768, 1024, and 1440 px found no horizontal overflow, clipping, broken wrapping, image distortion, or gap between the listing section and footer.
- Icons and assets: existing Lucide icons and PicchuSpot brand assets are preserved. No CSS art, handcrafted SVG, placeholder, gradient, or heavy shadow was added.

## Full-view comparison evidence

- The approved Option 3 hierarchy, white hero, neutral listing surface, compact white card, text-left/image-right desktop composition, title weight, category pill, metadata, gold divider, and restrained gold article link are visibly preserved on the blog comparison board.
- The implementation omits empty placeholder cards shown in the concept because no additional articles are published; the existing two-column editorial grid remains in code for future registered articles. This is an intentional product-data difference, not visual drift.

## Focused-region comparison evidence

- The article comparison board shows the exact supplied bedroom photographs above the implemented proof block. Room geometry and full rectangular framing are preserved; no diagonal mask or artificial crop is present.
- Desktop image boxes measure 424 × 282.67 CSS px each. Mobile image boxes measure 331.33 × 221.05 CSS px each. Both produce a 1.50 ratio with matching heights.
- The checklist immediately above the figure and the following cost paragraph are both visible in the desktop capture, confirming placement inside the AI-versus-professional section.

## Comparison history

- Earlier implementation: the in-article proof used the existing single living-room composite and the contextual CTA used an outlined pale treatment.
- Requested correction: replace the body proof with the supplied bedroom Before/After pair, use responsive side-by-side/stacked layouts, and align the CTA with PicchuSpot's filled yellow action style.
- Fix applied: added optimized bedroom assets, a two-column responsive proof block with restrained labels and neutral caption, a filled gold pricing CTA, exact `Latest Insights` capitalization, and the full-strength slim gold divider.
- Post-fix evidence: the desktop and mobile captures plus exact-width measurements show correct ordering, matching 3:2 image treatment, accessible labels and CTA, intended 35.97%/63.98% hub split, and no overflow.

## Implementation checklist

- [x] Preserve approved desktop and mobile hub composition.
- [x] Reuse exact `#F8F8F6` semantic token.
- [x] Restore slim gold divider and approved capitalization.
- [x] Keep featured preview asset unchanged.
- [x] Replace only the article-body proof image.
- [x] Use responsive optimized images with meaningful alt text.
- [x] Use one filled gold contextual CTA with accessible focus styling.
- [x] Verify 360, 390, 768, 1024, and 1440 px.

## Follow-up polish

- None required before approval.

final result: passed
