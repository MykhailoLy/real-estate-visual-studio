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
  assert.match(benefitsSource, /Gift/);
  assert.match(benefitsSource, /lg:grid-cols-6/);
});

test("homepage and signup presentation use the authoritative English Welcome Offer copy", () => {
  const benefitsSource = readSource("src/components/home/BenefitsRow.tsx");
  const signUpPageSource = readSource("src/app/(auth)/signup/page.tsx");

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

test("signup keeps the existing auth, redirect, and Turnstile implementation", () => {
  const formSource = readSource("src/app/(auth)/signup/SignUpForm.tsx");

  assert.match(formSource, /supabase\.auth\.signUp/);
  assert.match(formSource, /captchaToken/);
  assert.match(formSource, /TurnstileWidget/);
  assert.match(formSource, /emailRedirectTo/);
  assert.match(formSource, /safeInternalPath/);
});
