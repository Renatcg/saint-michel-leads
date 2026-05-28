"use client";

import { useState } from "react";
import type { AdminIntegrationSettings } from "@/lib/integrations";

export function AdminIntegrationsSettings({
  initialIntegrations,
  initialSalesPhone,
  canEdit,
}: {
  initialIntegrations: AdminIntegrationSettings;
  initialSalesPhone: string;
  canEdit: boolean;
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [salesPhone, setSalesPhone] = useState(initialSalesPhone);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(next: Partial<AdminIntegrationSettings>) {
    setIntegrations((current) => ({ ...current, ...next }));
  }

  async function save() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/admin/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations, salesPhone }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível salvar as integrações.");
      return;
    }

    const data = await response.json();
    setIntegrations(data.integrations);
    setSalesPhone(data.salesPhone);
    setMessage("Integrações atualizadas.");
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Contato dos corretores</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Este telefone alimenta a variável {"{{link_corretores}}"} nos e-mails e o botão da página de sucesso.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
          <TextInput
            label="Telefone comercial / WhatsApp"
            value={salesPhone}
            canEdit={canEdit}
            placeholder="(00) 00000-0000"
            onChange={setSalesPhone}
          />
          <div>
            <span className="mb-2 block text-sm font-medium text-neutral-700">Link gerado</span>
            <div className="min-h-12 break-all rounded-lg border border-black/10 bg-neutral-50 px-3 py-3 text-sm text-neutral-600">
              {buildSalesContactPreview(salesPhone) || "Cadastre um telefone para gerar o link"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Resend</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Dados usados para envio dos e-mails transacionais e régua de relacionamento.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput label="API Key" value={integrations.resendApiKey} canEdit={canEdit} placeholder="re_..." onChange={(value) => update({ resendApiKey: value })} />
          <TextInput
            label="E-mail remetente"
            value={integrations.resendFromEmail}
            canEdit={canEdit}
            placeholder="contato@seudominio.com.br"
            onChange={(value) => update({ resendFromEmail: value })}
          />
          <TextInput
            label="Nome do remetente"
            value={integrations.resendFromName}
            canEdit={canEdit}
            placeholder="Saint Michel Construtora"
            onChange={(value) => update({ resendFromName: value })}
          />
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Evolution API</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Dados que serão usados para envio de WhatsApp pela Evolution API.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput
            label="URL da API"
            value={integrations.evolutionApiUrl}
            canEdit={canEdit}
            placeholder="https://sua-evolution-api.com"
            onChange={(value) => update({ evolutionApiUrl: value })}
          />
          <TextInput
            label="API Key"
            value={integrations.evolutionApiKey}
            canEdit={canEdit}
            placeholder="Chave da Evolution API"
            onChange={(value) => update({ evolutionApiKey: value })}
          />
          <TextInput
            label="Nome da instância"
            value={integrations.evolutionInstanceName}
            canEdit={canEdit}
            placeholder="saint-michel"
            onChange={(value) => update({ evolutionInstanceName: value })}
          />
        </div>
      </section>

      {canEdit ? (
        <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={loading} onClick={save}>
          Salvar integrações
        </button>
      ) : null}
      {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
    </div>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  canEdit,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  canEdit: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
        disabled={!canEdit}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildSalesContactPreview(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}
