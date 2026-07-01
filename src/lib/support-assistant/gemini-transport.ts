import "server-only";

import { GoogleGenAI } from "@google/genai";
import { PICCHUSPOT_SUPPORT_SYSTEM_PROMPT } from "./prompt.ts";
import { buildGeminiSupportInteractionRequest } from "./gemini-request.ts";
import { extractCompletedGeminiSupportOutput } from "./gemini-response.ts";
import {
  SupportAssistantConfigurationError,
  SupportAssistantGenerationError,
  type SupportAssistantTransport,
} from "./types.ts";

let geminiClient: GoogleGenAI | null = null;
let geminiClientApiKey = "";

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new SupportAssistantConfigurationError(
      "GEMINI_API_KEY is not configured.",
    );
  }
  return apiKey;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!geminiClient || geminiClientApiKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    geminiClientApiKey = apiKey;
  }
  return geminiClient;
}

export class GeminiSupportTransport implements SupportAssistantTransport {
  async generate(input: string): Promise<string> {
    try {
      const interaction = await getGeminiClient().interactions.create(
        buildGeminiSupportInteractionRequest(
          input,
          PICCHUSPOT_SUPPORT_SYSTEM_PROMPT,
        ),
      );
      return extractCompletedGeminiSupportOutput(interaction);
    } catch (error) {
      if (
        error instanceof SupportAssistantConfigurationError ||
        error instanceof SupportAssistantGenerationError
      ) {
        throw error;
      }
      throw new SupportAssistantGenerationError(
        "Support assistant provider request failed.",
        "provider_failed",
      );
    }
  }
}

export function createGeminiSupportTransport(): SupportAssistantTransport {
  return new GeminiSupportTransport();
}
