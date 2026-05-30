import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminWhatsappChat } from "@/components/admin-whatsapp-chat";
import { requireAdminUser } from "@/lib/admin-auth";
import { canAccessManagement } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ChatPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

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
  direction: string;
  senderName: string | null;
  readAt: Date | null;
  createdAt: Date;
};

type LastMessageRow = {
  leadId: string;
  content: string | null;
  attachmentName: string | null;
  createdAt: Date;
  unreadCount: bigint;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = searchParams ? await searchParams : {};
  const requestedLeadId = getParam(params, "leadId") ?? null;
  const prisma = getPrisma();
  const { response, user: currentUser } = await requireAdminUser();
  if (response || !currentUser) {
    redirect("/admin/login");
  }
  const canChat = Boolean(currentUser);
  const canSyncHistory = canAccessManagement(currentUser.role);

  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const selectedLeadId = leads.some((lead) => lead.id === requestedLeadId) ? requestedLeadId : leads[0]?.id ?? null;
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

  const messages = selectedLeadId
    ? await prisma.$queryRaw<ChatMessageRow[]>`
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
          "direction",
          "senderName",
          "readAt",
          "createdAt"
        FROM "MessageLog"
        WHERE "leadId" = ${selectedLeadId}
          AND "channel" = 'WHATSAPP'
        ORDER BY "createdAt" ASC
      `
    : [];

  return (
    <AdminShell fullBleed>
      <AdminWhatsappChat
        key={selectedLeadId}
        canChat={canChat}
        canSyncHistory={canSyncHistory}
        selectedLeadId={selectedLeadId}
        initialMessages={messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt?.toISOString() ?? null,
        }))}
        leads={leads.map((lead) => {
          const lastLog = lastMessagesByLead.get(lead.id);

          return {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            status: lead.status,
            createdAt: lead.createdAt.toISOString(),
            lastMessageAt: lastLog?.createdAt.toISOString() ?? null,
            lastMessage: lastLog?.content || (lastLog?.attachmentName ? `Anexo: ${lastLog.attachmentName}` : ""),
            unreadCount: Number(lastLog?.unreadCount ?? 0),
          };
        })}
      />
    </AdminShell>
  );
}
