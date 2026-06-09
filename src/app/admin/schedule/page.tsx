import { redirect } from "next/navigation";
import { AdminScheduleMock } from "@/components/admin-schedule-mock";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    redirect("/admin");
  }

  return (
    <AdminShell fullBleed>
      <AdminScheduleMock />
    </AdminShell>
  );
}
