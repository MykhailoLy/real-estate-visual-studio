import { getClientUser } from "@/lib/client-auth";
import { completeDraftReferenceForUser } from "@/lib/order-drafts/draft-reference-files-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ draftId: string; referenceId: string }> };

export async function POST(_request: Request, { params }: Context) {
  const user = await getClientUser();
  if (!user) return Response.json({ error: "You must be signed in." }, { status: 401 });
  const { draftId, referenceId } = await params;
  const result = await completeDraftReferenceForUser(user.id, draftId, referenceId);
  return result.ok
    ? Response.json({ data: result.data })
    : Response.json({ error: result.message }, { status: result.status });
}
