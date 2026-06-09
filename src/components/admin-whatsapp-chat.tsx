"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ChatLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
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
  senderName: string | null;
  readAt: string | null;
  createdAt: string;
};

type AssignableUser = {
  id: string;
  name: string;
  role: string;
};

type AttachmentDraft = {
  url: string;
  name: string;
  type: string;
};

type AssignmentMenu = {
  leadId: string;
  x: number;
  y: number;
};

type WindowWithAudioFallback = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export function AdminWhatsappChat({
  leads,
  selectedLeadId,
  initialMessages,
  canChat,
  canSyncHistory,
  canAssignLeads = false,
  assignableUsers = [],
  showAssigneeGroups = false,
}: {
  leads: ChatLead[];
  selectedLeadId: string | null;
  initialMessages: ChatMessage[];
  canChat: boolean;
  canSyncHistory: boolean;
  canAssignLeads?: boolean;
  assignableUsers?: AssignableUser[];
  showAssigneeGroups?: boolean;
}) {
  const [threads, setThreads] = useState(leads);
  const [activeLeadId, setActiveLeadId] = useState(selectedLeadId);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [notice, setNotice] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [assignmentMenu, setAssignmentMenu] = useState<AssignmentMenu | null>(null);
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingInitialScrollRef = useRef(true);
  const shouldKeepBottomRef = useRef(false);
  const knownInboundIdsRef = useRef(new Set(initialMessages.filter((message) => message.direction === "INBOUND").map((message) => message.id)));
  const unreadTotalRef = useRef(sumUnreadMessages(leads));
  const audioContextRef = useRef<AudioContext | null>(null);

  const selectedLead = useMemo(() => threads.find((lead) => lead.id === activeLeadId) ?? threads[0] ?? null, [threads, activeLeadId]);
  const groupedThreads = useMemo(() => groupThreadsByAssignee(threads, showAssigneeGroups), [threads, showAssigneeGroups]);
  const assignmentLead = useMemo(
    () => (assignmentMenu ? threads.find((lead) => lead.id === assignmentMenu.leadId) ?? null : null),
    [assignmentMenu, threads],
  );

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  }

  useLayoutEffect(() => {
    if (loadingMessages) {
      return;
    }

    if (!pendingInitialScrollRef.current && !shouldKeepBottomRef.current) {
      return;
    }

    scrollToBottom(messagesAreaRef.current, bottomRef.current);
    pendingInitialScrollRef.current = false;
    shouldKeepBottomRef.current = false;
  }, [messages, loadingMessages]);

  useLayoutEffect(() => {
    const textArea = textAreaRef.current;

    if (!textArea) {
      return;
    }

    textArea.style.height = "44px";
    textArea.style.height = `${Math.min(textArea.scrollHeight, 76)}px`;
  }, [text]);

  useEffect(() => {
    if (!assignmentMenu) {
      return;
    }

    function closeMenu() {
      setAssignmentMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [assignmentMenu]);

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
      shouldKeepBottomRef.current = isNearBottom(messagesAreaRef.current);
      let shouldNotify = false;

      if (chatResponse.ok && Array.isArray(chatData?.messages)) {
        shouldNotify = hasNewInboundMessages(chatData.messages, knownInboundIdsRef.current);
        setMessages(chatData.messages);
      }

      if (threadsResponse.ok && Array.isArray(threadsData?.leads)) {
        const nextUnreadTotal = sumUnreadMessages(threadsData.leads);

        if (nextUnreadTotal > unreadTotalRef.current) {
          shouldNotify = true;
        }

        unreadTotalRef.current = nextUnreadTotal;
        setThreads(threadsData.leads);
      }

      if (shouldNotify) {
        playNotificationSound(audioContextRef);
      }
    };

    const interval = window.setInterval(refresh, 8000);
    return () => window.clearInterval(interval);
  }, [selectedLead]);

  async function selectLead(leadId: string) {
    if (leadId === activeLeadId) {
      return;
    }

    pendingInitialScrollRef.current = true;
    shouldKeepBottomRef.current = false;
    setActiveLeadId(leadId);
    setMessages([]);
    setLoadingMessages(true);
    setText("");
    setAttachment(null);
    setNotice("");
    window.history.pushState(null, "", `/admin/chat?leadId=${leadId}`);

    const response = await fetch(`/api/admin/chat?leadId=${leadId}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);

    if (response.ok && Array.isArray(data?.messages)) {
      markKnownInboundMessages(data.messages, knownInboundIdsRef.current);
      setMessages(data.messages);
    }
    setLoadingMessages(false);

    const threadsResponse = await fetch("/api/admin/chat/threads", { cache: "no-store" });
    const threadsData = await threadsResponse.json().catch(() => null);

    if (threadsResponse.ok && Array.isArray(threadsData?.leads)) {
      unreadTotalRef.current = sumUnreadMessages(threadsData.leads);
      setThreads(threadsData.leads);
    }
  }

  function openAssignmentMenu(event: React.MouseEvent, leadId: string) {
    if (!canAssignLeads || assignableUsers.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setAssignmentMenu({
      leadId,
      x: Math.min(event.clientX, window.innerWidth - 280),
      y: Math.min(event.clientY, window.innerHeight - 260),
    });
  }

  async function assignLead(leadId: string, userId: string | null) {
    setAssigningLeadId(leadId);
    setNotice("");

    const response = await fetch(`/api/admin/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setNotice(data?.error ?? "Não foi possível encaminhar o lead.");
      setAssigningLeadId(null);
      setAssignmentMenu(null);
      return;
    }

    setThreads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              assignedToUserId: data.lead?.assignedToUserId ?? null,
              assignedToName: data.lead?.assignedToName ?? null,
            }
          : lead,
      ),
    );
    setAssigningLeadId(null);
    setAssignmentMenu(null);
  }

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
    shouldKeepBottomRef.current = true;
    markKnownInboundMessages(refreshed.messages ?? [], knownInboundIdsRef.current);
    unreadTotalRef.current = sumUnreadMessages(refreshedThreads.leads ?? threads);
    setMessages(refreshed.messages ?? []);
    setThreads(refreshedThreads.leads ?? threads);
    setText("");
    setAttachment(null);
    setSending(false);
  }

  async function syncAllHistory() {
    if (!selectedLead) {
      return;
    }

    setSyncing(true);
    setNotice("");

    const response = await fetch("/api/admin/chat/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setNotice(data?.error ?? "Não foi possível atualizar o histórico.");
      setSyncing(false);
      return;
    }

    const [chatResponse, threadsResponse] = await Promise.all([
      fetch(`/api/admin/chat?leadId=${selectedLead.id}`, { cache: "no-store" }),
      fetch("/api/admin/chat/threads", { cache: "no-store" }),
    ]);
    const chatData = await chatResponse.json().catch(() => null);
    const threadsData = await threadsResponse.json().catch(() => null);
    shouldKeepBottomRef.current = isNearBottom(messagesAreaRef.current);

    if (chatResponse.ok && Array.isArray(chatData?.messages)) {
      markKnownInboundMessages(chatData.messages, knownInboundIdsRef.current);
      setMessages(chatData.messages);
    }

    if (threadsResponse.ok && Array.isArray(threadsData?.leads)) {
      unreadTotalRef.current = sumUnreadMessages(threadsData.leads);
      setThreads(threadsData.leads);
    }

    setNotice("Histórico reconstruído.");
    setSyncing(false);
  }

  return (
    <div className="grid h-[calc(100vh-106px)] min-h-[520px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-black/10 bg-white lg:border-b-0 lg:border-r">
        <div className="border-b border-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Chat</h1>
            </div>
            {canSyncHistory ? (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-lg text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
                type="button"
                disabled={syncing}
                onClick={syncAllHistory}
                title="Atualizar histórico"
                aria-label="Atualizar histórico"
              >
                {syncing ? (
                  "..."
                ) : (
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20 11a8 8 0 0 0-14.9-4M4 5v5h5" />
                    <path d="M4 13a8 8 0 0 0 14.9 4M20 19v-5h-5" />
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groupedThreads.map((group) => {
            const collapsed = collapsedGroups.has(group.id);

            return (
            <div key={group.id}>
              {showAssigneeGroups ? (
                <button
                  className="sticky top-0 z-10 flex w-full items-center justify-between gap-3 border-b border-black/10 bg-neutral-100 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.12em] text-neutral-600 hover:bg-neutral-200"
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!collapsed}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <svg
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                    <span className="truncate">{group.label}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] tracking-normal text-neutral-600">
                    {group.leads.length}
                  </span>
                </button>
              ) : null}
              {collapsed ? null : group.leads.map((lead) => (
                <button
                  className={`flex w-full gap-3 border-b border-black/5 px-3 py-3 text-left hover:bg-neutral-50 ${
                    lead.id === selectedLead?.id ? "bg-[#f0f2f5]" : ""
                  }`}
                  key={lead.id}
                  type="button"
                  onClick={() => selectLead(lead.id)}
                  onContextMenu={(event) => openAssignmentMenu(event, lead.id)}
                  title={canAssignLeads ? "Clique com o botão direito para encaminhar" : undefined}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9fdd3] text-xs font-bold text-[#1f7a3a]">
                    {getInitials(lead.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className={`truncate text-sm text-neutral-900 ${lead.unreadCount > 0 ? "font-bold" : "font-normal"}`}>{lead.name}</span>
                      <span className="shrink-0 text-xs text-neutral-500">{formatTime(lead.lastMessageAt)}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${lead.unreadCount > 0 ? "font-bold text-neutral-900" : "text-neutral-600"}`}>
                      {lead.lastMessage || lead.phone}
                    </span>
                    {lead.unreadCount > 0 ? (
                      <span className="mt-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-xs font-bold text-white">
                        {lead.unreadCount}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            );
          })}
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

            <div ref={messagesAreaRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
              <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-3">
                <div className="mt-auto" />
                {!loadingMessages && messages.length === 0 ? (
                  <p className="mx-auto rounded-lg bg-white/80 px-4 py-2 text-sm text-neutral-600">
                    Nenhuma mensagem enviada para este lead ainda.
                  </p>
                ) : null}

                {groupMessagesByDay(messages).map((group) => (
                  <div className="contents" key={group.dayKey}>
                    <div className="my-2 flex justify-center">
                      <span className="rounded-lg bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-600 shadow-sm">{group.label}</span>
                    </div>
                    {group.messages.map((message) => (
                      <div className={message.direction === "INBOUND" ? "flex justify-start" : "flex justify-end"} key={message.id}>
                        <div
                          className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                            message.direction === "INBOUND" ? "bg-white" : "bg-[#d9fdd3]"
                          }`}
                        >
                          {message.attachmentUrl ? <AttachmentPreview message={message} /> : null}
                          {message.direction === "OUTBOUND" && message.senderName ? (
                            <p className="mb-1 font-bold text-neutral-900">{message.senderName}:</p>
                          ) : null}
                          {message.content ? (
                            <p className="whitespace-pre-wrap break-words">
                              <LinkifiedText text={message.content} />{" "}
                              <span className="inline-block pl-1 text-[11px] text-neutral-500">{formatTime(message.createdAt)}</span>
                            </p>
                          ) : (
                            <span className="inline-block text-[11px] text-neutral-500">{formatTime(message.createdAt)}</span>
                          )}
                          {message.errorMessage ? <p className="mt-1 text-xs text-red-700">{message.errorMessage}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="border-t border-black/10 bg-[#f0f2f5] p-3">
              {notice ? <p className="mb-2 rounded-md bg-white px-3 py-2 text-sm text-red-700">{notice}</p> : null}
              {attachment ? (
                <AttachmentDraftPreview attachment={attachment} onRemove={() => setAttachment(null)} />
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
                  ref={textAreaRef}
                  rows={1}
                  className="h-11 max-h-[76px] min-h-11 flex-1 resize-none overflow-y-auto rounded-3xl border border-transparent bg-white px-4 py-2.5 outline-none focus:border-[#98743e]"
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
      {assignmentMenu && assignmentLead && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed z-50 w-72 overflow-hidden rounded-lg border border-black/10 bg-white py-2 text-sm shadow-xl"
          style={{ left: assignmentMenu.x, top: assignmentMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="border-b border-black/10 px-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Encaminhar lead</p>
            <p className="mt-1 truncate font-semibold text-neutral-900">{assignmentLead.name}</p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {assignableUsers.map((user) => {
              const selected = assignmentLead.assignedToUserId === user.id;

              return (
                <button
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-100 disabled:opacity-60"
                  disabled={assigningLeadId === assignmentLead.id || selected}
                  key={user.id}
                  type="button"
                  onClick={() => assignLead(assignmentLead.id, user.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-900">{user.name}</span>
                    <span className="text-xs text-neutral-500">{formatRoleLabel(user.role)}</span>
                  </span>
                  {selected ? <span className="text-xs font-semibold text-[#1f7a3a]">Atual</span> : null}
                </button>
              );
            })}
          </div>
          <button
            className="flex w-full items-center justify-between border-t border-black/10 px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-60"
            disabled={assigningLeadId === assignmentLead.id || !assignmentLead.assignedToUserId}
            type="button"
            onClick={() => assignLead(assignmentLead.id, null)}
          >
            Remover encaminhamento
          </button>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function isNearBottom(element: HTMLDivElement | null) {
  if (!element) {
    return true;
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

function scrollToBottom(element: HTMLDivElement | null, fallback: HTMLDivElement | null) {
  if (element) {
    element.scrollTop = element.scrollHeight;
    return;
  }

  fallback?.scrollIntoView({ behavior: "auto", block: "end" });
}

function sumUnreadMessages(leads: ChatLead[]) {
  return leads.reduce((total, lead) => total + lead.unreadCount, 0);
}

function groupThreadsByAssignee(leads: ChatLead[], enabled: boolean) {
  if (!enabled) {
    return [{ id: "all", label: "Conversas", leads }];
  }

  const groups = new Map<string, ChatLead[]>();

  leads.forEach((lead) => {
    const id = lead.assignedToUserId ?? "unassigned";
    groups.set(id, [...(groups.get(id) ?? []), lead]);
  });

  return Array.from(groups.entries()).map(([id, groupedLeads]) => ({
    id,
    label: groupedLeads[0]?.assignedToName ?? "Sem corretor",
    leads: groupedLeads,
  }));
}

function markKnownInboundMessages(messages: ChatMessage[], knownIds: Set<string>) {
  messages.forEach((message) => {
    if (message.direction === "INBOUND") {
      knownIds.add(message.id);
    }
  });
}

function hasNewInboundMessages(messages: ChatMessage[], knownIds: Set<string>) {
  let hasNewMessage = false;

  messages.forEach((message) => {
    if (message.direction !== "INBOUND") {
      return;
    }

    if (!knownIds.has(message.id)) {
      hasNewMessage = true;
    }

    knownIds.add(message.id);
  });

  return hasNewMessage;
}

function playNotificationSound(audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const AudioContextConstructor = window.AudioContext || (window as WindowWithAudioFallback).webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const context = audioContextRef.current ?? new AudioContextConstructor();
  audioContextRef.current = context;

  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }

  const now = context.currentTime;
  playTone(context, now, 740, 0.08);
  playTone(context, now + 0.1, 980, 0.1);
}

function playTone(context: AudioContext, startTime: number, frequency: number, duration: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.045, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
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

function AttachmentDraftPreview({ attachment, onRemove }: { attachment: AttachmentDraft; onRemove: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <DraftPreviewMedia attachment={attachment} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-800">{attachment.name}</p>
          <p className="text-xs text-neutral-500">{attachment.type || "Arquivo anexado"}</p>
        </div>
      </div>
      <button className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" type="button" onClick={onRemove}>
        Remover
      </button>
    </div>
  );
}

function DraftPreviewMedia({ attachment }: { attachment: AttachmentDraft }) {
  if (attachment.type.startsWith("image/")) {
    return <img className="h-14 w-14 rounded-md object-cover" src={attachment.url} alt={attachment.name} />;
  }

  if (attachment.type.startsWith("video/")) {
    return <video className="h-14 w-20 rounded-md object-cover" src={attachment.url} muted />;
  }

  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold uppercase text-neutral-600">
      {attachment.type.includes("pdf") ? "PDF" : "DOC"}
    </span>
  );
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+|\*[^*\n]+\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (/^\*[^*\n]+\*$/.test(part)) {
          return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>;
        }

        if (!/^(https?:\/\/|www\.)/.test(part)) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        const href = part.startsWith("http") ? part : `https://${part}`;

        return (
          <a className="text-blue-700 underline" href={href} key={`${part}-${index}`} rel="noreferrer" target="_blank">
            {part}
          </a>
        );
      })}
    </>
  );
}

function groupMessagesByDay(messages: ChatMessage[]) {
  return messages.reduce<Array<{ dayKey: string; label: string; messages: ChatMessage[] }>>((groups, message) => {
    const date = new Date(message.createdAt);
    const dayKey = date.toISOString().slice(0, 10);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.dayKey === dayKey) {
      lastGroup.messages.push(message);
      return groups;
    }

    groups.push({
      dayKey,
      label: formatDayLabel(date),
      messages: [message],
    });
    return groups;
  }, []);
}

function formatDayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return "hoje";
  }

  if (isSameDay(date, yesterday)) {
    return "ontem";
  }

  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
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

function formatRoleLabel(role: string) {
  if (role === "SUPERVISOR") {
    return "Supervisor";
  }

  if (role === "BROKER" || role === "VIEWER") {
    return "Corretor";
  }

  return role;
}
