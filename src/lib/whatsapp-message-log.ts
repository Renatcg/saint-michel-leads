import { DeliveryStatus, MessageChannel } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

type InboundWhatsappMessage = {
  provider: string;
  providerId: string | null;
  phone: string;
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  createdAt: Date;
};

export async function saveInboundWhatsappMessage(message: InboundWhatsappMessage) {
  const prisma = getPrisma();
  const phone = normalizeDigits(message.phone);
  const lead = await prisma.lead.findFirst({
    where: {
      phone: {
        contains: phone.slice(-8),
      },
    },
    select: { id: true },
  });

  if (!lead) {
    return { saved: false, reason: "lead_not_found" };
  }

  if (message.providerId) {
    const existingByProviderId = await prisma.messageLog.findFirst({
      where: {
        providerId: message.providerId,
        provider: message.provider,
      },
      select: { id: true },
    });

    if (existingByProviderId) {
      return { saved: false, reason: "duplicate_provider_id" };
    }
  }

  const duplicate = await findEquivalentInboundMessage({
    leadId: lead.id,
    text: message.text,
    createdAt: message.createdAt,
    attachmentName: message.attachmentName,
  });

  if (duplicate) {
    return { saved: false, reason: "duplicate_equivalent" };
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
      direction: "INBOUND",
      readAt: null,
      provider: message.provider,
      providerId: message.providerId,
      createdAt: message.createdAt,
    } as never,
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      lastInboundAt: message.createdAt,
    },
  });

  return { saved: true, leadId: lead.id };
}

async function findEquivalentInboundMessage({
  leadId,
  text,
  createdAt,
  attachmentName,
}: {
  leadId: string;
  text: string;
  createdAt: Date;
  attachmentName: string | null;
}) {
  const prisma = getPrisma();
  const start = new Date(createdAt.getTime() - 90_000);
  const end = new Date(createdAt.getTime() + 90_000);

  return prisma.messageLog.findFirst({
    where: {
      leadId,
      channel: MessageChannel.WHATSAPP,
      direction: "INBOUND",
      createdAt: {
        gte: start,
        lte: end,
      },
      content: {
        in: Array.from(new Set([text, normalizeText(text)])),
      },
      attachmentName,
    },
    select: { id: true },
  });
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
