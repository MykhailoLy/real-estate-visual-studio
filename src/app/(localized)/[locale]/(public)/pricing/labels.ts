const exampleTitleTranslations: Record<string, string> = {
  "PHOTO-REALISTIC VIRTUAL STAGING": "VIRTUAL STAGING FOTORREALISTA",
  "ACCURATE ROOM SCALE": "PROPORCIONES REALISTAS",
  "VIRTUAL STAGING FROM US$19": "VIRTUAL STAGING DESDE US$19",
  "FAST 24-HOUR DELIVERY": "ENTREGA RÁPIDA EN 24 HORAS",
  "REVISIONS INCLUDED": "REVISIONES INCLUIDAS",
  "MULTIPLE INTERIOR STYLES": "VARIEDAD DE ESTILOS DE INTERIOR",

  "Exterior Photo Polish": "Pulido de foto exterior",
  "Natural White Balance": "Balance de blancos natural",
  "Straight Lines & Lens Correction": "Líneas rectas y corrección de lente",
  "Brightness & Contrast Lift": "Mejora de brillo y contraste",
};

export function translatePricingExampleTitle(title: string): string {
  return exampleTitleTranslations[title] ?? title;
}

const exampleDescriptionTranslations: Record<string, string> = {
  "Realistic furniture, natural lighting, and clean finishing — every image is staged to look believable, polished, and ready for listing.": "Mobiliario realista, iluminación natural y acabados cuidados: cada imagen ofrece un resultado creíble y listo para publicar en tu anuncio.",
  "We match furniture proportions to the real space, so every staged room feels natural, balanced, and visually convincing.": "Ajustamos las proporciones del mobiliario al espacio real para que cada habitación resulte natural, equilibrada y visualmente convincente.",
  "Professional virtual staging starting from US$19 per image. No subscriptions, no hidden fees — just clear pricing per project.": "Virtual Staging profesional desde US$19 por imagen. Sin suscripciones ni cargos ocultos: precios claros para cada proyecto.",
  "Need listing images quickly? Most virtual staging projects are delivered within 24 hours, depending on volume and complexity.": "¿Necesitas imágenes para tu anuncio cuanto antes? La mayoría de los proyectos de Virtual Staging se entregan en 24 horas, según el volumen y la complejidad.",
  "Need a small adjustment after delivery? We include revisions to help make the final image fit your listing perfectly.": "¿Necesitas un pequeño ajuste después de la entrega? Incluimos revisiones para que la imagen final encaje con tu anuncio.",
  "Choose from modern, Scandinavian, farmhouse, contemporary, traditional, commercial, and other popular staging styles.": "Elige entre estilos modernos, escandinavos, rústicos, contemporáneos, tradicionales, comerciales y otras opciones populares de decoración.",
};

export function translatePricingExampleDescription(description: string): string {
  return exampleDescriptionTranslations[description] ?? description;
}

export const spanishServicePageLabels = {
  bestForEyebrow: "Ideal para",
  backToServices: "Volver a precios",
  backToServicesHref: "/es/pricing",
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

const exampleAltTranslations: Record<string, string> = {
  "Empty bedroom room before virtual staging": "Dormitorio vacío antes de Virtual Staging",
  "Modern bedroom room after virtual staging": "Dormitorio de estilo moderno después de Virtual Staging",
  "Empty Living Room before virtual staging": "Salón vacío antes de Virtual Staging",
  "Living Room after Modern virtual staging": "Salón de estilo moderno después de Virtual Staging",
  "Empty Dining Room before virtual staging": "Comedor vacío antes de Virtual Staging",
  "Dining Room after Modern virtual staging": "Comedor de estilo moderno después de Virtual Staging",
  "Mid-Century Modern living room before virtual staging": "Salón antes de Virtual Staging de estilo moderno de mediados de siglo",
  "Mid-Century Modern living room after virtual staging": "Salón después de Virtual Staging de estilo moderno de mediados de siglo",
  "Scandinavian bedroom room before virtual staging": "Dormitorio antes de Virtual Staging de estilo escandinavo",
  "Scandinavian bedroom room after virtual staging": "Dormitorio después de Virtual Staging de estilo escandinavo",
  "Hamptons living room before virtual staging": "Salón antes de Virtual Staging de estilo Hamptons",
  "Hamptons living room after virtual staging": "Salón después de Virtual Staging de estilo Hamptons",
  "Modern virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo moderno en un salón",
  "Modern virtual staging style example for a real estate dining room": "Ejemplo de Virtual Staging de estilo moderno en un comedor",
  "Modern virtual staging style example for a real estate bedroom": "Ejemplo de Virtual Staging de estilo moderno en un dormitorio",
  "Urban virtual staging style example for a real estate bedroom": "Ejemplo de Virtual Staging de estilo urbano en un dormitorio",
  "Urban virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo urbano en un salón",
  "Scandinavian virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo escandinavo en un salón",
  "Scandinavian virtual staging style example for a real estate study room": "Ejemplo de Virtual Staging de estilo escandinavo en un despacho",
  "Mid-Century virtual staging style example for a real estate dining room": "Ejemplo de Virtual Staging de estilo moderno de mediados de siglo en un comedor",
  "Mid-Century virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo moderno de mediados de siglo en un salón",
  "Mid-Century virtual staging style example for a real estate bedroom": "Ejemplo de Virtual Staging de estilo moderno de mediados de siglo en un dormitorio",
  "Farmhouse virtual staging style example for a real estate study room": "Ejemplo de Virtual Staging de estilo rústico en un despacho",
  "Farmhouse virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo rústico en un salón",
  "Farmhouse virtual staging style example for a real estate dining room": "Ejemplo de Virtual Staging de estilo rústico en un comedor",
  "Hamptons virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo Hamptons en un salón",
  "Hamptons virtual staging style example for a real estate bedroom": "Ejemplo de Virtual Staging de estilo Hamptons en un dormitorio",
  "Contemporary virtual staging style example for a real estate study room": "Ejemplo de Virtual Staging de estilo contemporáneo en un despacho",
  "Contemporary virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo contemporáneo en un salón",
  "Contemporary virtual staging style example for a real estate dining room": "Ejemplo de Virtual Staging de estilo contemporáneo en un comedor",
  "Traditional virtual staging style example for a real estate bedroom": "Ejemplo de Virtual Staging de estilo tradicional en un dormitorio",
  "Traditional virtual staging style example for a real estate living room": "Ejemplo de Virtual Staging de estilo tradicional en un salón",
  "Traditional virtual staging style example for a real estate dining room": "Ejemplo de Virtual Staging de estilo tradicional en un comedor",
  "Commercial virtual staging style example for a real estate office": "Ejemplo de Virtual Staging de estilo comercial en una oficina",
  "Commercial virtual staging style example for a real estate shop": "Ejemplo de Virtual Staging de estilo comercial en una tienda",
};

export function translatePricingExampleAlt(alt: string): string {
  return exampleAltTranslations[alt] ?? alt;
}
