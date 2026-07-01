import {
  ORDER_SERVICE_CATALOG,
  getOrderServiceCatalogEntry,
  type OrderServiceAvailability,
  type OrderServiceCatalogEntry,
  type OrderServiceCanonicalFields,
  type OrderServiceSlug,
} from "../../lib/order-service-catalog.ts";
import type { SupportChatLanguage } from "./support-chat-copy.ts";

export type OrderAssistantGoalId =
  | "add-furniture-empty-rooms"
  | "change-furniture-or-finishes"
  | "remove-objects-or-clean-room"
  | "improve-brightness-colour-presentation"
  | "turn-daytime-exterior-to-dusk"
  | "create-floor-plan";

export type OrderAssistantQuestionId = "property-image-goal";

export type OrderAssistantServiceId = OrderServiceSlug;

interface LocalizedText {
  en: string;
  es: string;
}

interface OrderAssistantGoal {
  id: OrderAssistantGoalId;
  labels: LocalizedText;
  recommendedServiceId: OrderAssistantServiceId;
}

interface OrderAssistantQuestion {
  id: OrderAssistantQuestionId;
  labels: LocalizedText;
  choices: readonly OrderAssistantGoal[];
}

interface OrderAssistantServiceCopy {
  labels: Pick<LocalizedText, "es">;
  reasons: LocalizedText;
}

export interface OrderAssistantService {
  id: OrderAssistantServiceId;
  title: string;
  publicServiceSlug: string;
  availability: OrderServiceAvailability;
  labels: LocalizedText;
  reasons: LocalizedText;
  orderHref: string;
  detailHref?: LocalizedText;
}

export interface LocalizedOrderAssistantChoice {
  id: OrderAssistantGoalId;
  label: string;
  recommendedServiceId: OrderAssistantServiceId;
}

export interface LocalizedOrderAssistantQuestion {
  id: OrderAssistantQuestionId;
  label: string;
  choices: LocalizedOrderAssistantChoice[];
}

export interface LocalizedOrderAssistantService {
  id: OrderAssistantServiceId;
  label: string;
  reason: string;
  orderHref: string;
  detailHref?: string;
}

export const ORDER_ASSISTANT_INITIAL_QUESTION_ID: OrderAssistantQuestionId =
  "property-image-goal";

export const orderAssistantCopy = {
  en: {
    intro:
      "Tell us what you need, and we'll point you to the right service.",
    recommendedHeading: "Recommended service",
    startOrder: "Start this order",
    viewDetails: "View service details",
    chooseAnother: "Choose another service",
    backToChat: "Back to chat",
  },
  es: {
    intro:
      "Cu\u00e9ntanos qu\u00e9 necesitas y te indicaremos el servicio adecuado.",
    recommendedHeading: "Servicio recomendado",
    startOrder: "Empezar este pedido",
    viewDetails: "Ver detalles del servicio",
    chooseAnother: "Elegir otro servicio",
    backToChat: "Volver al chat",
  },
} as const satisfies Record<SupportChatLanguage, Record<string, string>>;

const orderAssistantServiceCopy = {
  "virtual-staging": {
    labels: {
      es: "Virtual Staging",
    },
    reasons: {
      en: "Best for empty rooms where you want realistic furniture and decor added to the photo.",
      es: "Ideal para habitaciones vac\u00edas donde quieres a\u00f1adir mobiliario y decoraci\u00f3n realistas a la foto.",
    },
  },
  "virtual-renovation": {
    labels: {
      es: "Virtual Renovation",
    },
    reasons: {
      en: "Best when the room or exterior needs different finishes, materials, fixtures, or design direction.",
      es: "Ideal cuando una estancia o exterior necesita otros acabados, materiales, elementos o direcci\u00f3n de dise\u00f1o.",
    },
  },
  "item-removal-virtual-cleaning": {
    labels: {
      es: "Eliminaci\u00f3n de objetos y limpieza virtual",
    },
    reasons: {
      en: "Best for removing clutter, objects, personal items, or distractions so the space looks listing-ready.",
      es: "Ideal para eliminar desorden, objetos personales o distracciones y dejar el espacio listo para publicar.",
    },
  },
  "day-to-dusk": {
    labels: {
      es: "Day to Dusk",
    },
    reasons: {
      en: "Best for turning a daytime exterior into a warm twilight image with a stronger listing mood.",
      es: "Ideal para convertir un exterior de d\u00eda en una imagen de atardecer c\u00e1lida y m\u00e1s atractiva para el anuncio.",
    },
  },
  "image-enhancement": {
    labels: {
      es: "Mejora de imagen",
    },
    reasons: {
      en: "Best for improving brightness, colour, exposure, white balance, contrast, and overall presentation.",
      es: "Ideal para mejorar brillo, color, exposici\u00f3n, balance de blancos, contraste y presentaci\u00f3n general.",
    },
  },
  "floor-plans": {
    labels: {
      es: "Planos",
    },
    reasons: {
      en: "Best for turning sketches, scans, PDFs, or measurements into clean 2D or 3D floor plans.",
      es: "Ideal para convertir bocetos, escaneos, PDFs o medidas en planos 2D o 3D limpios.",
    },
  },
} as const satisfies Partial<Record<OrderAssistantServiceId, OrderAssistantServiceCopy>>;

const servicesWithPublicPricingPages = new Set<OrderAssistantServiceId>([
  "virtual-staging",
  "virtual-renovation",
  "day-to-dusk",
  "image-enhancement",
  "floor-plans",
]);

const orderAssistantQuestions = [
  {
    id: "property-image-goal",
    labels: {
      en: "What would you like to do with your property images?",
      es: "\u00bfQu\u00e9 te gustar\u00eda hacer con las im\u00e1genes de tu propiedad?",
    },
    choices: [
      {
        id: "add-furniture-empty-rooms",
        labels: {
          en: "Add furniture to empty rooms",
          es: "A\u00f1adir muebles a habitaciones vac\u00edas",
        },
        recommendedServiceId: "virtual-staging",
      },
      {
        id: "change-furniture-or-finishes",
        labels: {
          en: "Change existing furniture or finishes",
          es: "Cambiar muebles o acabados existentes",
        },
        recommendedServiceId: "virtual-renovation",
      },
      {
        id: "remove-objects-or-clean-room",
        labels: {
          en: "Remove objects or clean up a room",
          es: "Eliminar objetos o limpiar una habitaci\u00f3n",
        },
        recommendedServiceId: "item-removal-virtual-cleaning",
      },
      {
        id: "improve-brightness-colour-presentation",
        labels: {
          en: "Improve brightness, colour and overall presentation",
          es: "Mejorar brillo, color y presentaci\u00f3n general",
        },
        recommendedServiceId: "image-enhancement",
      },
      {
        id: "turn-daytime-exterior-to-dusk",
        labels: {
          en: "Turn a daytime exterior into dusk",
          es: "Convertir un exterior de d\u00eda en atardecer",
        },
        recommendedServiceId: "day-to-dusk",
      },
      {
        id: "create-floor-plan",
        labels: {
          en: "Create a floor plan",
          es: "Crear un plano",
        },
        recommendedServiceId: "floor-plans",
      },
    ],
  },
] as const satisfies readonly OrderAssistantQuestion[];

export function getOrderAssistantQuestion(
  language: SupportChatLanguage,
  questionId: OrderAssistantQuestionId = ORDER_ASSISTANT_INITIAL_QUESTION_ID,
): LocalizedOrderAssistantQuestion | null {
  const question = orderAssistantQuestions.find((item) => item.id === questionId);
  if (!question) return null;

  return {
    id: question.id,
    label: question.labels[language],
    choices: question.choices.map((choice) => ({
      id: choice.id,
      label: choice.labels[language],
      recommendedServiceId: choice.recommendedServiceId,
    })),
  };
}

export function getOrderAssistantGoals(language: SupportChatLanguage) {
  return getOrderAssistantQuestion(language)?.choices ?? [];
}

export function getOrderAssistantServices(): OrderAssistantService[] {
  return Object.keys(orderAssistantServiceCopy)
    .map((serviceId) => getOrderAssistantService(serviceId))
    .filter((service): service is OrderAssistantService => service !== null);
}

export function getOrderAssistantService(
  serviceId: string,
): OrderAssistantService | null {
  const canonicalService = getOrderServiceCatalogEntry(serviceId);
  if (!isRecommendableCanonicalService(canonicalService)) return null;

  const copy = getServiceCopy(canonicalService.slug);
  if (!copy) return null;

  return buildOrderAssistantService(canonicalService, copy);
}

export function getLocalizedOrderAssistantService(
  language: SupportChatLanguage,
  serviceId: string,
): LocalizedOrderAssistantService | null {
  const service = getOrderAssistantService(serviceId);
  if (!service) return null;

  return {
    id: service.id,
    label: service.labels[language],
    reason: service.reasons[language],
    orderHref: service.orderHref,
    detailHref: service.detailHref?.[language],
  };
}

export function getOrderAssistantRecommendation(
  goalId: string,
  answerId?: string,
): OrderAssistantService | null {
  if (answerId) return null;

  const goal = orderAssistantQuestions[0].choices.find(
    (choice) => choice.id === goalId,
  );
  if (!goal) return null;

  return getOrderAssistantService(goal.recommendedServiceId);
}

export function getLocalizedOrderAssistantRecommendation(
  language: SupportChatLanguage,
  goalId: string,
  answerId?: string,
): LocalizedOrderAssistantService | null {
  const service = getOrderAssistantRecommendation(goalId, answerId);
  return service
    ? getLocalizedOrderAssistantService(language, service.id)
    : null;
}

export function isOrderAssistantOrderHref(href: string) {
  return (
    href === "/dashboard/orders/new" ||
    href.startsWith("/dashboard/orders/new/")
  );
}

function buildOrderAssistantService(
  canonicalService: OrderServiceCatalogEntry & { route: string },
  copy: OrderAssistantServiceCopy,
): OrderAssistantService {
  return {
    id: canonicalService.slug,
    title: canonicalService.title,
    publicServiceSlug: canonicalService.publicServiceSlug,
    availability: canonicalService.availability,
    labels: {
      en: canonicalService.title,
      es: copy.labels.es,
    },
    reasons: { ...copy.reasons },
    orderHref: canonicalService.route,
    detailHref: getServiceDetailHref(canonicalService),
  };
}

function getServiceCopy(
  serviceId: string,
): OrderAssistantServiceCopy | undefined {
  if (!isOrderAssistantServiceId(serviceId)) return undefined;
  return orderAssistantServiceCopy[serviceId];
}

function isOrderAssistantServiceId(
  serviceId: string,
): serviceId is keyof typeof orderAssistantServiceCopy {
  return serviceId in orderAssistantServiceCopy;
}

function isRecommendableCanonicalService(
  service: OrderServiceCanonicalFields | null,
): service is OrderServiceCanonicalFields & { route: string } {
  return service?.availability === "active" && service.route !== null;
}

function getServiceDetailHref(
  service: OrderServiceCatalogEntry,
): LocalizedText | undefined {
  const detailSlug = getPublicPricingSlug(service);
  if (!detailSlug) return undefined;

  return {
    en: `/pricing/${detailSlug}`,
    es: `/es/pricing/${detailSlug}`,
  };
}

function getPublicPricingSlug(
  service: OrderServiceCatalogEntry,
): string | null {
  if (servicesWithPublicPricingPages.has(service.slug)) {
    return service.publicServiceSlug;
  }

  if (service.slug === "item-removal-virtual-cleaning") {
    // Current public routing keeps Item Removal & Virtual Cleaning under
    // the legacy Photo Editing pricing page instead of its canonical slug.
    return "photo-editing";
  }

  return null;
}

export function getActiveOrderServiceCatalogEntries() {
  return ORDER_SERVICE_CATALOG.filter(
    (service) => service.availability === "active" && service.route !== null,
  ).map((service) => ({ ...service }));
}
