import { DeliveryStatus, MessageChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;

  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const event = extractEvolutionMessage(payload);

  if (!event?.phone || event.fromMe || (!event.text && !event.attachmentUrl)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const prisma = getPrisma();
  const phone = normalizeDigits(event.phone);
  const lead = await prisma.lead.findFirst({
    where: {
      phone: {
        contains: phone.slice(-8),
      },
    },
    select: { id: true },
  });

  if (!lead) {
    return NextResponse.json({ ok: true, ignored: true, reason: "lead_not_found" });
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

  return NextResponse.json({ ok: true });
}

function extractEvolutionMessage(payload: unknown) {
  const record = payload as Record<string, unknown> | null;
  const data = getRecord(record?.data) ?? record;
  const key = getRecord(data?.key);
  const message = getRecord(data?.message);
  const remoteJid = String(key?.remoteJid || data?.remoteJid || "");
  const fromMe = Boolean(key?.fromMe || data?.fromMe);
  const phone = remoteJid.split("@")[0] || String(data?.number || data?.phone || "");
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

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}
