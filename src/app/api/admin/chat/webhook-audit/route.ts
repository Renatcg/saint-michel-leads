import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { listWebhookAudits } from "@/lib/webhook-audit";

export async function GET() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  return NextResponse.json({
    ok: true,
    events: await listWebhookAudits(30),
  });
}
