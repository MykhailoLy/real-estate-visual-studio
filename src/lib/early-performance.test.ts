import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EARLY_PERFORMANCE_COPY,
  EARLY_PERFORMANCE_VERSION,
  resolveCurrentEarlyPerformanceRequest,
} from "./early-performance.ts";

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
  assert.equal(EARLY_PERFORMANCE_VERSION, "2026-08-29");
  assert.equal(
    EARLY_PERFORMANCE_COPY.en,
    "I request PicchuSpot to start work as soon as payment is confirmed, including during any applicable 14-day withdrawal period. I understand that, where consumer withdrawal rights apply, I may have to pay a proportionate amount for work already performed if I withdraw after work has started, and I will lose the right of withdrawal once the service has been fully performed.",
  );
  assert.equal(
    EARLY_PERFORMANCE_COPY.es,
    "Solicito expresamente que PicchuSpot comience a prestar el servicio en cuanto se confirme el pago, aunque sea dentro del periodo de desistimiento aplicable de 14 días. Entiendo que, cuando sean aplicables los derechos de desistimiento del consumidor, si desisto después de que haya comenzado el trabajo puede corresponderme pagar una cantidad proporcional por la parte del servicio ya prestada, y que perderé el derecho de desistimiento una vez que el servicio se haya ejecutado íntegramente.",
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

test("order confirmation UI keeps Terms, early performance, and portfolio as separate choices", () => {
  const termsIndex = ORDER_TERMS_SOURCE.indexOf(
    'onChange={(e) => update("accepted", e.target.checked)}',
  );
  const earlyPerformanceIndex = ORDER_TERMS_SOURCE.indexOf(
    'update("earlyPerformanceRequested", event.target.checked)',
  );
  const portfolioIndex = ORDER_TERMS_SOURCE.indexOf(
    'onChange={(e) => update("allowPortfolio", e.target.checked)}',
  );

  assert.ok(termsIndex >= 0);
  assert.ok(earlyPerformanceIndex > termsIndex);
  assert.ok(portfolioIndex > earlyPerformanceIndex);
  assert.match(
    ORDER_TERMS_SOURCE,
    /emptyOrderTerms[\s\S]*accepted: false,[\s\S]*earlyPerformanceRequested: false,[\s\S]*allowPortfolio: false/,
  );
  assert.match(
    ORDER_TERMS_SOURCE,
    /data-legal-acknowledgement="early-performance"[\s\S]*aria-required="true"[\s\S]*aria-describedby=/,
  );
  assert.doesNotMatch(ORDER_TERMS_SOURCE, /defaultChecked/);
  assert.match(ORDER_TERMS_SOURCE, /EARLY_PERFORMANCE_COPY\[language\]/);
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
