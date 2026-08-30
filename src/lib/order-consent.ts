export interface OrderTermsData {
  /** Required: must be true to enable Submit Order. */
  accepted: boolean;
  /** Required: explicit request to start after required payment or order confirmation. */
  earlyPerformanceRequested: boolean;
  /** Optional portfolio and marketing permission. */
  allowPortfolio: boolean;
}

export const emptyOrderTerms: OrderTermsData = {
  accepted: false,
  earlyPerformanceRequested: false,
  allowPortfolio: false,
};

export function setRequiredOrderConsent(
  data: OrderTermsData,
  checked: boolean,
): OrderTermsData {
  return {
    ...data,
    accepted: checked,
    earlyPerformanceRequested: checked,
  };
}

export const ORDER_CONSENT_ERROR_COPY = {
  en: "Accept the Terms and confirm the start-of-service request before submitting.",
  es: "Acepta los Términos y confirma la solicitud de inicio del servicio antes de enviar.",
} as const;

export const PORTFOLIO_PERMISSION_COPY = {
  en: {
    label:
      "Allow PicchuSpot to use before/after examples from this order in its portfolio and marketing.",
    supporting:
      "Optional. Property details may be anonymized and private contact information will not be displayed.",
  },
  es: {
    label:
      "Permito que PicchuSpot utilice ejemplos del antes y el después de este pedido en su portfolio y materiales de marketing.",
    supporting:
      "Opcional. Los datos del inmueble pueden anonimizarse y no se mostrará información de contacto privada.",
  },
} as const;
