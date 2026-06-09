import { NextResponse } from "next/server";
import { reassignStaleLeads } from "@/lib/lead-routing";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reassignStaleLeads();

  return NextResponse.json({ ok: true, ...result });
}
