import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { requireAdminUser } from "@/lib/admin-auth";
import { getAdminNavItems } from "@/lib/auth";

export async function AdminShell({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  const { response, user } = await requireAdminUser();

  if (response || !user) {
    redirect("/admin/login");
  }

  const navItems = getAdminNavItems(user.role);

  return (
    <div className="admin-shell">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#98743e]">Saint Michel</p>
            <p className="text-sm text-neutral-600">Olá, {user.name}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {navItems.map((item) => (
              <Link className="rounded-md px-3 py-2 text-neutral-700 hover:bg-neutral-100" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main
        className="mx-auto max-w-7xl px-6 py-8 data-[full-bleed=true]:max-w-none data-[full-bleed=true]:px-3 data-[full-bleed=true]:py-3"
        data-full-bleed={fullBleed}
      >
        {children}
      </main>
    </div>
  );
}
