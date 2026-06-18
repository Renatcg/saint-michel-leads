import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getEvolutionRuntimeSettings, getWuzRuntimeSettings, normalizeWhatsappNumber } from "@/lib/integrations";
import { saveInboundWhatsappMessage } from "@/lib/whatsapp-message-log";

type ProviderMessage = {
  provider: string;
  providerId: string | null;
  phone: string;
  fromMe: boolean;
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  createdAt: Date;
};

export async function GET(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const suffix = searchParams.get("q")?.replace(/\D/g, "") ?? "";
  const shouldImport = searchParams.get("import") === "1";
  const days = Math.max(1, Math.min(14, Number(searchParams.get("days") ?? 3) || 3));

  if (suffix.length < 4) {
    return NextResponse.json({ error: "Informe ao menos 4 dígitos do telefone." }, { status: 400 });
  }

  const [evolution, wuz] = await Promise.all([findEvolutionMessages(suffix, days), findWuzMessages(suffix)]);
  const messages = [...evolution.messages, ...wuz.messages].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const imported = [];

  if (shouldImport) {
    for (const message of messages) {
      imported.push(
        await saveInboundWhatsappMessage({
          provider: message.provider,
          providerId: message.providerId,
          phone: message.phone,
          text: message.text,
          attachmentUrl: message.attachmentUrl,
          attachmentName: message.attachmentName,
          attachmentType: message.attachmentType,
          createdAt: message.createdAt,
          direction: message.fromMe ? "OUTBOUND" : "INBOUND",
        }),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    imported: shouldImport ? imported : undefined,
    evolution: {
      ok: evolution.ok,
      error: evolution.error,
      count: evolution.messages.length,
      messages: summarizeMessages(evolution.messages),
    },
    wuz: {
      ok: wuz.ok,
      error: wuz.error,
      count: wuz.messages.length,
      messages: summarizeMessages(wuz.messages),
    },
  });
}

async function findEvolutionMessages(suffix: string, days: number) {
  const settings = await getEvolutionRuntimeSettings();

  if (!settings) {
    return { ok: false, error: "Evolution API não configurada.", messages: [] as ProviderMessage[] };
  }

  const body = JSON.stringify({
      where: {
        messageTimestamp: {
          gte: Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000),
        },
      },
    });
  const response = await fetchEvolutionFindMessages(settings, body);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorPayload = getRecord(payload);

    return {
      ok: false,
      error: getString(errorPayload?.message) || getString(errorPayload?.error) || `Evolution API retornou status ${response.status}.`,
      messages: [] as ProviderMessage[],
    };
  }

  return {
    ok: true,
    messages: flattenPotentialMessages(payload)
      .map(parseEvolutionMessage)
      .filter((message): message is ProviderMessage => Boolean(message?.phone.endsWith(suffix))),
  };
}

async function fetchEvolutionFindMessages(settings: NonNullable<Awaited<ReturnType<typeof getEvolutionRuntimeSettings>>>, body: string) {
  const baseUrl = settings.apiUrl.replace(/\/+$/, "");
  const candidates = Array.from(new Set([baseUrl, `${baseUrl}/api`, baseUrl.replace(/\/api$/i, "")]));

  for (const candidate of candidates) {
    const response = await fetch(`${candidate}/chat/findMessages/${encodeURIComponent(settings.instanceName)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: settings.apiKey,
      },
      body,
      cache: "no-store",
    });

    if (response.status !== 404) {
      return response;
    }
  }

  return fetch(`${baseUrl}/chat/findMessages/${encodeURIComponent(settings.instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.apiKey,
    },
    body,
    cache: "no-store",
  });
}

async function findWuzMessages(suffix: string) {
  const settings = await getWuzRuntimeSettings();

  if (!settings) {
    return { ok: false, error: "WUZ não configurada.", messages: [] as ProviderMessage[] };
  }

  const contactsResponse = await fetch(`${getWuzRequestBaseUrl(settings.apiUrl)}/user/contacts`, {
    headers: {
      token: settings.apiToken,
    },
    cache: "no-store",
  });
  const contactsPayload = await contactsResponse.json().catch(() => null);

  if (!contactsResponse.ok) {
    const errorPayload = getRecord(contactsPayload);

    return {
      ok: false,
      error: getString(errorPayload?.message) || getString(errorPayload?.error) || `WUZ retornou status ${contactsResponse.status}.`,
      messages: [] as ProviderMessage[],
    };
  }

  const chatJids = Array.from(new Set(extractWuzContactJids(contactsPayload).filter((jid) => jid.split("@")[0].endsWith(suffix))));
  const messages: ProviderMessage[] = [];

  for (const chatJid of chatJids.slice(0, 10)) {
    await requestWuzHistorySync(settings, chatJid);
    messages.push(...(await fetchWuzHistory(settings, chatJid)));
  }

  return {
    ok: true,
    messages,
  };
}

async function requestWuzHistorySync(settings: NonNullable<Awaited<ReturnType<typeof getWuzRuntimeSettings>>>, chatJid: string) {
  const url = new URL(`${getWuzRequestBaseUrl(settings.apiUrl)}/session/history`);
  url.searchParams.set("chat_jid", chatJid);
  url.searchParams.set("count", "1000");

  await fetch(url, {
    headers: {
      token: settings.apiToken,
    },
    cache: "no-store",
  }).catch(() => null);
}

async function fetchWuzHistory(settings: NonNullable<Awaited<ReturnType<typeof getWuzRuntimeSettings>>>, chatJid: string): Promise<ProviderMessage[]> {
  const url = new URL(`${getWuzRequestBaseUrl(settings.apiUrl)}/chat/history`);
  url.searchParams.set("chat_jid", chatJid);
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    headers: {
      token: settings.apiToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => null);
  return extractWuzMessages(payload).filter((message) => message.phone.endsWith(chatJid.split("@")[0]));
}

function parseEvolutionMessage(record: Record<string, unknown>): ProviderMessage | null {
  const key = getRecord(record.key);
  const message = getRecord(record.message) ?? record;
  const media =
    getRecord(message.imageMessage) ||
    getRecord(message.videoMessage) ||
    getRecord(message.documentMessage) ||
    getRecord(message.audioMessage) ||
    null;
  const remoteJid = getString(key?.remoteJid) || getString(record.remoteJid);
  const phone = remoteJid.split("@")[0];

  if (!phone) {
    return null;
  }

  return {
    provider: "evolution-history",
    providerId: getString(key?.id) || getString(record.id) || null,
    phone,
    fromMe: parseBoolean(key?.fromMe ?? record.fromMe),
    text:
      getString(message.conversation) ||
      getString(getRecord(message.extendedTextMessage)?.text) ||
      getString(media?.caption) ||
      getString(record.text) ||
      "",
    attachmentUrl: getString(media?.url) || null,
    attachmentName: getString(media?.fileName) || null,
    attachmentType: getString(media?.mimetype) || null,
    createdAt: parseDate(record.messageTimestamp || record.messageTimestampS || record.createdAt || record.timestamp),
  };
}

function extractWuzMessages(payload: unknown): ProviderMessage[] {
  const record = getRecord(payload);
  const rows = Array.isArray(record?.data) ? record.data : Array.isArray(payload) ? payload : [];

  return rows.map(parseWuzMessage).filter((message): message is ProviderMessage => message !== null);
}

function parseWuzMessage(value: unknown): ProviderMessage | null {
  const record = getRecord(value);

  if (!record) {
    return null;
  }

  const chatJid = getString(record.chat_jid);
  const senderJid = getString(record.sender_jid);
  const phone = chatJid.split("@")[0];

  if (!phone) {
    return null;
  }

  return {
    provider: "wuz-history",
    providerId: getString(record.message_id) || getString(record.id) || null,
    phone,
    fromMe: senderJid.split("@")[0] !== phone,
    text: getString(record.text_content),
    attachmentUrl: getString(record.media_link) || null,
    attachmentName: null,
    attachmentType: getString(record.message_type) || null,
    createdAt: parseDate(record.timestamp),
  };
}

function extractWuzContactJids(payload: unknown) {
  const record = getRecord(payload);
  const data = getRecord(record?.data);
  const keyedJids = data ? Object.keys(data).filter((key) => key.includes("@")) : [];

  return [...keyedJids, ...flattenPotentialMessages(payload)
    .flatMap((record) => [
      getString(record.jid),
      getString(record.id),
      getString(record.phone),
      getString(record.number),
      getString(record.contact_jid),
      getString(record.chat_jid),
    ])]
    .map((value) => (value.includes("@") ? value : `${normalizeWhatsappNumber(value)}@s.whatsapp.net`))
    .filter((value) => /^\d+@s\.whatsapp\.net$/.test(value));
}

function summarizeMessages(messages: ProviderMessage[]) {
  return messages.slice(-20).map((message) => ({
    phone: maskPhone(message.phone),
    direction: message.fromMe ? "OUTBOUND" : "INBOUND",
    createdAt: message.createdAt.toISOString(),
    text: message.text.slice(0, 180),
    providerId: message.providerId,
  }));
}

function flattenPotentialMessages(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenPotentialMessages);
  }

  const record = getRecord(value);

  if (!record) {
    return [];
  }

  const candidates = [record.messages, record.data, record.rows, record.result, record.records, record.contacts];

  for (const candidate of candidates) {
    const flattened = flattenPotentialMessages(candidate);

    if (flattened.length > 0) {
      return flattened;
    }
  }

  return [record];
}

function parseDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000);
  }

  const timestamp = Number(value);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  }

  const parsed = typeof value === "string" ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function getWuzRequestBaseUrl(apiUrl: string) {
  return apiUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
}

function getRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
}

function maskPhone(phone: string) {
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}
