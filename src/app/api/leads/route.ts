import { NextResponse } from "next/server";
import { after } from "next/server";
import { MessageTrigger } from "@prisma/client";
import { LANDING_SETTINGS_KEY } from "@/lib/landing";
import { expandTemplateChannels, processImmediateSchedules } from "@/lib/message-delivery";
import { getPrisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { leadSchema, normalizePhone } from "@/lib/validators";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`lead:${getClientIp(request)}`, 5, 10 * 60 * 1000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  if (!parsed.data.acceptedDataUsage) {
    return NextResponse.json({ error: "O aceite de uso dos dados é obrigatório." }, { status: 400 });
  }

  const prisma = getPrisma();
  const phone = normalizePhone(parsed.data.phone);
  const existingLead = await prisma.lead.findFirst({
    where: {
      OR: [
        { email: parsed.data.email },
        { phone },
      ],
    },
    select: { id: true },
  });

  if (existingLead) {
    return NextResponse.json(
      { error: "Este cadastro já existe. Nossa equipe já recebeu seus dados." },
      { status: 409 },
    );
  }

  const lead = await prisma.lead.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone,
      acceptedDataUsage: true,
    },
  });

  after(async () => {
    try {
      await createSchedulesAndProcessImmediate(lead.id);
    } catch (error) {
      console.error("Não foi possível processar mensagens do lead.", error);
    }
  });

  return NextResponse.json({ id: lead.id }, { status: 201 });
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

async function buildSchedules() {
  const prisma = getPrisma();
  const templates = await prisma.messageTemplate.findMany({
    where: {
      active: true,
      name: {
        not: LANDING_SETTINGS_KEY,
      },
      trigger: {
        in: [MessageTrigger.ON_LEAD_CREATED, MessageTrigger.AFTER_DAYS],
      },
    },
  });

  const now = new Date();

  return templates.flatMap((template) => {
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + template.delayDays);

    return expandTemplateChannels(template.channel).map((channel) => ({
      templateId: template.id,
      channel,
      scheduledFor,
    }));
  });
}

async function createSchedulesAndProcessImmediate(leadId: string) {
  const prisma = getPrisma();
  const schedules = await buildSchedules();

  if (schedules.length > 0) {
    await prisma.messageSchedule.createMany({
      data: schedules.map((schedule) => ({
        ...schedule,
        leadId,
      })),
    });
  }

  await processImmediateSchedules(leadId);
}
