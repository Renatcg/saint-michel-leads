"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button className="rounded-md bg-neutral-950 px-3 py-2 text-sm text-white hover:bg-neutral-800" onClick={logout} type="button">
      Sair
    </button>
  );
}
