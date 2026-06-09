import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { canViewAllLeads } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const favoriteLeadSchema = z.object({
  favorite: z.boolean(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { response, user } = await requireAdminUser();

  if (response || !user) {
    return response;
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = favoriteLeadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      assignedToUserId: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  if (!canViewAllLeads(user.role) && lead.assignedToUserId !== user.id) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  if (parsed.data.favorite) {
    await prisma.leadFavorite.upsert({
      where: {
        leadId_userId: {
          leadId: id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        leadId: id,
        userId: user.id,
      },
    });
  } else {
    await prisma.leadFavorite.deleteMany({
      where: {
        leadId: id,
        userId: user.id,
      },
    });
  }

  return NextResponse.json({ favorite: parsed.data.favorite });
}
