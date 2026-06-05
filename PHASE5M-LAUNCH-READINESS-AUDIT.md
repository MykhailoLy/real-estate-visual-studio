# Phase 5M Launch Readiness Audit

## 1. Executive summary

### Is the website close to launch-ready?

The product workflow is close to launch-ready for a controlled beta or soft launch, especially the order flow, client portal, admin order processing, file previews/downloads, ZIP downloads, and rework workflow. The public marketing website is not yet ready for a full public launch because several important public pages still render visible "coming soon" copy or placeholder content.

### What is ready?

- Core remote-service order entry points exist at `/order` and service-specific order pages.
- Order submission uses signed upload URLs and small JSON metadata, which is a good production pattern for Vercel/Supabase.
- Client dashboard pages for Jobs, Files, Invoices, Support, Profile, and order detail are functional and polished.
- Admin pages can process real orders, upload deliverables, handle replacements, manage active rework, and download/preview private files through signed URLs.
- Terms page is substantive and tied to order acceptance.
- Email helpers and notification flows exist for order and review/rework events.
- Admin pages mostly use `robots: { index: false, follow: false }`.

### What is blocking launch?

- Public pages `/about`, `/contact`, `/faq`, `/portfolio`, and `/privacy` contain visible "coming soon" placeholder copy.
- Contact page does not yet provide reliable launch-grade contact options even though it is linked from navigation and footer.
- Privacy policy is placeholder-only, which is a legal/compliance blocker for collecting account, order, and file-upload data.
- Portfolio/testimonial/media content is still placeholder-heavy unless production content is uploaded through admin tools before launch.
- No obvious `robots.txt` or sitemap artifact/config is present despite `next-sitemap` being installed.
- Dashboard pages are protected, but dashboard route-group pages do not appear to export `robots: { index: false }`; add noindex before public launch.

### What can launch as "coming soon"?

- Legal downloadable invoices can remain "Coming soon" as long as invoice wording stays "Estimated total" and "Billing summary".
- Support ticketing can remain deferred because `/dashboard/support` links users to existing help paths.
- Analytics/conversion tracking can be deferred for a soft launch, but should be planned before paid traffic.
- Advanced admin filtering/search can be deferred if order volume starts low.

### What should not be touched before launch unless necessary?

- Order submission logic and pricing calculations.
- Supabase storage bucket visibility.
- Upload/download signed URL routes.
- Rework backend state transitions.
- Email/Resend behavior except for configuration verification.
- Auth/admin internals except for a focused noindex/security audit.

## 2. Public website pages

### `/`

- Exists and serves as the main public homepage.
- Uses shared public layout with header/footer.
- Has service grid, how-it-works/trust sections, and conversion path to `/order`.
- Launch risk: homepage visuals appear to rely heavily on CSS placeholders/admin-managed media fallbacks. This is acceptable for development but weak for a public brand launch unless real media is uploaded.

### `/services`

- Exists with metadata, clear service sections, remote/local split, and CTAs to `/order` and `/contact`.
- Should be checked manually for footer/header anchor alignment. A quick text scan did not show obvious literal `id=` anchors for footer links such as `/services#virtual-staging`; verify rendered IDs or update links.
- Likely launch-ready after link/anchor QA.

### `/pricing`

- Exists with metadata and pricing sections.
- Major pricing detail pages exist for remote services.
- Pricing wording appears explicit and should be manually cross-checked against current business pricing.
- Do not change pricing calculations in this audit phase.

### `/portfolio`

- Exists, but currently renders visible "Portfolio grid with category filters coming soon."
- Launch blocker for full public launch because header/footer link to it.
- Options: populate/admin-wire portfolio before launch, remove prominent links temporarily, or replace with a credible curated simple gallery.

### `/about`

- Exists, but currently renders visible "About page content (story, team, credentials) coming soon."
- High priority before launch because it reduces trust.
- Needs real story, coverage area, service positioning, and proof points.

### `/contact`

- Exists, but currently renders visible "Contact form + direct info (email, phone, WhatsApp) coming soon."
- Launch blocker because navigation and local/renders/online-retail pages rely on `/contact` as the conversion path.
- At minimum, launch needs a mailto link and clear response expectations.

### `/faq`

- Exists, but currently renders visible "FAQ accordion coming soon."
- High priority before launch because users need answers on turnaround, revisions, payments, file formats, and refunds.
- Can be smaller than planned, but should not show placeholder text publicly.

### `/order`

- Exists and routes to four service-specific order forms:
  - `/order/virtual-staging`
  - `/order/virtual-renovation`
  - `/order/3d-floor-plans`
  - `/order/photo-editing`
- Clear conversion path for remote services.
- Does not cover every marketing service as a separate form; some pricing pages intentionally route into shared order forms.

### Major service pages

- Present:
  - `/pricing/virtual-staging`
  - `/pricing/virtual-renovation`
  - `/pricing/floor-plans`
  - `/pricing/photo-editing`
  - `/pricing/image-enhancement`
  - `/pricing/day-to-dusk`
  - `/pricing/360-image-enhancement`
  - `/pricing/360-virtual-staging`
  - `/pricing/aerial-editing`
  - `/pricing/development-site-plans`
  - `/renders`
  - `/online-retail`
  - `/local`
- Renders, online retail, and local pages mostly route users to `/contact`, so `/contact` must be launch-ready first.
- No dedicated standalone public route was observed for `virtual-staging` outside pricing/order; current structure is acceptable if navigation consistently uses pricing detail pages.

## 3. Navigation audit

- Desktop navigation uses a two-level header with top-level categories and service sub-links.
- More dropdown uses a fixed-position overlay to avoid clipping, which is a strong implementation detail.
- Mobile menu uses accordion sections.
- Header CTAs route to `/order` and `/contact`.
- Footer links route to `/portfolio`, `/pricing`, `/order`, `/about`, `/faq`, `/contact`, `/privacy`, and `/terms`.
- Launch blockers:
  - Footer/header link to `/contact`, `/portfolio`, `/about`, `/faq`, and `/privacy`, which currently contain visible placeholder content.
  - Footer service anchors like `/services#virtual-staging` should be manually verified against rendered section IDs.
- Recommended QA:
  - Desktop header category switching.
  - More dropdown overlay on medium desktop widths.
  - Mobile burger menu open/close and accordion behavior.
  - All footer links.
  - All category anchors on `/local`, `/renders`, and `/online-retail`.

## 4. Order flow readiness

### What looks ready

- `/order` has clear service selection cards.
- Service-specific order pages exist for the main orderable services.
- File upload uses signed upload URLs via `/api/upload-url`.
- Client uploads go directly to Supabase Storage, avoiding Vercel payload-size limits.
- Order metadata posts to `/api/order`.
- Server recalculates item subtotals and estimated total instead of trusting client totals.
- Terms acceptance is captured with a version.
- Order API sends notifications best-effort and does not fail a successful order if email is unavailable.

### What to QA before launch

- Required fields and validation on each order form.
- File type and file size validation.
- Upload failure recovery and user-facing error copy.
- Order success state and email notification copy.
- Auth/profile upsert behavior after order submission.
- Price totals across all service-specific combinations.
- Mobile file picker behavior.

### Findings

- The order flow is one of the strongest launch areas, but should not be changed casually before launch.
- Payment is not implemented; wording correctly indicates order submission does not charge the client.
- Production launch should include a manual end-to-end order with real Supabase and Resend env vars.

## 5. Client portal readiness

Use `PHASE5L5-FINAL-PORTAL-QA-CHECKLIST.md` as the detailed portal checklist.

### Ready areas

- `/dashboard/jobs`
- `/dashboard/jobs/[orderId]`
- `/dashboard/files`
- `/dashboard/invoices`
- `/dashboard/support`
- `/dashboard/profile`

### Launch-blocker focus

- Ownership/security: client helpers consistently document that email comes from `getClientUser()` and service-role usage stays server-side.
- Downloads/previews: signed URL routes are used and storage paths are not rendered to client components.
- Invoice wording: page uses estimated totals and disabled invoice download.
- Mobile: recently polished; still needs device QA.

### Finding

- Dashboard pages are protected by session-aware rendering, but dashboard route pages do not appear to export `robots: { index: false }`. Add noindex metadata to dashboard/authenticated routes before public launch.

## 6. Admin portal readiness

### Pages

- `/admin/login`
- `/admin/orders`
- `/admin/orders/[orderId]`
- `/admin/rework`
- `/admin/media`
- `/admin/portfolio`

### Ready areas

- Admin pages require admin authentication.
- Orders list and detail support real order processing.
- Admin can preview/download client source files.
- Admin can upload, preview, download, delete deliverables.
- Admin can upload replacements from the rework queue.
- Admin can mark rework in progress and resolved.
- Reference files are displayed in the correct admin review/image context.
- Bulk ZIP downloads exist.
- Admin/media and admin/portfolio provide production content management foundations.

### Launch risk

- Admin auth appears to be a single shared password. This may be acceptable for a small launch, but is a risk for multi-operator production use. Do not rework auth immediately before launch unless there is a targeted security PR.

## 7. SEO basics

### Strengths

- Root metadata has `metadataBase`, default title, description, Open Graph, and Twitter basics.
- Many public pages export page-specific metadata titles/descriptions.
- Admin pages export noindex metadata.

### Gaps

- No obvious `robots.txt` or `sitemap.xml` artifact/config was found, even though `next-sitemap` is installed.
- Dashboard pages do not appear to export noindex metadata.
- Public placeholder pages are indexable unless fixed.
- No obvious canonical configuration beyond `metadataBase`.
- Image alt text is supported in admin media/portfolio forms, but production content needs alt-text QA.
- Public pages relying on CSS placeholders are weak for SEO and conversion.

### Recommendation

Make SEO metadata polish a separate PR after public content placeholders are removed. Do not optimize metadata for pages that still say "coming soon."

## 8. Content and copy audit

### Launch blockers

- `/about` visible placeholder.
- `/contact` visible placeholder.
- `/faq` visible placeholder.
- `/portfolio` visible placeholder.
- `/privacy` visible placeholder.

### High priority copy checks

- Replace placeholder testimonials in `src/data/testimonials.ts` or hide the section until real testimonials are approved.
- Replace placeholder portfolio data/media with admin-uploaded production examples.
- Review public wording for "rework" vs "revision"; client-facing public copy should usually say "revision" while admin/internal can say "rework."
- Verify all turnaround claims such as 24-48 hours are operationally realistic.
- Verify PicchuSpot capitalization everywhere.
- Check for mojibake/encoding artifacts in rendered UI, especially degree symbols and dashes.

### Coming soon areas

- Invoice downloads can safely remain coming soon.
- Contact, FAQ, Portfolio, About, and Privacy should not remain visibly coming soon for full public launch.

## 9. Legal/compliance basics

This is not legal advice.

### Present

- `/terms` is detailed and includes scope, client responsibilities, revisions, turnaround, pricing/invoices, file delivery, copyright, refunds/cancellations, local services, and contact.
- Terms version is referenced by order acceptance.

### Missing or weak

- `/privacy` is placeholder-only. This is a launch blocker because the app collects names, emails, phone numbers, company names, uploaded files, order details, and account data.
- Contact information is incomplete on `/contact`.
- Refund/revision policy exists in terms but should be easy to find from FAQ/order pages.
- Cookie/analytics notice is not present; this is acceptable only if analytics/cookies are not launched yet.

## 10. Email/DNS/notification readiness

### Code/documentation findings

- Resend is present in dependencies.
- `.env.example` includes `RESEND_API_KEY` and `ADMIN_EMAIL`.
- README describes `RESEND_API_KEY`, `ADMIN_EMAIL`, and `NEXT_PUBLIC_SITE_URL`.
- Order confirmation/admin notification email helpers exist.
- Review/rework notification helper exists.
- Public/support email references include `hello@picchuspot.com`; admin notification fallback is `orders@picchuspot.com`.

### Launch checks

- Verify Resend production domain is configured.
- Verify SPF, DKIM, and DMARC records for the sending domain.
- Verify `ADMIN_EMAIL` points to a monitored inbox.
- Smoke-test order confirmation, admin order notification, rework request, replacement ready, and approval notifications.
- Keep any email code changes in a separate PR.

## 11. Analytics/conversion readiness

### Current state

- No active Google Analytics, Plausible, Vercel Analytics, pixel, or conversion-tracking implementation was found in app code.
- Planning docs mention analytics, but implementation is not present.

### Recommendation

- Before paid traffic, create a separate analytics audit/implementation plan.
- Track at minimum:
  - Visit to `/order`
  - Service selected
  - Order started
  - File upload started/completed
  - Order submitted
  - Contact click/mailto
  - Pricing CTA click
- Ensure analytics are privacy-safe and reflected in privacy/cookie copy.

## 12. Performance/mobile readiness

### Strengths

- Next.js app structure is modern.
- File previews and ZIP generation have recent guardrails.
- Header More dropdown was implemented to avoid overlay clipping.
- Client/admin dashboard layouts have received recent mobile polish.

### Risks

- Next/font build depends on fetching Google Fonts during production build. Build passes with network access, but CI/deploy environments need reliable outbound access.
- Public visual experience relies on CSS placeholders and admin-uploaded media. Real images should be optimized and QAed for layout shift.
- `public/` currently contains only default SVGs and an empty images/styles directory; launch-quality visuals likely depend on Supabase/admin content.
- Heavy public imagery should use optimized image patterns where possible.
- Preview modals and file cards need real-device mobile QA.

## 13. Security/privacy launch checklist

- [ ] Client ownership checks verified for orders, deliverables, source files, review files, and bulk ZIP downloads.
- [ ] Admin routes require admin authentication.
- [ ] Admin API routes require admin authentication.
- [ ] `order-files` bucket remains private.
- [ ] `deliverables` bucket remains private if used as private storage.
- [ ] Signed URL routes return only signed URL + safe filename.
- [ ] Raw `storage_path` is never rendered in client UI.
- [ ] Raw `storage_path` is not returned by reference file routes.
- [ ] Service role key is used only server-side.
- [ ] Env vars/secrets are not exposed in rendered UI.
- [ ] Dashboard and admin pages are noindexed.
- [ ] Public upload URL route validates size/type and stores server-generated paths.
- [ ] Error messages do not leak secrets or storage internals.

## 14. Production readiness checklist

- [x] `npm run lint` should pass before launch.
- [x] `npm run build` should pass before launch.
- [ ] Remove or replace public placeholder pages.
- [ ] Configure required production env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `ADMIN_EMAIL`
  - `NEXT_PUBLIC_SITE_URL`
  - `ADMIN_PASSWORD`
- [ ] Confirm Supabase schema and manually applied migrations match production.
- [ ] Confirm buckets and policies match expected private/public visibility.
- [ ] Confirm Vercel build can fetch fonts or switch to local font strategy.
- [ ] Confirm fallback behavior when Supabase/email is unavailable.
- [ ] Confirm DB/admin error messages do not expose secrets.
- [ ] Confirm production admin password is rotated from placeholder.

## 15. Risk ranking

### Launch blockers

1. `/privacy` is placeholder-only.
2. `/contact` is placeholder-only despite being a primary CTA.
3. `/portfolio` is placeholder-only despite being a trust/conversion page.
4. `/about` and `/faq` contain visible "coming soon" copy.
5. Dashboard pages should be explicitly noindexed.

### High priority before launch

1. Add sitemap/robots setup or confirm generated artifacts in deployment.
2. Replace placeholder testimonials/portfolio visuals or hide those sections.
3. Verify all navigation/footer links and service anchors.
4. Verify Resend domain/DNS and notification smoke tests.
5. Run complete Phase 5L.5 portal QA checklist with production-like data.

### Medium priority polish

1. SEO metadata polish after public content is final.
2. Public CTA/copy consistency pass.
3. Real-device mobile QA for public pages, order forms, dashboards, and modals.
4. Image alt text/content quality pass.
5. Contact/support email consistency.

### Low priority / post-launch

1. Advanced admin filtering/search.
2. Support ticketing.
3. Legal downloadable invoices.
4. Client file rename/delete.
5. Multi-admin identity and audit logs.

### Safe to defer

1. Real Stripe/payment implementation if manual invoicing is acceptable.
2. Analytics if no paid acquisition is starting immediately.
3. Full content expansion beyond minimum launch pages.

## 16. Recommended next PR sequence

### 5M.1 fix launch blockers

- Replace `/privacy`, `/contact`, `/portfolio`, `/about`, and `/faq` placeholder content with minimum launch-ready content.
- Add dashboard noindex metadata.
- Keep this focused on public content and metadata only.

### 5M.2 public navigation/link cleanup

- Verify and fix footer/service anchors.
- Confirm desktop More dropdown and mobile menu links.
- Remove links to any still-deferred public pages.

### 5M.3 SEO metadata polish

- Add/verify robots and sitemap.
- Improve public page descriptions and Open Graph data.
- Keep admin/dashboard noindexed.

### 5M.4 public copy/CTA polish

- Align CTA language across homepage, services, pricing, order, and contact.
- Replace placeholder testimonials or hide the section.
- Verify turnaround and pricing claims.

### 5M.5 analytics audit/implementation plan

- Decide analytics vendor and event taxonomy.
- Add privacy-safe tracking only after privacy copy is updated.

### 5M.6 legal/policy copy audit

- Review privacy, terms, refund/revision, copyright, portfolio permission, and local services copy with appropriate legal/commercial review.

### 5M.7 final smoke test checklist

- Combine public site smoke test, order submission test, client portal QA, admin fulfillment QA, email smoke test, and mobile/browser checks into a release checklist.

## Top 10 launch readiness findings

1. The portal/order/admin workflow is strong enough for a controlled beta.
2. Public launch is blocked by visible placeholder pages, especially Privacy and Contact.
3. Portfolio/trust content needs real examples before a full launch.
4. Dashboard pages need explicit noindex metadata.
5. Sitemap/robots setup is not obvious despite `next-sitemap` being installed.
6. Order flow uses a solid signed-upload architecture and should not be refactored before launch.
7. Payment is intentionally manual/deferred; invoice wording is currently safe.
8. Email code exists, but production DNS and notification smoke tests are mandatory.
9. Analytics/conversion tracking is not implemented and should be planned separately.
10. Production visuals/assets are still placeholder-heavy and need content QA.
