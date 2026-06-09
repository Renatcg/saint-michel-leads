import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { canAssignLeads } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const assignLeadSchema = z.object({
  userId: z.string().trim().nullable().optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { response, user } = await requireAdminUser(["ADMIN", "SUPERVISOR"]);

  if (response || !user) {
    return response;
  }

  if (!canAssignLeads(user.role)) {
    return NextResponse.json({ error: "Você não tem permissão para encaminhar leads." }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = assignLeadSchema.safeParse(payload);

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

  const nextUserId = parsed.data.userId || null;

  if (nextUserId) {
    const broker = await prisma.user.findFirst({
      where: {
        id: nextUserId,
        active: true,
        role: {
          in: ["BROKER", "VIEWER"],
        },
      },
      select: { id: true },
    });

    if (!broker) {
      return NextResponse.json({ error: "Corretor não encontrado ou inativo." }, { status: 404 });
    }
  }

  const updatedLead = await prisma.lead.update({
    where: { id },
    data: {
      assignedToUserId: nextUserId,
      assignedAt: nextUserId ? new Date() : null,
      assignmentStatus: nextUserId ? "ASSIGNED" : "UNASSIGNED",
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  await prisma.leadAssignmentLog.create({
    data: {
      leadId: lead.id,
      fromUserId: lead.assignedToUserId,
      toUserId: nextUserId,
      reason: nextUserId ? "manual" : "manual_unassign",
      createdById: user.id,
    },
  });

  return NextResponse.json({
    lead: {
      id: updatedLead.id,
      assignedToUserId: updatedLead.assignedToUserId,
      assignedToName: updatedLead.assignedTo?.name ?? null,
      assignmentStatus: updatedLead.assignmentStatus,
      assignedAt: updatedLead.assignedAt?.toISOString() ?? null,
    },
  });
}
