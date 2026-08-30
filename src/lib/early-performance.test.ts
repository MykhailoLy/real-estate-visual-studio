import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMBINED_ORDER_CONSENT_COPY,
  EARLY_PERFORMANCE_COPY,
  EARLY_PERFORMANCE_VERSION,
  resolveCurrentEarlyPerformanceRequest,
} from "./early-performance.ts";
import {
  ORDER_CONSENT_ERROR_COPY,
  PORTFOLIO_PERMISSION_COPY,
  emptyOrderTerms,
  setRequiredOrderConsent,
} from "./order-consent.ts";

const ORDER_TERMS_SOURCE = readFileSync(
  "src/components/order/OrderTermsBlock.tsx",
  "utf8",
);
const ORDER_ROUTE_SOURCE = readFileSync(
  "src/app/(public)/api/order/route.ts",
  "utf8",
);
const SERVER_VALIDATION_SOURCE = readFileSync(
  "src/lib/server-validation.ts",
  "utf8",
);
const SUBMIT_ORDER_SOURCE = readFileSync("src/lib/submit-order.ts", "utf8");
const EARLY_PERFORMANCE_SOURCE = readFileSync(
  "src/lib/early-performance.ts",
  "utf8",
);

test("early-performance copy preserves the approved service-law meaning in English and Spanish", () => {
  assert.equal(EARLY_PERFORMANCE_VERSION, "2026-08-30");
  assert.equal(
    EARLY_PERFORMANCE_COPY.en,
    "I agree to the Terms & Conditions and expressly request PicchuSpot to start work as described there. Where consumer withdrawal rights apply, I understand that a proportionate amount may be due for work already performed and that the right ends once the service has been fully performed.",
  );
  assert.equal(
    EARLY_PERFORMANCE_COPY.es,
    "Acepto los Términos y Condiciones y solicito expresamente que PicchuSpot comience el trabajo según lo descrito allí. Cuando sean aplicables los derechos de desistimiento del consumidor, entiendo que puede corresponder un importe proporcional por el trabajo ya realizado y que el derecho termina una vez que el servicio se haya ejecutado íntegramente.",
  );
  assert.equal(
    `${COMBINED_ORDER_CONSENT_COPY.en.beforeTerms}${COMBINED_ORDER_CONSENT_COPY.en.termsLabel}${COMBINED_ORDER_CONSENT_COPY.en.afterTerms}`,
    EARLY_PERFORMANCE_COPY.en,
  );
  assert.equal(
    `${COMBINED_ORDER_CONSENT_COPY.es.beforeTerms}${COMBINED_ORDER_CONSENT_COPY.es.termsLabel}${COMBINED_ORDER_CONSENT_COPY.es.afterTerms}`,
    EARLY_PERFORMANCE_COPY.es,
  );
  assert.doesNotMatch(EARLY_PERFORMANCE_SOURCE, /TERMS_VERSION|LEGAL_VERSION/);
});

test("server resolution requires an affirmative request and current handshake version", () => {
  assert.deepEqual(
    resolveCurrentEarlyPerformanceRequest({
      requested: true,
      version: EARLY_PERFORMANCE_VERSION,
    }),
    {
      ok: true,
      request: {
        requested: true,
        acknowledged_loss_after_full_performance: true,
        acknowledged_proportionate_payment: true,
        version: EARLY_PERFORMANCE_VERSION,
      },
    },
  );
  assert.deepEqual(
    resolveCurrentEarlyPerformanceRequest({
      requested: false,
      version: EARLY_PERFORMANCE_VERSION,
    }),
    { ok: false, reason: "not_requested" },
  );
  assert.deepEqual(
    resolveCurrentEarlyPerformanceRequest({
      requested: true,
      version: "stale-client",
    }),
    { ok: false, reason: "version_mismatch" },
  );
});

test("one required checkbox controls both evidence fields and portfolio stays optional", () => {
  assert.equal((ORDER_TERMS_SOURCE.match(/type="checkbox"/g) ?? []).length, 2);
  assert.equal((ORDER_TERMS_SOURCE.match(/aria-required="true"/g) ?? []).length, 1);
  assert.match(
    ORDER_TERMS_SOURCE,
    /checked=\{requiredConsentChecked\}[\s\S]*setRequiredOrderConsent\(data, event\.target\.checked\)/,
  );
  assert.match(
    ORDER_TERMS_SOURCE,
    /data-legal-acknowledgement="terms-and-early-performance"[\s\S]*aria-required="true"[\s\S]*aria-describedby=/,
  );
  assert.match(ORDER_TERMS_SOURCE, /checked=\{data\.allowPortfolio\}/);
  assert.doesNotMatch(ORDER_TERMS_SOURCE, /defaultChecked/);
  assert.match(
    ORDER_TERMS_SOURCE,
    /language === "es" \? "\/es\/terms" : "\/terms"/,
  );

  assert.deepEqual(emptyOrderTerms, {
    accepted: false,
    earlyPerformanceRequested: false,
    allowPortfolio: false,
  });
  assert.deepEqual(setRequiredOrderConsent(emptyOrderTerms, true), {
    accepted: true,
    earlyPerformanceRequested: true,
    allowPortfolio: false,
  });
  assert.deepEqual(
    setRequiredOrderConsent(
      { accepted: true, earlyPerformanceRequested: true, allowPortfolio: true },
      false,
    ),
    { accepted: false, earlyPerformanceRequested: false, allowPortfolio: true },
  );
  assert.equal(
    ORDER_CONSENT_ERROR_COPY.en,
    "Accept the Terms and confirm the start-of-service request before submitting.",
  );
  assert.equal(
    ORDER_CONSENT_ERROR_COPY.es,
    "Acepta los Términos y confirma la solicitud de inicio del servicio antes de enviar.",
  );
  assert.equal(
    PORTFOLIO_PERMISSION_COPY.en.label,
    "Allow PicchuSpot to use before/after examples from this order in its portfolio and marketing.",
  );
  assert.equal(
    PORTFOLIO_PERMISSION_COPY.en.supporting,
    "Optional. Property details may be anonymized and private contact information will not be displayed.",
  );
  assert.equal(
    PORTFOLIO_PERMISSION_COPY.es.label,
    "Permito que PicchuSpot utilice ejemplos del antes y el después de este pedido en su portfolio y materiales de marketing.",
  );
  assert.equal(
    PORTFOLIO_PERMISSION_COPY.es.supporting,
    "Opcional. Los datos del inmueble pueden anonimizarse y no se mostrará información de contacto privada.",
  );
});

test("client and route gates require the separate request before submission side effects", () => {
  const clientGate = SUBMIT_ORDER_SOURCE.indexOf(
    "!orderTerms.earlyPerformanceRequested",
  );
  const localPreflight = SUBMIT_ORDER_SOURCE.indexOf(
    "// ---- 1. Local pre-flight ----",
  );
  assert.ok(clientGate >= 0 && clientGate < localPreflight);
  assert.match(
    SUBMIT_ORDER_SOURCE,
    /earlyPerformanceRequest: \{\s*requested: orderTerms\.earlyPerformanceRequested,\s*version: EARLY_PERFORMANCE_VERSION/,
  );
  assert.match(
    ORDER_ROUTE_SOURCE,
    /!\("earlyPerformanceRequest" in bodyJson\)[\s\S]*The order confirmation requirements have changed\.[\s\S]*code: "client_upgrade_required"[\s\S]*status: 409/,
  );
  assert.match(
    SERVER_VALIDATION_SOURCE,
    /earlyPerformanceRequest: EarlyPerformanceRequestSchema/,
  );
  assert.match(
    SERVER_VALIDATION_SOURCE,
    /requested: z\.literal\(true/,
  );
});
