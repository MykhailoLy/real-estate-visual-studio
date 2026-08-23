import {
  SupportAssistantGenerationError,
  type SupportAssistantGenerationLogCategory,
} from "./types.ts";

export interface GeminiSupportInteractionLike extends Record<string, unknown> {
  status?: unknown;
  output_text?: unknown;
  steps?: unknown;
}

function logCategoryForGeminiStatus(
  status: unknown,
): SupportAssistantGenerationLogCategory {
  switch (status) {
    case "incomplete":
      return "provider_incomplete";
    case "budget_exceeded":
      return "provider_budget_exceeded";
    case "failed":
      return "provider_failed";
    default:
      return "provider_unexpected_status";
  }
}

export function extractCompletedGeminiSupportOutput(
  interaction: GeminiSupportInteractionLike,
): string {
  assertCompletedGeminiSupportInteraction(interaction);

  const output =
    typeof interaction.output_text === "string"
      ? interaction.output_text.trim()
      : "";
  if (!output) {
    throw new SupportAssistantGenerationError(
      "Support assistant returned an empty response.",
    );
  }

  return output;
}

export function assertCompletedGeminiSupportInteraction(
  interaction: GeminiSupportInteractionLike,
): void {
  if (interaction.status !== "completed") {
    throw new SupportAssistantGenerationError(
      "Support assistant provider did not complete.",
      logCategoryForGeminiStatus(interaction.status),
    );
  }
}
