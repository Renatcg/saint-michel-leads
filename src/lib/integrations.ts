import { getPrisma } from "@/lib/prisma";

const SECRET_PLACEHOLDER = "•••••••• configurado";

export type AdminIntegrationSettings = {
  resendApiKey: string;
  resendFromEmail: string;
  resendFromName: string;
  whatsappProvider: WhatsappProvider;
  captureEvolution: boolean;
  captureWuz: boolean;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
  wuzApiUrl: string;
  wuzApiToken: string;
  wuzInstanceName: string;
};

export type WhatsappProvider = "EVOLUTION" | "WUZ";

type StoredIntegrationSettingsRow = {
  id: string;
  resendApiKey: string | null;
  resendFromEmail: string | null;
  resendFromName: string | null;
  whatsappProvider: string | null;
  captureEvolution: boolean | null;
  captureWuz: boolean | null;
  evolutionApiUrl: string | null;
  evolutionApiKey: string | null;
  evolutionInstanceName: string | null;
  wuzApiUrl: string | null;
  wuzApiToken: string | null;
  wuzInstanceName: string | null;
};

export const defaultIntegrationSettings: AdminIntegrationSettings = {
  resendApiKey: "",
  resendFromEmail: "",
  resendFromName: "Saint Michel Construtora",
  whatsappProvider: "EVOLUTION",
  captureEvolution: true,
  captureWuz: false,
  evolutionApiUrl: "",
  evolutionApiKey: "",
  evolutionInstanceName: "",
  wuzApiUrl: "https://utilitarios-wuzapi.xku2lc.easypanel.host/api",
  wuzApiToken: "",
  wuzInstanceName: "",
};

export async function getIntegrationSettings(): Promise<AdminIntegrationSettings> {
  const settings = await getStoredIntegrationSettings();
  const resendApiKey = settings.resendApiKey || process.env.RESEND_API_KEY || "";
  const evolutionApiKey = settings.evolutionApiKey || process.env.EVOLUTION_API_KEY || process.env.EVO_API_KEY || "";
  const wuzApiToken = settings.wuzApiToken || process.env.WUZ_API_TOKEN || "";

  return {
    resendApiKey: resendApiKey ? SECRET_PLACEHOLDER : "",
    resendFromEmail: settings.resendFromEmail || process.env.RESEND_FROM_EMAIL || "",
    resendFromName: settings.resendFromName || process.env.RESEND_FROM_NAME || defaultIntegrationSettings.resendFromName,
    whatsappProvider: settings.whatsappProvider,
    captureEvolution: settings.captureEvolution,
    captureWuz: settings.captureWuz,
    evolutionApiUrl: settings.evolutionApiUrl || process.env.EVOLUTION_API_URL || process.env.EVO_API_URL || "",
    evolutionApiKey: evolutionApiKey ? SECRET_PLACEHOLDER : "",
    evolutionInstanceName: settings.evolutionInstanceName || process.env.EVOLUTION_INSTANCE_NAME || process.env.EVO_INSTANCE_NAME || "",
    wuzApiUrl: settings.wuzApiUrl || process.env.WUZ_API_URL || defaultIntegrationSettings.wuzApiUrl,
    wuzApiToken: wuzApiToken ? SECRET_PLACEHOLDER : "",
    wuzInstanceName: settings.wuzInstanceName || process.env.WUZ_INSTANCE_NAME || "",
  };
}

export async function getStoredIntegrationSettings(): Promise<AdminIntegrationSettings> {
  const prisma = getPrisma();
  const [settings] = await prisma.$queryRaw<StoredIntegrationSettingsRow[]>`
    SELECT
      "id",
      "resendApiKey",
      "resendFromEmail",
      "resendFromName",
      "whatsappProvider",
      "captureEvolution",
      "captureWuz",
      "evolutionApiUrl",
      "evolutionApiKey",
      "evolutionInstanceName",
      "wuzApiUrl",
      "wuzApiToken",
      "wuzInstanceName"
    FROM "IntegrationSettings"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;

  return {
    resendApiKey: settings?.resendApiKey || "",
    resendFromEmail: settings?.resendFromEmail || "",
    resendFromName: settings?.resendFromName || defaultIntegrationSettings.resendFromName,
    whatsappProvider: normalizeWhatsappProvider(settings?.whatsappProvider),
    captureEvolution: settings?.captureEvolution ?? defaultIntegrationSettings.captureEvolution,
    captureWuz: settings?.captureWuz ?? defaultIntegrationSettings.captureWuz,
    evolutionApiUrl: settings?.evolutionApiUrl || "",
    evolutionApiKey: settings?.evolutionApiKey || "",
    evolutionInstanceName: settings?.evolutionInstanceName || "",
    wuzApiUrl: settings?.wuzApiUrl || "",
    wuzApiToken: settings?.wuzApiToken || "",
    wuzInstanceName: settings?.wuzInstanceName || "",
  };
}

export async function saveIntegrationSettings(settings: Partial<AdminIntegrationSettings>) {
  const prisma = getPrisma();
  const [existing] = await prisma.$queryRaw<StoredIntegrationSettingsRow[]>`
    SELECT
      "id",
      "resendApiKey",
      "evolutionApiKey",
      "wuzApiToken"
    FROM "IntegrationSettings"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  const normalized = normalizeIntegrationSettings(settings);

  if (shouldPreserveSecret(settings.resendApiKey)) {
    normalized.resendApiKey = existing?.resendApiKey || "";
  }

  if (shouldPreserveSecret(settings.evolutionApiKey)) {
    normalized.evolutionApiKey = existing?.evolutionApiKey || "";
  }

  if (shouldPreserveSecret(settings.wuzApiToken)) {
    normalized.wuzApiToken = existing?.wuzApiToken || "";
  }

  if (existing) {
    return prisma.integrationSettings.update({
      where: { id: existing.id },
      data: normalized as never,
    });
  }

  return prisma.integrationSettings.create({
    data: normalized as never,
  });
}

export function normalizeIntegrationSettings(settings: Partial<AdminIntegrationSettings>): AdminIntegrationSettings {
  return {
    resendApiKey: settings.resendApiKey?.trim() || "",
    resendFromEmail: settings.resendFromEmail?.trim() || "",
    resendFromName: settings.resendFromName?.trim() || defaultIntegrationSettings.resendFromName,
    whatsappProvider: normalizeWhatsappProvider(settings.whatsappProvider),
    captureEvolution: settings.captureEvolution ?? defaultIntegrationSettings.captureEvolution,
    captureWuz: settings.captureWuz ?? defaultIntegrationSettings.captureWuz,
    evolutionApiUrl: trimTrailingSlash(settings.evolutionApiUrl?.trim() || ""),
    evolutionApiKey: settings.evolutionApiKey?.trim() || "",
    evolutionInstanceName: settings.evolutionInstanceName?.trim() || "",
    wuzApiUrl: trimTrailingSlash(settings.wuzApiUrl?.trim() || ""),
    wuzApiToken: settings.wuzApiToken?.trim() || "",
    wuzInstanceName: settings.wuzInstanceName?.trim() || "",
  };
}

export async function getEvolutionRuntimeSettings() {
  const settings = await getStoredIntegrationSettings();
  const apiUrl = trimTrailingSlash(settings.evolutionApiUrl || process.env.EVOLUTION_API_URL || process.env.EVO_API_URL || "");
  const apiKey = settings.evolutionApiKey || process.env.EVOLUTION_API_KEY || process.env.EVO_API_KEY;
  const instanceName = settings.evolutionInstanceName || process.env.EVOLUTION_INSTANCE_NAME || process.env.EVO_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instanceName) {
    return null;
  }

  return {
    apiUrl,
    apiKey,
    instanceName,
  };
}

export async function getWuzRuntimeSettings() {
  const settings = await getStoredIntegrationSettings();
  const apiUrl = trimTrailingSlash(settings.wuzApiUrl || process.env.WUZ_API_URL || defaultIntegrationSettings.wuzApiUrl);
  const apiToken = settings.wuzApiToken || process.env.WUZ_API_TOKEN;
  const instanceName = settings.wuzInstanceName || process.env.WUZ_INSTANCE_NAME || "";

  if (!apiUrl || !apiToken) {
    return null;
  }

  return {
    apiUrl,
    apiToken,
    instanceName,
  };
}

export async function getActiveWhatsappProvider() {
  const settings = await getStoredIntegrationSettings();
  return settings.whatsappProvider;
}

export async function shouldCaptureWhatsappProvider(provider: WhatsappProvider) {
  const settings = await getStoredIntegrationSettings();

  if (provider === "WUZ") {
    return settings.captureWuz;
  }

  return settings.captureEvolution;
}

export async function sendWhatsappTextMessage({ number, text }: { number: string; text: string }) {
  const provider = await getActiveWhatsappProvider();

  if (provider === "WUZ") {
    return sendWuzTextMessage({ number, text });
  }

  return sendEvolutionTextMessage({ number, text });
}

export async function sendWhatsappMediaMessage({
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
  const provider = await getActiveWhatsappProvider();

  if (provider === "WUZ") {
    return sendWuzMediaMessage({ number, caption, mediaUrl, fileName, mimeType });
  }

  return sendEvolutionMediaMessage({ number, caption, mediaUrl, fileName, mimeType });
}

export async function sendWuzTextMessage({ number, text }: { number: string; text: string }) {
  const settings = await getWuzRuntimeSettings();

  if (!settings) {
    throw new Error("WUZ não configurada. Cadastre URL e token na aba Integrações.");
  }

  void settings;
  void number;
  void text;

  throw new Error("Envio pela WUZ ainda precisa do endpoint de envio da documentação.");
}

export async function sendWuzMediaMessage({
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
  const settings = await getWuzRuntimeSettings();

  if (!settings) {
    throw new Error("WUZ não configurada. Cadastre URL e token na aba Integrações.");
  }

  void number;
  void caption;
  void mediaUrl;
  void fileName;
  void mimeType;

  throw new Error("Envio de mídia pela WUZ ainda precisa do endpoint de envio da documentação.");
}

export async function sendEvolutionTextMessage({ number, text }: { number: string; text: string }) {
  const settings = await getEvolutionRuntimeSettings();

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

function normalizeWhatsappProvider(value: string | undefined | null): WhatsappProvider {
  return value === "WUZ" ? "WUZ" : "EVOLUTION";
}
