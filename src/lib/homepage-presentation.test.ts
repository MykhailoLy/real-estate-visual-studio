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
  assert.match(benefitsSource, /lg:mx-auto/);
  assert.match(benefitsSource, /lg:text-center/);
  assert.match(benefitsSource, /lg:grid-cols-6/);
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
    /text-\[11px\][\s\S]*?xl:text-\[12px\][\s\S]*?xl:tracking-\[0\.10em\]/,
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
  assert.match(heroSource, /getHomeHeroServicePresentation/);
  assert.match(heroSource, /CatalogPriceText/);
  assert.match(heroSource, /prefetch=\{false\}/);
  assert.match(heroSource, /data-testid="homepage-hero-frame"/);
  assert.match(heroSource, /data-testid="homepage-hero-image-stage"/);
  assert.match(heroSource, /data-testid="hero-service-footer"/);
  assert.match(heroSource, /const showFooter = showNav \|\| Boolean\(activeService\)/);
  assert.match(heroSource, /<HeroServiceFooter/);
  assert.doesNotMatch(heroSource, /absolute inset-x-0 bottom-0 z-10/);
  assert.match(heroSource, /data-testid="hero-slide-dots"/);
  assert.match(heroSource, /sm:col-start-2 sm:row-start-1/);
  assert.doesNotMatch(heroSource, /mt-2 lg:mt-3 flex items-center justify-center/);
  assert.match(heroSource, /\? "w-6 bg-white"/);
  assert.match(heroSource, /"w-2 bg-white\/40 group-hover:bg-white\/60"/);
  assert.match(heroSource, /w-\[2px\].*bg-white\/85/);
  assert.doesNotMatch(heroSource, /M3 1L0 6l3 5V1/);
  assert.doesNotMatch(heroSource, /rounded-full bg-white shadow-md/);
  assert.match(heroSource, /bg-primary\/25/);
  assert.match(heroSource, /backdrop-blur-sm/);
  assert.match(heroSource, /trimWholeCents/);
  assert.match(heroSource, /locale === "es" \? "ANTES" : "BEFORE"/);
  assert.match(heroSource, /locale === "es" \? "DESPUÉS" : "AFTER"/);
  assert.doesNotMatch(heroSource, /\$\d/);
  assert.match(englishHomeSource, /serviceSlug: row\.service_slug/);
  assert.match(spanishHomeSource, /serviceSlug: row\.service_slug/);
  assert.match(spanishHomeSource, /locale="es"/);
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
