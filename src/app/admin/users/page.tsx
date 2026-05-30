import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { response } = await requireAdminUser(["ADMIN"]);

  if (response) {
    redirect("/admin");
  }

  const users = await getPrisma().user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Usuários</h1>
        <p className="mt-2 text-neutral-600">Crie admins, managers e viewers para acessar o painel.</p>

        <AdminUsersManager
          initialUsers={users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            active: user.active,
            createdAt: user.createdAt.toISOString(),
          }))}
        />
      </section>
    </AdminShell>
  );
}
