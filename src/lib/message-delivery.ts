import { DeliveryStatus, MessageChannel, MessageTrigger, type Lead, type MessageTemplate } from "@prisma/client";
import { Resend } from "resend";
import { sendEvolutionTextMessage } from "@/lib/integrations";
import { buildSalesContactUrl, getLandingSettings } from "@/lib/landing";
import { getPrisma } from "@/lib/prisma";
import { markdownToHtml } from "@/lib/rich-content";

type TemplateWithLead = {
  id: string;
  channel: MessageChannel;
  lead: Lead;
  template: MessageTemplate;
};

type ResendSettings = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

type TemplateVariables = {
  salesContactUrl?: string;
};

export function renderMessageTemplate(
  template: string,
  lead: Pick<Lead, "name" | "email" | "phone">,
  variables: TemplateVariables = {},
) {
  return template
    .replaceAll("{{nome}}", lead.name)
    .replaceAll("{{email}}", lead.email)
    .replaceAll("{{telefone}}", lead.phone)
    .replaceAll("{{link_corretores}}", variables.salesContactUrl ?? "");
}

export function expandTemplateChannels(channel: MessageChannel) {
  if (channel === MessageChannel.BOTH) {
    return [MessageChannel.EMAIL, MessageChannel.WHATSAPP];
  }

  return [channel];
}

export async function processImmediateSchedules(leadId: string) {
  const prisma = getPrisma();
  const schedules = await prisma.messageSchedule.findMany({
    where: {
      leadId,
      status: DeliveryStatus.PENDING,
      scheduledFor: {
        lte: new Date(),
      },
      template: {
        active: true,
        trigger: MessageTrigger.ON_LEAD_CREATED,
      },
    },
    include: {
      lead: true,
      template: true,
    },
  });

  await Promise.all(
    schedules.map((schedule) => {
      if (schedule.channel === MessageChannel.WHATSAPP) {
        return sendWhatsappSchedule(schedule);
      }

      return sendEmailSchedule(schedule);
    }),
  );
}

async function sendEmailSchedule(schedule: TemplateWithLead) {
  const prisma = getPrisma();

  try {
    const settings = await getResendSettings();

    if (!settings) {
      throw new Error("Resend não configurado.");
    }

    if (!schedule.template.subject) {
      throw new Error("Mensagem sem assunto de e-mail.");
    }

    const salesContactUrl = await getSalesContactUrl(settings.fromEmail);
    const subject = renderMessageTemplate(schedule.template.subject, schedule.lead, { salesContactUrl });
    const renderedBody = renderMessageTemplate(schedule.template.body, schedule.lead, { salesContactUrl });
    const text = replaceSalesContactLinks(renderedBody, salesContactUrl);
    const resend = new Resend(settings.apiKey);
    const result = await resend.emails.send({
      from: formatFrom(settings),
      to: schedule.lead.email,
      subject,
      text,
      html: markdownToHtml(text),
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    await prisma.$transaction([
      prisma.messageLog.create({
        data: {
          leadId: schedule.lead.id,
          templateId: schedule.template.id,
          channel: MessageChannel.EMAIL,
          status: DeliveryStatus.SENT,
          provider: "resend",
          providerId: result.data?.id,
        },
      }),
      prisma.messageSchedule.update({
        where: { id: schedule.id },
        data: {
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      }),
    ]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha desconhecida ao enviar e-mail.";

    await prisma.$transaction([
      prisma.messageLog.create({
        data: {
          leadId: schedule.lead.id,
          templateId: schedule.template.id,
          channel: MessageChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          provider: "resend",
          errorMessage,
        },
      }),
      prisma.messageSchedule.update({
        where: { id: schedule.id },
        data: {
          status: DeliveryStatus.FAILED,
          errorMessage,
        },
      }),
    ]);
  }
}

async function sendWhatsappSchedule(schedule: TemplateWithLead) {
  const prisma = getPrisma();

  try {
    const salesContactUrl = await getSalesContactUrl();
    const renderedBody = renderMessageTemplate(schedule.template.body, schedule.lead, { salesContactUrl });
    const text = stripRichContent(replaceSalesContactLinks(renderedBody, salesContactUrl));
    const result = await sendEvolutionTextMessage({
      number: schedule.lead.phone,
      text,
    });

    await prisma.$transaction([
      prisma.messageLog.create({
        data: {
          leadId: schedule.lead.id,
          templateId: schedule.template.id,
          channel: MessageChannel.WHATSAPP,
          status: DeliveryStatus.SENT,
          content: text,
          direction: "OUTBOUND",
          readAt: new Date(),
          provider: "evolution",
          providerId: result?.key?.id,
        } as never,
      }),
      prisma.messageSchedule.update({
        where: { id: schedule.id },
        data: {
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      }),
    ]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha desconhecida ao enviar WhatsApp.";

    await prisma.$transaction([
      prisma.messageLog.create({
        data: {
          leadId: schedule.lead.id,
          templateId: schedule.template.id,
          channel: MessageChannel.WHATSAPP,
          status: DeliveryStatus.FAILED,
          content: schedule.template.body,
          direction: "OUTBOUND",
          readAt: new Date(),
          provider: "evolution",
          errorMessage,
        } as never,
      }),
      prisma.messageSchedule.update({
        where: { id: schedule.id },
        data: {
          status: DeliveryStatus.FAILED,
          errorMessage,
        },
      }),
    ]);
  }
}

async function getResendSettings(): Promise<ResendSettings | null> {
  const prisma = getPrisma();
  const settings = await prisma.integrationSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const apiKey = process.env.RESEND_API_KEY || settings?.resendApiKey;
  const fromEmail = process.env.RESEND_FROM_EMAIL || settings?.resendFromEmail;
  const fromName = process.env.RESEND_FROM_NAME || settings?.resendFromName || "Saint Michel Construtora";

  if (!apiKey || !fromEmail) {
    return null;
  }

  return {
    apiKey,
    fromEmail,
    fromName,
  };
}

function formatFrom(settings: ResendSettings) {
  return `${settings.fromName} <${settings.fromEmail}>`;
}

async function getSalesContactUrl(fromEmail?: string) {
  const landingSettings = await getLandingSettings();
  return (
    buildSalesContactUrl(landingSettings) ||
    process.env.SALES_TEAM_CONTACT_URL ||
    (fromEmail ? `mailto:${fromEmail}?subject=${encodeURIComponent("Quero falar com a equipe de corretores")}` : "")
  );
}

function replaceSalesContactLinks(content: string, salesContactUrl: string) {
  if (!salesContactUrl) {
    return content;
  }

  return content
    .replace(/https:\/\/wa\.me\/\d+(?:\?[^\s)\]]*)?/g, salesContactUrl)
    .replace(/https:\/\/api\.whatsapp\.com\/send\?phone=\d+(?:[^\s)\]]*)?/g, salesContactUrl);
}

function stripRichContent(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "$2: $1")
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, "Imagem: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "Imagem: $1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,2}\s+/gm, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
