import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminMessagesManager } from "@/components/admin-messages-manager";
import { requireAdminUser } from "@/lib/admin-auth";
import { canEditLeads } from "@/lib/auth";
import { LANDING_SETTINGS_KEY } from "@/lib/landing";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { response, user: currentUser } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response || !currentUser) {
    redirect("/admin/leads");
  }

  const canEdit = currentUser ? canEditLeads(currentUser.role) : false;
  const templates = await getPrisma().messageTemplate.findMany({
    where: {
      name: {
        not: LANDING_SETTINGS_KEY,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          schedules: true,
          logs: true,
        },
      },
    },
  });

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Mensagens</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Crie mensagens automáticas e manuais usando variáveis como {"{{nome}}"}, {"{{email}}"} e {"{{telefone}}"}.
        </p>

        <AdminMessagesManager
          canEdit={canEdit}
          initialTemplates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            channel: template.channel,
            trigger: template.trigger,
            delayDays: template.delayDays,
            subject: template.subject ?? "",
            body: template.body,
            active: template.active,
            schedulesCount: template._count.schedules,
            logsCount: template._count.logs,
          }))}
        />
      </section>
    </AdminShell>
  );
}
