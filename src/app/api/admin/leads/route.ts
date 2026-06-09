import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { canViewAllLeads } from "@/lib/auth";
import { leadStatusValues, type LeadStatusValue } from "@/lib/leads";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { response, user } = await requireAdminUser();

  if (response || !user) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();

  const where: Prisma.LeadWhereInput = {};

  if (!canViewAllLeads(user.role)) {
    where.assignedToUserId = user.id;
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ];
  }

  if (status && leadStatusValues.includes(status as LeadStatusValue)) {
    where.status = status as LeadStatusValue;
  }

  const leads = await getPrisma().lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: {
        select: {
          logs: true,
          schedules: true,
        },
      },
    },
  });

  return NextResponse.json({ leads });
}
