"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      headers: { "Content-Type": "application/json" },
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Não foi possível entrar.");
      return;
    }

    router.push(searchParams.get("next") ?? "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">E-mail</span>
        <input
          className="w-full rounded-lg border border-white/15 bg-white px-3 py-3 text-neutral-950 outline-none focus:border-[#d8bd85]"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Senha</span>
        <input
          className="w-full rounded-lg border border-white/15 bg-white px-3 py-3 text-neutral-950 outline-none focus:border-[#d8bd85]"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button
        className="w-full rounded-lg bg-[#b9975b] px-4 py-3 font-semibold text-neutral-950 transition hover:bg-[#d8bd85] disabled:opacity-60"
        type="submit"
        disabled={loading}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </form>
  );
}
