import { handleGuestDraft } from "@/lib/guest-order-drafts/server";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handleGuestDraft(request, "get");
}

export function PUT(request: Request) {
  return handleGuestDraft(request, "save");
}
