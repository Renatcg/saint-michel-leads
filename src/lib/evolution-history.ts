import { DeliveryStatus, MessageChannel, type Lead } from "@prisma/client";
import { getEvolutionRuntimeSettings, normalizeWhatsappNumber } from "@/lib/integrations";
import { getPrisma } from "@/lib/prisma";

type EvolutionHistoryMessage = {
  id: string | null;
  remoteJid: string;
  fromMe: boolean;
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  createdAt: Date;
};

export async function syncEvolutionHistoryForLead(lead: Pick<Lead, "id" | "phone">) {
  const settings = await getEvolutionRuntimeSettings();

  if (!settings) {
    return;
  }

  const remoteJid = `${normalizeWhatsappNumber(lead.phone)}@s.whatsapp.net`;
  const response = await fetch(`${settings.apiUrl}/chat/findMessages/${encodeURIComponent(settings.instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.apiKey,
    },
    body: JSON.stringify({
      where: {
        key: {
          remoteJid,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return;
  }

  const payload = await response.json().catch(() => null);
  const messages = extractEvolutionMessages(payload)
    .filter((message) => message.remoteJid === remoteJid || !message.remoteJid)
    .slice(-100);
  const prisma = getPrisma();

  for (const message of messages) {
    if (message.id) {
      const existing = await prisma.messageLog.findFirst({
        where: {
          provider: "evolution-history",
          providerId: message.id,
        },
        select: { id: true },
      });

      if (existing) {
        continue;
      }
    }

    await prisma.messageLog.create({
      data: {
        leadId: lead.id,
        channel: MessageChannel.WHATSAPP,
        status: DeliveryStatus.SENT,
        content: message.text,
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        attachmentType: message.attachmentType,
        direction: message.fromMe ? "OUTBOUND" : "INBOUND",
        readAt: message.fromMe ? message.createdAt : null,
        provider: "evolution-history",
        providerId: message.id,
        createdAt: message.createdAt,
      } as never,
    });
  }
}

function extractEvolutionMessages(payload: unknown): EvolutionHistoryMessage[] {
  const records = flattenPotentialMessages(payload);

  return records.map(parseEvolutionMessage).filter((message): message is EvolutionHistoryMessage => Boolean(message));
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
    fromMe: Boolean(key?.fromMe ?? record.fromMe),
    text,
    attachmentUrl: getString(media?.url) || null,
    attachmentName: getString(media?.fileName) || null,
    attachmentType: getString(media?.mimetype) || null,
    createdAt,
  };
}

function getRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
