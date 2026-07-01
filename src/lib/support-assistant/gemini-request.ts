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
  input: string;
}

export function buildGeminiSupportInteractionRequest(
  input: string,
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
    input,
  };
}
