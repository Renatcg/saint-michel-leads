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

export async function getEvolutionRuntimeSettings() {
  const settings = await getIntegrationSettings();
  const apiUrl = trimTrailingSlash(process.env.EVOLUTION_API_URL || settings.evolutionApiUrl);
  const apiKey = process.env.EVOLUTION_API_KEY || settings.evolutionApiKey;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || settings.evolutionInstanceName;

  if (!apiUrl || !apiKey || !instanceName) {
    return null;
  }

  return {
    apiUrl,
    apiKey,
    instanceName,
  };
}

export async function sendEvolutionTextMessage({ number, text }: { number: string; text: string }) {
  const settings = await getEvolutionRuntimeSettings();

  if (!settings) {
    throw new Error("Evolution API não configurada. Verifique EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME.");
  }

  const response = await fetch(`${settings.apiUrl}/message/sendText/${encodeURIComponent(settings.instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.apiKey,
    },
    body: JSON.stringify({
      number: normalizeWhatsappNumber(number),
      text,
      linkPreview: false,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Evolution API retornou status ${response.status}.`;
    throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
  }

  return data;
}

export function normalizeWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return digits.startsWith("55") ? digits : `55${digits}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
