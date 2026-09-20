import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { EARLY_PERFORMANCE_VERSION } from "./early-performance.ts";
import { LEGAL_UPDATED, LEGAL_VERSION } from "./legal.ts";
import {
  TERMS_VERSION,
  resolveCurrentTermsAcceptance,
} from "./order-terms.ts";

const workspace = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(workspace, relativePath), "utf8");
}

function sourceTree(relativeDirectory: string) {
  const files: string[] = [];

  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        files.push(readFileSync(entryPath, "utf8"));
      }
    }
  }

  visit(path.join(workspace, relativeDirectory));
  return files.join("\n");
}

const localizedRoutesSource = source("src/lib/localized-routes.ts");
const legalContentSource = source("src/content/legal-pages.tsx");
const legalNoticeContentSource = legalContentSource.slice(
  legalContentSource.indexOf("export const legalNoticeSectionsEn"),
  legalContentSource.indexOf("export const termsSectionsEn"),
);
const termsContentSource = legalContentSource.slice(
  legalContentSource.indexOf("export const termsSectionsEn"),
  legalContentSource.indexOf("export const privacySectionsEn"),
);
const privacyContentSource = legalContentSource.slice(
  legalContentSource.indexOf("export const privacySectionsEn"),
  legalContentSource.indexOf("export const cookieSectionsEn"),
);
const footerSource = source("src/components/layout/Footer.tsx");
const headerSource = source("src/components/layout/Header.tsx");
const cookieBannerSource = source(
  "src/components/privacy/CookieConsentBanner.tsx",
);
const englishFaqSource = source("src/app/(default)/(public)/faq/page.tsx");
const spanishFaqSource = source("src/app/(localized)/[locale]/(public)/faq/page.tsx");
const faqDataSource = source("src/data/faq.ts");
const publicPricingSource = source("src/lib/pricing/public.ts");
const pricingPageSource = source("src/app/(default)/(public)/pricing/page.tsx");
const pricingServicePageSource = source("src/components/pricing/ServicePage.tsx");
const spanishPricingPageSource = source(
  "src/app/(localized)/[locale]/(public)/pricing/page.tsx",
);
const spanishPricingLabelsSource = source(
  "src/app/(localized)/[locale]/(public)/pricing/labels.ts",
);
const orderSummarySource = source("src/components/order/OrderSummary.tsx");
const orderReviewHeaderSource = source(
  "src/components/order/OrderReviewHeader.tsx",
);
const orderSummaryCopySource = source(
  "src/components/order/order-summary-copy.ts",
);
const supportPromptSource = source("src/lib/support-assistant/prompt.ts");
const clientReviewsSource = source("src/lib/client-reviews.ts");
const revisionPolicySources = [
  sourceTree("src/app/(default)/(public)"),
  sourceTree("src/app/(localized)/[locale]/(public)"),
  sourceTree("src/app/(public)/api"),
  sourceTree("src/components"),
  sourceTree("src/content"),
  sourceTree("src/data"),
  supportPromptSource,
].join("\n");

test("legal version is current and remains the order terms version", () => {
  assert.equal(LEGAL_VERSION, "2026-08-30");
  assert.equal(TERMS_VERSION, LEGAL_VERSION);
  assert.equal(EARLY_PERFORMANCE_VERSION, "2026-08-30");
  assert.equal(LEGAL_UPDATED.en, "30 August 2026");
  assert.equal(LEGAL_UPDATED.es, "30 de agosto de 2026");
  assert.match(source("src/lib/order-terms.ts"), /TERMS_VERSION = LEGAL_VERSION/);
  assert.deepEqual(
    resolveCurrentTermsAcceptance({
      accepted: true,
      version: "stale-client",
    }),
    { ok: false, reason: "version_mismatch" },
  );

  const orderTermsBlock = source("src/components/order/OrderTermsBlock.tsx");
  assert.match(
    orderTermsBlock,
    /termsHref = language === "es" \? "\/es\/terms" : "\/terms"/,
  );
  assert.match(orderTermsBlock, /TERMS_VERSION/);
});

test("Terms explain early performance and withdrawal effects in both languages", () => {
  assert.match(
    legalContentSource,
    /Consumers contracting at a distance may normally have a 14-day\s+statutory withdrawal period/,
  );
  assert.match(
    legalContentSource,
    /work may begin after any\s+required payment is confirmed or, where no payment is due, after order\s+confirmation/,
  );
  assert.match(
    legalContentSource,
    /withdraws after work has started, a proportionate\s+amount may be due for the service already supplied/,
  );
  assert.match(
    legalContentSource,
    /withdrawal\s+right is lost once the service has been fully performed where the\s+applicable statutory consent conditions are satisfied/,
  );
  assert.match(legalContentSource, /Mandatory\s+consumer rights remain unaffected/);

  assert.match(
    legalContentSource,
    /plazo legal de desistimiento de 14 días/,
  );
  assert.match(
    legalContentSource,
    /trabajo podrá comenzar una vez confirmado cualquier pago\s+exigible o, si no se adeuda pago alguno, después de la confirmación del\s+pedido/,
  );
  assert.match(
    legalContentSource,
    /desiste después de que haya comenzado el\s+trabajo, puede corresponder un importe proporcional por el servicio ya\s+prestado/,
  );
  assert.match(
    legalContentSource,
    /derecho de desistimiento se pierde una vez que el servicio\s+se ha ejecutado íntegramente cuando se cumplen las condiciones de\s+consentimiento exigidas por la ley aplicable/,
  );
  assert.match(
    legalContentSource,
    /derechos imperativos\s+de las personas consumidoras no se ven afectados/,
  );
});

test("bilingual revision policy is unlimited for 30 days within the original scope", () => {
  assert.match(
    legalContentSource,
    /Unlimited revisions are included for 30 calendar days from the first\s+delivery of the completed work/,
  );
  assert.match(
    legalContentSource,
    /original brief, overall style and design direction and use\s+the original source materials/,
  );
  assert.match(legalContentSource, /colours, materials or textures/);
  assert.match(
    legalContentSource,
    /replacing or repositioning individual\s+furniture or décor items/,
  );
  assert.match(legalContentSource, /A substantial redesign/);
  assert.match(legalContentSource, /replacing most or all of the furniture/);
  assert.match(legalContentSource, /new source image or angle/);
  assert.match(
    legalContentSource,
    /series of revision requests\s+that collectively results in a substantial redesign/,
  );

  assert.match(
    legalContentSource,
    /revisiones ilimitadas durante los 30 días naturales\s+siguientes a la primera entrega del trabajo terminado/,
  );
  assert.match(legalContentSource, /estilo general y la línea de diseño acordada/);
  assert.match(legalContentSource, /cambiar colores, materiales o texturas/);
  assert.match(legalContentSource, /Un rediseño sustancial/);
  assert.match(legalContentSource, /la mayoría o la totalidad del mobiliario/);
  assert.match(legalContentSource, /nueva imagen o ángulo de origen/);
  assert.match(
    legalContentSource,
    /serie de solicitudes que, en conjunto,\s+suponga un rediseño sustancial/,
  );

  assert.doesNotMatch(
    revisionPolicySources,
    /\b(?:one|1)\s+(?:round\s+of\s+)?revisions?\b|\bone\s+revision\s+round\b/i,
  );
  assert.doesNotMatch(
    revisionPolicySources,
    /\b(?:una|1)\s+(?:ronda\s+de\s+)?revisi(?:ó|o)n(?:es)?\b|\bse\s+incluye\s+una\s+revisión\b/i,
  );
});

test("creative revisions remain distinct from nonconforming-work remedies", () => {
  assert.match(
    legalContentSource,
    /creative-revision policy is separate from correction of\s+work that does not conform to the agreed scope/,
  );
  assert.match(
    legalContentSource,
    /does not limit\s+mandatory consumer rights or remedies/,
  );
  assert.match(
    legalContentSource,
    /correction is distinct from the\s+included creative-revision policy in the Terms/,
  );
  assert.match(
    legalContentSource,
    /política de revisiones creativas incluidas es independiente de\s+la corrección de un trabajo que no se ajuste al alcance acordado/,
  );
  assert.match(legalContentSource, /remedios imperativos/);
});

test("revision policy is copy-only and repeated review cycles remain available", () => {
  assert.match(
    clientReviewsSource,
    /rework_requested is intentionally allowed after terminal states/,
  );
  assert.match(
    clientReviewsSource,
    /if \(\(ACTIVE_REWORK_STATUSES as string\[\]\)\.includes\(latest\)\)/,
  );
  assert.doesNotMatch(
    clientReviewsSource,
    /revision[_ ]count|max(?:imum)?[_ ]revisions?|revision[_ ]limit/i,
  );
});

test("all bilingual policy routes are localized and present", () => {
  const routePairs = [
    ["/legal", "/es/legal"],
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
      "src/app/(default)/(public)",
      englishPath.slice(1),
      "page.tsx",
    );
    const spanishFile = path.join(
      workspace,
      "src/app/(localized)/[locale]/(public)",
      spanishPath.slice("/es/".length),
      "page.tsx",
    );

    assert.equal(existsSync(englishFile), true, englishFile);
    assert.equal(existsSync(spanishFile), true, spanishFile);
  }

  assert.match(source("src/app/sitemap.ts"), /localizedRoutes/);
});

test("Legal Notice metadata uses the bilingual canonical and alternate helpers", () => {
  const englishPage = source("src/app/(default)/(public)/legal/page.tsx");
  const spanishPage = source("src/app/(localized)/[locale]/(public)/legal/page.tsx");

  assert.match(englishPage, /title: "Legal Notice"/);
  assert.match(englishPage, /canonicalPath: "\/legal"/);
  assert.match(englishPage, /spanishPath: "\/es\/legal"/);
  assert.match(englishPage, /publicPageMetadata/);

  assert.match(spanishPage, /title: "Aviso legal"/);
  assert.match(spanishPage, /path: "\/es\/legal"/);
  assert.match(spanishPage, /englishPath: "\/legal"/);
  assert.match(spanishPage, /spanishMetadata/);
});

test("Legal Notice identifies the confirmed operator without invented claims", () => {
  assert.match(legalNoticeContentSource, /Mykhailo Lykin/);
  assert.match(legalNoticeContentSource, /Y9650008G/);
  assert.match(legalNoticeContentSource, /C\. Capitán Dema, 3/);
  assert.match(legalNoticeContentSource, /03007 Alicante/);
  assert.match(legalNoticeContentSource, /\+34 614 714 337/);
  assert.match(legalNoticeContentSource, /tel:\+34614714337/);
  assert.match(legalContentSource, /contactEmail = "hello@picchuspot\.com"/);
  assert.match(legalNoticeContentSource, /mailto:/);
  assert.match(legalNoticeContentSource, /trading name used by Mykhailo Lykin/);
  assert.match(legalNoticeContentSource, /nombre comercial utilizado por Mykhailo Lykin/);
  assert.match(legalNoticeContentSource, /self-employed\s+individual \(autónomo\)/);
  assert.match(legalNoticeContentSource, /trabajador autónomo/);

  assert.doesNotMatch(legalNoticeContentSource, /\bcompany\b|\bsociedad\b/i);
  assert.doesNotMatch(
    legalNoticeContentSource,
    /\bS\.?\s*L\.?\b|\bCIF\b|Registro Mercantil|Colegio de Arquitectos|colegiad[oa]/,
  );
  assert.doesNotMatch(
    legalNoticeContentSource,
    /(?:architect|arquitect[oa]).{0,30}(?:licen[cs]e|colegiad[oa])/i,
  );
});

test("Privacy identifies the controller and links to the Legal Notice", () => {
  assert.match(
    privacyContentSource,
    /controller is\s+Mykhailo Lykin, trading as PicchuSpot and established in Spain/,
  );
  assert.match(
    privacyContentSource,
    /responsable es\s+Mykhailo Lykin, que opera bajo el nombre comercial PicchuSpot y está\s+establecido en España/,
  );
  assert.match(privacyContentSource, /C\. Capitán Dema, 3/);
  assert.match(privacyContentSource, /href="\/legal"/);
  assert.match(privacyContentSource, /href="\/es\/legal"/);
  assert.match(
    privacyContentSource,
    /See the Legal Notice for full operator details\./,
  );
  assert.match(
    privacyContentSource,
    /Consulta el Aviso legal para ver los datos completos del titular\./,
  );
});

test("Terms link to the bilingual operator identification without changing their rules", () => {
  assert.match(termsContentSource, /href="\/legal">Legal Notice/);
  assert.match(termsContentSource, /href="\/es\/legal">Aviso legal/);
  assert.match(
    termsContentSource,
    /Full operator identification is available in the/,
  );
  assert.match(
    termsContentSource,
    /Los datos completos del titular están\s+disponibles en el/,
  );
});

test("footer and consent banner expose the bilingual policy routes", () => {
  for (const href of [
    "/legal",
    "/terms",
    "/privacy",
    "/cookies",
    "/refunds",
    "/es/legal",
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

  assert.match(
    footerSource,
    /legal: \[\s*\{ href: "\/legal", label: "Legal Notice" \}/,
  );
  assert.match(
    footerSource,
    /legal: \[\s*\{ href: "\/es\/legal", label: "Aviso legal" \}/,
  );
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

  assert.match(orderSummarySource, />\s*Estimated total\s*</);
  assert.match(
    orderSummarySource,
    /getOrderSummarySupportingCopy\(quote\)/,
  );
  assert.match(orderReviewHeaderSource, />\s*Estimated total\s*</);
  assert.match(
    orderReviewHeaderSource,
    /getOrderTotalSupportingCopy\(quote\)/,
  );
  assert.match(
    orderSummaryCopySource,
    /For eligible fixed-price online orders, this is the Checkout total\. Applicable tax is included and identified by Stripe\./,
  );
  assert.match(
    orderSummaryCopySource,
    /Final tax treatment will be confirmed in your written quote\./,
  );
  assert.match(
    orderSummaryCopySource,
    /quote\.customQuote \|\| quote\.totalCents === null/,
  );
});

test("unnecessary legal routes are not published", () => {
  assert.equal(
    existsSync(path.join(workspace, "src/app/(default)/(public)/payment-security/page.tsx")),
    false,
  );
  assert.doesNotMatch(footerSource, /payment-security/);
});
