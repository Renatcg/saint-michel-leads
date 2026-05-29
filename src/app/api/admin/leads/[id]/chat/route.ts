import { DeliveryStatus, MessageChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { sendEvolutionTextMessage } from "@/lib/integrations";
import { getPrisma } from "@/lib/prisma";

const chatMessageSchema = z.object({
  text: z.string().trim().min(2, "Escreva uma mensagem antes de enviar.").max(2000, "Mensagem muito longa."),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  try {
    const result = await sendEvolutionTextMessage({
      number: lead.phone,
      text: parsed.data.text,
    });

    await prisma.messageLog.create({
      data: {
        leadId: lead.id,
        channel: MessageChannel.WHATSAPP,
        status: DeliveryStatus.SENT,
        provider: "evolution-manual",
        providerId: typeof result?.key?.id === "string" ? result.key.id : null,
      },
    });

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      providerId: typeof result?.key?.id === "string" ? result.key.id : null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao enviar WhatsApp.";

    await prisma.messageLog.create({
      data: {
        leadId: lead.id,
        channel: MessageChannel.WHATSAPP,
        status: DeliveryStatus.FAILED,
        provider: "evolution-manual",
        errorMessage,
      },
    });

    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
