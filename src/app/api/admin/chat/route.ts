import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

type ChatMessageRow = {
  id: string;
  status: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  errorMessage: string | null;
  provider: string | null;
  providerId: string | null;
  createdAt: Date;
};

export async function GET(request: Request) {
  const { response } = await requireAdminUser();

  if (response) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  const prisma = getPrisma();

  if (!leadId) {
    return NextResponse.json({ error: "Lead não informado." }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  const messages = await prisma.$queryRaw<ChatMessageRow[]>`
    SELECT
      "id",
      "status",
      "content",
      "attachmentUrl",
      "attachmentName",
      "attachmentType",
      "errorMessage",
      "provider",
      "providerId",
      "createdAt"
    FROM "MessageLog"
    WHERE "leadId" = ${leadId}
      AND "channel" = 'WHATSAPP'
    ORDER BY "createdAt" ASC
  `;

  return NextResponse.json({
    lead: {
      ...lead,
      createdAt: lead.createdAt.toISOString(),
    },
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}
