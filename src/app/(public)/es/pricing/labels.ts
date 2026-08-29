const exampleTitleTranslations: Record<string, string> = {
  "Exterior Photo Polish": "Pulido de foto exterior",
  "Natural White Balance": "Balance de blancos natural",
  "Straight Lines & Lens Correction": "Líneas rectas y corrección de lente",
  "Brightness & Contrast Lift": "Mejora de brillo y contraste",
};

export function translatePricingExampleTitle(title: string): string {
  return exampleTitleTranslations[title] ?? title;
}

export function translatePricingExampleDescription(description: string): string {
  return description;
}

export const spanishServicePageLabels = {
  bestForEyebrow: "Ideal para",
  backToServices: "Volver a servicios",
  backToServicesHref: "/es/services",
  whatItIsEyebrow: "Qué es",
  beforeYouOrderEyebrow: "Antes de pedir",
  beforeYouOrderTitle: "Qué necesitamos de ti",
  pricingEyebrow: "Precios",
  basePriceBadge: "Precio base",
  taxNotice:
    "Para los pedidos online elegibles con precio fijo, el total mostrado en Checkout incluye los impuestos cuando corresponda, y Stripe identifica cualquier impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.",
  faqEyebrow: "FAQ",
  beforeLabel: "Antes",
  afterLabel: "Después",
  viewExamplePrefix: "Ver ",
  viewExampleSuffix: ": antes y después",
  translateExampleTitle: translatePricingExampleTitle,
  translateExampleDescription: translatePricingExampleDescription,
  secondaryCtaLabel: "Hacer una pregunta",
  secondaryCtaHref: "/es/contact",
} as const;
