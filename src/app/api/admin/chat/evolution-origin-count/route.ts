import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getEvolutionRuntimeSettings } from "@/lib/integrations";

const ORIGENS_PANORAMA_PHRASE = "Olá! Quero mais informações sobre o Origens Panorama, por favor.";
const DEFAULT_DAYS = 2;
const MAX_DAYS = 7;

type EvolutionMessage = {
  id: string | null;
  remoteJid: string;
  fromMe: boolean;
  text: string;
  createdAt: Date;
};

export async function GET(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER", "SUPERVISOR"]);

  if (response) {
    return response;
  }

  const settings = await getEvolutionRuntimeSettings();

  if (!settings) {
    return NextResponse.json({ error: "Evolution API não configurada." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const days = clampDays(Number(searchParams.get("days") || DEFAULT_DAYS));
  const phrase = searchParams.get("phrase")?.trim() || ORIGENS_PANORAMA_PHRASE;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const responsePayload = await fetchRecentEvolutionMessages(settings, since);

  if (!responsePayload.ok) {
    return NextResponse.json({ error: responsePayload.error }, { status: 502 });
  }

  const allMessages = extractEvolutionMessages(responsePayload.payload).filter((message) => !message.remoteJid.endsWith("@g.us"));
  const recentMessages = allMessages
    .filter((message) => message.createdAt >= since)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const chats = groupMessagesByChat(recentMessages);
  const matches = Array.from(chats.entries())
    .map(([remoteJid, messages]) => {
      const firstInbound = messages.find((message) => !message.fromMe && message.text.trim());

      return {
        remoteJid,
        firstInbound,
        totalMessages: messages.length,
      };
    })
    .filter((chat) => chat.firstInbound?.text.trim() === phrase);

  return NextResponse.json({
    ok: true,
    days,
    since: since.toISOString(),
    phrase,
    evoDateFilterRequested: true,
    fetchedMessages: allMessages.length,
    checkedMessages: recentMessages.length,
    checkedConversations: chats.size,
    matchedConversations: matches.length,
    sample: matches.slice(0, 10).map((match) => ({
      phone: maskRemoteJid(match.remoteJid),
      firstInboundAt: match.firstInbound?.createdAt.toISOString() ?? null,
      totalMessages: match.totalMessages,
    })),
  });
}

async function fetchRecentEvolutionMessages(
  settings: { apiUrl: string; apiKey: string; instanceName: string },
  since: Date,
) {
  const endpoint = `${settings.apiUrl}/chat/findMessages/${encodeURIComponent(settings.instanceName)}`;
  const body = {
    where: {
      messageTimestamp: {
        gte: Math.floor(since.getTime() / 1000),
      },
    },
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false as const,
      error: payload?.message || payload?.error || `Evolution API retornou status ${response.status}.`,
    };
  }

  return {
    ok: true as const,
    payload,
  };
}

function extractEvolutionMessages(payload: unknown): EvolutionMessage[] {
  return flattenPotentialMessages(payload)
    .map(parseEvolutionMessage)
    .filter((message): message is EvolutionMessage => Boolean(message?.remoteJid));
}

function flattenPotentialMessages(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenPotentialMessages);
  }

  const record = getRecord(value);

  if (!record) {
    return [];
  }

  const candidates = [record.messages, record.data, record.rows, record.result, record.records];

  for (const candidate of candidates) {
    const flattened = flattenPotentialMessages(candidate);

    if (flattened.length > 0) {
      return flattened;
    }
  }

  return record.key || record.message || record.messageTimestamp ? [record] : [];
}

function parseEvolutionMessage(record: Record<string, unknown>) {
  const key = getRecord(record.key);
  const message = getRecord(record.message) ?? record;
  const remoteJid = getString(key?.remoteJid) || getString(record.remoteJid);
  const timestamp = Number(record.messageTimestamp || record.messageTimestampS || record.createdAt || record.timestamp);
  const createdAt = Number.isFinite(timestamp)
    ? new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000)
    : new Date();
  const media =
    getRecord(message.imageMessage) ||
    getRecord(message.videoMessage) ||
    getRecord(message.documentMessage) ||
    getRecord(message.audioMessage) ||
    null;
  const text =
    getString(message.conversation) ||
    getString(getRecord(message.extendedTextMessage)?.text) ||
    getString(media?.caption) ||
    getString(record.text) ||
    "";

  return {
    id: getString(key?.id) || getString(record.id) || null,
    remoteJid,
    fromMe: parseBoolean(key?.fromMe ?? record.fromMe),
    text,
    createdAt,
  };
}

function groupMessagesByChat(messages: EvolutionMessage[]) {
  const chats = new Map<string, EvolutionMessage[]>();

  for (const message of messages) {
    chats.set(message.remoteJid, [...(chats.get(message.remoteJid) ?? []), message]);
  }

  return chats;
}

function clampDays(days: number) {
  if (!Number.isFinite(days)) {
    return DEFAULT_DAYS;
  }

  return Math.min(Math.max(Math.floor(days), 1), MAX_DAYS);
}

function maskRemoteJid(remoteJid: string) {
  const phone = remoteJid.split("@")[0] ?? "";
  const visible = phone.slice(-4);

  return visible ? `***${visible}` : "***";
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
