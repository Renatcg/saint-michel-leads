import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DASHBOARD_TIME_ZONE = "America/Sao_Paulo";

export default async function AdminDashboardPage() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER", "SUPERVISOR"]);

  if (response) {
    redirect("/admin/leads");
  }

  const prisma = getPrisma();
  const now = new Date();
  const startOfDay = getStartOfTodayInTimeZone(now, DASHBOARD_TIME_ZONE);
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

function getStartOfTodayInTimeZone(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const offset = getTimeZoneOffset(new Date(utcMidnight), timeZone);

  return new Date(utcMidnight - offset);
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return zonedAsUtc - date.getTime();
}

function getDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour ?? 0),
    minute: Number(values.minute ?? 0),
    second: Number(values.second ?? 0),
  };
}
