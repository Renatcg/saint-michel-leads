import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { canViewAllLeads } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

type LastMessageRow = {
  leadId: string;
  content: string | null;
  attachmentName: string | null;
  createdAt: Date;
  unreadCount: bigint;
};

export async function GET() {
  const { response, user } = await requireAdminUser();

  if (response || !user) {
    return response;
  }

  const prisma = getPrisma();
  const leads = await prisma.lead.findMany({
    where: canViewAllLeads(user.role)
      ? undefined
      : {
          assignedToUserId: user.id,
        },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const lastMessages =
    leads.length > 0
      ? await prisma.$queryRaw<LastMessageRow[]>`
          SELECT DISTINCT ON ("leadId")
            "leadId",
            "content",
            "attachmentName",
            "createdAt",
            COUNT(*) FILTER (WHERE "direction" = 'INBOUND' AND "readAt" IS NULL) OVER (PARTITION BY "leadId") AS "unreadCount"
          FROM "MessageLog"
          WHERE "channel" = 'WHATSAPP'
            AND "leadId" IN (${Prisma.join(leads.map((lead) => lead.id))})
          ORDER BY "leadId", "createdAt" DESC
        `
      : [];
  const lastMessagesByLead = new Map(lastMessages.map((message) => [message.leadId, message]));

  return NextResponse.json({
    leads: leads.map((lead) => {
      const lastLog = lastMessagesByLead.get(lead.id);

      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        assignedToUserId: lead.assignedToUserId,
        assignedToName: lead.assignedTo?.name ?? null,
        createdAt: lead.createdAt.toISOString(),
        lastMessageAt: lastLog?.createdAt.toISOString() ?? null,
        lastMessage: lastLog?.content || (lastLog?.attachmentName ? `Anexo: ${lastLog.attachmentName}` : ""),
        unreadCount: Number(lastLog?.unreadCount ?? 0),
      };
    }),
  });
}
