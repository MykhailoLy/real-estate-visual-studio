import type { Interactions } from "@google/genai";
import {
  buildGeminiSupportInteractionRequest,
  buildGeminiSupportStatelessHistory,
  type GeminiSupportInteractionRequest,
} from "./gemini-request.ts";
import {
  assertCompletedGeminiSupportInteraction,
  extractCompletedGeminiSupportOutput,
  type GeminiSupportInteractionLike,
} from "./gemini-response.ts";
import {
  SUPPORT_PRICING_TOOL_NAMES,
  SupportPricingToolValidationError,
  UnknownSupportPricingToolError,
  executeSupportPricingTool,
  type SupportPricingToolName,
} from "./pricing-tools.ts";
import { SupportAssistantGenerationError } from "./types.ts";

export const GEMINI_SUPPORT_MAX_TOOL_CALL_ROUNDS = 2;
export const GEMINI_SUPPORT_MAX_FUNCTION_CALLS_PER_ROUND = 4;

export type GeminiSupportInteractionCreator = (
  request: GeminiSupportInteractionRequest,
) => Promise<GeminiSupportInteractionLike>;

interface ValidatedFunctionCall {
  type: "function_call";
  name: SupportPricingToolName;
  arguments: Record<string, unknown>;
  id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportPricingToolName(
  name: string,
): name is SupportPricingToolName {
  return SUPPORT_PRICING_TOOL_NAMES.some((allowedName) => allowedName === name);
}

function interactionSteps(
  interaction: GeminiSupportInteractionLike,
): Interactions.Step[] {
  if (interaction.steps === undefined) return [];
  if (!Array.isArray(interaction.steps)) {
    throw new SupportAssistantGenerationError(
      "Support assistant provider returned invalid interaction steps.",
      "provider_failed",
    );
  }
  return interaction.steps as Interactions.Step[];
}

function validatedFunctionCalls(
  steps: readonly Interactions.Step[],
): ValidatedFunctionCall[] {
  const calls: ValidatedFunctionCall[] = [];

  for (const step of steps) {
    if (!isRecord(step) || step.type !== "function_call") continue;
    if (
      typeof step.name !== "string" ||
      typeof step.id !== "string" ||
      step.id.length === 0 ||
      !isRecord(step.arguments)
    ) {
      throw new SupportAssistantGenerationError(
        "Support assistant provider returned a malformed function call.",
        "provider_failed",
      );
    }
    if (!isSupportPricingToolName(step.name)) {
      throw new SupportAssistantGenerationError(
        "Support assistant provider returned an unauthorised function call.",
        "provider_failed",
      );
    }
    calls.push({
      type: "function_call",
      name: step.name,
      arguments: step.arguments,
      id: step.id,
    });
  }

  if (calls.length > GEMINI_SUPPORT_MAX_FUNCTION_CALLS_PER_ROUND) {
    throw new SupportAssistantGenerationError(
      "Support assistant provider requested too many function calls.",
      "provider_failed",
    );
  }

  return calls;
}

function functionResultText(result: unknown): Interactions.TextContent[] {
  return [{ type: "text", text: JSON.stringify(result) }];
}

function executeFunctionCall(
  call: ValidatedFunctionCall,
): Interactions.FunctionResultStep {
  try {
    const result = executeSupportPricingTool(call.name, call.arguments);
    return {
      type: "function_result",
      name: call.name,
      call_id: call.id,
      result: functionResultText(result),
    };
  } catch (error) {
    if (error instanceof SupportPricingToolValidationError) {
      return {
        type: "function_result",
        name: call.name,
        call_id: call.id,
        is_error: true,
        result: functionResultText({
          status: "invalid_arguments",
          message:
            "Server-side validation rejected the pricing tool arguments. Ask the customer only for the missing or corrected supported values.",
          issues: error.issues,
        }),
      };
    }
    if (error instanceof UnknownSupportPricingToolError) {
      throw new SupportAssistantGenerationError(
        "Support assistant provider returned an unauthorised function call.",
        "provider_failed",
      );
    }
    throw new SupportAssistantGenerationError(
      "Support assistant pricing function failed safely.",
      "provider_failed",
    );
  }
}

export async function runGeminiSupportInteraction(
  input: string,
  systemPrompt: string,
  createInteraction: GeminiSupportInteractionCreator,
): Promise<string> {
  const history = buildGeminiSupportStatelessHistory(input);
  let toolCallRounds = 0;

  while (true) {
    const interaction = await createInteraction(
      buildGeminiSupportInteractionRequest(history, systemPrompt),
    );
    assertCompletedGeminiSupportInteraction(interaction);

    const steps = interactionSteps(interaction);
    const functionCalls = validatedFunctionCalls(steps);
    if (functionCalls.length === 0) {
      return extractCompletedGeminiSupportOutput(interaction);
    }

    if (toolCallRounds >= GEMINI_SUPPORT_MAX_TOOL_CALL_ROUNDS) {
      throw new SupportAssistantGenerationError(
        "Support assistant exceeded the pricing function-call round limit.",
        "provider_failed",
      );
    }

    history.push(...steps);
    history.push(...functionCalls.map(executeFunctionCall));
    toolCallRounds += 1;
  }
}
