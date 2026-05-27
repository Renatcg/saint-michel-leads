import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getLandingSettings, normalizeLandingSettings, saveLandingSettings } from "@/lib/landing";

export async function GET() {
  const { response } = await requireAdminUser();

  if (response) {
    return response;
  }

  return NextResponse.json({ settings: await getLandingSettings() });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const settings = await saveLandingSettings(normalizeLandingSettings(payload ?? {}));

  return NextResponse.json({ settings });
}
