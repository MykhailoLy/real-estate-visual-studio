import type { PropertyShowcase } from "./types";

const costaBlancaDemo: PropertyShowcase = {
  slug: "sea-view-residence",
  reference: "PS-001",
  status: "for-sale",
  title: {
    en: "Sea View Residence",
    es: "Residencia con vistas al mar",
  },
  summary: {
    en: "A bright contemporary home designed around the terrace, natural light and uninterrupted Mediterranean views.",
    es: "Una vivienda contemporánea y luminosa, diseñada alrededor de la terraza, la luz natural y las vistas abiertas al Mediterráneo.",
  },
  description: [
    {
      en: "The residence combines an open living space, a generous sea-facing terrace and three well-separated bedrooms. Full-height glazing keeps the main rooms bright throughout the day.",
      es: "La vivienda combina una zona de día abierta, una amplia terraza orientada al mar y tres dormitorios bien separados. Los grandes ventanales mantienen las estancias principales luminosas durante todo el día.",
    },
    {
      en: "This digital presentation brings photography, planning information and remote viewing tools into one clear link, helping international buyers make confident decisions before travelling to Spain.",
      es: "Esta presentación digital reúne fotografías, planos y herramientas de visita remota en un único enlace, ayudando a compradores internacionales a tomar decisiones antes de viajar a España.",
    },
  ],
  priceLabel: {
    en: "Asking price",
    es: "Precio de venta",
  },
  price: "€695,000",
  coverImage: "/property-demo/exterior.svg",
  languages: ["en", "es"],
  facts: [
    {
      key: "bedrooms",
      value: "3",
      label: { en: "Bedrooms", es: "Dormitorios" },
    },
    {
      key: "bathrooms",
      value: "2",
      label: { en: "Bathrooms", es: "Baños" },
    },
    {
      key: "built-area",
      value: "142 m²",
      label: { en: "Built area", es: "Superficie construida" },
    },
    {
      key: "parking",
      value: "1",
      label: { en: "Parking", es: "Aparcamiento" },
    },
  ],
  highlights: [
    {
      title: { en: "Open Mediterranean views", es: "Vistas abiertas al Mediterráneo" },
      description: {
        en: "Uninterrupted coastal outlook from the living area and terrace.",
        es: "Vistas despejadas desde el salón y la terraza.",
      },
    },
    {
      title: { en: "South-east orientation", es: "Orientación sureste" },
      description: {
        en: "Morning light, bright interiors and comfortable shaded afternoons.",
        es: "Luz de mañana, interiores luminosos y tardes agradables a la sombra.",
      },
    },
    {
      title: { en: "Turn-key residence", es: "Vivienda lista para entrar" },
      description: {
        en: "Contemporary finishes, integrated appliances and climate control.",
        es: "Acabados contemporáneos, electrodomésticos integrados y climatización.",
      },
    },
    {
      title: { en: "Remote buyer ready", es: "Preparada para compradores a distancia" },
      description: {
        en: "English and Spanish presentation prepared for international clients.",
        es: "Presentación en inglés y español preparada para clientes internacionales.",
      },
    },
  ],
  gallery: [
    {
      id: "exterior",
      src: "/property-demo/exterior.svg",
      alt: {
        en: "Contemporary Costa Blanca residence with pool and sea view",
        es: "Vivienda contemporánea en la Costa Blanca con piscina y vistas al mar",
      },
      label: { en: "Exterior & pool", es: "Exterior y piscina" },
      sortOrder: 1,
    },
    {
      id: "living-room",
      src: "/property-demo/living-room.svg",
      alt: {
        en: "Bright open-plan living room with Mediterranean sea view",
        es: "Salón abierto y luminoso con vistas al Mediterráneo",
      },
      label: { en: "Living room", es: "Salón" },
      note: {
        en: "Open-plan living space with direct access to the terrace.",
        es: "Zona de día abierta con acceso directo a la terraza.",
      },
      roomId: "living-room",
      hotspot: { xPercent: 48, yPercent: 48 },
      sortOrder: 2,
    },
    {
      id: "terrace",
      src: "/property-demo/terrace.svg",
      alt: {
        en: "Private terrace overlooking the Mediterranean coast",
        es: "Terraza privada con vistas a la costa mediterránea",
      },
      label: { en: "Sea-view terrace", es: "Terraza con vistas al mar" },
      note: {
        en: "Sea-facing outdoor area connected to the main living zone.",
        es: "Espacio exterior orientado al mar y conectado con la zona de día.",
      },
      roomId: "terrace",
      hotspot: { xPercent: 49, yPercent: 16 },
      sortOrder: 3,
    },
    {
      id: "principal-bedroom",
      src: "/property-demo/bedroom.svg",
      alt: {
        en: "Calm principal bedroom with warm natural finishes",
        es: "Dormitorio principal tranquilo con acabados naturales",
      },
      label: { en: "Principal bedroom", es: "Dormitorio principal" },
      note: {
        en: "Private bedroom zone separated from the social spaces.",
        es: "Zona de descanso privada y separada de los espacios sociales.",
      },
      roomId: "principal-bedroom",
      hotspot: { xPercent: 24, yPercent: 58 },
      sortOrder: 4,
    },
  ],
  virtualTour: {
    provider: "kuula",
    posterImage: "/property-demo/living-room.svg",
  },
  floorPlans: [
    {
      id: "main-floor",
      title: { en: "Ground floor", es: "Planta baja" },
      imageUrl: "/property-demo/floor-plan.svg",
      downloadUrl: "/property-demo/floor-plan.svg",
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/demo-plan",
      sortOrder: 1,
    },
    {
      id: "first-floor",
      title: { en: "First floor", es: "Primera planta" },
      imageUrl: "/property-demo/floor-plan.svg",
      downloadUrl: "/property-demo/floor-plan.svg",
      sortOrder: 2,
    },
  ],
  location: {
    displayAddress: {
      en: "Altea, Alicante, Costa Blanca",
      es: "Altea, Alicante, Costa Blanca",
    },
    privacyMode: "approximate",
    airportTravelTime: {
      en: "Approximately 45 minutes to Alicante Airport",
      es: "Aproximadamente 45 minutos al Aeropuerto de Alicante",
    },
  },
  agent: {
    agencyName: "Demo Real Estate Agency",
    agentName: "Costa Blanca Property Team",
    role: {
      en: "International property advisor",
      es: "Asesor inmobiliario internacional",
    },
    website: "https://picchuspot.com",
  },
};

const noHighlightsDemo: PropertyShowcase = {
  ...costaBlancaDemo,
  slug: "quiet-townhouse",
  reference: "PS-002",
  title: {
    en: "Quiet Townhouse",
    es: "Casa adosada tranquila",
  },
  summary: {
    en: "A compact showcase variant used to verify that the overview remains balanced without highlight cards.",
    es: "Una variante compacta de la presentación para comprobar que la vista general funciona sin destacados.",
  },
  highlights: [],
  floorPlans: [
    {
      ...costaBlancaDemo.floorPlans[0],
      interactiveProvider: undefined,
      interactiveExternalUrl: undefined,
      interactiveEmbedUrl: undefined,
      interactiveUrl: undefined,
    },
  ],
};

const propertyShowcases: Record<string, PropertyShowcase> = {
  [costaBlancaDemo.slug]: costaBlancaDemo,
  [noHighlightsDemo.slug]: noHighlightsDemo,
};

export function getPropertyShowcase(slug: string): PropertyShowcase | null {
  return propertyShowcases[slug] ?? null;
}

export function getPropertyShowcaseSlugs(): string[] {
  return Object.keys(propertyShowcases);
}

export { costaBlancaDemo };
