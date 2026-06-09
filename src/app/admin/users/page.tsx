import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  name: string;
  messageUsername: string | null;
  email: string;
  role: "ADMIN" | "MANAGER" | "SUPERVISOR" | "BROKER" | "VIEWER";
  active: boolean;
  createdAt: Date;
};

export default async function UsersPage() {
  const { response, user: currentUser } = await requireAdminUser(["ADMIN", "SUPERVISOR"]);

  if (response || !currentUser) {
    redirect("/admin");
  }

  const users =
    currentUser.role === "ADMIN"
      ? await getPrisma().$queryRaw<UserRow[]>`
          SELECT "id", "name", "messageUsername", "email", "role", "active", "createdAt"
          FROM "User"
          ORDER BY "createdAt" DESC
        `
      : await getPrisma().$queryRaw<UserRow[]>`
          SELECT "id", "name", "messageUsername", "email", "role", "active", "createdAt"
          FROM "User"
          WHERE "role" IN ('SUPERVISOR', 'BROKER')
          ORDER BY "createdAt" DESC
        `;

  return (
    <AdminShell>
      <section>
        <h1 className="text-3xl font-semibold">Usuários</h1>
        <p className="mt-2 text-neutral-600">Crie supervisores e corretores para operar o atendimento.</p>

        <AdminUsersManager
          currentUserRole={currentUser.role}
          initialUsers={users.map((user) => ({
            id: user.id,
            name: user.name,
            messageUsername: user.messageUsername ?? user.name,
            email: user.email,
            role: user.role === "VIEWER" ? "BROKER" : user.role,
            active: user.active,
            createdAt: user.createdAt.toISOString(),
          }))}
        />
      </section>
    </AdminShell>
  );
}
