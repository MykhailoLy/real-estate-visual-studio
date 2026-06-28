import { z } from "zod";

export const SUPPORT_ASSISTANT_MAX_BODY_BYTES = 32 * 1024;
export const SUPPORT_ASSISTANT_MAX_MESSAGE_CHARS = 2000;
export const SUPPORT_ASSISTANT_MAX_HISTORY_MESSAGES = 6;
export const SUPPORT_ASSISTANT_MAX_TRANSCRIPT_CHARS = 8000;
export const SUPPORT_ASSISTANT_MAX_RESPONSE_CHARS = 8000;

export const SupportAssistantHistoryMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z
      .string()
      .trim()
      .min(1, "History message cannot be empty.")
      .max(
        SUPPORT_ASSISTANT_MAX_MESSAGE_CHARS,
        "History message is too long.",
      ),
  })
  .strict();

export const SupportAssistantRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Message is required.")
      .max(SUPPORT_ASSISTANT_MAX_MESSAGE_CHARS, "Message is too long."),
    history: z
      .array(SupportAssistantHistoryMessageSchema)
      .max(
        SUPPORT_ASSISTANT_MAX_HISTORY_MESSAGES,
        "Conversation history is too long.",
      )
      .optional()
      .default([]),
  })
  .strict();

export type SupportAssistantRequestData = z.infer<
  typeof SupportAssistantRequestSchema
>;
