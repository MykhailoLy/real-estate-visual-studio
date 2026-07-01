export type SupportChatLanguage = "en" | "es";

export type SupportChatLinkKey = "pricing" | "services" | "contact";

export type SupportChatQuickActionKey =
  | "chooseService"
  | "pricing"
  | "services"
  | "howToOrder"
  | "talkToPerson";

export type SupportChatQuickActionBehavior =
  | "orderAssistant"
  | "navigate"
  | "prompt"
  | "handoff";

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
    orderAction: {
      startOrder: "Start this order",
      startOrderAriaLabel: "Start this order",
    },
    quickActions: {
      chooseService: "Help me choose a service",
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
    handoff: {
      heading: "Talk to a person",
      explanation:
        "Share your contact details and we'll connect you with the PicchuSpot team. A short summary of this chat will be included so you don't have to repeat yourself.",
      continuityNote:
        "Your information will be handled according to our Privacy Policy.",
      nameLabel: "Name",
      nameOptional: "optional",
      emailLabel: "Email",
      continueButton: "Continue to live support",
      cancelButton: "Cancel",
      connecting: "Connecting to live support...",
      productionOnly:
        "Live support is available on the live PicchuSpot website. You can continue using the AI assistant here or contact us through the contact page.",
      retry:
        "Live support could not connect just now. Please try again or continue using the AI assistant.",
      validation: {
        nameTooLong: "Name must be 80 characters or fewer.",
        emailRequired: "Email is required.",
        emailTooLong: "Email must be 254 characters or fewer.",
        emailInvalid: "Enter a valid email address.",
      },
    },
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
    orderAction: {
      startOrder: "Empezar este pedido",
      startOrderAriaLabel: "Empezar este pedido",
    },
    quickActions: {
      chooseService: "Ay\u00fadame a elegir un servicio",
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
    handoff: {
      heading: "Hablar con una persona",
      explanation:
        "Comparte tus datos de contacto y te conectaremos con el equipo de PicchuSpot. Incluiremos un breve resumen de este chat para que no tengas que repetir la información.",
      continuityNote:
        "Tu información se tratará de acuerdo con nuestra Política de privacidad.",
      nameLabel: "Nombre",
      nameOptional: "opcional",
      emailLabel: "Correo electrónico",
      continueButton: "Continuar con atención en vivo",
      cancelButton: "Cancelar",
      connecting: "Conectando con atención en vivo...",
      productionOnly:
        "La atención en vivo está disponible en el sitio web activo de PicchuSpot. Puedes seguir usando el asistente de IA aquí o contactarnos a través de la página de contacto.",
      retry:
        "No se pudo conectar con la atención en vivo en este momento. Inténtalo de nuevo o sigue usando el asistente de IA.",
      validation: {
        nameTooLong: "El nombre debe tener 80 caracteres o menos.",
        emailRequired: "El correo electrónico es obligatorio.",
        emailTooLong: "El correo electrónico debe tener 254 caracteres o menos.",
        emailInvalid: "Introduce un correo electrónico válido.",
      },
    },
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

export function getSupportChatQuickActionBehavior(
  action: SupportChatQuickActionKey,
): SupportChatQuickActionBehavior {
  switch (action) {
    case "chooseService":
      return "orderAssistant";
    case "pricing":
    case "services":
      return "navigate";
    case "howToOrder":
      return "prompt";
    case "talkToPerson":
      return "handoff";
  }
}

