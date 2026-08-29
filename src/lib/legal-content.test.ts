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
const englishFaqSource = source("src/app/(public)/faq/page.tsx");
const spanishFaqSource = source("src/app/(public)/es/faq/page.tsx");
const faqDataSource = source("src/data/faq.ts");
const publicPricingSource = source("src/lib/pricing/public.ts");
const pricingPageSource = source("src/app/(public)/pricing/page.tsx");
const pricingServicePageSource = source("src/components/pricing/ServicePage.tsx");
const spanishPricingPageSource = source(
  "src/app/(public)/es/pricing/page.tsx",
);
const spanishPricingLabelsSource = source(
  "src/app/(public)/es/pricing/labels.ts",
);
const orderSummarySource = source("src/components/order/OrderSummary.tsx");
const orderReviewHeaderSource = source(
  "src/components/order/OrderReviewHeader.tsx",
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

test("customer-facing tax copy matches tax-inclusive Stripe Checkout", () => {
  const faqNotice =
    "For eligible fixed-price online orders, the amount shown in Stripe Checkout is tax-inclusive where applicable, and Stripe identifies the included tax. Custom quotes or manually invoiced services may state their own tax treatment.";
  const spanishFaqNotice =
    "Para los pedidos online elegibles con precio fijo, el importe que muestra Stripe Checkout incluye los impuestos cuando corresponda, y Stripe identifica el impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.";
  const pricingNotice =
    "For eligible fixed-price online orders, the Checkout total is tax-inclusive where applicable, and Stripe identifies any included tax. Custom quotes or manually invoiced services may state their own tax treatment.";
  const spanishPricingNotice =
    "Para los pedidos online elegibles con precio fijo, el total mostrado en Checkout incluye los impuestos cuando corresponda, y Stripe identifica cualquier impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.";

  assert.equal(englishFaqSource.includes(faqNotice), true);
  assert.equal(faqDataSource.includes(faqNotice), true);
  assert.equal(spanishFaqSource.includes(spanishFaqNotice), true);
  assert.equal(publicPricingSource.includes(pricingNotice), true);
  assert.equal(publicPricingSource.includes(spanishPricingNotice), true);
  assert.equal(spanishPricingLabelsSource.includes(spanishPricingNotice), true);

  assert.match(pricingPageSource, /title: "Tax-inclusive Checkout"/);
  assert.match(pricingPageSource, /description: PUBLIC_TAX_NOTICE/);
  assert.match(
    pricingServicePageSource,
    /labels\?\.taxNotice \?\? PUBLIC_TAX_NOTICE/,
  );
  assert.match(spanishPricingPageSource, /\{PUBLIC_TAX_NOTICE_ES\}/);

  const obsoletePhrases = [
    "Prices exclude applicable taxes.",
    "Taxes calculated separately where applicable.",
    "Los precios no incluyen los impuestos aplicables.",
    "Los impuestos se calculan por separado cuando corresponda.",
    "Estimated total before tax",
    "Taxes shown separately",
  ];
  const customerSources = [
    englishFaqSource,
    spanishFaqSource,
    faqDataSource,
    publicPricingSource,
    pricingPageSource,
    spanishPricingLabelsSource,
    orderSummarySource,
    orderReviewHeaderSource,
  ];
  for (const customerSource of customerSources) {
    for (const obsoletePhrase of obsoletePhrases) {
      assert.equal(customerSource.includes(obsoletePhrase), false);
    }
  }

  for (const orderSource of [orderSummarySource, orderReviewHeaderSource]) {
    assert.match(orderSource, />\s*Estimated total\s*</);
    assert.match(
      orderSource,
      /For eligible fixed-price online orders, this is the Checkout total\. Applicable tax is included and identified by Stripe\./,
    );
    assert.match(
      orderSource,
      /Final tax treatment will be confirmed in your written quote\./,
    );
    assert.match(
      orderSource,
      /quote\.customQuote \|\| quote\.totalCents === null/,
    );
  }
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
