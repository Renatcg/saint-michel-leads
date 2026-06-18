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
  direction?: "INBOUND" | "OUTBOUND";
};

export async function saveInboundWhatsappMessage(message: InboundWhatsappMessage) {
  const prisma = getPrisma();
  const phone = normalizeDigits(message.phone);
  const direction = message.direction ?? "INBOUND";
  const lead = await prisma.lead.findFirst({
    where: {
      phone: {
        contains: phone.slice(-8),
      },
    },
    select: { id: true },
  }) ?? (await createWhatsappLead(phone, message.createdAt, direction));

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
    direction,
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
      direction,
      readAt: direction === "INBOUND" ? null : message.createdAt,
      provider: message.provider,
      providerId: message.providerId,
      createdAt: message.createdAt,
    } as never,
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(direction === "INBOUND" ? { lastInboundAt: message.createdAt } : { lastOutboundAt: message.createdAt }),
    },
  });

  return { saved: true, leadId: lead.id };
}

async function findEquivalentInboundMessage({
  leadId,
  text,
  createdAt,
  attachmentName,
  direction,
}: {
  leadId: string;
  text: string;
  createdAt: Date;
  attachmentName: string | null;
  direction: "INBOUND" | "OUTBOUND";
}) {
  const prisma = getPrisma();
  const start = new Date(createdAt.getTime() - 90_000);
  const end = new Date(createdAt.getTime() + 90_000);

  return prisma.messageLog.findFirst({
    where: {
      leadId,
      channel: MessageChannel.WHATSAPP,
      direction,
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

async function createWhatsappLead(phone: string, createdAt: Date, direction: "INBOUND" | "OUTBOUND") {
  const prisma = getPrisma();
  const normalizedPhone = normalizePhoneNumber(phone);

  return prisma.lead.create({
    data: {
      name: `WhatsApp ${formatPhoneLabel(normalizedPhone)}`,
      email: `whatsapp-${normalizedPhone}@saint-michel.local`,
      phone: normalizedPhone,
      acceptedDataUsage: true,
      source: "whatsapp",
      status: "NEW",
      ...(direction === "INBOUND" ? { lastInboundAt: createdAt } : { lastOutboundAt: createdAt }),
    },
    select: { id: true },
  });
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhoneNumber(phone: string) {
  if (phone.startsWith("55")) {
    return phone;
  }

  return `55${phone}`;
}

function formatPhoneLabel(phone: string) {
  return phone.replace(/^55/, "").replace(/(\d{2})(\d+)(\d{4})$/, "($1) $2-$3");
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
