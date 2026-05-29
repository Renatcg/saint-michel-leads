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
  createdAt: string;
  logsCount: number;
  schedulesCount: number;
};

type Draft = Pick<LeadRow, "name" | "email" | "phone" | "status" | "source">;

export function AdminLeadsTable({ initialLeads, canEdit }: { initialLeads: LeadRow[]; canEdit: boolean }) {
  const [leads, setLeads] = useState(initialLeads);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  return (
    <div className="mt-6">
      {message ? <p className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : null}
      {!canEdit ? (
        <p className="mb-4 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm text-neutral-700">
          Seu acesso é somente leitura. Você pode visualizar os leads, mas não alterar cadastros nem enviar mensagens.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-neutral-100 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Mensagens</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
              {canEdit ? <th className="px-4 py-3 font-medium">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isEditing = editingId === lead.id && draft;

              return (
                <tr className="border-t border-black/10 align-top" key={lead.id}>
                  <td className="px-4 py-3 font-medium">
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
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-neutral-600">
                    {lead.logsCount} envios / {lead.schedulesCount} pendentes
                  </td>
                  <td className="px-4 py-3">{new Date(lead.createdAt).toLocaleDateString("pt-BR")}</td>
                  {canEdit ? (
                    <td className="px-4 py-3">
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
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-md border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
                            href={`/admin/chat?leadId=${lead.id}`}
                          >
                            Chat
                          </Link>
                          <button
                            className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold"
                            type="button"
                            onClick={() => startEditing(lead)}
                          >
                            Editar
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                            type="button"
                            disabled={loadingId === lead.id}
                            onClick={() => deleteLead(lead.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {leads.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={canEdit ? 8 : 7}>
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
