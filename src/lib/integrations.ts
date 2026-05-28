import { getPrisma } from "@/lib/prisma";

export type AdminIntegrationSettings = {
  resendApiKey: string;
  resendFromEmail: string;
  resendFromName: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
};

export const defaultIntegrationSettings: AdminIntegrationSettings = {
  resendApiKey: "",
  resendFromEmail: "",
  resendFromName: "Saint Michel Construtora",
  evolutionApiUrl: "",
  evolutionApiKey: "",
  evolutionInstanceName: "",
};

export async function getIntegrationSettings(): Promise<AdminIntegrationSettings> {
  const prisma = getPrisma();
  const settings = await prisma.integrationSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  return {
    resendApiKey: settings?.resendApiKey || "",
    resendFromEmail: settings?.resendFromEmail || "",
    resendFromName: settings?.resendFromName || defaultIntegrationSettings.resendFromName,
    evolutionApiUrl: settings?.evolutionApiUrl || "",
    evolutionApiKey: settings?.evolutionApiKey || "",
    evolutionInstanceName: settings?.evolutionInstanceName || "",
  };
}

export async function saveIntegrationSettings(settings: Partial<AdminIntegrationSettings>) {
  const prisma = getPrisma();
  const normalized = normalizeIntegrationSettings(settings);
  const existing = await prisma.integrationSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return prisma.integrationSettings.update({
      where: { id: existing.id },
      data: normalized,
    });
  }

  return prisma.integrationSettings.create({
    data: normalized,
  });
}

export function normalizeIntegrationSettings(settings: Partial<AdminIntegrationSettings>): AdminIntegrationSettings {
  return {
    resendApiKey: settings.resendApiKey?.trim() || "",
    resendFromEmail: settings.resendFromEmail?.trim() || "",
    resendFromName: settings.resendFromName?.trim() || defaultIntegrationSettings.resendFromName,
    evolutionApiUrl: trimTrailingSlash(settings.evolutionApiUrl?.trim() || ""),
    evolutionApiKey: settings.evolutionApiKey?.trim() || "",
    evolutionInstanceName: settings.evolutionInstanceName?.trim() || "",
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
