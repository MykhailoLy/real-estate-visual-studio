export type SupportChatLanguage = "en" | "es";

export type SupportChatLinkKey = "pricing" | "services" | "contact";

export type SupportChatQuickActionKey =
  | "pricing"
  | "services"
  | "howToOrder"
  | "talkToPerson";

export const supportChatCopy = {
  en: {
    headerTitle: "PicchuSpot Assistant",
    status: "AI assistant available",
    initialMessage:
      "Hi! I can help with pricing, services, turnaround times, and placing an order.\nWhat can I help you with?",
    launcherLabel: "Ask PicchuSpot",
    mobileLauncherLabel: "Ask PicchuSpot",
    launcherAriaLabel: "Open PicchuSpot AI assistant",
    closeAriaLabel: "Close PicchuSpot assistant",
    dialogLabel: "PicchuSpot support assistant",
    composerLabel: "Message PicchuSpot assistant",
    composerPlaceholder: "Type your question...",
    sendLabel: "Send message",
    sendingLabel: "Sending",
    loadingText: "PicchuSpot Assistant is typing...",
    characterCount: (count: number) => `${count}/2000`,
    footerNote: "AI can make mistakes. Check important details.",
    contactLinkLabel: "Contact page",
    quickActions: {
      pricing: "View pricing",
      services: "Choose a service",
      howToOrder: "How to order",
      talkToPerson: "Talk to a person",
    },
    prompts: {
      howToOrder: "How do I place an order with PicchuSpot?",
    },
    humanSupportMessage:
      "Live support is being prepared. For now, please contact our team through the contact page.",
    errors: {
      invalidInput:
        "That message could not be sent. Please shorten it and try again.",
      rateLimited: (seconds: number) =>
        `You've sent several messages quickly. Please try again in ${seconds}s.`,
      generationFailed: "I couldn't generate a response just now. Please try again.",
      unavailable:
        "The assistant is temporarily unavailable. You can still contact us through the contact page.",
      network:
        "The connection was interrupted. Check your internet connection and try again.",
    },
  },
  es: {
    headerTitle: "Asistente PicchuSpot",
    status: "Asistente de IA disponible",
    initialMessage:
      "¡Hola! Puedo ayudarte con precios, servicios, plazos de entrega y cómo realizar un pedido.\n¿En qué puedo ayudarte?",
    launcherLabel: "Pregunta a PicchuSpot",
    mobileLauncherLabel: "Preguntar",
    launcherAriaLabel: "Abrir el asistente de IA de PicchuSpot",
    closeAriaLabel: "Cerrar el asistente de PicchuSpot",
    dialogLabel: "Asistente de soporte de PicchuSpot",
    composerLabel: "Mensaje para el asistente de PicchuSpot",
    composerPlaceholder: "Escribe tu pregunta...",
    sendLabel: "Enviar mensaje",
    sendingLabel: "Enviando",
    loadingText: "El Asistente PicchuSpot está escribiendo...",
    characterCount: (count: number) => `${count}/2000`,
    footerNote: "La IA puede cometer errores. Comprueba la información importante.",
    contactLinkLabel: "Página de contacto",
    quickActions: {
      pricing: "Ver precios",
      services: "Elegir un servicio",
      howToOrder: "Cómo hacer un pedido",
      talkToPerson: "Hablar con una persona",
    },
    prompts: {
      howToOrder: "¿Cómo puedo realizar un pedido en PicchuSpot?",
    },
    humanSupportMessage:
      "Estamos preparando la atención en vivo. Por ahora, puedes contactar con nuestro equipo a través de la página de contacto.",
    errors: {
      invalidInput:
        "No se pudo enviar el mensaje. Acórtalo e inténtalo de nuevo.",
      rateLimited: (seconds: number) =>
        `Has enviado varios mensajes rápidamente. Inténtalo de nuevo en ${seconds}s.`,
      generationFailed:
        "No pude generar una respuesta en este momento. Inténtalo de nuevo.",
      unavailable:
        "El asistente no está disponible temporalmente. Puedes contactarnos a través de la página de contacto.",
      network:
        "La conexión se interrumpió. Comprueba tu conexión a internet e inténtalo de nuevo.",
    },
  },
} as const;

const localizedPaths = {
  pricing: "/pricing",
  services: "/services",
  contact: "/contact",
} as const satisfies Record<SupportChatLinkKey, string>;

export function getSupportChatLink(
  language: SupportChatLanguage,
  key: SupportChatLinkKey,
) {
  const path = localizedPaths[key];
  return language === "es" ? `/es${path}` : path;
}

