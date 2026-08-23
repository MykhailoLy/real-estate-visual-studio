import type { Interactions } from "@google/genai";
import { GEMINI_SUPPORT_PRICING_TOOLS } from "./pricing-tools.ts";

export const GEMINI_SUPPORT_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_SUPPORT_MAX_OUTPUT_TOKENS = 2048;

export interface GeminiSupportInteractionRequest {
  model: typeof GEMINI_SUPPORT_MODEL;
  store: false;
  system_instruction: string;
  generation_config: {
    thinking_level: "low";
    max_output_tokens: typeof GEMINI_SUPPORT_MAX_OUTPUT_TOKENS;
  };
  tools: Interactions.Tool[];
  input: Interactions.Step[];
}

export function buildGeminiSupportStatelessHistory(
  input: string,
): Interactions.Step[] {
  return [
    {
      type: "user_input",
      content: [{ type: "text", text: input }],
    },
  ];
}

export function buildGeminiSupportInteractionRequest(
  history: readonly Interactions.Step[],
  systemPrompt: string,
): GeminiSupportInteractionRequest {
  return {
    model: GEMINI_SUPPORT_MODEL,
    store: false,
    system_instruction: systemPrompt,
    generation_config: {
      thinking_level: "low",
      max_output_tokens: GEMINI_SUPPORT_MAX_OUTPUT_TOKENS,
    },
    tools: GEMINI_SUPPORT_PRICING_TOOLS.map((tool) => ({ ...tool })),
    input: [...history],
  };
}
