import { parseSupportOrderAction } from "../support-order-action.ts";
import { resolveSupportOrderRecommendation } from "../support-order-prefill.ts";
import { SUPPORT_ASSISTANT_MAX_RESPONSE_CHARS } from "./schema.ts";
import {
  SupportAssistantGenerationError,
  type SupportAssistantGeneratedReply,
  type SupportAssistantRequestInput,
} from "./types.ts";

const ORDER_SERVICE_MARKER_LINE =
  /^\s*\[\[PICCHUSPOT_ORDER_SERVICE:([a-z0-9-]+)\]\]\s*$/;
const ORDER_RECOMMENDATION_MARKER_LINE =
  /^\s*\[\[PICCHUSPOT_ORDER_RECOMMENDATION:([a-z0-9-]+)\]\]\s*$/;
const ORDER_SERVICE_MARKER_PREFIX_PATTERN =
  /PICCHUSPOT_ORDER_SERVICE/gi;
const ORDER_RECOMMENDATION_MARKER_PREFIX_PATTERN =
  /PICCHUSPOT_ORDER_RECOMMENDATION/gi;
const SUPPORT_ORDER_MARKER_PREFIX_PATTERN =
  /PICCHUSPOT_ORDER_(?:SERVICE|RECOMMENDATION)/gi;
const COMPLETE_ORDER_MARKER_LIKE_TOKEN =
  /\[\[\s*PICCHUSPOT_ORDER_(?:SERVICE|RECOMMENDATION)\s*:[^\r\n]*?\]\]+/gi;
const PARTIAL_ORDER_MARKER_LIKE_TOKEN =
  /\[\[\s*PICCHUSPOT_ORDER_(?:SERVICE|RECOMMENDATION)\b(?:\s*:)?[^\r\n]*/gi;
const BARE_ORDER_MARKER_LIKE_TOKEN =
  /\bPICCHUSPOT_ORDER_(?:SERVICE|RECOMMENDATION)\b(?:\s*:)?[^\r\n]*/gi;

interface ParseSupportAssistantGeneratedReplyOptions {
  allowOrderAction?: boolean;
}

export function parseSupportAssistantGeneratedReply(
  output: string,
  { allowOrderAction = true }: ParseSupportAssistantGeneratedReplyOptions = {},
): SupportAssistantGeneratedReply {
  const terminalMarker = getTerminalOrderMarkerMetadata(output);
  const serviceMarkerLikeCount = countMarkerLikeOccurrences(
    output,
    ORDER_SERVICE_MARKER_PREFIX_PATTERN,
  );
  const visibleMessage = normalizeSupportAssistantOutput(
    stripOrderServiceMarkerLikeText(output),
  );

  const action =
    allowOrderAction &&
    terminalMarker.serviceSlug !== null &&
    serviceMarkerLikeCount === 1
      ? parseSupportOrderAction({
          type: "start_order",
          serviceId: terminalMarker.serviceSlug,
          ...(terminalMarker.recommendationId
            ? { recommendationId: terminalMarker.recommendationId }
            : {}),
        })
      : null;

  return action
    ? {
        message: visibleMessage,
        action,
      }
    : { message: visibleMessage };
}

export function containsSupportOrderMarkerLikeText(value: string): boolean {
  SUPPORT_ORDER_MARKER_PREFIX_PATTERN.lastIndex = 0;
  return SUPPORT_ORDER_MARKER_PREFIX_PATTERN.test(value);
}

export function supportRequestContainsOrderMarker(
  input: SupportAssistantRequestInput,
): boolean {
  return (
    containsSupportOrderMarkerLikeText(input.message) ||
    input.history.some((message) =>
      containsSupportOrderMarkerLikeText(message.content),
    )
  );
}

export function normalizeSupportAssistantOutput(output: string): string {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new SupportAssistantGenerationError(
      "Support assistant returned an empty response.",
    );
  }
  return trimmed.slice(0, SUPPORT_ASSISTANT_MAX_RESPONSE_CHARS);
}

export function stripOrderServiceMarkerLikeText(output: string): string {
  return output
    .replace(COMPLETE_ORDER_MARKER_LIKE_TOKEN, "")
    .replace(PARTIAL_ORDER_MARKER_LIKE_TOKEN, "")
    .replace(BARE_ORDER_MARKER_LIKE_TOKEN, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getTerminalOrderMarkerMetadata(output: string): {
  serviceSlug: string | null;
  recommendationId: string | null;
} {
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  let index = lines.length - 1;

  while (index >= 0 && !lines[index]?.trim()) {
    index -= 1;
  }

  const serviceMatch = ORDER_SERVICE_MARKER_LINE.exec(lines[index] ?? "");
  if (!serviceMatch) {
    return { serviceSlug: null, recommendationId: null };
  }

  const serviceSlug = serviceMatch[1] ?? null;
  let recommendationLineIndex = index - 1;
  while (
    recommendationLineIndex >= 0 &&
    !lines[recommendationLineIndex]?.trim()
  ) {
    recommendationLineIndex -= 1;
  }

  const recommendationMatch = ORDER_RECOMMENDATION_MARKER_LINE.exec(
    lines[recommendationLineIndex] ?? "",
  );
  const recommendationId = recommendationMatch?.[1] ?? null;
  const recommendationMarkerLikeCount = countMarkerLikeOccurrences(
    output,
    ORDER_RECOMMENDATION_MARKER_PREFIX_PATTERN,
  );

  if (
    serviceSlug &&
    recommendationId &&
    recommendationMarkerLikeCount === 1 &&
    resolveSupportOrderRecommendation(recommendationId, serviceSlug)
  ) {
    return { serviceSlug, recommendationId };
  }

  return { serviceSlug, recommendationId: null };
}

function countMarkerLikeOccurrences(output: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return Array.from(output.matchAll(pattern)).length;
}
