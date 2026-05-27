import { AdminLandingSettings } from "@/components/admin-landing-settings";
import { AdminShell } from "@/components/admin-shell";
import { canEditLeads, getCurrentUser } from "@/lib/auth";
import { getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function LandingSettingsPage() {
  const currentUser = await getCurrentUser();
  const canEdit = currentUser ? canEditLeads(currentUser.role) : false;

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Landing Page</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Atualize o vídeo da primeira dobra, overlay, headline e subheadline.
        </p>
        <AdminLandingSettings canEdit={canEdit} initialSettings={await getLandingSettings()} />
      </section>
    </AdminShell>
  );
}
