import { handleSupportAssistantPostRequest } from "@/lib/support-assistant/api";
import { createGeminiSupportTransport } from "@/lib/support-assistant/gemini-transport";
import { createUpstashSupportAssistantRateLimiter } from "@/lib/support-assistant/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function POST(request: Request) {
  return handleSupportAssistantPostRequest(
    request,
    createGeminiSupportTransport(),
    createUpstashSupportAssistantRateLimiter(),
  );
}
