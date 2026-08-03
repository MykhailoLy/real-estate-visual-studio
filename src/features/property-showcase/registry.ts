import type { PropertyShowcase } from "./types";

const costaBlancaDemo: PropertyShowcase = {
  slug: "sea-view-residence",
  reference: "PS-001",
  status: "for-sale",
  primaryLanguage: "en",
  title: {
    en: "Sea View Residence",
    es: "Residencia con vistas al mar",
    de: "Residenz mit Meerblick",
  },
  summary: {
    en: "A bright contemporary home designed around the terrace, natural light and uninterrupted Mediterranean views.",
    es: "Una vivienda contemporanea con terraza, luz natural y vistas abiertas al Mediterraneo.",
    de: "Ein helles modernes Zuhause mit Terrasse, Tageslicht und freiem Mittelmeerblick.",
  },
  description: [
    {
      en: "The residence combines an open living space, a generous sea-facing terrace and three well-separated bedrooms. Full-height glazing keeps the main rooms bright throughout the day.",
      es: "La vivienda combina una zona de dia abierta, una amplia terraza orientada al mar y tres dormitorios bien separados.",
      de: "Die Residenz verbindet einen offenen Wohnbereich, eine grosse Meerterrasse und drei klar getrennte Schlafzimmer.",
    },
    {
      en: "This digital presentation brings photography, planning information and remote viewing tools into one clear link, helping international buyers make confident decisions before travelling to Spain.",
      es: "Esta presentacion digital reune fotografias, planos y herramientas de visita remota en un unico enlace.",
      de: "Diese digitale Praesentation vereint Fotos, Grundrisse und Remote-Besichtigung in einem klaren Link.",
    },
  ],
  priceLabel: {
    en: "Asking price",
    es: "Precio de venta",
    de: "Kaufpreis",
  },
  price: "\u20ac695,000",
  coverImage: "/property-demo/exterior.svg",
  brochureUrl: "/property-demo/floor-plan.svg",
  languages: ["en", "es", "de"],
  translations: {
    es: {
      title: "Residencia con vistas al mar",
      summary:
        "Una vivienda contemporanea con terraza, luz natural y vistas abiertas al Mediterraneo.",
      description: [
        "La vivienda combina una zona de dia abierta, una amplia terraza orientada al mar y tres dormitorios bien separados.",
        "Esta presentacion digital reune fotografias, planos y herramientas de visita remota en un unico enlace.",
      ],
      highlights: [
        "Vistas abiertas al Mediterraneo",
        "Orientacion sureste",
        "Vivienda lista para entrar",
        "Preparada para compradores a distancia",
      ],
    },
    de: {
      title: "Residenz mit Meerblick",
      summary:
        "Ein helles modernes Zuhause mit Terrasse, Tageslicht und freiem Mittelmeerblick.",
    },
  },
  facts: [
    {
      key: "bedrooms",
      value: "3",
      label: { en: "Bedrooms", es: "Dormitorios", de: "Schlafzimmer" },
    },
    {
      key: "bathrooms",
      value: "2",
      label: { en: "Bathrooms", es: "Banos", de: "Badezimmer" },
    },
    {
      key: "parking",
      value: "Garage + driveway",
      label: { en: "Parking", es: "Aparcamiento", de: "Parken" },
    },
    {
      key: "built-area",
      value: "142 m\u00b2",
      label: {
        en: "Built area",
        es: "Superficie construida",
        de: "Wohnflache",
      },
    },
    {
      key: "year-built",
      value: "2022",
      label: { en: "Year built", es: "Ano de construccion", de: "Baujahr" },
    },
    {
      key: "plot-area",
      value: "480 m\u00b2",
      label: { en: "Lot size", es: "Parcela", de: "Grundstuck" },
    },
  ],
  highlights: [
    {
      text: {
        en: "Open Mediterranean views",
        es: "Vistas abiertas al Mediterraneo",
        de: "Freier Mittelmeerblick",
      },
      sortOrder: 1,
    },
    {
      text: {
        en: "South-east orientation with morning light",
        es: "Orientacion sureste con luz de manana",
        de: "Suedostausrichtung mit Morgensonne",
      },
      sortOrder: 2,
    },
    {
      text: {
        en: "Turn-key residence with contemporary finishes",
        es: "Vivienda lista para entrar con acabados contemporaneos",
        de: "Bezugsfertig mit modernen Ausstattungen",
      },
      sortOrder: 3,
    },
    {
      text: {
        en: "Prepared for remote international buyers",
        es: "Preparada para compradores internacionales a distancia",
        de: "Vorbereitet fuer internationale Kaeufer aus der Ferne",
      },
      sortOrder: 4,
    },
  ],
  gallery: [
    {
      id: "exterior",
      src: "/property-demo/exterior.svg",
      alt: {
        en: "Contemporary Costa Blanca residence with pool and sea view",
        es: "Vivienda contemporanea en la Costa Blanca con piscina y vistas al mar",
      },
      label: { en: "Exterior and pool", es: "Exterior y piscina" },
      sortOrder: 1,
    },
    {
      id: "living-room",
      src: "/property-demo/living-room.svg",
      alt: {
        en: "Bright open-plan living room with Mediterranean sea view",
        es: "Salon abierto y luminoso con vistas al Mediterraneo",
      },
      label: { en: "Living room", es: "Salon" },
      note: {
        en: "Open-plan living space with direct access to the terrace.",
        es: "Zona de dia abierta con acceso directo a la terraza.",
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
        es: "Terraza privada con vistas a la costa mediterranea",
      },
      label: { en: "Sea-view terrace", es: "Terraza con vistas al mar" },
      note: {
        en: "Sea-facing outdoor area connected to the main living zone.",
        es: "Espacio exterior orientado al mar y conectado con la zona de dia.",
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
  interactiveFloorPlanTour: {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/demo-plan",
  },
  floorPlans: [
    {
      id: "main-floor",
      title: { en: "Ground floor", es: "Planta baja", de: "Erdgeschoss" },
      imageUrl: "/property-demo/floor-plan.svg",
      downloadUrl: "/property-demo/floor-plan.svg",
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/demo-plan",
      sortOrder: 1,
    },
    {
      id: "first-floor",
      title: { en: "First floor", es: "Primera planta", de: "Obergeschoss" },
      imageUrl: "/property-demo/floor-plan.svg",
      downloadUrl: "/property-demo/floor-plan.svg",
      sortOrder: 2,
    },
  ],
  location: {
    displayAddress: {
      en: "Altea, Alicante, Costa Blanca",
      es: "Altea, Alicante, Costa Blanca",
      de: "Altea, Alicante, Costa Blanca",
    },
    privacyMode: "approximate",
    showMap: true,
    mapExternalUrl: "https://www.google.com/maps/place/Altea,+Alicante",
    airportTravelTime: {
      en: "Approximately 45 minutes to Alicante Airport",
      es: "Aproximadamente 45 minutos al Aeropuerto de Alicante",
      de: "Etwa 45 Minuten zum Flughafen Alicante",
    },
  },
  agent: {
    agencyName: "Demo Real Estate Agency",
    displayProfile: true,
    agentName: "Costa Blanca Property Team",
    role: {
      en: "International property advisor",
      es: "Asesor inmobiliario internacional",
      de: "Internationaler Immobilienberater",
    },
    phone: "+34 600 000 000",
    whatsapp: "+34 600 000 000",
    email: "listings@example.com",
    website: "https://picchuspot.com",
    socialLinks: [
      {
        provider: "instagram",
        url: "https://www.instagram.com/picchuspot",
        sortOrder: 1,
      },
      {
        provider: "linkedin",
        url: "https://www.linkedin.com/company/picchuspot",
        sortOrder: 2,
      },
    ],
  },
};

const noHighlightsDemo: PropertyShowcase = {
  ...costaBlancaDemo,
  slug: "quiet-townhouse",
  reference: "PS-002",
  primaryLanguage: "en",
  languages: ["en"],
  translations: undefined,
  title: {
    en: "Quiet Townhouse",
  },
  summary: {
    en: "A compact showcase variant used to verify that the overview remains balanced without highlights.",
  },
  description: [
    {
      en: "A simple one-language listing with the same media tools but fewer public sections.",
    },
  ],
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
  interactiveFloorPlanTour: undefined,
  location: {
    displayAddress: { en: "Moraira, Alicante" },
    privacyMode: "hidden",
    showMap: false,
  },
  agent: {
    agencyName: "Demo Real Estate Agency",
    displayProfile: true,
  },
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

export { costaBlancaDemo, noHighlightsDemo };
