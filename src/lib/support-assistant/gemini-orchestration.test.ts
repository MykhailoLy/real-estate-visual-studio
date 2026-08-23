import assert from "node:assert/strict";
import test from "node:test";
import type { Interactions } from "@google/genai";
import { PRICING_VERSION } from "../pricing/catalog.ts";
import {
  GEMINI_SUPPORT_MAX_TOOL_CALL_ROUNDS,
  runGeminiSupportInteraction,
} from "./gemini-orchestration.ts";
import type { GeminiSupportInteractionRequest } from "./gemini-request.ts";
import type { GeminiSupportInteractionLike } from "./gemini-response.ts";
import { SupportAssistantGenerationError } from "./types.ts";

function completed(
  outputText: string,
  steps: unknown[] = [],
): GeminiSupportInteractionLike {
  return {
    id: "interaction-id",
    status: "completed",
    output_text: outputText,
    steps,
  };
}

function createSequence(
  responses: readonly GeminiSupportInteractionLike[],
  requests: GeminiSupportInteractionRequest[],
) {
  let index = 0;
  return async (request: GeminiSupportInteractionRequest) => {
    requests.push(request);
    const response = responses[index];
    index += 1;
    if (!response) throw new Error("Unexpected interaction request.");
    return response;
  };
}

function functionResultStep(request: GeminiSupportInteractionRequest) {
  const step = request.input.at(-1);
  assert.equal(step?.type, "function_result");
  return step as Interactions.FunctionResultStep;
}

function parsedFunctionResult(step: Interactions.FunctionResultStep) {
  assert.ok(Array.isArray(step.result));
  const content = step.result[0];
  assert.equal(content?.type, "text");
  return JSON.parse((content as Interactions.TextContent).text) as Record<
    string,
    unknown
  >;
}

test("stateless orchestration preserves model steps and returns the final answer", async () => {
  const thoughtStep = {
    type: "thought",
    signature: "signed-thought",
  };
  const callStep = {
    type: "function_call",
    name: "get_remote_service_quote",
    id: "quote-call-1",
    arguments: {
      service: "virtual-staging",
      quantity: 3,
      currency: "USD",
    },
  };
  const requests: GeminiSupportInteractionRequest[] = [];

  const output = await runGeminiSupportInteraction(
    "Serialized support transcript",
    "Canonical system prompt",
    createSequence(
      [
        completed("", [thoughtStep, callStep]),
        completed("The authoritative total is US$45.00."),
      ],
      requests,
    ),
  );

  assert.equal(output, "The authoritative total is US$45.00.");
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0]?.input, [
    {
      type: "user_input",
      content: [
        { type: "text", text: "Serialized support transcript" },
      ],
    },
  ]);
  assert.equal(requests[0]?.store, false);
  assert.equal(requests[1]?.store, false);
  assert.equal(
    Object.hasOwn(requests[1] ?? {}, "previous_interaction_id"),
    false,
  );
  assert.strictEqual(requests[1]?.input[1], thoughtStep);
  assert.strictEqual(requests[1]?.input[2], callStep);

  const functionResult = functionResultStep(requests[1]!);
  assert.equal(functionResult.name, "get_remote_service_quote");
  assert.equal(functionResult.call_id, "quote-call-1");
  assert.equal(functionResult.is_error, undefined);
  assert.deepEqual(parsedFunctionResult(functionResult), {
    status: "quoted",
    quoteKind: "estimate",
    service: "virtual-staging",
    currency: "USD",
    quantity: 3,
    unitPriceCents: 1_500,
    baseSubtotalCents: 4_500,
    addOnSubtotalCents: 0,
    discountEligibility: "eligible",
    discountExplanation:
      "Eligible for standard volume discounts; no discount applies at this quantity.",
    discountPercent: 0,
    discountAmountCents: 0,
    finalSubtotalBeforeTaxCents: 4_500,
    taxCalculated: false,
    currencyPolicy: "fixed-catalog-prices-not-live-conversion",
    pricingVersion: PRICING_VERSION,
    lineItems: [
      {
        id: "virtual-staging",
        quantity: 3,
        unitPriceCents: 1_500,
        subtotalCents: 4_500,
      },
    ],
  });
});

test("invalid function arguments are rejected server-side and returned as an error result", async () => {
  const requests: GeminiSupportInteractionRequest[] = [];
  const output = await runGeminiSupportInteraction(
    "Price this in GBP",
    "Canonical system prompt",
    createSequence(
      [
        completed("", [
          {
            type: "function_call",
            name: "get_remote_service_quote",
            id: "bad-currency",
            arguments: {
              service: "virtual-staging",
              quantity: 3,
              currency: "GBP",
            },
          },
        ]),
        completed("Official pricing is available only in USD, EUR, and CAD."),
      ],
      requests,
    ),
  );

  assert.equal(
    output,
    "Official pricing is available only in USD, EUR, and CAD.",
  );
  const resultStep = functionResultStep(requests[1]!);
  assert.equal(resultStep.is_error, true);
  const result = parsedFunctionResult(resultStep);
  assert.equal(result.status, "invalid_arguments");
  assert.match(JSON.stringify(result.issues), /currency/);
});

test("unknown function names are rejected before execution", async () => {
  const requests: GeminiSupportInteractionRequest[] = [];

  await assert.rejects(
    () =>
      runGeminiSupportInteraction(
        "Delete an order",
        "Canonical system prompt",
        createSequence(
          [
            completed("", [
              {
                type: "function_call",
                name: "delete_order",
                id: "unknown-call",
                arguments: {},
              },
            ]),
          ],
          requests,
        ),
      ),
    (error: unknown) =>
      error instanceof SupportAssistantGenerationError &&
      /unauthorised function call/.test(error.message),
  );
  assert.equal(requests.length, 1);
});

test("malformed function call arguments are rejected safely", async () => {
  await assert.rejects(
    () =>
      runGeminiSupportInteraction(
        "Quote this",
        "Canonical system prompt",
        async () =>
          completed("", [
            {
              type: "function_call",
              name: "get_remote_service_quote",
              id: "malformed-call",
              arguments: "not-an-object",
            },
          ]),
      ),
    (error: unknown) =>
      error instanceof SupportAssistantGenerationError &&
      /malformed function call/.test(error.message),
  );
});

test("maximum function-call round protection stops repeated tool loops", async () => {
  const requests: GeminiSupportInteractionRequest[] = [];
  const repeatedCalls = Array.from(
    { length: GEMINI_SUPPORT_MAX_TOOL_CALL_ROUNDS + 1 },
    (_, index) =>
      completed("", [
        {
          type: "function_call",
          name: "get_remote_service_quote",
          id: `loop-call-${index}`,
          arguments: {
            service: "virtual-staging",
            quantity: 3,
            currency: "USD",
          },
        },
      ]),
  );

  await assert.rejects(
    () =>
      runGeminiSupportInteraction(
        "Keep calling the tool",
        "Canonical system prompt",
        createSequence(repeatedCalls, requests),
      ),
    (error: unknown) =>
      error instanceof SupportAssistantGenerationError &&
      /round limit/.test(error.message),
  );
  assert.equal(
    requests.length,
    GEMINI_SUPPORT_MAX_TOOL_CALL_ROUNDS + 1,
  );
  assert.equal(GEMINI_SUPPORT_MAX_TOOL_CALL_ROUNDS, 2);
});

test("normal non-pricing support answers complete without function results", async () => {
  const requests: GeminiSupportInteractionRequest[] = [];
  const output = await runGeminiSupportInteraction(
    "What is your turnaround time?",
    "Canonical system prompt",
    createSequence(
      [completed("The standard turnaround is 24–48 hours.")],
      requests,
    ),
  );

  assert.equal(output, "The standard turnaround is 24–48 hours.");
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.input.some((step) => step.type === "function_result"),
    false,
  );
  assert.deepEqual(
    requests[0]?.tools.map((tool) => tool.name),
    ["get_remote_service_quote", "get_local_service_pricing"],
  );
});
