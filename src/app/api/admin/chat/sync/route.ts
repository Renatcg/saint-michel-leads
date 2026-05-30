import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { replaceEvolutionHistoryForLeads, syncEvolutionHistoryForLeads } from "@/lib/evolution-history";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const reset = Boolean((payload as { reset?: boolean } | null)?.reset);
  const leads = await getPrisma().lead.findMany({
    select: {
      id: true,
      phone: true,
    },
  });

  if (reset) {
    const result = await replaceEvolutionHistoryForLeads(leads);

    return NextResponse.json({
      ok: true,
      reset: true,
      ...result,
    });
  }

  const synced = await syncEvolutionHistoryForLeads(leads);

  return NextResponse.json({
    ok: true,
    synced,
  });
}
