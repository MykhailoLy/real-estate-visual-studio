import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminClientsError, PartnerPricingBody, setAdminClientPartner } from "@/lib/admin-clients-server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  const parsed = PartnerPricingBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "A Partner client toggle is required." }, { status: 400, headers });
  }
  try {
    await setAdminClientPartner((await params).userId, parsed.data.partnerClient);
    return Response.json({ partnerClient: parsed.data.partnerClient }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof AdminClientsError ? error.message : "Could not update Partner pricing. Please retry." },
      { status: error instanceof AdminClientsError ? error.status : 503, headers });
  }
}
