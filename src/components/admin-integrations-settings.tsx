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
  const [savedIntegrations, setSavedIntegrations] = useState(initialIntegrations);
  const [salesPhone, setSalesPhone] = useState(initialSalesPhone);
  const [savedSalesPhone, setSavedSalesPhone] = useState(initialSalesPhone);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [testNumber, setTestNumber] = useState("21967566636");
  const [testText, setTestText] = useState("Teste Saint Michel: sua integração com WhatsApp está funcionando.");
  const [testMessage, setTestMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const hasChanges = JSON.stringify(integrations) !== JSON.stringify(savedIntegrations) || salesPhone !== savedSalesPhone;
  const hasWhatsappChanges =
    integrations.whatsappProvider !== savedIntegrations.whatsappProvider ||
    integrations.captureEvolution !== savedIntegrations.captureEvolution ||
    integrations.captureWuz !== savedIntegrations.captureWuz;

  function update(next: Partial<AdminIntegrationSettings>) {
    setIntegrations((current) => ({ ...current, ...next }));
    setMessage("");
  }

  async function save() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/admin/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations, salesPhone }),
    }).catch(() => null);

    setLoading(false);

    if (!response?.ok) {
      const data = response ? await response.json().catch(() => null) : null;
      setMessageTone("error");
      setMessage(data?.error ?? "Não foi possível salvar as integrações.");
      return;
    }

    const data = await response.json();
    setIntegrations(data.integrations);
    setSavedIntegrations(data.integrations);
    setSalesPhone(data.salesPhone);
    setSavedSalesPhone(data.salesPhone);
    setMessageTone("success");
    setMessage("Integrações atualizadas.");
  }

  async function sendWhatsAppTest() {
    setTestingWhatsApp(true);
    setTestMessage("");

    const response = await fetch("/api/admin/integrations/test-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: testNumber, text: testText }),
    });

    setTestingWhatsApp(false);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setTestMessage(data?.error ?? "Não foi possível enviar o teste.");
      return;
    }

    setTestMessage(`Mensagem enviada para ${data.number}${data.status ? ` (${data.status})` : ""}.`);
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="sticky top-0 z-10 rounded-lg border border-black/10 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{hasChanges ? "Alterações pendentes" : "Configurações salvas"}</p>
            {message ? <p className={`mt-1 text-sm ${messageTone === "error" ? "text-red-700" : "text-neutral-600"}`}>{message}</p> : null}
          </div>
          {canEdit ? (
            <button
              className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60"
              type="button"
              disabled={loading || !hasChanges}
              onClick={save}
            >
              {loading ? "Salvando..." : hasChanges ? "Salvar alterações" : "Salvo"}
            </button>
          ) : null}
        </div>
      </section>

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
          Dados usados para envio dos e-mails transacionais e régua de relacionamento. Chaves salvas não são exibidas novamente.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput label="API Key" value={integrations.resendApiKey} canEdit={canEdit} placeholder="re_..." secret onChange={(value) => update({ resendApiKey: value })} />
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
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">WhatsApp</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Escolha a API usada para envio e quais provedores podem alimentar o histórico do chat.
            </p>
          </div>
          {hasWhatsappChanges ? (
            <span className="rounded-md border border-[#98743e]/30 bg-[#98743e]/10 px-3 py-2 text-sm font-semibold text-[#7b5c2d]">
              Salve para aplicar
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Provedor ativo para envio</span>
            <select
              className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              disabled={!canEdit}
              value={integrations.whatsappProvider}
              onChange={(event) => update({ whatsappProvider: event.target.value as AdminIntegrationSettings["whatsappProvider"] })}
            >
              <option value="EVOLUTION">Evolution API</option>
              <option value="WUZ">WUZ</option>
            </select>
          </label>
          <div className="rounded-lg border border-black/10 bg-neutral-50 p-3">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Captura de mensagens</span>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                checked={integrations.captureEvolution}
                disabled={!canEdit}
                type="checkbox"
                onChange={(event) => update({ captureEvolution: event.target.checked })}
              />
              Aceitar mensagens da Evolution API
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
              <input
                checked={integrations.captureWuz}
                disabled={!canEdit}
                type="checkbox"
                onChange={(event) => update({ captureWuz: event.target.checked })}
              />
              Aceitar mensagens da WUZ
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Evolution API</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Dados que serão usados para envio de WhatsApp pela Evolution API. A API Key não é exibida depois de configurada.
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
            secret
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

        <div className="mt-5 rounded-lg border border-black/10 bg-neutral-50 p-4">
          <h3 className="text-lg font-semibold">Teste de WhatsApp</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Envie uma mensagem de teste usando a Evolution API configurada na Vercel ou, como fallback, os dados cadastrados aqui.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="Número de teste" value={testNumber} canEdit={canEdit} placeholder="21967566636" onChange={setTestNumber} />
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Mensagem de teste</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                disabled={!canEdit}
                value={testText}
                onChange={(event) => setTestText(event.target.value)}
              />
            </label>
          </div>
          {canEdit ? (
            <button
              className="mt-4 rounded-lg border border-[#98743e] px-4 py-3 text-sm font-semibold text-[#98743e] disabled:opacity-60"
              type="button"
              disabled={testingWhatsApp}
              onClick={sendWhatsAppTest}
            >
              {testingWhatsApp ? "Enviando teste..." : "Enviar teste WhatsApp"}
            </button>
          ) : null}
          {testMessage ? <p className="mt-3 text-sm text-neutral-600">{testMessage}</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">WUZ</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Configure a WUZ para capturar mensagens em paralelo. O envio pela WUZ será ativado quando o endpoint de envio da documentação for configurado.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput
            label="URL da API"
            value={integrations.wuzApiUrl}
            canEdit={canEdit}
            placeholder="https://utilitarios-wuzapi.xku2lc.easypanel.host/api"
            onChange={(value) => update({ wuzApiUrl: value })}
          />
          <TextInput
            label="Token"
            value={integrations.wuzApiToken}
            canEdit={canEdit}
            placeholder="Token da WUZ"
            secret
            onChange={(value) => update({ wuzApiToken: value })}
          />
          <TextInput
            label="Instância / identificação"
            value={integrations.wuzInstanceName}
            canEdit={canEdit}
            placeholder="Opcional, conforme a WUZ"
            onChange={(value) => update({ wuzInstanceName: value })}
          />
          <div>
            <span className="mb-2 block text-sm font-medium text-neutral-700">Webhook WUZ</span>
            <div className="min-h-12 break-all rounded-lg border border-black/10 bg-neutral-50 px-3 py-3 text-sm text-neutral-600">
              /api/wuz/webhook
            </div>
          </div>
        </div>
      </section>

      {canEdit ? (
        <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={loading || !hasChanges} onClick={save}>
          {loading ? "Salvando..." : hasChanges ? "Salvar integrações" : "Integrações salvas"}
        </button>
      ) : null}
    </div>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  secret,
  canEdit,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  secret?: boolean;
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
        type={secret ? "password" : "text"}
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
