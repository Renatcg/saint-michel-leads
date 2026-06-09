"use client";

import Link from "next/link";
import { useState } from "react";
import { leadStatusLabels, leadStatusValues, type LeadStatusValue } from "@/lib/leads";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatusValue;
  source: string;
  acceptedDataUsage: boolean;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignmentStatus: string;
  createdAt: string;
  logsCount: number;
  schedulesCount: number;
};

type Draft = Pick<LeadRow, "name" | "email" | "phone" | "status" | "source">;

type BrokerOption = {
  id: string;
  name: string;
};

export function AdminLeadsTable({
  initialLeads,
  brokers,
  canAssign,
  canEdit,
  canChat,
}: {
  initialLeads: LeadRow[];
  brokers: BrokerOption[];
  canAssign: boolean;
  canEdit: boolean;
  canChat: boolean;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  function startEditing(lead: LeadRow) {
    setMessage("");
    setEditingId(lead.id);
    setDraft({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
    });
  }

  async function saveLead(id: string) {
    if (!draft) {
      return;
    }

    setLoadingId(id);
    setMessage("");

    const response = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    setLoadingId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível atualizar o lead.");
      return;
    }

    const data = await response.json();
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              name: data.lead.name,
              email: data.lead.email,
              phone: data.lead.phone,
              status: data.lead.status,
              source: data.lead.source,
            }
          : lead,
      ),
    );
    setEditingId(null);
    setDraft(null);
    setMessage("Lead atualizado.");
  }

  async function deleteLead(id: string) {
    const lead = leads.find((item) => item.id === id);

    if (!lead || !window.confirm(`Excluir o lead ${lead.name}?`)) {
      return;
    }

    setLoadingId(id);
    setMessage("");

    const response = await fetch(`/api/admin/leads/${id}`, {
      method: "DELETE",
    });

    setLoadingId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível excluir o lead.");
      return;
    }

    setLeads((current) => current.filter((item) => item.id !== id));
    setMessage("Lead excluído.");
  }

  async function assignLead(leadId: string, userId: string) {
    setAssigningId(leadId);
    setMessage("");

    const response = await fetch(`/api/admin/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId || null }),
    });

    setAssigningId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível encaminhar o lead.");
      return;
    }

    const data = await response.json();
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              assignedToUserId: data.lead.assignedToUserId,
              assignedToName: data.lead.assignedToName,
              assignmentStatus: data.lead.assignmentStatus,
            }
          : lead,
      ),
    );
    setMessage(userId ? "Lead encaminhado." : "Atribuição removida.");
  }

  return (
    <div className="mt-6">
      {message ? <p className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : null}
      {!canEdit ? (
        <p className="mb-4 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm text-neutral-700">
          Seu acesso é somente leitura. Você pode visualizar os leads e acessar o chat, mas não alterar cadastros.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className="bg-neutral-100 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Corretor</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
              {canEdit || canChat ? <th className="px-4 py-3 font-medium">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isEditing = editingId === lead.id && draft;

              return (
                <tr className="border-t border-black/10 align-middle" key={lead.id}>
                  <td className="px-4 py-2 font-medium">
                    {isEditing ? (
                      <input
                        className="w-full rounded-md border border-black/15 px-3 py-2"
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    ) : (
                      lead.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        className="w-full rounded-md border border-black/15 px-3 py-2"
                        value={draft.email}
                        onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                      />
                    ) : (
                      lead.email
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        className="w-full rounded-md border border-black/15 px-3 py-2"
                        value={draft.phone}
                        onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                      />
                    ) : (
                      lead.phone
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        className="w-full rounded-md border border-black/15 px-3 py-2"
                        value={draft.status}
                        onChange={(event) => setDraft({ ...draft, status: event.target.value as LeadStatusValue })}
                      >
                        {leadStatusValues.map((status) => (
                          <option key={status} value={status}>
                            {leadStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      leadStatusLabels[lead.status]
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {canAssign ? (
                      <select
                        className="w-full min-w-36 rounded-md border border-black/15 px-2 py-2 text-xs outline-none focus:border-[#98743e] disabled:opacity-60"
                        value={lead.assignedToUserId ?? ""}
                        disabled={assigningId === lead.id}
                        onChange={(event) => assignLead(lead.id, event.target.value)}
                      >
                        <option value="">Sem corretor</option>
                        {brokers.map((broker) => (
                          <option key={broker.id} value={broker.id}>
                            {broker.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-700">{lead.assignedToName ?? "Sem corretor"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        className="w-full rounded-md border border-black/15 px-3 py-2"
                        value={draft.source}
                        onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                      />
                    ) : (
                      lead.source
                    )}
                  </td>
                  <td className="px-4 py-2">{formatDateTime(lead.createdAt)}</td>
                  {canEdit || canChat ? (
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md bg-[#98743e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            type="button"
                            disabled={loadingId === lead.id}
                            onClick={() => saveLead(lead.id)}
                          >
                            Salvar
                          </button>
                          <button
                            className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold"
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setDraft(null);
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {canChat ? (
                            <Link
                              className="inline-flex h-5 w-5 items-center justify-center text-emerald-700 transition hover:scale-110"
                              href={`/admin/chat?leadId=${lead.id}`}
                              title="Abrir chat"
                              aria-label="Abrir chat"
                            >
                              <IconChat />
                            </Link>
                          ) : null}
                          {canEdit ? (
                            <>
                              <button
                                className="inline-flex h-5 w-5 items-center justify-center text-neutral-700 transition hover:scale-110"
                                type="button"
                                title="Editar lead"
                                aria-label="Editar lead"
                                onClick={() => startEditing(lead)}
                              >
                                <IconEdit />
                              </button>
                              <button
                                className="inline-flex h-5 w-5 items-center justify-center text-red-700 transition hover:scale-110 disabled:opacity-60"
                                type="button"
                                disabled={loadingId === lead.id}
                                title="Excluir lead"
                                aria-label="Excluir lead"
                                onClick={() => deleteLead(lead.id)}
                              >
                                <IconTrash />
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {leads.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={canEdit || canChat ? 8 : 7}>
                  Nenhum lead encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function IconChat() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.8-.9L3 21l1.8-4.8A8.2 8.2 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 15h10l1-15" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
