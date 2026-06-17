import { DeliveryStatus, MessageChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { canViewAllLeads } from "@/lib/auth";
import { getActiveWhatsappProvider, sendWhatsappMediaMessage, sendWhatsappTextMessage } from "@/lib/integrations";
import { getPrisma } from "@/lib/prisma";

const chatMessageSchema = z.object({
  text: z.string().trim().max(2000, "Mensagem muito longa.").optional().default(""),
  attachment: z
    .object({
      url: z.string().url(),
      name: z.string().trim().min(1).max(180),
      type: z.string().trim().min(1).max(120),
    })
    .nullish(),
}).refine((data) => data.text.length >= 2 || data.attachment, {
  message: "Escreva uma mensagem ou anexe um arquivo antes de enviar.",
  path: ["text"],
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SenderRow = {
  name: string;
  messageUsername: string | null;
};

function formatMessageForLead(senderName: string, text: string) {
  const cleanText = text.trim();
  const senderLabel = `*${senderName}:*`;

  return cleanText ? `${senderLabel}\n${cleanText}` : senderLabel;
}

export async function POST(request: Request, context: RouteContext) {
  const { response, user } = await requireAdminUser();

  if (response || !user) {
    return response;
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const [sender] = await prisma.$queryRaw<SenderRow[]>`
    SELECT "name", "messageUsername"
    FROM "User"
    WHERE "id" = ${user.id}
    LIMIT 1
  `;
  const senderName = sender?.messageUsername || sender?.name || user.name;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      assignedToUserId: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  if (!canViewAllLeads(user.role) && lead.assignedToUserId !== user.id) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const leadMessageText = formatMessageForLead(senderName, parsed.data.text);
  const whatsappProvider = await getActiveWhatsappProvider();
  const providerPrefix = whatsappProvider === "WUZ" ? "wuz" : "evolution";

  try {
    const result = parsed.data.attachment
      ? await sendWhatsappMediaMessage({
          number: lead.phone,
          caption: leadMessageText,
          mediaUrl: parsed.data.attachment.url,
          fileName: parsed.data.attachment.name,
          mimeType: parsed.data.attachment.type,
        })
      : await sendWhatsappTextMessage({
          number: lead.phone,
          text: leadMessageText,
        });

    await prisma.messageLog.create({
      data: {
        leadId: lead.id,
        channel: MessageChannel.WHATSAPP,
        status: DeliveryStatus.SENT,
        content: parsed.data.text,
        attachmentUrl: parsed.data.attachment?.url,
        attachmentName: parsed.data.attachment?.name,
        attachmentType: parsed.data.attachment?.type,
        direction: "OUTBOUND",
        senderName,
        readAt: new Date(),
        provider: `${providerPrefix}-manual`,
        providerId: extractProviderMessageId(result),
      } as never,
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastOutboundAt: new Date(),
        lastHandledAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      providerId: extractProviderMessageId(result),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao enviar WhatsApp.";

    await prisma.messageLog.create({
      data: {
        leadId: lead.id,
        channel: MessageChannel.WHATSAPP,
        status: DeliveryStatus.FAILED,
        content: parsed.data.text,
        attachmentUrl: parsed.data.attachment?.url,
        attachmentName: parsed.data.attachment?.name,
        attachmentType: parsed.data.attachment?.type,
        direction: "OUTBOUND",
        senderName,
        readAt: new Date(),
        provider: `${providerPrefix}-manual`,
        errorMessage,
      } as never,
    });

    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}

function extractProviderMessageId(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  const key = record.key && typeof record.key === "object" ? (record.key as Record<string, unknown>) : null;

  return typeof key?.id === "string"
    ? key.id
    : typeof record.id === "string"
      ? record.id
      : typeof record.messageId === "string"
        ? record.messageId
        : null;
}
