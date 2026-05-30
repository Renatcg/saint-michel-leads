import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    redirect("/admin/leads");
  }

  const prisma = getPrisma();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [totalLeads, leadsToday, leadsLastWeek, pendingMessages, failedMessages] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.messageSchedule.count({ where: { status: "PENDING" } }),
    prisma.messageLog.count({ where: { status: "FAILED" } }),
  ]);

  const cards = [
    { label: "Total de leads", value: totalLeads },
    { label: "Leads hoje", value: leadsToday },
    { label: "Últimos 7 dias", value: leadsLastWeek },
    { label: "Mensagens pendentes", value: pendingMessages },
    { label: "Falhas de envio", value: failedMessages },
  ];

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <article className="rounded-lg border border-black/10 bg-white p-5" key={card.label}>
              <p className="text-sm text-neutral-600">{card.label}</p>
              <strong className="mt-3 block text-3xl">{card.value}</strong>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
