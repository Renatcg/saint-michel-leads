import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/messages", label: "Mensagens" },
  { href: "/admin/integrations", label: "Integrações" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

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
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
