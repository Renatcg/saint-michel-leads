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
    <form onSubmit={handleSubmit} className="glass w-full max-w-md rounded-lg p-4 text-left text-neutral-950 sm:p-6 md:p-7">
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl font-semibold md:text-2xl">{settings.formTitle}</h2>
        <p className="mt-1.5 text-xs leading-5 text-neutral-700 md:mt-2 md:text-sm md:leading-6">
          {settings.formDescription}
        </p>
      </div>

      <div className="space-y-3 md:space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium md:mb-2 md:text-sm">{settings.nameLabel}</span>
          <input className="field" name="name" type="text" autoComplete="name" placeholder={settings.namePlaceholder} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium md:mb-2 md:text-sm">{settings.emailLabel}</span>
          <input className="field" name="email" type="email" autoComplete="email" placeholder={settings.emailPlaceholder} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium md:mb-2 md:text-sm">{settings.phoneLabel}</span>
          <input className="field" name="phone" type="tel" autoComplete="tel" placeholder={settings.phonePlaceholder} required />
        </label>

        <label className="flex items-start gap-2.5 text-xs leading-4 text-neutral-700 md:gap-3 md:text-sm md:leading-5">
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
        className="mt-4 w-full rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition brightness-100 hover:brightness-90 disabled:opacity-60 md:mt-6 md:px-5 md:py-4 md:text-sm md:tracking-[0.16em]"
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
