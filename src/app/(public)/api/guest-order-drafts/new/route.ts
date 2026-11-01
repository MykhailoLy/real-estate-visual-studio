import { handleGuestDraft } from "@/lib/guest-order-drafts/server";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handleGuestDraft(request, "new");
}
