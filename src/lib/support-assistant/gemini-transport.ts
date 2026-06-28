import "server-only";

import { GoogleGenAI } from "@google/genai";
import { PICCHUSPOT_SUPPORT_SYSTEM_PROMPT } from "./prompt.ts";
import { buildGeminiSupportInteractionRequest } from "./gemini-request.ts";
import { normalizeSupportAssistantOutput } from "./service.ts";
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
    let outputText: string | undefined;

    try {
      const interaction = await getGeminiClient().interactions.create(
        buildGeminiSupportInteractionRequest(
          input,
          PICCHUSPOT_SUPPORT_SYSTEM_PROMPT,
        ),
      );
      outputText = interaction.output_text;
    } catch (error) {
      if (error instanceof SupportAssistantConfigurationError) {
        throw error;
      }
      throw new SupportAssistantGenerationError();
    }

    return normalizeSupportAssistantOutput(outputText ?? "");
  }
}

export function createGeminiSupportTransport(): SupportAssistantTransport {
  return new GeminiSupportTransport();
}
