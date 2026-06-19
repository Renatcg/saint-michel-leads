import { DeliveryStatus, MessageChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const META_ORIGENS_MESSAGES = new Set([
  normalizeMetaMessage("Olá! Quero maisi informações sobre o Origens Panorama, por favor."),
  normalizeMetaMessage("Olá! Quero mais informações sobre o Origens Panorama, por favor."),
]);

export async function POST(request: Request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;

  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const event = extractEvolutionMessage(payload);

  if (!event?.phone || event.unresolvedLid || event.fromMe || (!event.text && !event.attachmentUrl)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const prisma = getPrisma();
  const phone = normalizeDigits(event.phone);
  let lead = await prisma.lead.findFirst({
    where: {
      phone: {
        contains: phone.slice(-8),
      },
    },
    select: { id: true },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        name: event.pushName || `WhatsApp ${formatPhoneLabel(phone)}`,
        email: `whatsapp-${phone}@saint-michel.local`,
        phone,
        source: getWhatsappLeadSource(event.text),
        lastInboundAt: new Date(),
      },
      select: { id: true },
    });
  }

  if (event.id) {
    const existing = await prisma.messageLog.findFirst({
      where: {
        providerId: event.id,
        provider: {
          in: ["evolution-webhook", "evolution-history"],
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: true, ignored: true, reason: "duplicate" });
    }
  }

  await prisma.messageLog.create({
    data: {
      leadId: lead.id,
      channel: MessageChannel.WHATSAPP,
      status: DeliveryStatus.SENT,
      content: event.text,
      attachmentUrl: event.attachmentUrl,
      attachmentName: event.attachmentName,
      attachmentType: event.attachmentType,
      direction: "INBOUND",
      readAt: null,
      provider: "evolution-webhook",
      providerId: event.id,
    } as never,
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      lastInboundAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

function extractEvolutionMessage(payload: unknown) {
  const record = payload as Record<string, unknown> | null;
  const data = getRecord(record?.data) ?? record;
  const key = getRecord(data?.key);
  const message = getRecord(data?.message);
  const rawRemoteJid = getString(key?.remoteJid) || getString(data?.remoteJid);
  const remoteJidAlt = getString(key?.remoteJidAlt);
  const remoteJid = remoteJidAlt || rawRemoteJid;
  const fromMe = parseBoolean(key?.fromMe ?? data?.fromMe);
  const phone = remoteJid.split("@")[0] || getString(data?.number) || getString(data?.phone);
  const text =
    getString(message?.conversation) ||
    getString(getRecord(message?.extendedTextMessage)?.text) ||
    getString(getRecord(message?.imageMessage)?.caption) ||
    getString(getRecord(message?.videoMessage)?.caption) ||
    getString(getRecord(message?.documentMessage)?.caption) ||
    "";
  const media =
    getRecord(message?.imageMessage) ||
    getRecord(message?.videoMessage) ||
    getRecord(message?.documentMessage) ||
    null;

  return {
    id: getString(key?.id) || getString(data?.id) || null,
    phone,
    unresolvedLid: !remoteJidAlt && rawRemoteJid.endsWith("@lid"),
    pushName: getString(data?.pushName),
    fromMe,
    text,
    attachmentUrl: getString(media?.url) || null,
    attachmentName: getString(media?.fileName) || null,
    attachmentType: getString(media?.mimetype) || null,
  };
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

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getWhatsappLeadSource(text: string) {
  return META_ORIGENS_MESSAGES.has(normalizeMetaMessage(text)) ? "meta" : "whatsapp_avulso";
}

function normalizeMetaMessage(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatPhoneLabel(phone: string) {
  const digits = normalizeDigits(phone);

  if (digits.length <= 4) {
    return digits || "sem número";
  }

  return digits.slice(-4);
}
