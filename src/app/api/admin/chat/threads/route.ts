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

type OutboundCountRow = {
  leadId: string;
  outboundCount: bigint;
};

export async function GET(request: Request) {
  const { response, user } = await requireAdminUser();

  if (response || !user) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const phoneQuery = query.replace(/\D/g, "");
  const prisma = getPrisma();
  const leads = await prisma.lead.findMany({
    where: {
      ...(canViewAllLeads(user.role) ? {} : { assignedToUserId: user.id }),
      ...(query
        ? {
            OR: [
              {
                name: {
                  contains: query,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              ...(phoneQuery
                ? [
                    {
                      phone: {
                        contains: phoneQuery,
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
      favorites: {
        where: {
          userId: user.id,
        },
        select: {
          id: true,
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
  const outboundCounts =
    leads.length > 0
      ? await prisma.$queryRaw<OutboundCountRow[]>`
          SELECT
            "leadId",
            COUNT(*) AS "outboundCount"
          FROM "MessageLog"
          WHERE "channel" = 'WHATSAPP'
            AND "direction" = 'OUTBOUND'
            AND "leadId" IN (${Prisma.join(leads.map((lead) => lead.id))})
          GROUP BY "leadId"
        `
      : [];
  const outboundCountsByLead = new Map(outboundCounts.map((row) => [row.leadId, Number(row.outboundCount)]));

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
        lastOutboundAt: lead.lastOutboundAt?.toISOString() ?? null,
        outboundCount: outboundCountsByLead.get(lead.id) ?? 0,
        createdAt: lead.createdAt.toISOString(),
        lastMessageAt: lastLog?.createdAt.toISOString() ?? null,
        lastMessage: lastLog?.content || (lastLog?.attachmentName ? `Anexo: ${lastLog.attachmentName}` : ""),
        unreadCount: Number(lastLog?.unreadCount ?? 0),
        isFavorite: lead.favorites.length > 0,
      };
    }).sort(sortByRecentActivity).slice(0, 100),
  });
}

function sortByRecentActivity(
  left: { lastMessageAt: string | null; createdAt: string },
  right: { lastMessageAt: string | null; createdAt: string },
) {
  const leftTime = new Date(left.lastMessageAt ?? left.createdAt).getTime();
  const rightTime = new Date(right.lastMessageAt ?? right.createdAt).getTime();

  return rightTime - leftTime;
}
