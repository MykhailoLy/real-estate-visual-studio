import type { SupportChatMessage } from "./support-chat-client.ts";

export const SUPPORT_CHAT_SESSION_STORAGE_KEY =
  "picchuspot_support_chat_session_v1";
export const SUPPORT_CHAT_SESSION_VERSION = 1;
export const SUPPORT_CHAT_SESSION_MAX_MESSAGES = 20;
export const SUPPORT_CHAT_SESSION_MAX_CHARACTERS = 20000;

export interface SupportChatSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SupportChatSessionPayload {
  version: typeof SUPPORT_CHAT_SESSION_VERSION;
  messages: SupportChatMessage[];
}

export function sanitizeSupportChatSessionMessages(
  messages: readonly SupportChatMessage[],
  {
    maxMessages = SUPPORT_CHAT_SESSION_MAX_MESSAGES,
    maxCharacters = SUPPORT_CHAT_SESSION_MAX_CHARACTERS,
  }: {
    maxMessages?: number;
    maxCharacters?: number;
  } = {},
): SupportChatMessage[] {
  const selected: SupportChatMessage[] = [];
  let characterTotal = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = toSupportChatSessionMessage(messages[index]);
    if (!message) continue;
    if (selected.length >= maxMessages) break;
    if (characterTotal + message.content.length > maxCharacters) continue;

    selected.unshift(message);
    characterTotal += message.content.length;
  }

  return selected;
}

export function readSupportChatSession(
  storage: SupportChatSessionStorage,
): SupportChatMessage[] {
  let rawPayload: string | null;

  try {
    rawPayload = storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY);
  } catch {
    return [];
  }

  if (!rawPayload) return [];

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawPayload);
  } catch {
    clearSupportChatSession(storage);
    return [];
  }

  if (!isRecord(parsedPayload) || parsedPayload.version !== SUPPORT_CHAT_SESSION_VERSION) {
    clearSupportChatSession(storage);
    return [];
  }

  const rawMessages = parsedPayload.messages;
  if (!Array.isArray(rawMessages)) {
    clearSupportChatSession(storage);
    return [];
  }

  const restoredMessages: SupportChatMessage[] = [];
  for (const rawMessage of rawMessages) {
    const message = toSupportChatSessionMessage(rawMessage);
    if (!message) {
      clearSupportChatSession(storage);
      return [];
    }
    restoredMessages.push(message);
  }

  return sanitizeSupportChatSessionMessages(restoredMessages);
}

export function writeSupportChatSession(
  storage: SupportChatSessionStorage,
  messages: readonly SupportChatMessage[],
) {
  const sanitizedMessages = sanitizeSupportChatSessionMessages(messages);

  if (!sanitizedMessages.length) {
    clearSupportChatSession(storage);
    return;
  }

  const payload: SupportChatSessionPayload = {
    version: SUPPORT_CHAT_SESSION_VERSION,
    messages: sanitizedMessages,
  };

  try {
    storage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}

export function clearSupportChatSession(storage: SupportChatSessionStorage) {
  try {
    storage.removeItem(SUPPORT_CHAT_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
}

function toSupportChatSessionMessage(value: unknown): SupportChatMessage | null {
  if (!isRecord(value)) return null;

  const { id, role, content, origin, status } = value;
  if (typeof id !== "string" || !id.trim()) return null;
  if (typeof content !== "string" || !content.trim()) return null;
  if (status !== "complete") return null;

  if (role === "user" && origin === "local") {
    return {
      id,
      role,
      content,
      origin,
      status,
    };
  }

  if (role === "assistant" && origin === "remote") {
    return {
      id,
      role,
      content,
      origin,
      status,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
