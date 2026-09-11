import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { WELCOME_OFFER_PUBLIC_COPY } from "./welcome-offer.ts";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function assertSourceOrder(source: string, markers: string[]) {
  let previousPosition = -1;

  for (const marker of markers) {
    const position = source.indexOf(marker, previousPosition + 1);
    assert.notEqual(position, -1, `Expected to find ${marker}`);
    assert.ok(position > previousPosition, `${marker} should follow the prior section`);
    previousPosition = position;
  }
}

test("homepage keeps the SEO introduction, compact benefits, and conversion sections in order", () => {
  const source = readSource("src/app/(public)/page.tsx");
  const benefitsSource = readSource("src/components/home/BenefitsRow.tsx");

  assertSourceOrder(source, [
    "<BeforeAfterShowcase",
    "Real Estate Photo Editing, Virtual Staging &amp; Floor Plans",
    "<BenefitsRow />",
    "<ServiceGrid />",
    "<HowItWorksDetailed />",
    "Help Your Listings Stand Out and Sell Faster",
    "<AboutPicchuSpot",
    "<Testimonials />",
    "<CtaSection",
  ]);
  assert.doesNotMatch(benefitsSource, /Why work with PicchuSpot/);
  assert.doesNotMatch(
    benefitsSource,
    /Built for listings - not generic photo work\./,
  );
  assert.doesNotMatch(benefitsSource, /Remote \+ Local/);
  assert.doesNotMatch(benefitsSource, /flex h-11 w-11/);
  assert.doesNotMatch(benefitsSource, /rounded-lg bg-primary\/10/);
  assert.match(benefitsSource, /Clock3/);
  assert.match(benefitsSource, /CalendarX2/);
  assert.match(benefitsSource, /RefreshCcw/);
  assert.match(benefitsSource, /UserCheck/);
  assert.match(benefitsSource, /ShieldCheck/);
  assert.match(benefitsSource, /Gift/);
  assert.match(benefitsSource, /strokeWidth=\{1\.75\}/);
  assert.match(benefitsSource, /text-secondary/);
  assert.match(
    benefitsSource,
    /border-y border-border bg-white py-4 sm:py-5 lg:py-6/,
  );
  assert.doesNotMatch(benefitsSource, /bg-ivory/);
  assert.match(
    benefitsSource,
    /grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 md:grid-cols-3 lg:grid-cols-6 lg:gap-0/,
  );
  assert.match(
    benefitsSource,
    /flex min-w-0 items-start gap-3 px-1 py-2\.5 sm:block/,
  );
  assert.match(benefitsSource, /sm:mx-auto/);
  assert.match(
    benefitsSource,
    /h-9 w-9 shrink-0 sm:mx-auto sm:h-12 sm:w-12 lg:h-14 lg:w-14/,
  );
  assert.match(benefitsSource, /sm:text-center/);
  assert.match(benefitsSource, /lg:grid-cols-6/);
  assert.match(
    benefitsSource,
    /lg:border-l lg:border-border lg:px-3 lg:py-2 lg:first:border-l-0/,
  );
  assert.doesNotMatch(
    benefitsSource,
    /overflow-hidden rounded-xl border border-border bg-border/,
  );
});

test("service sub-navigation stays available from lg with compact overflow measurement", () => {
  const headerSource = readSource("src/components/layout/Header.tsx");

  assert.match(
    headerSource,
    /hidden border-b border-border bg-white lg:block/,
  );
  assert.doesNotMatch(
    headerSource,
    /hidden border-b border-border bg-white xl:block/,
  );
  assert.match(headerSource, /gap-x-4 xl:gap-x-7/);
  assert.match(
    headerSource,
    /data-subnav-measure="link"[\s\S]*?text-sm[\s\S]*?xl:text-\[15px\][\s\S]*?xl:tracking-\[0\.06em\]/,
  );
  assert.match(headerSource, /measureMoreRef/);
  assert.match(headerSource, /<MoreDropdown/);
  assert.match(headerSource, /py-2\.5/);
  assert.match(headerSource, /bg-secondary/);
});

test("public header keeps the dark primary hierarchy without changing its shared controls", () => {
  const headerSource = readSource("src/components/layout/Header.tsx");
  const accountMenuSource = readSource(
    "src/components/auth/PublicAccountMenu.tsx",
  );
  const topLevelStart = headerSource.indexOf(
    "{/* Top-level categories (desktop) */}",
  );
  const topLevelEnd = headerSource.indexOf(
    "{/* Menu, account actions, and preferences */}",
  );
  const topLevelSource = headerSource.slice(topLevelStart, topLevelEnd);

  assert.match(headerSource, /data-testid="public-header-primary-row"/);
  assert.match(headerSource, /cn\("bg-primary", NAV_X_PADDING\)/);
  assert.match(headerSource, /flex items-center h-14/);
  assert.match(headerSource, /variant="mark-light"/);
  assert.match(headerSource, /width=\{64\}/);
  assert.match(headerSource, /height=\{32\}/);
  assert.match(headerSource, /<BrandWordmark[\s\S]*?theme="dark"/);
  assert.match(
    topLevelSource,
    /isActive\s*\?\s*"text-white"\s*:\s*"text-white\/65 hover:text-white"/,
  );
  assert.match(topLevelSource, /bg-secondary/);
  assert.doesNotMatch(topLevelSource, /bg-primary\/5|rounded-md|hover:bg-surface/);
  assert.match(headerSource, /bg-secondary[\s\S]*?text-primary/);
  assert.match(headerSource, /text-white\/80/);
  assert.match(headerSource, /theme="dark"/);
  assert.match(headerSource, /darkHeaderTrigger/);
  assert.match(headerSource, /border-white\/15 bg-white\/5/);
  assert.match(headerSource, /focus-visible:ring-offset-primary/);
  assert.match(accountMenuSource, /theme\?: "light" \| "dark"/);
  assert.match(accountMenuSource, /const darkHeader = theme === "dark" && !mobileAction/);
  assert.match(accountMenuSource, /text-white hover:bg-white\/10/);
});

test("top-level header categories wait for the wide 3xl layout while the lg service row remains", () => {
  const headerSource = readSource("src/components/layout/Header.tsx");
  const categoryStart = headerSource.indexOf("aria-label=\"Service categories\"");
  const categoryEnd = headerSource.indexOf(
    "{/* Menu, account actions, and preferences */}",
  );
  const categorySource = headerSource.slice(categoryStart, categoryEnd);

  assert.match(
    categorySource,
    /hidden 3xl:ml-4 3xl:flex 3xl:min-w-0 3xl:items-center 3xl:gap-0\.5/,
  );
  assert.doesNotMatch(categorySource, /\sxl:flex/);
  assert.match(headerSource, /hidden border-b border-border bg-white lg:block/);
});

test("hero service metadata resolves canonical routes and display-only pricing", () => {
  const heroSource = readSource("src/components/home/BeforeAfterShowcase.tsx");
  const chromeSource = readSource(
    "src/components/media/ComparisonHeroChrome.tsx",
  );
  const heroStageSource = heroSource.slice(
    heroSource.indexOf('data-testid="homepage-hero-image-stage"'),
    heroSource.indexOf("<ComparisonHeroFooter"),
  );
  const heroFooterSource = chromeSource.slice(
    chromeSource.indexOf("export function ComparisonHeroFooter"),
    chromeSource.indexOf("interface HeroSlideIndicatorRailProps"),
  );
  const englishHomeSource = readSource("src/app/(public)/page.tsx");
  const spanishHomeSource = readSource("src/app/(public)/es/page.tsx");
  const pricingHubSource = readSource("src/app/(public)/pricing/page.tsx");
  const presentationSource = readSource(
    "src/lib/pricing/remote-service-presentation.ts",
  );
  const portfolioMetaSource = readSource("src/lib/portfolio-service-meta.ts");

  assert.match(
    presentationSource,
    /"item-removal": "item-removal-virtual-cleaning"/,
  );
  assert.match(
    presentationSource,
    /en: "Item Removal & Virtual Cleaning"/,
  );
  assert.match(
    presentationSource,
    /es: "Eliminación de objetos y limpieza virtual"/,
  );
  assert.match(
    presentationSource,
    /priceKey: "item-removal-virtual-cleaning"/,
  );
  assert.match(presentationSource, /image: \{ en: "image", es: "imagen" \}/);
  assert.match(presentationSource, /suffix: ` \/ \$\{UNIT_LABELS\[service\.price\.unit\]\[locale\]\}`/);
  assert.match(
    presentationSource,
    /label: \{ en: "Option-based pricing", es: "Precio por opciones" \}/,
  );
  assert.match(presentationSource, /getSpanishPath\(service\.href\)/);
  assert.match(presentationSource, /if \(!serviceSlug\) return null/);
  assert.match(presentationSource, /if \(!service\) return null/);
  assert.match(
    portfolioMetaSource,
    /slug: "item-removal-virtual-cleaning"[\s\S]*?pricingHref: "\/pricing\/photo-editing"/,
  );

  assert.match(pricingHubSource, /REMOTE_SERVICE_GROUPS/);
  assert.match(presentationSource, /getHeroServicePresentation/);
  assert.match(heroSource, /getHeroServicePresentation/);
  assert.match(chromeSource, /CatalogPriceText/);
  assert.match(chromeSource, /prefetch=\{false\}/);
  assert.match(heroSource, /data-testid="homepage-hero-frame"/);
  assert.match(heroSource, /data-testid="homepage-hero-image-stage"/);
  assert.match(chromeSource, /data-testid="hero-service-footer"/);
  assert.match(heroSource, /<ComparisonHeroFooter/);
  assert.doesNotMatch(heroSource, /absolute inset-x-0 bottom-0 z-10/);
  assert.doesNotMatch(heroSource, /BeforeAfterLabels/);
  assert.doesNotMatch(heroSource, /HeroArrowControl/);
  assert.doesNotMatch(heroSource, /Previous slide|Next slide/);
  assert.doesNotMatch(heroSource, /ArrowRight|ChevronLeft|ChevronRight/);
  assert.match(heroSource, /showDivider=\{false\}/);
  assert.match(chromeSource, /data-testid="hero-comparison-divider"/);
  assert.match(chromeSource, /w-\[2px\].*bg-white\/85/);
  assert.match(heroSource, /<ComparisonHeroDivider/);
  assert.match(chromeSource, /data-testid="hero-slide-dots"/);
  assert.match(heroStageSource, /<HeroSlideIndicatorRail/);
  assert.doesNotMatch(heroFooterSource, /HeroSlideIndicatorRail/);
  assert.match(
    chromeSource,
    /absolute top-1\/2 left-3[\s\S]*?hidden[\s\S]*?-translate-y-1\/2 flex-col[\s\S]*?md:left-4 md:flex lg:left-5/,
  );
  assert.match(chromeSource, /\? "h-3 w-3 border-white\/90 bg-\[#C7A94E\]/);
  assert.match(chromeSource, /bg-primary\/50 group-hover:bg-primary\/65/);
  assert.match(chromeSource, /h-5 w-7[\s\S]*?md:h-\[26px\] md:w-8 xl:h-8/);
  assert.doesNotMatch(chromeSource, /-space-y-/);
  assert.match(chromeSource, /group-focus-visible:outline-\[#C7A94E\]/);
  assert.match(heroFooterSource, /bg-\[#071A2B\]/);
  assert.match(heroFooterSource, /grid-cols-2 grid-rows-\[auto_auto\]/);
  assert.match(heroFooterSource, /md:grid-cols-\[1fr_auto_1fr\] md:grid-rows-1/);
  assert.match(heroFooterSource, /text-sm font-bold uppercase[\s\S]*?md:text-base/);
  assert.match(heroFooterSource, /text-\[#C7A94E\][\s\S]*?text-white/);
  assert.doesNotMatch(heroSource, /M3 1L0 6l3 5V1/);
  assert.doesNotMatch(heroSource, /rounded-full bg-white shadow-md/);
  assert.equal(chromeSource.match(/<TrackedLink/g)?.length, 1);
  assert.match(chromeSource, /flex-wrap items-center justify-center justify-self-center/);
  assert.match(heroFooterSource, /min-w-0 text-center font-bold uppercase/);
  assert.match(chromeSource, /text-white\/40[\s\S]*?·/);
  assert.match(heroSource, /touchAction: "pan-y"/);
  assert.doesNotMatch(heroSource, /touchAction: "none"/);
  assert.match(heroSource, /setPointerCapture\(pointerId\)/);
  assert.match(heroSource, /hasPointerCapture\(pointerId\)/);
  assert.match(heroSource, /releasePointerCapture\(pointerId\)/);
  assert.match(heroSource, /dragStart\.current = \{ x: e\.clientX, y: e\.clientY \}/);
  assert.match(heroSource, /if \(dx < 0\) goNext\(\);[\s\S]*?else goPrev\(\);/);
  assert.match(heroSource, /if \(ady > adx \* SWIPE_MAX_RATIO\) return/);
  assert.match(
    heroSource,
    /handlePointerCancel[\s\S]*?dragStart\.current = null;[\s\S]*?safelyReleasePointer/,
  );
  assert.equal(heroSource.match(/draggable=\{false\}/g)?.length, 2);
  assert.match(chromeSource, /trimWholeCents/);
  assert.match(chromeSource, /locale === "es" \? "ANTES" : "BEFORE"/);
  assert.match(chromeSource, /locale === "es" \? "DESPUÉS" : "AFTER"/);
  assert.doesNotMatch(heroSource, /\$\d/);
  assert.match(englishHomeSource, /serviceSlug: row\.service_slug/);
  assert.match(spanishHomeSource, /serviceSlug: row\.service_slug/);
  assert.match(spanishHomeSource, /locale="es"/);
});

test("service comparison heroes reuse the homepage chrome and reliable swipe behavior", () => {
  const sliderSource = readSource(
    "src/components/pricing/ServicePageSlider.tsx",
  );
  const servicePageSource = readSource(
    "src/components/pricing/ServicePage.tsx",
  );
  const chromeSource = readSource(
    "src/components/media/ComparisonHeroChrome.tsx",
  );
  const floorPlansSource = readSource(
    "src/app/(public)/pricing/floor-plans/page.tsx",
  );
  const spanishFloorPlansSource = readSource(
    "src/app/(public)/es/pricing/floor-plans/page.tsx",
  );
  const virtualStagingSource = readSource(
    "src/app/(public)/pricing/virtual-staging/page.tsx",
  );
  const spanishVirtualStagingSource = readSource(
    "src/app/(public)/es/pricing/virtual-staging/page.tsx",
  );

  assert.match(sliderSource, /data-testid="service-hero-image-stage"/);
  assert.match(sliderSource, /<ComparisonHeroDivider/);
  assert.match(sliderSource, /<HeroSlideIndicatorRail/);
  assert.match(sliderSource, /<ComparisonHeroFooter/);
  assert.match(sliderSource, /analyticsLocation="service_hero"/);
  assert.match(sliderSource, /ctaHref=\{orderHref\}/);
  assert.match(sliderSource, /ctaLabel=\{orderLabel\}/);
  assert.doesNotMatch(sliderSource, /ChevronLeft|ChevronRight/);
  assert.doesNotMatch(sliderSource, /Previous slide|Next slide/);
  assert.doesNotMatch(sliderSource, /M3 1L0 6l3 5V1/);
  assert.doesNotMatch(sliderSource, /mt-1 lg:mt-2/);
  assert.match(sliderSource, /showDivider=\{false\}/);
  assert.match(chromeSource, /role="tablist"/);
  assert.match(chromeSource, /role="tab"/);
  assert.match(chromeSource, /aria-selected=\{isActive\}/);
  assert.match(chromeSource, /hidden[\s\S]*?md:flex/);
  assert.match(chromeSource, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(chromeSource, /bg-primary\/50 group-hover:bg-primary\/65/);
  assert.match(chromeSource, /bg-\[#C7A94E\]/);
  assert.match(chromeSource, /bg-\[#071A2B\]/);
  assert.match(chromeSource, /text-sm font-bold uppercase[\s\S]*?text-white/);
  assert.match(chromeSource, /font-bold uppercase[\s\S]*?text-\[#C7A94E\]/);
  assert.match(chromeSource, /whitespace-nowrap[\s\S]*?font-bold text-white/);
  assert.match(sliderSource, /touchAction: "pan-y"/);
  assert.doesNotMatch(sliderSource, /touchAction: "none"|preventDefault/);
  assert.match(sliderSource, /if \(!e\.isPrimary\) return/);
  assert.match(sliderSource, /e\.pointerType === "mouse" && e\.button !== 0/);
  assert.match(sliderSource, /setPointerCapture\(pointerId\)/);
  assert.match(sliderSource, /hasPointerCapture\(pointerId\)/);
  assert.match(sliderSource, /releasePointerCapture\(pointerId\)/);
  assert.match(sliderSource, /onLostPointerCapture/);
  assert.match(
    sliderSource,
    /handlePointerCancel[\s\S]*?dragStart\.current = null;[\s\S]*?safelyReleasePointer/,
  );
  assert.match(sliderSource, /const SWIPE_MIN_X = 40/);
  assert.match(sliderSource, /if \(dx < 0\) goNext\(\);[\s\S]*?else goPrev\(\);/);
  assert.match(sliderSource, /if \(ady > adx \* SWIPE_MAX_RATIO\) return/);
  assert.equal(sliderSource.match(/draggable=\{false\}/g)?.length, 2);
  assert.match(sliderSource, /prefers-reduced-motion/);
  assert.match(sliderSource, /if \(paused \|\| reducedMotion \|\| total <= 1\) return/);
  assert.match(sliderSource, /isSlideMounted/);

  assert.match(
    servicePageSource,
    /<ServicePageSlider[\s\S]*?serviceSlug=\{serviceSlug\}[\s\S]*?locale=\{altLocale\}[\s\S]*?orderHref=\{orderHref\}[\s\S]*?orderLabel=\{orderLabel\}/,
  );
  for (const [source, locale, slug, orderHref] of [
    [virtualStagingSource, "en", "virtual-staging", "/order/virtual-staging"],
    [spanishVirtualStagingSource, "es", "virtual-staging", "/order/virtual-staging"],
    [floorPlansSource, "en", "floor-plans", "/order/3d-floor-plans"],
    [spanishFloorPlansSource, "es", "floor-plans", "/order/3d-floor-plans"],
  ] as const) {
    assert.match(source, new RegExp(`serviceSlug="${slug}"`));
    assert.match(source, new RegExp(`locale="${locale}"`));
    assert.match(source, new RegExp(`orderHref="${orderHref}"`));
    assert.match(source, /orderLabel="[^"]+"/);
  }

  for (const source of [floorPlansSource, spanishFloorPlansSource]) {
    assert.match(source, /imageFit="contain"/);
    assert.match(source, /imageBackground="bg-white"/);
    assert.match(source, /mobileAspect="aspect-\[16\/10\]"/);
  }
});

test("360 service heroes stay synchronized comparisons with safe non-comparison fallbacks", () => {
  const syncedSource = readSource(
    "src/components/pricing/SyncedPanoramaCompareViewer.tsx",
  );
  const singleSource = readSource(
    "src/components/pricing/PanoramaHeroViewer.tsx",
  );
  const siteMediaSource = readSource("src/lib/site-media.ts");
  const routeSources = [
    readSource("src/app/(public)/pricing/360-image-enhancement/page.tsx"),
    readSource("src/app/(public)/es/pricing/360-image-enhancement/page.tsx"),
    readSource("src/app/(public)/pricing/360-virtual-staging/page.tsx"),
    readSource("src/app/(public)/es/pricing/360-virtual-staging/page.tsx"),
  ];

  const onePairHelper = siteMediaSource.slice(
    siteMediaSource.indexOf("export async function getServiceHeroBeforeAfterItem"),
    siteMediaSource.indexOf("export async function getServiceHeroPanoramaItems"),
  );
  assert.match(onePairHelper, /\.limit\(1\)/);
  assert.match(onePairHelper, /\.not\("before_image_path", "is", null\)/);
  assert.match(onePairHelper, /\.not\("after_image_path", "is", null\)/);

  assert.equal(syncedSource.match(/new Viewer\(/g)?.length, 2);
  assert.match(syncedSource, /position-updated/);
  assert.match(syncedSource, /zoom-updated/);
  assert.match(syncedSource, /syncFrom\("before"\)/);
  assert.match(syncedSource, /syncFrom\("after"\)/);
  assert.match(syncedSource, /touch-none/);
  assert.match(syncedSource, /role="group"/);
  assert.match(syncedSource, /role="img"/);
  assert.match(syncedSource, /<ComparisonHeroFooter/);
  assert.match(syncedSource, /showComparisonLabelsOnMobile=\{false\}/);
  assert.match(syncedSource, /comparisonLabelsAriaHidden/);
  assert.equal(syncedSource.match(/data-testid="panorama-mobile-label"/g)?.length, 1);
  assert.match(syncedSource, /mobileLabel=\{beforeLabel\}/);
  assert.match(syncedSource, /mobileLabel=\{afterLabel\}/);
  assert.match(
    syncedSource,
    /panorama-mobile-label[\s\S]*?bg-\[#071A2B\][\s\S]*?text-\[13px\][\s\S]*?md:hidden/,
  );
  assert.match(
    syncedSource,
    /<PanoramaPane[\s\S]*?mobileLabel=\{beforeLabel\}[\s\S]*?<PanoramaPane[\s\S]*?mobileLabel=\{afterLabel\}/,
  );
  assert.match(syncedSource, /grid-cols-1[\s\S]*?md:grid-cols-2/);
  assert.doesNotMatch(syncedSource, /role="tablist"|aria-roledescription="carousel"/);
  assert.doesNotMatch(syncedSource, /ChevronLeft|ChevronRight|Previous slide|Next slide/);
  assert.doesNotMatch(syncedSource, /handlePointerDown|SWIPE_MIN_X|touchAction: "pan-y"/);
  assert.doesNotMatch(syncedSource, /Synced 360|Drag either view to compare/);
  assert.doesNotMatch(syncedSource, /absolute left-3 top-3 rounded-full/);
  assert.doesNotMatch(syncedSource, /bg-gradient-to-t from-black/);

  assert.match(singleSource, /<ComparisonHeroFooter/);
  assert.match(singleSource, /showComparisonLabels=\{false\}/);
  assert.doesNotMatch(singleSource, /panorama-mobile-label/);
  assert.doesNotMatch(singleSource, /role="tablist"|aria-roledescription="carousel"/);
  assert.doesNotMatch(singleSource, />\s*(BEFORE|AFTER|ANTES|DESPUÉS)\s*</);
  assert.doesNotMatch(singleSource, /bg-gradient-to-t from-black/);

  for (const source of routeSources) {
    assert.match(source, /getServiceHeroBeforeAfterItem\(/);
    assert.match(source, /<SyncedPanoramaCompareViewer/);
    assert.match(source, /<PanoramaHeroViewer/);
    assert.match(source, /beforePanoramaUrl && afterPanoramaUrl/);
    assert.match(source, /getServiceHeroPanoramaItems\(/);
    assert.doesNotMatch(source, /<ServicePageSlider/);
    assert.doesNotMatch(source, /\) : undefined/);
  }

  assert.match(routeSources[0], /locale="en"/);
  assert.match(routeSources[1], /locale="es"/);
  assert.match(routeSources[2], /locale="en"/);
  assert.match(routeSources[3], /locale="es"/);
});

test("homepage and signup presentation use the authoritative English Welcome Offer copy", () => {
  const benefitsSource = readSource("src/components/home/BenefitsRow.tsx");
  const signUpPageSource = readSource("src/app/(auth)/signup/page.tsx");
  const welcomeOfferSource = readSource(
    "src/components/auth/WelcomeOfferCallout.tsx",
  );

  assert.deepEqual(WELCOME_OFFER_PUBLIC_COPY.en.benefits, [
    "1 Image Enhancement free",
    "1 Day to Dusk free",
    "50% off your first Virtual Staging image",
  ]);
  assert.equal(
    WELCOME_OFFER_PUBLIC_COPY.en.benefitSummary,
    "1 Image Enhancement free, 1 Day to Dusk free, and 50% off your first Virtual Staging image.",
  );
  assert.match(benefitsSource, /WELCOME_OFFER_PUBLIC_COPY\.en\.benefitSummary/);
  assert.match(signUpPageSource, /WelcomeOfferCallout/);
  assert.match(signUpPageSource, /WELCOME_OFFER_PUBLIC_COPY\.en\.benefits/);
  assert.match(welcomeOfferSource, /border border-primary bg-primary/);
  assert.match(
    welcomeOfferSource,
    /bg-gradient-to-br from-primary-light to-primary/,
  );
  assert.match(welcomeOfferSource, /divide-y divide-white\/15/);
  assert.match(welcomeOfferSource, /text-secondary/);
  assert.doesNotMatch(welcomeOfferSource, /perAccount/);
});

test("Spanish homepage and signup mirror the localized presentation without a second H1", () => {
  const spanishHomeSource = readSource("src/app/(public)/es/page.tsx");
  const spanishSignUpSource = readSource("src/app/(auth)/es/signup/page.tsx");

  assertSourceOrder(spanishHomeSource, [
    "<BeforeAfterShowcase",
    "Edición fotográfica inmobiliaria, Virtual Staging y planos",
    "<BenefitsRow copy={benefitsCopy} />",
    '<ServiceGrid copy={serviceGridCopy} locale="es" />',
    "<HowItWorksDetailed copy={processCopy} />",
    "Ayuda a que tus anuncios destaquen y vendan más rápido",
    "<AboutPicchuSpot",
    "<Testimonials",
    "<CtaSection",
  ]);
  assert.equal((spanishHomeSource.match(/<h1/g) ?? []).length, 1);
  assert.doesNotMatch(spanishHomeSource, /Remoto \+ local/);
  assert.deepEqual(WELCOME_OFFER_PUBLIC_COPY.es.benefits, [
    "1 mejora de imagen gratis",
    "1 conversión Day to Dusk gratis",
    "50 % de descuento en tu primera imagen de Virtual Staging",
  ]);
  assert.match(spanishSignUpSource, /WelcomeOfferCallout/);
  assert.match(spanishSignUpSource, /WELCOME_OFFER_PUBLIC_COPY\.es\.benefits/);
});

test("signup pages use shared public chrome without duplicate portal branding", () => {
  const shellSource = readSource("src/components/auth/SignupPageShell.tsx");
  const englishSignUpSource = readSource("src/app/(auth)/signup/page.tsx");
  const spanishSignUpSource = readSource("src/app/(auth)/es/signup/page.tsx");

  assert.match(shellSource, /PublicAuthProvider/);
  assert.match(shellSource, /<Header/);
  assert.match(shellSource, /<Footer/);
  assert.doesNotMatch(shellSource, /FloatingSiteActions/);
  assert.match(shellSource, /max-w-md/);
  assert.match(shellSource, /py-8/);
  assert.match(shellSource, /lg:py-16/);

  for (const source of [englishSignUpSource, spanishSignUpSource]) {
    assert.match(source, /SignupPageShell/);
    assert.doesNotMatch(source, /PicchuSpotLogo/);
    assert.doesNotMatch(source, /BrandWordmark/);
    assert.doesNotMatch(source, /ArrowLeft/);
  }

  assert.doesNotMatch(englishSignUpSource, /Back to website/);
  assert.doesNotMatch(spanishSignUpSource, /Volver al sitio/);
});

test("signup keeps the existing auth, redirect, and Turnstile implementation", () => {
  const formSource = readSource("src/app/(auth)/signup/SignUpForm.tsx");

  assert.match(formSource, /supabase\.auth\.signUp/);
  assert.match(formSource, /captchaToken/);
  assert.match(formSource, /TurnstileWidget/);
  assert.match(formSource, /emailRedirectTo/);
  assert.match(formSource, /safeInternalPath/);
});
