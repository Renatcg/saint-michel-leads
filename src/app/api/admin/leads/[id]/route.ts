import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";
import { adminLeadUpdateSchema, normalizePhone } from "@/lib/validators";

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
  const parsed = adminLeadUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const lead = await getPrisma().lead
    .update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: normalizePhone(parsed.data.phone),
        status: parsed.data.status,
        source: parsed.data.source,
      },
    })
    .catch(() => null);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const lead = await getPrisma().lead.delete({ where: { id } }).catch(() => null);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
