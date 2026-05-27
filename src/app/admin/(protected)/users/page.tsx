import { redirect } from "next/navigation";
import { canManageUsers, getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !canManageUsers(currentUser.role)) {
    redirect("/admin");
  }

  const users = await getPrisma().user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <section>
      <h1 className="text-3xl font-semibold">Usuários</h1>
      <p className="mt-2 text-neutral-600">Base inicial para gestão de acessos administrativos.</p>

      <div className="mt-6 overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-neutral-100 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-t border-black/10" key={user.id}>
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.active ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
