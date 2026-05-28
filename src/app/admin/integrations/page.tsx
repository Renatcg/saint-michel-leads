import { AdminShell } from "@/components/admin-shell";
import { AdminIntegrationsSettings } from "@/components/admin-integrations-settings";
import { canEditLeads, getCurrentUser } from "@/lib/auth";
import { getIntegrationSettings } from "@/lib/integrations";
import { getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const currentUser = await getCurrentUser();
  const canEdit = currentUser ? canEditLeads(currentUser.role) : false;
  const [integrations, landing] = await Promise.all([getIntegrationSettings(), getLandingSettings()]);

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Integrações</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Configure os canais de envio e o contato comercial usado nos botões e mensagens.
        </p>
        <AdminIntegrationsSettings canEdit={canEdit} initialIntegrations={integrations} initialSalesPhone={landing.salesPhone} />
      </section>
    </AdminShell>
  );
}
