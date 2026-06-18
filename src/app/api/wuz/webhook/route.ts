import { NextResponse } from "next/server";
import { shouldCaptureWhatsappProvider } from "@/lib/integrations";
import { saveInboundWhatsappMessage } from "@/lib/whatsapp-message-log";

export async function POST(request: Request) {
  const secret = process.env.WUZ_WEBHOOK_SECRET;

  if (secret && !isValidSecret(request, secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!(await shouldCaptureWhatsappProvider("WUZ"))) {
    return NextResponse.json({ ok: true, ignored: true, reason: "provider_capture_disabled" });
  }

  const payload = await request.json().catch(() => null);
  const event = extractWuzMessage(payload);

  if (!event?.phone || (!event.text && !event.attachmentUrl)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await saveInboundWhatsappMessage({
    provider: "wuz-webhook",
    providerId: event.id,
    phone: event.phone,
    text: event.text,
    attachmentUrl: event.attachmentUrl,
    attachmentName: event.attachmentName,
    attachmentType: event.attachmentType,
    createdAt: event.createdAt,
    direction: event.fromMe ? "OUTBOUND" : "INBOUND",
  });

  return NextResponse.json({ ok: true, ...result });
}

function extractWuzMessage(payload: unknown) {
  const record = getRecord(payload);
  const data = getRecord(record?.data) ?? getRecord(record?.message) ?? record;
  const key = getRecord(data?.key);
  const nestedMessage = getRecord(data?.message);
  const remoteJid =
    getString(key?.remoteJid) ||
    getString(data?.remoteJid) ||
    getString(data?.jid) ||
    getString(data?.chatId) ||
    getString(data?.from);
  const fromMe = parseBoolean(key?.fromMe ?? data?.fromMe ?? data?.isFromMe);
  const phone =
    remoteJid.split("@")[0] ||
    getString(data?.phone) ||
    getString(data?.number) ||
    getString(data?.sender) ||
    getString(data?.from);
  const text =
    getString(data?.text) ||
    getString(data?.body) ||
    getString(data?.content) ||
    getString(nestedMessage?.conversation) ||
    getString(getRecord(nestedMessage?.extendedTextMessage)?.text) ||
    getString(getRecord(nestedMessage?.imageMessage)?.caption) ||
    getString(getRecord(nestedMessage?.videoMessage)?.caption) ||
    getString(getRecord(nestedMessage?.documentMessage)?.caption) ||
    "";
  const media =
    getRecord(data?.media) ||
    getRecord(data?.attachment) ||
    getRecord(nestedMessage?.imageMessage) ||
    getRecord(nestedMessage?.videoMessage) ||
    getRecord(nestedMessage?.documentMessage) ||
    null;

  return {
    id:
      getString(key?.id) ||
      getString(data?.id) ||
      getString(data?.messageId) ||
      getString(data?.msgId) ||
      null,
    phone,
    fromMe,
    text,
    attachmentUrl: getString(media?.url) || getString(media?.mediaUrl) || null,
    attachmentName: getString(media?.fileName) || getString(media?.name) || null,
    attachmentType: getString(media?.mimetype) || getString(media?.mimeType) || getString(media?.type) || null,
    createdAt: parseMessageDate(data),
  };
}

function isValidSecret(request: Request, secret: string) {
  return (
    request.headers.get("x-webhook-secret") === secret ||
    request.headers.get("x-wuz-secret") === secret ||
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

function parseMessageDate(data: Record<string, unknown> | null) {
  const timestamp = Number(data?.messageTimestamp || data?.timestamp || data?.time);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  }

  const date = getString(data?.createdAt) || getString(data?.date);
  const parsedDate = date ? new Date(date) : null;

  return parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date();
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
