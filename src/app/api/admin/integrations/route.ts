import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getIntegrationSettings, saveIntegrationSettings } from "@/lib/integrations";
import { getLandingSettings, saveLandingSettings } from "@/lib/landing";

export async function GET() {
  const { response } = await requireAdminUser();

  if (response) {
    return response;
  }

  const [integrations, landing] = await Promise.all([getIntegrationSettings(), getLandingSettings()]);
  return NextResponse.json({ integrations, salesPhone: landing.salesPhone });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  await saveIntegrationSettings(payload?.integrations ?? payload ?? {});
  const landing = await getLandingSettings();

  if (typeof payload?.salesPhone === "string") {
    await saveLandingSettings({ ...landing, salesPhone: payload.salesPhone });
  }

  const updatedLanding = await getLandingSettings();
  return NextResponse.json({
    integrations: await getIntegrationSettings(),
    salesPhone: updatedLanding.salesPhone,
  });
}
