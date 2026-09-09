import { AdminClientsError, inviteAdminPartnerClient } from "@/lib/admin-clients-server";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  try {
    await inviteAdminPartnerClient(await request.json().catch(() => null));
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return Response.json({
      error: error instanceof AdminClientsError ? error.message : "Invitation could not be confirmed. Check Admin Clients before retrying.",
      code: error instanceof AdminClientsError ? error.code : "invite-unconfirmed",
    }, { status: error instanceof AdminClientsError ? error.status : 503, headers });
  }
}
