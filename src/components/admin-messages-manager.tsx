"use client";

import { useState } from "react";
import {
  messageChannelLabels,
  messageChannelValues,
  messageTriggerLabels,
  messageTriggerValues,
  type MessageChannelValue,
  type MessageTriggerValue,
} from "@/lib/messages";
import { markdownToHtml } from "@/lib/rich-content";

type TemplateRow = {
  id: string;
  name: string;
  channel: MessageChannelValue;
  trigger: MessageTriggerValue;
  delayDays: number;
  subject: string;
  body: string;
  active: boolean;
  schedulesCount: number;
  logsCount: number;
};

type Draft = Omit<TemplateRow, "id" | "schedulesCount" | "logsCount">;

const emptyDraft: Draft = {
  name: "",
  channel: "EMAIL",
  trigger: "ON_LEAD_CREATED",
  delayDays: 0,
  subject: "",
  body: "Olá {{nome}}, obrigado pelo seu cadastro. Em breve nossa equipe entrará em contato.",
  active: true,
};

export function AdminMessagesManager({ initialTemplates, canEdit }: { initialTemplates: TemplateRow[]; canEdit: boolean }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"email" | "whatsapp">("email");

  function startEditing(template: TemplateRow) {
    setMessage("");
    setEditingId(template.id);
    setDraft({
      name: template.name,
      channel: template.channel,
      trigger: template.trigger,
      delayDays: template.delayDays,
      subject: template.subject,
      body: template.body,
      active: template.active,
    });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function submitTemplate() {
    setLoading(true);
    setMessage("");

    const response = await fetch(editingId ? `/api/admin/messages/${editingId}` : "/api/admin/messages", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível salvar a mensagem.");
      return;
    }

    const data = await response.json();
    const nextTemplate: TemplateRow = {
      id: data.template.id,
      name: data.template.name,
      channel: data.template.channel,
      trigger: data.template.trigger,
      delayDays: data.template.delayDays,
      subject: data.template.subject ?? "",
      body: data.template.body,
      active: data.template.active,
      schedulesCount: templates.find((template) => template.id === data.template.id)?.schedulesCount ?? 0,
      logsCount: templates.find((template) => template.id === data.template.id)?.logsCount ?? 0,
    };

    setTemplates((current) =>
      editingId
        ? current.map((template) => (template.id === editingId ? nextTemplate : template))
        : [nextTemplate, ...current],
    );
    resetForm();
    setMessage(editingId ? "Mensagem atualizada." : "Mensagem criada.");
  }

  async function deleteTemplate(id: string) {
    const template = templates.find((item) => item.id === id);

    if (!template || !window.confirm(`Excluir a mensagem ${template.name}?`)) {
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch(`/api/admin/messages/${id}`, {
      method: "DELETE",
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível excluir a mensagem.");
      return;
    }

    setTemplates((current) => current.filter((item) => item.id !== id));
    setMessage("Mensagem excluída.");
  }

  async function toggleActive(template: TemplateRow) {
    setLoading(true);
    setMessage("");

    const response = await fetch(`/api/admin/messages/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: template.name,
        channel: template.channel,
        trigger: template.trigger,
        delayDays: template.delayDays,
        subject: template.subject,
        body: template.body,
        active: !template.active,
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível alterar o status.");
      return;
    }

    setTemplates((current) =>
      current.map((item) => (item.id === template.id ? { ...item, active: !template.active } : item)),
    );
  }

  function insertAroundSelection(before: string, after = before) {
    const textarea = document.getElementById("message-body") as HTMLTextAreaElement | null;

    if (!textarea) {
      setDraft({ ...draft, body: `${draft.body}${before}${after}` });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.body.slice(start, end) || "texto";
    const nextBody = `${draft.body.slice(0, start)}${before}${selected}${after}${draft.body.slice(end)}`;
    setDraft({ ...draft, body: nextBody });

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertLine(snippet: string) {
    const separator = draft.body.endsWith("\n") || draft.body.length === 0 ? "" : "\n";
    setDraft({ ...draft, body: `${draft.body}${separator}${snippet}` });
  }

  async function attachFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const snippets = await Promise.all(Array.from(files).map(fileToSnippet));
    insertLine(snippets.join("\n"));
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[520px_1fr]">
      {canEdit ? (
        <section className="rounded-lg border border-black/10 bg-white p-5">
          <h2 className="text-xl font-semibold">{editingId ? "Editar mensagem" : "Nova mensagem"}</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Nome interno</span>
              <input
                className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Canal</span>
                <select
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  value={draft.channel}
                  onChange={(event) => setDraft({ ...draft, channel: event.target.value as MessageChannelValue })}
                >
                  {messageChannelValues.map((channel) => (
                    <option key={channel} value={channel}>
                      {messageChannelLabels[channel]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Gatilho</span>
                <select
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  value={draft.trigger}
                  onChange={(event) => {
                    const trigger = event.target.value as MessageTriggerValue;
                    setDraft({ ...draft, trigger, delayDays: trigger === "AFTER_DAYS" ? draft.delayDays : 0 });
                  }}
                >
                  {messageTriggerValues.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {messageTriggerLabels[trigger]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {draft.trigger === "AFTER_DAYS" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Enviar após quantos dias?</span>
                <input
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  min={0}
                  type="number"
                  value={draft.delayDays}
                  onChange={(event) => setDraft({ ...draft, delayDays: Number(event.target.value) })}
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Assunto do e-mail</span>
              <input
                className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                placeholder="Obrigatório para e-mail"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Corpo da mensagem</span>
              <div className="mb-2 flex flex-wrap gap-2">
                <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" onClick={() => insertAroundSelection("**")}>
                  Negrito
                </button>
                <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" onClick={() => insertAroundSelection("*")}>
                  Itálico
                </button>
                <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" onClick={() => insertLine("## Subtítulo")}>
                  Título
                </button>
                <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" onClick={() => insertLine("[Texto do botão]({{link_corretores}})")}>
                  Botão
                </button>
              </div>
              <textarea
                id="message-body"
                className="min-h-40 w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
            </label>

            <label className="block rounded-lg border border-dashed border-black/20 p-4 text-sm text-neutral-700">
              <span className="block font-medium">Anexar imagens, PDFs ou vídeos</span>
              <span className="mt-1 block text-xs text-neutral-500">
                Os arquivos entram como links/preview dentro da mensagem. Use arquivos leves para evitar e-mails muito grandes.
              </span>
              <input
                className="mt-3 block w-full text-sm"
                type="file"
                accept="image/*,application/pdf,video/*"
                multiple
                onChange={(event) => attachFiles(event.target.files)}
              />
            </label>

            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <input
                checked={draft.active}
                className="h-4 w-4 accent-[#98743e]"
                type="checkbox"
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              />
              Mensagem ativa
            </label>

            <div className="rounded-lg bg-neutral-100 p-3 text-xs leading-5 text-neutral-600">
              Variáveis disponíveis: {"{{nome}}"}, {"{{email}}"}, {"{{telefone}}"} e {"{{link_corretores}}"}.
              Para criar botão, use: [Texto do botão]({"{{link_corretores}}"}).
            </div>

            <section className="rounded-lg border border-black/10 bg-neutral-50 p-4">
              <div className="mb-3 flex rounded-lg bg-white p-1 text-sm">
                <button
                  className={`flex-1 rounded-md px-3 py-2 font-semibold ${previewMode === "email" ? "bg-[#98743e] text-white" : "text-neutral-600"}`}
                  type="button"
                  onClick={() => setPreviewMode("email")}
                >
                  Preview e-mail
                </button>
                <button
                  className={`flex-1 rounded-md px-3 py-2 font-semibold ${previewMode === "whatsapp" ? "bg-[#98743e] text-white" : "text-neutral-600"}`}
                  type="button"
                  onClick={() => setPreviewMode("whatsapp")}
                >
                  Preview WhatsApp
                </button>
              </div>
              {previewMode === "email" ? <EmailPreview draft={draft} /> : <WhatsappPreview draft={draft} />}
            </section>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60"
                type="button"
                disabled={loading}
                onClick={submitTemplate}
              >
                {editingId ? "Salvar alterações" : "Criar mensagem"}
              </button>
              {editingId ? (
                <button className="rounded-lg border border-black/15 px-5 py-3 font-semibold" type="button" onClick={resetForm}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section>
        {message ? <p className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : null}

        <div className="space-y-4">
          {templates.map((template) => (
            <article className="rounded-lg border border-black/10 bg-white p-5" key={template.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{template.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${template.active ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>
                      {template.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-600">
                    {messageChannelLabels[template.channel]} · {messageTriggerLabels[template.trigger]}
                    {template.trigger === "AFTER_DAYS" ? ` · ${template.delayDays} dias` : ""}
                  </p>
                </div>

                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" onClick={() => startEditing(template)}>
                      Editar
                    </button>
                    <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" disabled={loading} onClick={() => toggleActive(template)}>
                      {template.active ? "Desativar" : "Ativar"}
                    </button>
                    <button className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" type="button" disabled={loading} onClick={() => deleteTemplate(template.id)}>
                      Excluir
                    </button>
                  </div>
                ) : null}
              </div>

              {template.subject ? <p className="mt-4 text-sm font-medium">Assunto: {template.subject}</p> : null}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{template.body}</p>
              <p className="mt-4 text-xs text-neutral-500">
                {template.schedulesCount} agendamentos · {template.logsCount} logs de envio
              </p>
            </article>
          ))}

          {templates.length === 0 ? (
            <div className="rounded-lg border border-black/10 bg-white p-8 text-center text-neutral-500">
              Nenhuma mensagem criada ainda.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EmailPreview({ draft }: { draft: Draft }) {
  const body = renderPreviewVariables(draft.body);
  const subject = renderPreviewVariables(draft.subject || "Assunto do e-mail");

  return (
    <div className="rounded-lg bg-white p-4 text-sm shadow-sm">
      <p className="border-b border-black/10 pb-3 font-semibold">{subject}</p>
      <div
        className="prose-preview mt-4 text-neutral-800"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(body) }}
      />
    </div>
  );
}

function WhatsappPreview({ draft }: { draft: Draft }) {
  return (
    <div className="rounded-[24px] bg-[#e5ddd5] p-4">
      <div className="ml-auto max-w-[86%] rounded-lg bg-[#dcf8c6] px-4 py-3 text-sm leading-6 shadow">
        <p className="whitespace-pre-wrap">{stripMarkdown(renderPreviewVariables(draft.body))}</p>
      </div>
    </div>
  );
}

function renderPreviewVariables(text: string) {
  return text
    .replaceAll("{{nome}}", "Mariana")
    .replaceAll("{{email}}", "mariana@email.com")
    .replaceAll("{{telefone}}", "5511999999999")
    .replaceAll("{{link_corretores}}", "https://wa.me/5511999999999");
}

function stripMarkdown(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "Imagem: $1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,2}\s+/gm, "");
}

function fileToSnippet(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result);

      if (file.type.startsWith("image/")) {
        resolve(`![${file.name}](${dataUrl})`);
        return;
      }

      resolve(`[Arquivo: ${file.name}](${dataUrl})`);
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
