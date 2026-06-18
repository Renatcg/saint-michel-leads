import { getPrisma } from "@/lib/prisma";

const SECRET_PLACEHOLDER = "•••••••• configurado";

export type AdminIntegrationSettings = {
  resendApiKey: string;
  resendFromEmail: string;
  resendFromName: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
};

type EvolutionRuntimeOverrides = Partial<Pick<AdminIntegrationSettings, "evolutionApiUrl" | "evolutionApiKey" | "evolutionInstanceName">>;

export const defaultIntegrationSettings: AdminIntegrationSettings = {
  resendApiKey: "",
  resendFromEmail: "",
  resendFromName: "Saint Michel Construtora",
  evolutionApiUrl: "",
  evolutionApiKey: "",
  evolutionInstanceName: "",
};

export async function getIntegrationSettings(): Promise<AdminIntegrationSettings> {
  const settings = await getStoredIntegrationSettings();

  return {
    resendApiKey: settings.resendApiKey || process.env.RESEND_API_KEY ? SECRET_PLACEHOLDER : "",
    resendFromEmail: settings.resendFromEmail || process.env.RESEND_FROM_EMAIL || "",
    resendFromName: settings.resendFromName || process.env.RESEND_FROM_NAME || defaultIntegrationSettings.resendFromName,
    evolutionApiUrl: settings.evolutionApiUrl || process.env.EVOLUTION_API_URL || process.env.EVO_API_URL || "",
    evolutionApiKey: settings.evolutionApiKey || process.env.EVOLUTION_API_KEY || process.env.EVO_API_KEY ? SECRET_PLACEHOLDER : "",
    evolutionInstanceName: settings.evolutionInstanceName || process.env.EVOLUTION_INSTANCE_NAME || process.env.EVO_INSTANCE_NAME || "",
  };
}

export async function getStoredIntegrationSettings(): Promise<AdminIntegrationSettings> {
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
  const existing = await prisma.integrationSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  const normalized = normalizeIntegrationSettings(settings);

  if (shouldPreserveSecret(settings.resendApiKey)) {
    normalized.resendApiKey = existing?.resendApiKey || "";
  }

  if (shouldPreserveSecret(settings.evolutionApiKey)) {
    normalized.evolutionApiKey = existing?.evolutionApiKey || "";
  }

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

export async function getEvolutionRuntimeSettings(overrides: EvolutionRuntimeOverrides = {}) {
  const settings = await getStoredIntegrationSettings();
  const apiUrl = trimTrailingSlash(overrides.evolutionApiUrl?.trim() || settings.evolutionApiUrl || process.env.EVOLUTION_API_URL || process.env.EVO_API_URL || "");
  const apiKey = shouldPreserveSecret(overrides.evolutionApiKey)
    ? settings.evolutionApiKey || process.env.EVOLUTION_API_KEY || process.env.EVO_API_KEY || ""
    : overrides.evolutionApiKey?.trim() || settings.evolutionApiKey || process.env.EVOLUTION_API_KEY || process.env.EVO_API_KEY || "";
  const instanceName = overrides.evolutionInstanceName?.trim() || settings.evolutionInstanceName || process.env.EVOLUTION_INSTANCE_NAME || process.env.EVO_INSTANCE_NAME || "";

  if (!apiUrl || !apiKey || !instanceName) {
    return null;
  }

  return {
    apiUrl,
    apiKey,
    instanceName,
  };
}

export async function sendEvolutionTextMessage({
  number,
  text,
  settings: overrides,
}: {
  number: string;
  text: string;
  settings?: EvolutionRuntimeOverrides;
}) {
  const settings = await getEvolutionRuntimeSettings(overrides);

  if (!settings) {
    throw new Error("Evolution API não configurada. Verifique EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME.");
  }

  const endpoint = `${settings.apiUrl}/message/sendText/${encodeURIComponent(settings.instanceName)}`;
  const normalizedNumber = normalizeWhatsappNumber(number);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.apiKey,
    },
    body: JSON.stringify({
      number: normalizedNumber,
      text,
      linkPreview: false,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Evolution API retornou status ${response.status}.`;

    if (isInvalidEvolutionInput(message)) {
      return sendEvolutionLegacyTextMessage({
        endpoint,
        apiKey: settings.apiKey,
        number: normalizedNumber,
        text,
      });
    }

    throw new Error(formatEvolutionError(message));
  }

  return data;
}

async function sendEvolutionLegacyTextMessage({
  endpoint,
  apiKey,
  number,
  text,
}: {
  endpoint: string;
  apiKey: string;
  number: string;
  text: string;
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number,
      textMessage: { text },
      options: {
        linkPreview: false,
      },
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Evolution API retornou status ${response.status}.`;
    throw new Error(formatEvolutionError(message));
  }

  return data;
}

export async function sendEvolutionMediaMessage({
  number,
  caption,
  mediaUrl,
  fileName,
  mimeType,
}: {
  number: string;
  caption?: string;
  mediaUrl: string;
  fileName: string;
  mimeType: string;
}) {
  const settings = await getEvolutionRuntimeSettings();

  if (!settings) {
    throw new Error("Evolution API não configurada. Cadastre as variáveis na Vercel ou na aba Integrações.");
  }

  const response = await fetch(`${settings.apiUrl}/message/sendMedia/${encodeURIComponent(settings.instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.apiKey,
    },
    body: JSON.stringify({
      number: normalizeWhatsappNumber(number),
      mediatype: getEvolutionMediaType(mimeType),
      mimetype: mimeType,
      caption: caption || "",
      media: mediaUrl,
      fileName,
      linkPreview: false,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(formatEvolutionError(data?.message ?? data?.error ?? "Evolution API recusou o envio de mídia."));
  }

  return data;
}

function isInvalidEvolutionInput(message: unknown) {
  return formatEvolutionError(message).toLowerCase().includes("invalid input");
}

function formatEvolutionError(message: unknown): string {
  if (Array.isArray(message)) {
    return message.map((item: unknown) => formatEvolutionError(item)).join(", ");
  }

  if (message && typeof message === "object") {
    const record = message as Record<string, unknown>;
    return String(record.message || record.error || JSON.stringify(record));
  }

  return String(message || "Erro desconhecido da Evolution API.");
}

function getEvolutionMediaType(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return "document";
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

function shouldPreserveSecret(value: string | undefined) {
  return !value || value.includes("••••");
}
