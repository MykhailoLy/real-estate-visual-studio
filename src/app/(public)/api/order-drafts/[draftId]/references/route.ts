import { getClientUser } from "@/lib/client-auth";
import { PrepareDraftReferenceFileSchema } from "@/lib/order-drafts/draft-reference-files";
import {
  listDraftReferencesForUser,
  prepareDraftReferenceForUser,
} from "@/lib/order-drafts/draft-reference-files-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ draftId: string }> };

function response<T>(result: { ok: true; data: T } | { ok: false; status: number; message: string }, success = 200) {
  return result.ok
    ? Response.json({ data: result.data }, { status: success })
    : Response.json({ error: result.message }, { status: result.status });
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getClientUser();
  if (!user) return Response.json({ error: "You must be signed in." }, { status: 401 });
  const { draftId } = await params;
  return response(await listDraftReferencesForUser(user.id, draftId));
}

export async function POST(request: Request, { params }: Context) {
  const user = await getClientUser();
  if (!user) return Response.json({ error: "You must be signed in." }, { status: 401 });
  const parsed = PrepareDraftReferenceFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid draft reference." }, { status: 400 });
  const { draftId } = await params;
  return response(await prepareDraftReferenceForUser(user.id, draftId, parsed.data), 201);
}
