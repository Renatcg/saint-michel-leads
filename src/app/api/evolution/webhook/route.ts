import { NextResponse } from "next/server";
import { shouldCaptureWhatsappProvider } from "@/lib/integrations";
import { saveInboundWhatsappMessage } from "@/lib/whatsapp-message-log";

export async function POST(request: Request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;

  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const event = extractEvolutionMessage(payload);

  if (!(await shouldCaptureWhatsappProvider("EVOLUTION"))) {
    return NextResponse.json({ ok: true, ignored: true, reason: "provider_capture_disabled" });
  }

  if (!event?.phone || event.fromMe || (!event.text && !event.attachmentUrl)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await saveInboundWhatsappMessage({
    provider: "evolution-webhook",
    providerId: event.id,
    phone: event.phone,
    text: event.text,
    attachmentUrl: event.attachmentUrl,
    attachmentName: event.attachmentName,
    attachmentType: event.attachmentType,
    createdAt: event.createdAt,
  });

  return NextResponse.json({ ok: true, ...result });
}

function extractEvolutionMessage(payload: unknown) {
  const record = payload as Record<string, unknown> | null;
  const data = getRecord(record?.data) ?? record;
  const key = getRecord(data?.key);
  const message = getRecord(data?.message);
  const remoteJid = String(key?.remoteJid || data?.remoteJid || "");
  const fromMe = parseBoolean(key?.fromMe ?? data?.fromMe);
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
    createdAt: parseMessageDate(data),
  };
}

function parseMessageDate(data: Record<string, unknown> | null) {
  const timestamp = Number(data?.messageTimestamp || data?.messageTimestampS || data?.timestamp);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  }

  return new Date();
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
