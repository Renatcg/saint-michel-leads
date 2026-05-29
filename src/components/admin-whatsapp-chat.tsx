"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ChatLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessage: string;
  unreadCount: number;
};

type ChatMessage = {
  id: string;
  status: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  errorMessage: string | null;
  provider: string | null;
  providerId: string | null;
  direction: string;
  readAt: string | null;
  createdAt: string;
};

type AttachmentDraft = {
  url: string;
  name: string;
  type: string;
};

export function AdminWhatsappChat({
  leads,
  selectedLeadId,
  initialMessages,
  canChat,
}: {
  leads: ChatLead[];
  selectedLeadId: string | null;
  initialMessages: ChatMessage[];
  canChat: boolean;
}) {
  const [threads, setThreads] = useState(leads);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedLead = useMemo(() => threads.find((lead) => lead.id === selectedLeadId) ?? threads[0] ?? null, [threads, selectedLeadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, selectedLeadId]);

  useEffect(() => {
    const refresh = async () => {
      if (!selectedLead) {
        return;
      }

      const [chatResponse, threadsResponse] = await Promise.all([
        fetch(`/api/admin/chat?leadId=${selectedLead.id}`, { cache: "no-store" }),
        fetch("/api/admin/chat/threads", { cache: "no-store" }),
      ]);
      const chatData = await chatResponse.json().catch(() => null);
      const threadsData = await threadsResponse.json().catch(() => null);

      if (chatResponse.ok && Array.isArray(chatData?.messages)) {
        setMessages(chatData.messages);
      }

      if (threadsResponse.ok && Array.isArray(threadsData?.leads)) {
        setThreads(threadsData.leads);
      }
    };

    const interval = window.setInterval(refresh, 8000);
    return () => window.clearInterval(interval);
  }, [selectedLead]);

  async function handleUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setUploading(true);
    setNotice("");

    try {
      const blob = await upload(`chat/${Date.now()}-${sanitizeFileName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob/upload",
        multipart: file.size > 4 * 1024 * 1024,
        contentType: file.type,
      });

      setAttachment({
        url: blob.url,
        name: file.name,
        type: file.type || "application/octet-stream",
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível anexar o arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function sendMessage() {
    if (!selectedLead || (!text.trim() && !attachment)) {
      return;
    }

    setSending(true);
    setNotice("");

    const response = await fetch(`/api/admin/leads/${selectedLead.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        ...(attachment ? { attachment } : {}),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setSending(false);
      setNotice(data?.error ?? "Não foi possível enviar a mensagem.");
      return;
    }

    const refreshed = await fetch(`/api/admin/chat?leadId=${selectedLead.id}`).then((result) => result.json());
    const refreshedThreads = await fetch("/api/admin/chat/threads").then((result) => result.json());
    setMessages(refreshed.messages ?? []);
    setThreads(refreshedThreads.leads ?? threads);
    setText("");
    setAttachment(null);
    setSending(false);
  }

  return (
    <div className="grid h-[calc(100vh-150px)] min-h-[640px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-black/10 bg-white lg:border-b-0 lg:border-r">
        <div className="border-b border-black/10 p-4">
          <h1 className="text-2xl font-semibold">Chat</h1>
          <p className="mt-1 text-sm text-neutral-600">Conversas enviadas pelo WhatsApp da Evo API.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {threads.map((lead) => (
            <Link
              className={`flex gap-3 border-b border-black/5 px-4 py-4 hover:bg-neutral-50 ${
                lead.id === selectedLead?.id ? "bg-[#f0f2f5]" : ""
              }`}
              href={`/admin/chat?leadId=${lead.id}`}
              key={lead.id}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d9fdd3] text-sm font-bold text-[#1f7a3a]">
                {getInitials(lead.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className={`truncate text-neutral-900 ${lead.unreadCount > 0 ? "font-bold" : "font-semibold"}`}>{lead.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">{formatTime(lead.lastMessageAt)}</span>
                </span>
                <span className={`mt-1 block truncate text-sm ${lead.unreadCount > 0 ? "font-bold text-neutral-900" : "text-neutral-600"}`}>
                  {lead.lastMessage || lead.phone}
                </span>
                {lead.unreadCount > 0 ? (
                  <span className="mt-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-xs font-bold text-white">
                    {lead.unreadCount}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col bg-[#efeae2]">
        {selectedLead ? (
          <>
            <header className="flex items-center gap-3 border-b border-black/10 bg-[#f0f2f5] px-5 py-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-[#1f7a3a]">
                {getInitials(selectedLead.name)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{selectedLead.name}</h2>
                <p className="truncate text-sm text-neutral-600">{selectedLead.phone} · {selectedLead.email}</p>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <div className="mx-auto flex max-w-4xl flex-col gap-3">
                {messages.length === 0 ? (
                  <p className="mx-auto rounded-lg bg-white/80 px-4 py-2 text-sm text-neutral-600">
                    Nenhuma mensagem enviada para este lead ainda.
                  </p>
                ) : null}

                {messages.map((message) => (
                  <div className={message.direction === "INBOUND" ? "flex justify-start" : "flex justify-end"} key={message.id}>
                    <div
                      className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        message.direction === "INBOUND" ? "bg-white" : "bg-[#d9fdd3]"
                      }`}
                    >
                      {message.attachmentUrl ? <AttachmentPreview message={message} /> : null}
                      {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}
                      <div className="mt-1 flex justify-end gap-2 text-[11px] text-neutral-500">
                        <span>{formatTime(message.createdAt)}</span>
                        <span>{message.direction === "INBOUND" ? "recebido" : message.status === "FAILED" ? "falhou" : "enviado"}</span>
                      </div>
                      {message.errorMessage ? <p className="mt-1 text-xs text-red-700">{message.errorMessage}</p> : null}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="border-t border-black/10 bg-[#f0f2f5] p-3">
              {notice ? <p className="mb-2 rounded-md bg-white px-3 py-2 text-sm text-red-700">{notice}</p> : null}
              {attachment ? (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="truncate">Anexo: {attachment.name}</span>
                  <button className="font-semibold text-red-700" type="button" onClick={() => setAttachment(null)}>
                    Remover
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => handleUpload(event.target.files?.[0])}
                />
                <button
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-light text-neutral-700 disabled:opacity-60"
                  type="button"
                  disabled={!canChat || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo"
                >
                  +
                </button>
                <textarea
                  className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-transparent bg-white px-4 py-3 outline-none focus:border-[#98743e]"
                  placeholder={canChat ? "Digite uma mensagem" : "Seu acesso é somente leitura"}
                  value={text}
                  disabled={!canChat}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  className="h-12 shrink-0 rounded-full bg-[#25d366] px-5 font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={!canChat || uploading || sending || (!text.trim() && !attachment)}
                  onClick={sendMessage}
                >
                  {sending ? "Enviando..." : uploading ? "Anexando..." : "Enviar"}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-neutral-600">
            Nenhum lead encontrado para iniciar uma conversa.
          </div>
        )}
      </section>
    </div>
  );
}

function AttachmentPreview({ message }: { message: ChatMessage }) {
  if (!message.attachmentUrl) {
    return null;
  }

  if (message.attachmentType?.startsWith("image/")) {
    return (
      <a href={message.attachmentUrl} rel="noreferrer" target="_blank">
        <img className="mb-2 max-h-64 rounded-md object-cover" src={message.attachmentUrl} alt={message.attachmentName ?? "Imagem enviada"} />
      </a>
    );
  }

  if (message.attachmentType?.startsWith("video/")) {
    return <video className="mb-2 max-h-64 rounded-md" src={message.attachmentUrl} controls />;
  }

  return (
    <a className="mb-2 block rounded-md bg-white/70 px-3 py-2 font-semibold text-[#1f7a3a]" href={message.attachmentUrl} rel="noreferrer" target="_blank">
      {message.attachmentName ?? "Abrir documento"}
    </a>
  );
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
