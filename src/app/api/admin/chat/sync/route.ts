import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { syncEvolutionHistoryForLeads } from "@/lib/evolution-history";
import { getPrisma } from "@/lib/prisma";

export async function POST() {
  const { response } = await requireAdminUser();

  if (response) {
    return response;
  }

  const leads = await getPrisma().lead.findMany({
    select: {
      id: true,
      phone: true,
    },
  });
  const synced = await syncEvolutionHistoryForLeads(leads);

  return NextResponse.json({
    ok: true,
    synced,
  });
}
