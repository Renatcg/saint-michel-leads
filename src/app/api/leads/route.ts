import { NextResponse } from "next/server";
import { MessageTrigger } from "@prisma/client";
import { LANDING_SETTINGS_KEY } from "@/lib/landing";
import { expandTemplateChannels, processImmediateSchedules } from "@/lib/message-delivery";
import { getPrisma } from "@/lib/prisma";
import { leadSchema, normalizePhone } from "@/lib/validators";

export async function POST(request: Request) {
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

  const lead = await prisma.lead.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone,
      acceptedDataUsage: true,
      schedules: {
        create: await buildSchedules(),
      },
    },
  });

  await processImmediateSchedules(lead.id);

  return NextResponse.json({ id: lead.id }, { status: 201 });
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
