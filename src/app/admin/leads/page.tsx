import { Prisma } from "@prisma/client";
import { AdminLeadsTable } from "@/components/admin-leads-table";
import { AdminShell } from "@/components/admin-shell";
import { canEditLeads, getCurrentUser } from "@/lib/auth";
import { leadStatusLabels, leadStatusValues, type LeadStatusValue } from "@/lib/leads";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = getParam(params, "q")?.trim() ?? "";
  const status = getParam(params, "status")?.trim() ?? "";
  const prisma = getPrisma();
  const currentUser = await getCurrentUser();
  const canEdit = currentUser ? canEditLeads(currentUser.role) : false;

  const where: Prisma.LeadWhereInput = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ];
  }

  if (leadStatusValues.includes(status as LeadStatusValue)) {
    where.status = status as LeadStatusValue;
  }

  const leads = await prisma.lead.findMany({
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

  return (
    <AdminShell>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Leads</h1>
            <p className="mt-2 text-neutral-600">
              Busque, filtre e acompanhe os cadastros recebidos pela landing page.
            </p>
          </div>
        </div>

        <form className="mt-6 grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-[1fr_220px_auto]" action="/admin/leads">
          <label>
            <span className="mb-2 block text-sm font-medium text-neutral-700">Buscar</span>
            <input
              className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              name="q"
              defaultValue={query}
              placeholder="Nome, e-mail ou telefone"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-neutral-700">Status</span>
            <select
              className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              name="status"
              defaultValue={status}
            >
              <option value="">Todos</option>
              {leadStatusValues.map((value) => (
                <option key={value} value={value}>
                  {leadStatusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white" type="submit">
              Filtrar
            </button>
            <a className="rounded-lg border border-black/15 px-5 py-3 font-semibold text-neutral-700" href="/admin/leads">
              Limpar
            </a>
          </div>
        </form>

        <AdminLeadsTable
          canEdit={canEdit}
          initialLeads={leads.map((lead) => ({
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            status: lead.status,
            source: lead.source,
            acceptedDataUsage: lead.acceptedDataUsage,
            createdAt: lead.createdAt.toISOString(),
            logsCount: lead._count.logs,
            schedulesCount: lead._count.schedules,
          }))}
        />
      </section>
    </AdminShell>
  );
}
