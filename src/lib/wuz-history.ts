import { DeliveryStatus, MessageChannel, type Lead } from "@prisma/client";
import { getWuzRuntimeSettings, normalizeWhatsappNumber } from "@/lib/integrations";
import { getPrisma } from "@/lib/prisma";

type WuzHistoryMessage = {
  id: string | null;
  chatJid: string;
  senderJid: string;
  text: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: Date;
};

export async function syncWuzHistoryForLead(lead: Pick<Lead, "id" | "phone">) {
  const messages = await fetchWuzHistoryForLead(lead);
  const prisma = getPrisma();
  let synced = 0;

  for (const message of messages) {
    if (message.id) {
      const existing = await prisma.messageLog.findFirst({
        where: {
          provider: "wuz-history",
          providerId: message.id,
        },
        select: { id: true },
      });

      if (existing) {
        continue;
      }
    }

    await prisma.messageLog.create({
      data: buildMessageLogData(lead, message),
    });
    synced += 1;
  }

  return synced;
}

export async function fetchWuzHistoryForLead(lead: Pick<Lead, "id" | "phone">) {
  const settings = await getWuzRuntimeSettings();

  if (!settings) {
    return [];
  }

  const chatJid = `${normalizeWhatsappNumber(lead.phone)}@s.whatsapp.net`;
  await requestWuzHistorySync(settings, chatJid);

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
  return extractWuzMessages(payload).filter((message) => message.chatJid === chatJid || !message.chatJid);
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

export async function syncWuzHistoryForLeads(leads: Pick<Lead, "id" | "phone">[]) {
  let synced = 0;

  for (const lead of leads) {
    synced += await syncWuzHistoryForLead(lead);
  }

  return synced;
}

export async function replaceWuzHistoryForLeads(leads: Pick<Lead, "id" | "phone">[]) {
  const fetched: Array<{ lead: Pick<Lead, "id" | "phone">; messages: WuzHistoryMessage[] }> = [];

  for (const lead of leads) {
    fetched.push({
      lead,
      messages: await fetchWuzHistoryForLead(lead),
    });
  }

  const prisma = getPrisma();
  const total = fetched.reduce((sum, item) => sum + item.messages.length, 0);

  await prisma.$transaction(
    async (tx) => {
      await tx.messageLog.deleteMany({
        where: {
          channel: MessageChannel.WHATSAPP,
          provider: "wuz-history",
        },
      });

      for (const item of fetched) {
        for (const message of item.messages) {
          await tx.messageLog.create({
            data: buildMessageLogData(item.lead, message),
          });
        }
      }
    },
    { timeout: 60000 },
  );

  return {
    leads: leads.length,
    messages: total,
  };
}

function buildMessageLogData(lead: Pick<Lead, "id" | "phone">, message: WuzHistoryMessage) {
  const leadNumber = normalizeWhatsappNumber(lead.phone);
  const senderNumber = message.senderJid.split("@")[0];

  return {
    leadId: lead.id,
    channel: MessageChannel.WHATSAPP,
    status: DeliveryStatus.SENT,
    content: message.text,
    attachmentUrl: message.attachmentUrl,
    attachmentType: message.attachmentType,
    direction: senderNumber === leadNumber ? "INBOUND" : "OUTBOUND",
    readAt: message.createdAt,
    provider: "wuz-history",
    providerId: message.id,
    createdAt: message.createdAt,
  } as never;
}

function extractWuzMessages(payload: unknown): WuzHistoryMessage[] {
  const record = getRecord(payload);
  const rows = Array.isArray(record?.data) ? record.data : Array.isArray(payload) ? payload : [];

  return rows.map(parseWuzHistoryMessage).filter((message): message is WuzHistoryMessage => Boolean(message));
}

function parseWuzHistoryMessage(value: unknown) {
  const record = getRecord(value);

  if (!record) {
    return null;
  }

  return {
    id: getString(record.message_id) || getString(record.id) || null,
    chatJid: getString(record.chat_jid),
    senderJid: getString(record.sender_jid),
    text: getString(record.text_content),
    attachmentUrl: getString(record.media_link) || null,
    attachmentType: getString(record.message_type) || null,
    createdAt: parseDate(record.timestamp),
  };
}

function parseDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000);
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
