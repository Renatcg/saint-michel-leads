"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  body: "<p>Olá {{nome}}, obrigado pelo seu cadastro. Em breve nossa equipe entrará em contato.</p>",
  active: true,
};

export function AdminMessagesManager({ initialTemplates, canEdit }: { initialTemplates: TemplateRow[]; canEdit: boolean }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function openCreator() {
    setMessage("");
    setEditingId(null);
    setDraft(emptyDraft);
    setEditorOpen(true);
  }

  function startEditing(template: TemplateRow) {
    setMessage("");
    setEditingId(template.id);
    setDraft({
      name: template.name,
      channel: template.channel,
      trigger: template.trigger,
      delayDays: template.delayDays,
      subject: template.subject,
      body: toEditableHtml(template.body),
      active: template.active,
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
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
    closeEditor();
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

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Mensagens cadastradas</h2>
          <p className="mt-1 text-sm text-neutral-600">Visualize, edite e gerencie os gatilhos da régua.</p>
        </div>
        {canEdit ? (
          <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white" type="button" onClick={openCreator}>
            Criar mensagem
          </button>
        ) : null}
      </div>

      {message ? <p className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : null}

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <div className="grid grid-cols-[1.4fr_.7fr_1fr_auto] gap-4 border-b border-black/10 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
          <span>Nome</span>
          <span>Status</span>
          <span>Gatilho</span>
          <span className="text-right">Ações</span>
        </div>
        <div className="divide-y divide-black/10">
          {templates.map((template) => (
            <article className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.4fr_.7fr_1fr_auto] md:items-center md:gap-4" key={template.id}>
              <div>
                <h3 className="font-semibold text-neutral-950">{template.name}</h3>
                <p className="mt-1 text-xs text-neutral-500">{messageChannelLabels[template.channel]}</p>
              </div>
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${template.active ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>
                  {template.active ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="text-sm text-neutral-700">
                {messageTriggerLabels[template.trigger]}
                {template.trigger === "AFTER_DAYS" ? ` · ${template.delayDays} dias` : ""}
              </p>
              <div className="flex justify-start gap-2 md:justify-end">
                <IconButton label="Preview" onClick={() => setPreviewTemplate(template)}>
                  <EyeIcon />
                </IconButton>
                {canEdit ? (
                  <>
                    <IconButton label="Editar" onClick={() => startEditing(template)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton label="Excluir" danger disabled={loading} onClick={() => deleteTemplate(template.id)}>
                      <TrashIcon />
                    </IconButton>
                  </>
                ) : null}
              </div>
            </article>
          ))}

          {templates.length === 0 ? (
            <div className="px-4 py-10 text-center text-neutral-500">Nenhuma mensagem criada ainda.</div>
          ) : null}
        </div>
      </section>

      {editorOpen ? (
        <MessageEditorModal
          canEdit={canEdit}
          draft={draft}
          editing={Boolean(editingId)}
          loading={loading}
          message={message}
          setDraft={setDraft}
          onClose={closeEditor}
          onSubmit={submitTemplate}
        />
      ) : null}

      {previewTemplate ? (
        <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      ) : null}
    </div>
  );
}

function MessageEditorModal({
  draft,
  editing,
  canEdit,
  loading,
  message,
  setDraft,
  onClose,
  onSubmit,
}: {
  draft: Draft;
  editing: boolean;
  canEdit: boolean;
  loading: boolean;
  message: string;
  setDraft: (draft: Draft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  async function attachFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const snippets = await Promise.all(Array.from(files).map(fileToHtml));
    setDraft({ ...draft, body: `${draft.body}${snippets.join("")}` });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto max-w-7xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
          <div>
            <h2 className="text-2xl font-semibold">{editing ? "Editar mensagem" : "Criar mensagem"}</h2>
            <p className="mt-1 text-sm text-neutral-600">Edite o conteúdo e acompanhe os previews em tempo real.</p>
          </div>
          <button className="rounded-lg border border-black/15 px-4 py-2 font-semibold" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {message ? <p className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">{message}</p> : null}

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(420px,1fr)_minmax(420px,1fr)]">
          <section className="space-y-4">
            <TextInput label="Nome interno" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Canal</span>
                <select className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]" value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as MessageChannelValue })}>
                  {messageChannelValues.map((channel) => (
                    <option key={channel} value={channel}>{messageChannelLabels[channel]}</option>
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
                    <option key={trigger} value={trigger}>{messageTriggerLabels[trigger]}</option>
                  ))}
                </select>
              </label>
            </div>

            {draft.trigger === "AFTER_DAYS" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Enviar após quantos dias?</span>
                <input className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]" min={0} type="number" value={draft.delayDays} onChange={(event) => setDraft({ ...draft, delayDays: Number(event.target.value) })} />
              </label>
            ) : null}

            <TextInput label="Assunto do e-mail" value={draft.subject} placeholder="Obrigatório para e-mail" onChange={(value) => setDraft({ ...draft, subject: value })} />
            <RichMessageEditor value={draft.body} onChange={(body) => setDraft({ ...draft, body })} />

            <label className="block rounded-lg border border-dashed border-black/20 p-4 text-sm text-neutral-700">
              <span className="block font-medium">Anexar imagens, PDFs ou vídeos</span>
              <span className="mt-1 block text-xs text-neutral-500">Os arquivos entram como links/preview dentro da mensagem.</span>
              <input className="mt-3 block w-full text-sm" type="file" accept="image/*,application/pdf,video/*" multiple onChange={(event) => attachFiles(event.target.files)} />
            </label>

            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <input checked={draft.active} className="h-4 w-4 accent-[#98743e]" type="checkbox" onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Mensagem ativa
            </label>

            <div className="rounded-lg bg-neutral-100 p-3 text-xs leading-5 text-neutral-600">
              Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{telefone}}"} e {"{{link_corretores}}"}.
            </div>
          </section>

          <section className="grid gap-4">
            <EmailPreview draft={draft} />
            <WhatsappPreview draft={draft} />
          </section>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-black/10 pt-4">
          <button className="rounded-lg border border-black/15 px-5 py-3 font-semibold" type="button" onClick={onClose}>
            Cancelar
          </button>
          {canEdit ? (
            <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={loading} onClick={onSubmit}>
              {editing ? "Salvar alterações" : "Criar mensagem"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RichMessageEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = toEditableHtml(value);
    }
  }, [value]);

  function sync() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function command(commandName: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(commandName, false, commandValue);
    sync();
  }

  function insertHtml(html: string) {
    command("insertHTML", html);
  }

  function applyInlineStyle(style: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, `<span style="${style}">${document.getSelection()?.toString() || "texto"}</span>`);
    sync();
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-neutral-700">Corpo da mensagem</span>
      <div className="rounded-lg border border-black/15 bg-neutral-50 p-2">
        <div className="mb-2 flex flex-wrap gap-2">
          <ToolbarButton label="B" onClick={() => command("bold")} />
          <ToolbarButton label="I" onClick={() => command("italic")} />
          <select className="rounded-md border border-black/15 bg-white px-2 py-2 text-xs" defaultValue="" onChange={(event) => event.target.value && command("fontSize", event.target.value)}>
            <option value="">Tamanho</option>
            <option value="2">Pequeno</option>
            <option value="3">Normal</option>
            <option value="4">Médio</option>
            <option value="5">Grande</option>
          </select>
          <ToolbarButton label="Lista" onClick={() => command("insertUnorderedList")} />
          <ToolbarButton label="Lista nº" onClick={() => command("insertOrderedList")} />
          <ToolbarButton label="Recuar" onClick={() => command("indent")} />
          <ToolbarButton label="Voltar" onClick={() => command("outdent")} />
          <ToolbarButton label="Linha 1.2" onClick={() => applyInlineStyle("line-height:1.2;")} />
          <ToolbarButton label="Linha 1.6" onClick={() => applyInlineStyle("line-height:1.6;")} />
          <ToolbarButton label="Espaço +" onClick={() => insertHtml('<p style="margin:24px 0;">Novo parágrafo</p>')} />
          <ToolbarButton label="Botão" onClick={() => insertHtml('<p style="margin:28px 0;"><a href="{{link_corretores}}" style="display:inline-block;background:#98743e;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700;">Falar com corretores</a></p>')} />
          <ToolbarButton label="{{nome}}" onClick={() => insertHtml("{{nome}}")} />
        </div>
        <div
          ref={editorRef}
          className="min-h-60 rounded-md bg-white px-4 py-3 text-sm leading-6 outline-none"
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
        />
      </div>
    </div>
  );
}

function PreviewModal({ template, onClose }: { template: TemplateRow; onClose: () => void }) {
  const draft: Draft = {
    name: template.name,
    channel: template.channel,
    trigger: template.trigger,
    delayDays: template.delayDays,
    subject: template.subject,
    body: template.body,
    active: template.active,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto max-w-6xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-4">
          <div>
            <h2 className="text-2xl font-semibold">{template.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{messageTriggerLabels[template.trigger]}</p>
          </div>
          <button className="rounded-lg border border-black/15 px-4 py-2 font-semibold" type="button" onClick={onClose}>Fechar</button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <EmailPreview draft={draft} />
          <WhatsappPreview draft={draft} />
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ draft }: { draft: Draft }) {
  const body = renderPreviewVariables(renderHtml(draft.body));
  const subject = renderPreviewVariables(draft.subject || "Assunto do e-mail");

  return (
    <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
      <h3 className="mb-3 font-semibold">Preview e-mail</h3>
      <div className="rounded-lg bg-white p-4 text-sm shadow-sm">
        <p className="border-b border-black/10 pb-3 font-semibold">{subject}</p>
        <div className="prose-preview mt-4 text-neutral-800" dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  );
}

function WhatsappPreview({ draft }: { draft: Draft }) {
  return (
    <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
      <h3 className="mb-3 font-semibold">Preview WhatsApp</h3>
      <div className="rounded-[24px] bg-[#e5ddd5] p-4">
        <div className="ml-auto max-w-[86%] rounded-lg bg-[#dcf8c6] px-4 py-3 text-sm leading-6 shadow">
          <p className="whitespace-pre-wrap">{stripRichContent(renderPreviewVariables(draft.body))}</p>
        </div>
      </div>
    </div>
  );
}

function TextInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <input className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-100" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );
}

function IconButton({ children, label, danger, disabled, onClick }: { children: ReactNode; label: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className={`rounded-md border px-2.5 py-2 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-black/15 text-neutral-700 hover:bg-neutral-100"} disabled:opacity-50`}
      title={label}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function EditIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 15h10l1-15" /></svg>;
}

function renderPreviewVariables(text: string) {
  return text
    .replaceAll("{{nome}}", "Mariana")
    .replaceAll("{{email}}", "mariana@email.com")
    .replaceAll("{{telefone}}", "5511999999999")
    .replaceAll("{{link_corretores}}", "https://wa.me/5511999999999");
}

function renderHtml(content: string) {
  return looksLikeHtml(content) ? content : markdownToHtml(content);
}

function toEditableHtml(content: string) {
  return looksLikeHtml(content) ? content : markdownToHtml(content);
}

function looksLikeHtml(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function stripRichContent(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "$2: $1")
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, "Imagem: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "Imagem: $1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,2}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fileToHtml(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result);

      if (file.type.startsWith("image/")) {
        resolve(`<p style="margin:22px 0;"><img src="${dataUrl}" alt="${file.name}" style="max-width:100%;border-radius:8px;display:block;" /></p>`);
        return;
      }

      resolve(`<p><a href="${dataUrl}">Arquivo: ${file.name}</a></p>`);
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
