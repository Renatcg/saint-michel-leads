"use client";

import { useState, type FormEvent } from "react";

type SubmitState = "idle" | "loading" | "success" | "error";

export function LeadForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        acceptedDataUsage: formData.get("acceptedDataUsage") === "on",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setState("error");
      setMessage(data?.error ?? "Não foi possível enviar agora. Tente novamente.");
      return;
    }

    form.reset();
    setState("success");
    setMessage("Cadastro recebido. Em breve nossa equipe entra em contato.");
  }

  return (
    <form onSubmit={handleSubmit} className="glass w-full max-w-md rounded-lg p-6 text-left text-neutral-950 sm:p-7">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Receba atendimento</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-700">
          Deixe seus dados para falar com a equipe da Saint Michel.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Nome</span>
          <input className="field" name="name" type="text" autoComplete="name" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Seu melhor e-mail</span>
          <input className="field" name="email" type="email" autoComplete="email" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Telefone (WhatsApp)</span>
          <input className="field" name="phone" type="tel" autoComplete="tel" required />
        </label>

        <label className="flex items-start gap-3 text-sm leading-5 text-neutral-700">
          <input
            className="mt-1 h-4 w-4 accent-[#8a6a36]"
            name="acceptedDataUsage"
            type="checkbox"
            defaultChecked
            required
          />
          <span>
            Aceito o uso dos meus dados pela Saint Michel Construtora e parceiros para contato comercial e relacionamento.
          </span>
        </label>
      </div>

      <button
        className="mt-6 w-full rounded-lg bg-[#98743e] px-5 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#7d5f31] disabled:opacity-60"
        type="submit"
        disabled={state === "loading"}
      >
        {state === "loading" ? "Enviando..." : "Quero saber mais"}
      </button>

      {message ? (
        <p className={`mt-4 text-sm ${state === "success" ? "text-green-800" : "text-red-800"}`}>{message}</p>
      ) : null}
    </form>
  );
}
