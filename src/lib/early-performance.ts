export const EARLY_PERFORMANCE_VERSION = "2026-08-29-v2";

export const EARLY_PERFORMANCE_COPY = {
  en: "I expressly request PicchuSpot to start work as soon as any required payment is confirmed, or after order confirmation where no payment is due, including during any applicable 14-day withdrawal period. I understand that, where consumer withdrawal rights apply, I may have to pay a proportionate amount for work already performed if I withdraw after work has started, and I will lose the right of withdrawal once the service has been fully performed.",
  es: "Solicito expresamente que PicchuSpot comience a prestar el servicio en cuanto se confirme cualquier pago exigible o, cuando no haya ningún pago pendiente, después de la confirmación del pedido, incluso durante cualquier periodo de desistimiento aplicable de 14 días. Entiendo que, cuando sean aplicables los derechos de desistimiento del consumidor, si desisto después de que haya comenzado el trabajo puede corresponderme pagar una cantidad proporcional por la parte del servicio ya prestada, y que perderé el derecho de desistimiento una vez que el servicio se haya ejecutado íntegramente.",
} as const;

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
