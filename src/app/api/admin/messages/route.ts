import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";
import { messageTemplateSchema } from "@/lib/validators";

export async function GET() {
  const { response } = await requireAdminUser();

  if (response) {
    return response;
  }

  const templates = await getPrisma().messageTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          schedules: true,
          logs: true,
        },
      },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = messageTemplateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const template = await getPrisma().messageTemplate.create({
    data: {
      name: parsed.data.name,
      channel: parsed.data.channel,
      trigger: parsed.data.trigger,
      delayDays: parsed.data.trigger === "AFTER_DAYS" ? parsed.data.delayDays : 0,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
      active: parsed.data.active,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
