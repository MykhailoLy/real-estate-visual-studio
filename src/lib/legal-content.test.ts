import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { LEGAL_VERSION } from "./legal.ts";

const workspace = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(workspace, relativePath), "utf8");
}

const localizedRoutesSource = source("src/lib/localized-routes.ts");
const legalContentSource = source("src/content/legal-pages.tsx");
const footerSource = source("src/components/layout/Footer.tsx");
const headerSource = source("src/components/layout/Header.tsx");
const cookieBannerSource = source(
  "src/components/privacy/CookieConsentBanner.tsx",
);

test("legal version is current and remains the order terms version", () => {
  assert.equal(LEGAL_VERSION, "2026-08");
  assert.match(source("src/lib/order-terms.ts"), /TERMS_VERSION = LEGAL_VERSION/);

  const orderTermsBlock = source("src/components/order/OrderTermsBlock.tsx");
  assert.match(orderTermsBlock, /href="\/terms"/);
  assert.match(orderTermsBlock, /TERMS_VERSION/);
});

test("all bilingual policy routes are localized and present", () => {
  const routePairs = [
    ["/terms", "/es/terms"],
    ["/privacy", "/es/privacy"],
    ["/cookies", "/es/cookies"],
    ["/refunds", "/es/refunds"],
  ] as const;

  for (const [englishPath, spanishPath] of routePairs) {
    assert.equal(localizedRoutesSource.includes('"' + englishPath + '"'), true);
    assert.equal(localizedRoutesSource.includes('"' + spanishPath + '"'), true);

    const englishFile = path.join(
      workspace,
      "src/app/(public)",
      englishPath.slice(1),
      "page.tsx",
    );
    const spanishFile = path.join(
      workspace,
      "src/app/(public)",
      spanishPath.slice(1),
      "page.tsx",
    );

    assert.equal(existsSync(englishFile), true, englishFile);
    assert.equal(existsSync(spanishFile), true, spanishFile);
  }

  assert.match(source("src/app/sitemap.ts"), /localizedRoutes/);
});

test("footer and consent banner expose the bilingual policy routes", () => {
  for (const href of [
    "/terms",
    "/privacy",
    "/cookies",
    "/refunds",
    "/es/terms",
    "/es/privacy",
    "/es/cookies",
    "/es/refunds",
  ]) {
    assert.equal(footerSource.includes('href: "' + href + '"'), true);
  }

  for (const href of ["/terms", "/privacy"]) {
    assert.equal(headerSource.includes('href: "' + href + '"'), true);
  }
  for (const href of ["/cookies", "/refunds"]) {
    assert.equal(headerSource.includes('href: "' + href + '"'), false);
  }

  assert.match(cookieBannerSource, /policyHref: "\/cookies"/);
  assert.match(cookieBannerSource, /policyHref: "\/es\/cookies"/);
  assert.match(cookieBannerSource, /saveChoice\("rejected"\)/);
  assert.match(cookieBannerSource, /saveChoice\("accepted"\)/);
});

test("policy copy covers confirmed providers, controls, and consumer rights", () => {
  for (const provider of [
    "Supabase",
    "Vercel",
    "Stripe",
    "Resend",
    "Gemini",
    "Google Analytics",
    "Crisp",
    "Cloudflare Turnstile",
    "Upstash",
  ]) {
    assert.match(legalContentSource, new RegExp(provider));
  }

  assert.match(legalContentSource, /14 calendar days/);
  assert.match(legalContentSource, /14 días naturales/);
  assert.match(legalContentSource, /24–48 hour turnaround is a usual estimate/);
  assert.match(legalContentSource, /estimación habitual/);
  assert.match(legalContentSource, /picchuspot_cookie_consent/);
  assert.match(legalContentSource, /portfolio permission/);
  assert.doesNotMatch(legalContentSource, /practical launch copy/i);
});

test("blocked and unnecessary legal routes are not published", () => {
  assert.equal(
    existsSync(path.join(workspace, "src/app/(public)/legal/page.tsx")),
    false,
  );
  assert.equal(
    existsSync(path.join(workspace, "src/app/(public)/es/legal/page.tsx")),
    false,
  );
  assert.equal(
    existsSync(path.join(workspace, "src/app/(public)/payment-security/page.tsx")),
    false,
  );
  assert.doesNotMatch(footerSource, /href: "\/(?:es\/)?legal"/);
  assert.doesNotMatch(footerSource, /payment-security/);
});
