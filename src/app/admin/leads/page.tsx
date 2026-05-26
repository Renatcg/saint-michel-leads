import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const prisma = getPrisma();
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Leads</h1>
          <p className="mt-2 text-neutral-600">Últimos cadastros recebidos pela landing page.</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-neutral-100 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr className="border-t border-black/10" key={lead.id}>
                <td className="px-4 py-3 font-medium">{lead.name}</td>
                <td className="px-4 py-3">{lead.email}</td>
                <td className="px-4 py-3">{lead.phone}</td>
                <td className="px-4 py-3">{lead.status}</td>
                <td className="px-4 py-3">{lead.createdAt.toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={5}>
                  Nenhum lead cadastrado ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
