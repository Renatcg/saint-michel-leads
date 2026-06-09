"use client";

import { useMemo, useState } from "react";

type Broker = {
  id: string;
  name: string;
};

type DayScale = {
  brokerIds: string[];
  startBrokerId: string;
  startTime: string;
  endTime: string;
  active: boolean;
};

type BrokerStats = {
  forwarded: number;
  answered: number;
  sameDayReplies: number;
};

const emptyStats: BrokerStats = {
  forwarded: 0,
  answered: 0,
  sameDayReplies: 0,
};

export function AdminScheduleMock({
  brokers,
  initialScales,
  initialStats,
}: {
  brokers: Broker[];
  initialScales: Record<string, DayScale>;
  initialStats: Record<string, Record<string, BrokerStats>>;
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => getStartOfWeek(new Date()));
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [scales, setScales] = useState<Record<string, DayScale>>(initialScales);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftBrokerIds, setDraftBrokerIds] = useState<string[]>(brokers.slice(0, 2).map((broker) => broker.id));
  const [draftStartBrokerId, setDraftStartBrokerId] = useState(brokers[0]?.id ?? "");
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("18:00");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index)), [weekAnchor]);
  const brokerNames = useMemo(() => new Map(brokers.map((broker) => [broker.id, broker.name])), [brokers]);
  const todayKey = toDateKey(new Date());

  function toggleDay(dayKey: string) {
    setSelectedDays((current) => {
      const next = new Set(current);

      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }

      return next;
    });
  }

  function selectWorkWeek() {
    setSelectedDays(new Set(weekDays.slice(0, 5).map(toDateKey)));
  }

  function clearSelection() {
    setSelectedDays(new Set());
  }

  function openBulkModal() {
    if (selectedDays.size === 0) {
      return;
    }

    setModalOpen(true);
  }

  function openEditModal(dayKey: string) {
    const scale = scales[dayKey];

    setSelectedDays(new Set([dayKey]));

    if (scale) {
      setDraftBrokerIds(scale.brokerIds);
      setDraftStartBrokerId(scale.startBrokerId);
      setDraftStartTime(scale.startTime);
      setDraftEndTime(scale.endTime);
    }

    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function clearDayScale(dayKey: string) {
    setMessage("");
    const ok = await updateScheduleDay(dayKey, "clear");

    if (!ok) {
      return;
    }

    setScales((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
    });
  }

  async function toggleDayActivity(dayKey: string) {
    setMessage("");
    const ok = await updateScheduleDay(dayKey, "toggle-active");

    if (!ok) {
      return;
    }

    setScales((current) => {
      const currentScale = current[dayKey];

      return {
        ...current,
        [dayKey]: currentScale
          ? { ...currentScale, active: !currentScale.active }
          : {
              brokerIds: [],
              startBrokerId: "",
              startTime: "09:00",
              endTime: "18:00",
              active: false,
            },
      };
    });
  }

  function toggleBroker(brokerId: string) {
    setDraftBrokerIds((current) => {
      const next = current.includes(brokerId) ? current.filter((id) => id !== brokerId) : [...current, brokerId];

      if (!next.includes(draftStartBrokerId)) {
        setDraftStartBrokerId(next[0] ?? "");
      }

      return next;
    });
  }

  async function applyScale() {
    if (selectedDays.size === 0 || draftBrokerIds.length === 0) {
      return;
    }

    const startBrokerId = draftBrokerIds.includes(draftStartBrokerId) ? draftStartBrokerId : draftBrokerIds[0];
    const dates = Array.from(selectedDays);
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dates,
        brokerIds: draftBrokerIds,
        startBrokerId,
        startTime: draftStartTime,
        endTime: draftEndTime,
        active: true,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível salvar a escala.");
      return;
    }

    setScales((current) => {
      const next = { ...current };

      dates.forEach((dayKey) => {
        next[dayKey] = {
          brokerIds: draftBrokerIds,
          startBrokerId,
          startTime: draftStartTime,
          endTime: draftEndTime,
          active: true,
        };
      });

      return next;
    });
    clearSelection();
    closeModal();
    setMessage("Escala salva.");
  }

  return (
    <section className="px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-4 px-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#98743e]">Operação comercial</p>
          <h1 className="mt-2 text-3xl font-semibold">Escala de atendimento</h1>
          <p className="mt-2 max-w-3xl text-neutral-600">
            Selecione um ou mais dias da semana e defina quais corretores entram na roleta de atendimento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-black/15 px-4 py-2 text-sm font-semibold hover:bg-neutral-100" type="button" onClick={selectWorkWeek}>
            Selecionar seg-sex
          </button>
          <button className="rounded-md border border-black/15 px-4 py-2 text-sm font-semibold hover:bg-neutral-100" type="button" onClick={clearSelection}>
            Limpar seleção
          </button>
          <button
            className="rounded-md bg-[#98743e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={selectedDays.size === 0}
            onClick={openBulkModal}
          >
            Definir escala
          </button>
        </div>
      </div>
      {message ? <p className="mt-4 rounded-lg bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : null}

      <div className="mt-6">
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
            <button className="text-sm font-semibold text-neutral-700 hover:text-black" type="button" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
              ← Semana anterior
            </button>
            <strong className="text-lg">{formatWeekRange(weekDays)}</strong>
            <button className="text-sm font-semibold text-neutral-700 hover:text-black" type="button" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
              Próxima semana →
            </button>
          </div>

          <div className="grid min-h-[620px] grid-cols-1 divide-y divide-black/10 lg:grid-cols-7 lg:divide-x lg:divide-y-0">
            {weekDays.map((day) => {
              const dayKey = toDateKey(day);
              const scale = scales[dayKey];
              const isPast = dayKey < todayKey;
              const selected = selectedDays.has(dayKey);
              const inactive = scale ? !scale.active : false;

              return (
                <article
                  className={`flex min-h-[620px] flex-col p-3 transition ${
                    inactive ? "bg-neutral-100 text-neutral-500" : selected ? "bg-[#f6efe3] ring-2 ring-inset ring-[#98743e]" : "bg-white"
                  }`}
                  key={dayKey}
                >
                  <span className="flex items-start justify-between gap-2">
                    <button className="min-w-0 text-left" type="button" onClick={() => toggleDay(dayKey)}>
                      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{formatWeekday(day)}</span>
                      <span className="mt-1 block text-2xl font-semibold">{formatDayNumber(day)}</span>
                    </button>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${selected ? "bg-[#98743e] text-white" : "bg-neutral-100 text-neutral-600"}`}>
                      {inactive ? "Sem expediente" : selected ? "Selecionado" : isPast ? "Fechado" : "Aberto"}
                    </span>
                  </span>

                  <div className="mt-3 flex items-center gap-1">
                    <IconButton label="Limpar escala" onClick={() => clearDayScale(dayKey)}>
                      <path d="M5 7h14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 7l1 14h10l1-14" />
                      <path d="M9 7V4h6v3" />
                    </IconButton>
                    <IconButton label={inactive ? "Ativar expediente" : "Inativar expediente"} onClick={() => toggleDayActivity(dayKey)}>
                      {inactive ? (
                        <>
                          <path d="M5 12h14" />
                          <path d="M12 5v14" />
                        </>
                      ) : (
                        <>
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </>
                      )}
                    </IconButton>
                    <IconButton label="Editar escala" onClick={() => openEditModal(dayKey)}>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </IconButton>
                  </div>

                  {inactive ? (
                    <span className="mt-4 block rounded-md border border-dashed border-black/20 px-3 py-2 text-xs text-neutral-500">Não haverá expediente neste dia</span>
                  ) : scale ? (
                    <span className="mt-4 block rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">
                      {scale.startTime} às {scale.endTime} · início: {getBrokerName(brokerNames, scale.startBrokerId)}
                    </span>
                  ) : (
                    <span className="mt-4 block rounded-md border border-dashed border-black/20 px-3 py-2 text-xs text-neutral-500">Sem escala definida</span>
                  )}

                  <div className="mt-4 space-y-2">
                    {!inactive && (scale?.brokerIds ?? []).map((brokerId) => {
                      const stats = initialStats[dayKey]?.[brokerId] ?? emptyStats;

                      return (
                        <div className="rounded-md border border-black/10 bg-white px-3 py-2 shadow-sm" key={brokerId}>
                          <p className="truncate text-sm font-semibold">{getBrokerName(brokerNames, brokerId)}</p>
                          {isPast ? (
                            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px] text-neutral-600">
                              <Metric label="Leads" value={stats.forwarded} />
                              <Metric label="Atend." value={stats.answered} />
                              <Metric label="Resp." value={stats.sameDayReplies} />
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-neutral-500">
                              {brokerId === scale?.startBrokerId ? "Começa a roleta" : "Na roleta"}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Definir escala</h2>
                <p className="mt-1 text-sm text-neutral-600">{selectedDays.size} dia(s) selecionado(s)</p>
              </div>
              <button className="text-2xl leading-none text-neutral-500 hover:text-black" type="button" onClick={closeModal} aria-label="Fechar modal">
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Início do atendimento
                <input className="rounded-md border border-black/15 px-3 py-2 font-normal" type="time" value={draftStartTime} onChange={(event) => setDraftStartTime(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Fim do atendimento
                <input className="rounded-md border border-black/15 px-3 py-2 font-normal" type="time" value={draftEndTime} onChange={(event) => setDraftEndTime(event.target.value)} />
              </label>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold">Corretores na escala</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {brokers.map((broker) => (
                  <label className="flex items-center gap-3 rounded-md border border-black/10 px-3 py-2 text-sm" key={broker.id}>
                    <input checked={draftBrokerIds.includes(broker.id)} type="checkbox" onChange={() => toggleBroker(broker.id)} />
                    <span className="font-medium">{broker.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="mt-5 grid gap-1 text-sm font-semibold">
              Início da roleta
              <select
                className="rounded-md border border-black/15 px-3 py-2 font-normal"
                value={draftStartBrokerId}
                onChange={(event) => setDraftStartBrokerId(event.target.value)}
              >
                {draftBrokerIds.map((brokerId) => (
                  <option key={brokerId} value={brokerId}>
                    {getBrokerName(brokerNames, brokerId)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button className="rounded-md border border-black/15 px-4 py-3 font-semibold hover:bg-neutral-100" type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="rounded-md bg-[#98743e] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={selectedDays.size === 0 || draftBrokerIds.length === 0}
                onClick={applyScale}
              >
                {saving ? "Salvando..." : "Salvar escala"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-black/5 hover:text-black"
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        {children}
      </svg>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-neutral-100 px-1.5 py-1">
      <strong className="block text-sm text-neutral-900">{value}</strong>
      {label}
    </span>
  );
}

async function updateScheduleDay(date: string, action: "clear" | "toggle-active") {
  const response = await fetch("/api/admin/schedule", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, action }),
  });

  return response.ok;
}

function getBrokerName(brokerNames: Map<string, string>, brokerId: string) {
  return brokerNames.get(brokerId) ?? "Corretor";
}

function getStartOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekRange(days: Date[]) {
  const first = days[0];
  const last = days[days.length - 1];

  return `${first.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${last.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

function formatWeekday(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function formatDayNumber(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
