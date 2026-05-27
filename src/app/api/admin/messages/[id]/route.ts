import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { LANDING_SETTINGS_KEY } from "@/lib/landing";
import { getPrisma } from "@/lib/prisma";
import { messageTemplateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = messageTemplateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  if (parsed.data.name === LANDING_SETTINGS_KEY) {
    return NextResponse.json({ error: "Nome reservado para configuração interna." }, { status: 400 });
  }

  const template = await getPrisma().messageTemplate
    .update({
      where: { id },
      data: {
        name: parsed.data.name,
        channel: parsed.data.channel,
        trigger: parsed.data.trigger,
        delayDays: parsed.data.trigger === "AFTER_DAYS" ? parsed.data.delayDays : 0,
        subject: parsed.data.subject || null,
        body: parsed.data.body,
        active: parsed.data.active,
      },
    })
    .catch(() => null);

  if (!template) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const template = await getPrisma().messageTemplate.delete({ where: { id } }).catch(() => null);

  if (!template) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
