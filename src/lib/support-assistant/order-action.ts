import { parseSupportOrderAction } from "../support-order-action.ts";
import { SUPPORT_ASSISTANT_MAX_RESPONSE_CHARS } from "./schema.ts";
import {
  SupportAssistantGenerationError,
  type SupportAssistantGeneratedReply,
  type SupportAssistantRequestInput,
} from "./types.ts";

const ORDER_SERVICE_MARKER_LINE =
  /^\s*\[\[PICCHUSPOT_ORDER_SERVICE:([a-z0-9-]+)\]\]\s*$/;
const ORDER_SERVICE_MARKER_PREFIX_PATTERN =
  /PICCHUSPOT_ORDER_SERVICE/gi;
const COMPLETE_ORDER_SERVICE_MARKER_LIKE_TOKEN =
  /\[\[\s*PICCHUSPOT_ORDER_SERVICE\s*:[^\r\n]*?\]\]+/gi;
const PARTIAL_ORDER_SERVICE_MARKER_LIKE_TOKEN =
  /\[\[\s*PICCHUSPOT_ORDER_SERVICE\b(?:\s*:)?[^\r\n]*/gi;
const BARE_ORDER_SERVICE_MARKER_LIKE_TOKEN =
  /\bPICCHUSPOT_ORDER_SERVICE\b(?:\s*:)?[^\r\n]*/gi;

interface ParseSupportAssistantGeneratedReplyOptions {
  allowOrderAction?: boolean;
}

export function parseSupportAssistantGeneratedReply(
  output: string,
  { allowOrderAction = true }: ParseSupportAssistantGeneratedReplyOptions = {},
): SupportAssistantGeneratedReply {
  const terminalMarkerSlugs = getTerminalOrderServiceMarkerSlugs(output);
  const markerLikeCount = countOrderServiceMarkerLikeOccurrences(output);
  const visibleMessage = normalizeSupportAssistantOutput(
    stripOrderServiceMarkerLikeText(output),
  );

  const action =
    allowOrderAction &&
    terminalMarkerSlugs.length === 1 &&
    markerLikeCount === 1
      ? parseSupportOrderAction({
          type: "start_order",
          serviceId: terminalMarkerSlugs[0],
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
  ORDER_SERVICE_MARKER_PREFIX_PATTERN.lastIndex = 0;
  return ORDER_SERVICE_MARKER_PREFIX_PATTERN.test(value);
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
    .replace(COMPLETE_ORDER_SERVICE_MARKER_LIKE_TOKEN, "")
    .replace(PARTIAL_ORDER_SERVICE_MARKER_LIKE_TOKEN, "")
    .replace(BARE_ORDER_SERVICE_MARKER_LIKE_TOKEN, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getTerminalOrderServiceMarkerSlugs(output: string) {
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  const slugs: string[] = [];
  let index = lines.length - 1;

  while (index >= 0 && !lines[index]?.trim()) {
    index -= 1;
  }

  while (index >= 0) {
    const match = ORDER_SERVICE_MARKER_LINE.exec(lines[index] ?? "");
    if (!match) break;
    slugs.unshift(match[1]);
    index -= 1;
  }

  return slugs;
}

function countOrderServiceMarkerLikeOccurrences(output: string): number {
  ORDER_SERVICE_MARKER_PREFIX_PATTERN.lastIndex = 0;
  return Array.from(output.matchAll(ORDER_SERVICE_MARKER_PREFIX_PATTERN))
    .length;
}
