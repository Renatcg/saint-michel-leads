import { redirect } from "next/navigation";
import { AdminLandingSettings } from "@/components/admin-landing-settings";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/admin-auth";
import { canEditLeads } from "@/lib/auth";
import { getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function LandingSettingsPage() {
  const { response, user: currentUser } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response || !currentUser) {
    redirect("/admin/leads");
  }

  const canEdit = currentUser ? canEditLeads(currentUser.role) : false;

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Landing Page</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Atualize as áreas públicas do site por abas: cabeçalho, hero, formulário e página de sucesso.
        </p>
        <AdminLandingSettings canEdit={canEdit} initialSettings={await getLandingSettings()} />
      </section>
    </AdminShell>
  );
}
