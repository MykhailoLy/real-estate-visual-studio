import {
  supportChatCopy,
  type SupportChatLanguage,
} from "./support-chat-copy.ts";
import type { SupportChatMessage } from "./support-chat-client.ts";

const HANDOFF_MAX_MESSAGES = 6;
const HANDOFF_MAX_CHARACTERS = 3000;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const PRACTICAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SupportHandoffIdentityInput {
  name: string;
  email: string;
}

export interface SupportHandoffIdentity {
  name: string;
  email: string;
}

export interface SupportHandoffIdentityErrors {
  name?: string;
  email?: string;
}

export interface SupportHandoffIdentityValidation {
  identity: SupportHandoffIdentity;
  errors: SupportHandoffIdentityErrors;
  valid: boolean;
}

export interface BuildSupportHandoffMessageOptions {
  language: SupportChatLanguage;
  pathname: string;
  messages: readonly SupportChatMessage[];
  maxMessages?: number;
  maxCharacters?: number;
}

interface HandoffTranscriptLine {
  role: "visitor" | "ai";
  content: string;
}

export function validateSupportHandoffIdentity(
  input: SupportHandoffIdentityInput,
  language: SupportChatLanguage,
): SupportHandoffIdentityValidation {
  const copy = supportChatCopy[language].handoff.validation;
  const name = input.name.trim();
  const email = input.email.trim();
  const errors: SupportHandoffIdentityErrors = {};

  if (name.length > NAME_MAX_LENGTH) {
    errors.name = copy.nameTooLong;
  }

  if (!email) {
    errors.email = copy.emailRequired;
  } else if (email.length > EMAIL_MAX_LENGTH) {
    errors.email = copy.emailTooLong;
  } else if (!PRACTICAL_EMAIL_PATTERN.test(email)) {
    errors.email = copy.emailInvalid;
  }

  return {
    identity: { name, email },
    errors,
    valid: !errors.name && !errors.email,
  };
}

export function isCrispProductionHostname(
  hostname: string | null | undefined,
) {
  const normalized = hostname?.trim().toLowerCase();
  return normalized === "picchuspot.com" || normalized === "www.picchuspot.com";
}

export function buildSupportHandoffMessage({
  language,
  pathname,
  messages,
  maxMessages = HANDOFF_MAX_MESSAGES,
  maxCharacters = HANDOFF_MAX_CHARACTERS,
}: BuildSupportHandoffMessageOptions) {
  const labels = getHandoffLabels(language);
  const pagePath = normalizeHandoffPath(pathname);
  const eligibleLines = messages
    .filter(isEligibleHandoffMessage)
    .map((message): HandoffTranscriptLine => ({
      role: message.role === "user" ? "visitor" : "ai",
      content: message.content.trim(),
    }))
    .filter((line) => line.content.length > 0);

  const selectedLines: HandoffTranscriptLine[] = [];

  for (let index = eligibleLines.length - 1; index >= 0; index -= 1) {
    const line = eligibleLines[index];
    if (!line || selectedLines.length >= maxMessages) break;

    const candidateLines = [line, ...selectedLines];
    const candidateMessage = formatHandoffMessage({
      labels,
      language,
      pagePath,
      lines: candidateLines,
    });

    if (candidateMessage.length > maxCharacters) break;
    selectedLines.unshift(line);
  }

  return formatHandoffMessage({
    labels,
    language,
    pagePath,
    lines: selectedLines,
  });
}

export function normalizeHandoffPath(pathname: string) {
  const pathOnly = pathname.split(/[?#]/, 1)[0]?.trim() || "/";
  const path = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function formatHandoffMessage({
  labels,
  language,
  pagePath,
  lines,
}: {
  labels: ReturnType<typeof getHandoffLabels>;
  language: SupportChatLanguage;
  pagePath: string;
  lines: readonly HandoffTranscriptLine[];
}) {
  const header = [
    labels.prefix,
    "",
    labels.contextNotice,
    "",
    `${labels.language}: ${language}`,
    `${labels.page}: ${pagePath}`,
  ];

  if (!lines.length) {
    return [...header, "", labels.noTranscript].join("\n");
  }

  return [
    ...header,
    "",
    labels.recentConversation,
    ...lines.map(
      (line) =>
        `${line.role === "visitor" ? labels.visitor : labels.ai}: ${
          line.content
        }`,
    ),
  ].join("\n");
}

function getHandoffLabels(language: SupportChatLanguage) {
  if (language === "es") {
    return {
      prefix:
        "[Compartido automáticamente por PicchuSpot antes de la atención humana]",
      contextNotice:
        "Este contexto se generó a partir de la conversación reciente con la IA y no fue escrito por un operador humano.",
      language: "Idioma",
      page: "Página actual",
      recentConversation: "Conversación reciente:",
      visitor: "Visitante",
      ai: "IA",
      noTranscript:
        "El visitante solicitó atención humana, pero no hay mensajes recientes aptos para compartir.",
    };
  }

  return {
    prefix: "[Automatically shared by PicchuSpot before human handoff]",
    contextNotice:
      "This context was generated from the recent AI conversation and was not written by a human operator.",
    language: "Language",
    page: "Current page",
    recentConversation: "Recent conversation:",
    visitor: "Visitor",
    ai: "AI",
    noTranscript:
      "The visitor requested human support, but there are no eligible recent messages to share.",
  };
}

function isEligibleHandoffMessage(message: SupportChatMessage) {
  if (message.status !== "complete") return false;
  if (message.localKind) return false;
  if (message.role === "user") return true;
  return message.role === "assistant" && message.origin === "remote";
}
