import type { Interactions } from "@google/genai";
import {
  SupportAssistantGenerationError,
  type SupportAssistantGenerationLogCategory,
} from "./types.ts";

type GeminiSupportInteractionLike = Partial<
  Pick<Interactions.Interaction, "status" | "output_text">
> &
  Record<string, unknown>;

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
  if (interaction.status !== "completed") {
    throw new SupportAssistantGenerationError(
      "Support assistant provider did not complete.",
      logCategoryForGeminiStatus(interaction.status),
    );
  }

  const output = (interaction.output_text ?? "").trim();
  if (!output) {
    throw new SupportAssistantGenerationError(
      "Support assistant returned an empty response.",
    );
  }

  return output;
}
