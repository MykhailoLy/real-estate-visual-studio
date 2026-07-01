import type { SupportChatLanguage } from "./support-chat-copy.ts";

export type OrderAssistantGoalId =
  | "add-furniture-empty-rooms"
  | "change-furniture-or-finishes"
  | "remove-objects-or-clean-room"
  | "improve-existing-photo"
  | "turn-daytime-exterior-to-dusk"
  | "create-floor-plan"
  | "improve-brightness-colour-presentation"
  | "request-specific-photo-edit";

export type OrderAssistantQuestionId =
  | "property-image-goal"
  | "photo-editing-goal";

export type OrderAssistantServiceId =
  | "virtual-staging"
  | "virtual-renovation"
  | "item-removal-virtual-cleaning"
  | "day-to-dusk"
  | "image-enhancement"
  | "photo-editing"
  | "floor-plans";

interface LocalizedText {
  en: string;
  es: string;
}

interface OrderAssistantGoal {
  id: OrderAssistantGoalId;
  labels: LocalizedText;
  recommendedServiceId?: OrderAssistantServiceId;
  nextQuestionId?: OrderAssistantQuestionId;
}

interface OrderAssistantQuestion {
  id: OrderAssistantQuestionId;
  labels: LocalizedText;
  choices: readonly OrderAssistantGoal[];
}

export interface OrderAssistantService {
  id: OrderAssistantServiceId;
  labels: LocalizedText;
  reasons: LocalizedText;
  orderHref: string;
  detailHref?: LocalizedText;
}

export interface LocalizedOrderAssistantChoice {
  id: OrderAssistantGoalId;
  label: string;
  recommendedServiceId?: OrderAssistantServiceId;
  nextQuestionId?: OrderAssistantQuestionId;
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
    back: "Back",
  },
  es: {
    intro:
      "Cu\u00e9ntanos qu\u00e9 necesitas y te indicaremos el servicio adecuado.",
    recommendedHeading: "Servicio recomendado",
    startOrder: "Empezar este pedido",
    viewDetails: "Ver detalles del servicio",
    chooseAnother: "Elegir otro servicio",
    backToChat: "Volver al chat",
    back: "Atr\u00e1s",
  },
} as const satisfies Record<SupportChatLanguage, Record<string, string>>;

const orderAssistantServices = [
  {
    id: "virtual-staging",
    labels: {
      en: "Virtual Staging",
      es: "Virtual Staging",
    },
    reasons: {
      en: "Best for empty rooms where you want realistic furniture and decor added to the photo.",
      es: "Ideal para habitaciones vac\u00edas donde quieres a\u00f1adir mobiliario y decoraci\u00f3n realistas a la foto.",
    },
    orderHref: "/dashboard/orders/new/virtual-staging",
    detailHref: {
      en: "/pricing/virtual-staging",
      es: "/es/pricing/virtual-staging",
    },
  },
  {
    id: "virtual-renovation",
    labels: {
      en: "Virtual Renovation",
      es: "Virtual Renovation",
    },
    reasons: {
      en: "Best when the room or exterior needs different finishes, materials, fixtures, or design direction.",
      es: "Ideal cuando una estancia o exterior necesita otros acabados, materiales, elementos o direcci\u00f3n de dise\u00f1o.",
    },
    orderHref: "/dashboard/orders/new/virtual-renovation",
    detailHref: {
      en: "/pricing/virtual-renovation",
      es: "/es/pricing/virtual-renovation",
    },
  },
  {
    id: "item-removal-virtual-cleaning",
    labels: {
      en: "Item Removal & Virtual Cleaning",
      es: "Eliminaci\u00f3n de objetos y limpieza virtual",
    },
    reasons: {
      en: "Best for removing clutter, objects, personal items, or distractions so the space looks listing-ready.",
      es: "Ideal para eliminar desorden, objetos personales o distracciones y dejar el espacio listo para publicar.",
    },
    orderHref: "/dashboard/orders/new/item-removal-virtual-cleaning",
    detailHref: {
      en: "/pricing/photo-editing",
      es: "/es/pricing/photo-editing",
    },
  },
  {
    id: "day-to-dusk",
    labels: {
      en: "Day to Dusk",
      es: "Day to Dusk",
    },
    reasons: {
      en: "Best for turning a daytime exterior into a warm twilight image with a stronger listing mood.",
      es: "Ideal para convertir un exterior de d\u00eda en una imagen de atardecer c\u00e1lida y m\u00e1s atractiva para el anuncio.",
    },
    orderHref: "/dashboard/orders/new/day-to-dusk",
    detailHref: {
      en: "/pricing/day-to-dusk",
      es: "/es/pricing/day-to-dusk",
    },
  },
  {
    id: "image-enhancement",
    labels: {
      en: "Image Enhancement",
      es: "Mejora de imagen",
    },
    reasons: {
      en: "Best for improving brightness, colour, exposure, white balance, contrast, and overall presentation.",
      es: "Ideal para mejorar brillo, color, exposici\u00f3n, balance de blancos, contraste y presentaci\u00f3n general.",
    },
    orderHref: "/dashboard/orders/new/image-enhancement",
    detailHref: {
      en: "/pricing/image-enhancement",
      es: "/es/pricing/image-enhancement",
    },
  },
  {
    id: "photo-editing",
    labels: {
      en: "Photo Editing",
      es: "Edici\u00f3n fotogr\u00e1fica",
    },
    reasons: {
      en: "Best for a specific real-estate photo edit when the request is broader than basic image enhancement.",
      es: "Ideal para una edici\u00f3n fotogr\u00e1fica inmobiliaria espec\u00edfica cuando la solicitud va m\u00e1s all\u00e1 de una mejora b\u00e1sica.",
    },
    orderHref: "/dashboard/orders/new/photo-editing",
  },
  {
    id: "floor-plans",
    labels: {
      en: "Floor Plans",
      es: "Planos",
    },
    reasons: {
      en: "Best for turning sketches, scans, PDFs, or measurements into clean 2D or 3D floor plans.",
      es: "Ideal para convertir bocetos, escaneos, PDFs o medidas en planos 2D o 3D limpios.",
    },
    orderHref: "/dashboard/orders/new/3d-floor-plans",
    detailHref: {
      en: "/pricing/floor-plans",
      es: "/es/pricing/floor-plans",
    },
  },
] as const satisfies readonly OrderAssistantService[];

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
        id: "improve-existing-photo",
        labels: {
          en: "Improve an existing photo",
          es: "Mejorar una foto existente",
        },
        nextQuestionId: "photo-editing-goal",
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
  {
    id: "photo-editing-goal",
    labels: {
      en: "What kind of photo improvement do you need?",
      es: "\u00bfQu\u00e9 tipo de mejora fotogr\u00e1fica necesitas?",
    },
    choices: [
      {
        id: "improve-brightness-colour-presentation",
        labels: {
          en: "Improve brightness, colour and overall presentation",
          es: "Mejorar brillo, color y presentaci\u00f3n general",
        },
        recommendedServiceId: "image-enhancement",
      },
      {
        id: "request-specific-photo-edit",
        labels: {
          en: "Request a specific edit or visual change",
          es: "Pedir una edici\u00f3n espec\u00edfica o cambio visual",
        },
        recommendedServiceId: "photo-editing",
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
      recommendedServiceId: getChoiceRecommendedServiceId(choice),
      nextQuestionId: getChoiceNextQuestionId(choice),
    })),
  };
}

export function getOrderAssistantGoals(language: SupportChatLanguage) {
  return getOrderAssistantQuestion(language)?.choices ?? [];
}

export function getOrderAssistantServices(): OrderAssistantService[] {
  return orderAssistantServices.map(cloneService);
}

export function getOrderAssistantService(
  serviceId: OrderAssistantServiceId,
): OrderAssistantService | null {
  const service = orderAssistantServices.find((item) => item.id === serviceId);
  return service ? cloneService(service) : null;
}

export function getLocalizedOrderAssistantService(
  language: SupportChatLanguage,
  serviceId: OrderAssistantServiceId,
): LocalizedOrderAssistantService | null {
  const service = orderAssistantServices.find((item) => item.id === serviceId);
  if (!service) return null;

  return {
    id: service.id,
    label: service.labels[language],
    reason: service.reasons[language],
    orderHref: service.orderHref,
    detailHref: getServiceDetailHref(service)?.[language],
  };
}

export function getOrderAssistantRecommendation(
  goalId: string,
  answerId?: string,
): OrderAssistantService | null {
  const goal = findGoal(goalId);
  if (!goal) return null;

  const nextQuestionId = getChoiceNextQuestionId(goal);
  const recommendedServiceId = getChoiceRecommendedServiceId(goal);

  if (nextQuestionId) {
    if (!answerId) return null;
    const answer = getQuestionChoice(nextQuestionId, answerId);
    const answerServiceId = answer
      ? getChoiceRecommendedServiceId(answer)
      : undefined;
    if (!answerServiceId) return null;
    return getOrderAssistantService(answerServiceId);
  }

  return recommendedServiceId
    ? getOrderAssistantService(recommendedServiceId)
    : null;
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

function findGoal(goalId: string): OrderAssistantGoal | null {
  for (const question of orderAssistantQuestions) {
    const goal = question.choices.find((choice) => choice.id === goalId);
    if (goal) return goal;
  }

  return null;
}

function getQuestionChoice(questionId: OrderAssistantQuestionId, goalId: string) {
  return (
    orderAssistantQuestions
      .find((question) => question.id === questionId)
      ?.choices.find((choice) => choice.id === goalId) ?? null
  );
}

function getChoiceRecommendedServiceId(
  choice: OrderAssistantGoal,
): OrderAssistantServiceId | undefined {
  return "recommendedServiceId" in choice
    ? choice.recommendedServiceId
    : undefined;
}

function getChoiceNextQuestionId(
  choice: OrderAssistantGoal,
): OrderAssistantQuestionId | undefined {
  return "nextQuestionId" in choice ? choice.nextQuestionId : undefined;
}

function cloneService(service: OrderAssistantService): OrderAssistantService {
  const detailHref = getServiceDetailHref(service);

  return {
    id: service.id,
    labels: { ...service.labels },
    reasons: { ...service.reasons },
    orderHref: service.orderHref,
    detailHref: detailHref ? { ...detailHref } : undefined,
  };
}

function getServiceDetailHref(
  service: OrderAssistantService,
): LocalizedText | undefined {
  return "detailHref" in service ? service.detailHref : undefined;
}
