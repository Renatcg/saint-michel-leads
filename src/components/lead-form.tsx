"use client";

import { useState, type FormEvent } from "react";
import type { LandingSettings } from "@/lib/landing";

type SubmitState = "idle" | "loading" | "success" | "error";

export function LeadForm({ settings }: { settings: LandingSettings }) {
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
      setMessage(data?.error ?? settings.errorMessage);
      return;
    }

    form.reset();
    setState("success");
    setMessage(settings.successMessage);
  }

  return (
    <form onSubmit={handleSubmit} className="glass w-full max-w-md rounded-lg p-6 text-left text-neutral-950 sm:p-7">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{settings.formTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-700">
          {settings.formDescription}
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">{settings.nameLabel}</span>
          <input className="field" name="name" type="text" autoComplete="name" placeholder={settings.namePlaceholder} required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">{settings.emailLabel}</span>
          <input className="field" name="email" type="email" autoComplete="email" placeholder={settings.emailPlaceholder} required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">{settings.phoneLabel}</span>
          <input className="field" name="phone" type="tel" autoComplete="tel" placeholder={settings.phonePlaceholder} required />
        </label>

        <label className="flex items-start gap-3 text-sm leading-5 text-neutral-700">
          <input
            className="mt-1 h-4 w-4 accent-[#8a6a36]"
            name="acceptedDataUsage"
            type="checkbox"
            defaultChecked
            required
          />
          <span>{settings.consentText}</span>
        </label>
      </div>

      <button
        className="mt-6 w-full rounded-lg px-5 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition brightness-100 hover:brightness-90 disabled:opacity-60"
        style={{ backgroundColor: settings.submitButtonColor }}
        type="submit"
        disabled={state === "loading"}
      >
        {state === "loading" ? settings.loadingButtonText : settings.submitButtonText}
      </button>

      {message ? (
        <p className={`mt-4 text-sm ${state === "success" ? "text-green-800" : "text-red-800"}`}>{message}</p>
      ) : null}
    </form>
  );
}
