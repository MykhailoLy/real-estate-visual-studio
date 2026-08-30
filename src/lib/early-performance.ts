export const EARLY_PERFORMANCE_VERSION = "2026-08-30";

export const COMBINED_ORDER_CONSENT_COPY = {
  en: {
    beforeTerms: "I agree to the ",
    termsLabel: "Terms & Conditions",
    afterTerms:
      " and expressly request PicchuSpot to start work as described there. Where consumer withdrawal rights apply, I understand that a proportionate amount may be due for work already performed and that the right of withdrawal ends once the service has been fully performed.",
  },
  es: {
    beforeTerms: "Acepto los ",
    termsLabel: "Términos y Condiciones",
    afterTerms:
      " y solicito expresamente que PicchuSpot comience el trabajo según lo descrito allí. Cuando sean aplicables los derechos de desistimiento del consumidor, entiendo que puede corresponder un importe proporcional por el trabajo ya realizado y que el derecho de desistimiento termina una vez que el servicio se haya ejecutado íntegramente.",
  },
} as const;

export const EARLY_PERFORMANCE_COPY = {
  en: `${COMBINED_ORDER_CONSENT_COPY.en.beforeTerms}${COMBINED_ORDER_CONSENT_COPY.en.termsLabel}${COMBINED_ORDER_CONSENT_COPY.en.afterTerms}`,
  es: `${COMBINED_ORDER_CONSENT_COPY.es.beforeTerms}${COMBINED_ORDER_CONSENT_COPY.es.termsLabel}${COMBINED_ORDER_CONSENT_COPY.es.afterTerms}`,
};

export type CurrentEarlyPerformanceRequest = {
  requested: true;
  acknowledged_loss_after_full_performance: true;
  acknowledged_proportionate_payment: true;
  version: typeof EARLY_PERFORMANCE_VERSION;
};

export type CurrentEarlyPerformanceRequestResult =
  | { ok: true; request: CurrentEarlyPerformanceRequest }
  | { ok: false; reason: "not_requested" | "version_mismatch" };

/**
 * Treats the browser value as an explicit request plus a version handshake.
 * The returned evidence is constructed exclusively from current server code;
 * the authoritative timestamp is added at the persistence boundary.
 */
export function resolveCurrentEarlyPerformanceRequest(input: {
  requested: boolean;
  version?: string | null;
}): CurrentEarlyPerformanceRequestResult {
  if (!input.requested) {
    return { ok: false, reason: "not_requested" };
  }
  if (input.version !== EARLY_PERFORMANCE_VERSION) {
    return { ok: false, reason: "version_mismatch" };
  }
  return {
    ok: true,
    request: {
      requested: true,
      acknowledged_loss_after_full_performance: true,
      acknowledged_proportionate_payment: true,
      version: EARLY_PERFORMANCE_VERSION,
    },
  };
}
