import { parseSupportOrderAction } from "../support-order-action.ts";
import {
  SupportAssistantGenerationError,
  type SupportAssistantGeneratedReply,
} from "./types.ts";

const ORDER_SERVICE_MARKER_LINE =
  /^\s*\[\[PICCHUSPOT_ORDER_SERVICE:([a-z0-9-]+)\]\]\s*$/;
const ORDER_SERVICE_MARKER_TOKEN =
  /\[\[PICCHUSPOT_ORDER_SERVICE:[^\]\r\n]*\]\]/g;

export function parseSupportAssistantGeneratedReply(
  output: string,
): SupportAssistantGeneratedReply {
  const terminalMarkerSlugs = getTerminalOrderServiceMarkerSlugs(output);
  const markerCount = Array.from(
    output.matchAll(ORDER_SERVICE_MARKER_TOKEN),
  ).length;
  const visibleMessage = stripOrderServiceMarkers(output);

  if (!visibleMessage) {
    throw new SupportAssistantGenerationError(
      "Support assistant returned an empty response.",
    );
  }

  const action =
    terminalMarkerSlugs.length === 1 && markerCount === 1
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

function stripOrderServiceMarkers(output: string) {
  return output
    .replace(ORDER_SERVICE_MARKER_TOKEN, "")
    .replace(/[ \t]+\n/g, "\n")
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
