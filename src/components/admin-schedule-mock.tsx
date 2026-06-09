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
};

type BrokerStats = {
  forwarded: number;
  answered: number;
  sameDayReplies: number;
};

const brokers: Broker[] = [
  { id: "gabriel", name: "Gabriel Borges" },
  { id: "renato", name: "Renato Guimarães" },
  { id: "juliana", name: "Juliana Coelho" },
  { id: "daniela", name: "Daniela Porto" },
  { id: "eduardo", name: "Eduardo Maia" },
];

const initialScales: Record<string, DayScale> = {
  "2026-06-08": {
    brokerIds: ["gabriel", "renato", "juliana"],
    startBrokerId: "gabriel",
    startTime: "09:00",
    endTime: "18:00",
  },
  "2026-06-09": {
    brokerIds: ["renato", "daniela", "eduardo"],
    startBrokerId: "renato",
    startTime: "09:00",
    endTime: "18:00",
  },
  "2026-06-10": {
    brokerIds: ["juliana", "gabriel", "daniela"],
    startBrokerId: "juliana",
    startTime: "10:00",
    endTime: "19:00",
  },
};

export function AdminScheduleMock() {
  const [weekAnchor, setWeekAnchor] = useState(() => getStartOfWeek(new Date()));
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [scales, setScales] = useState<Record<string, DayScale>>(initialScales);
  const [draftBrokerIds, setDraftBrokerIds] = useState<string[]>(["gabriel", "renato"]);
  const [draftStartBrokerId, setDraftStartBrokerId] = useState("gabriel");
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("18:00");
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index)), [weekAnchor]);
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

  function toggleBroker(brokerId: string) {
    setDraftBrokerIds((current) => {
      const next = current.includes(brokerId) ? current.filter((id) => id !== brokerId) : [...current, brokerId];

      if (!next.includes(draftStartBrokerId)) {
        setDraftStartBrokerId(next[0] ?? "");
      }

      return next;
    });
  }

  function applyScale() {
    if (selectedDays.size === 0 || draftBrokerIds.length === 0) {
      return;
    }

    const startBrokerId = draftBrokerIds.includes(draftStartBrokerId) ? draftStartBrokerId : draftBrokerIds[0];

    setScales((current) => {
      const next = { ...current };

      selectedDays.forEach((dayKey) => {
        next[dayKey] = {
          brokerIds: draftBrokerIds,
          startBrokerId,
          startTime: draftStartTime,
          endTime: draftEndTime,
        };
      });

      return next;
    });
    clearSelection();
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#98743e]">Mock operacional</p>
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
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-black/10 bg-white">
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

              return (
                <button
                  className={`flex min-h-[260px] flex-col p-3 text-left transition ${
                    selected ? "bg-[#f6efe3] ring-2 ring-inset ring-[#98743e]" : "bg-white hover:bg-neutral-50"
                  }`}
                  key={dayKey}
                  type="button"
                  onClick={() => toggleDay(dayKey)}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{formatWeekday(day)}</span>
                      <span className="mt-1 block text-2xl font-semibold">{formatDayNumber(day)}</span>
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${selected ? "bg-[#98743e] text-white" : "bg-neutral-100 text-neutral-600"}`}>
                      {selected ? "Selecionado" : isPast ? "Fechado" : "Aberto"}
                    </span>
                  </span>

                  {scale ? (
                    <span className="mt-4 block rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">
                      {scale.startTime} às {scale.endTime} · início: {getBrokerName(scale.startBrokerId)}
                    </span>
                  ) : (
                    <span className="mt-4 block rounded-md border border-dashed border-black/20 px-3 py-2 text-xs text-neutral-500">Sem escala definida</span>
                  )}

                  <div className="mt-4 space-y-2">
                    {(scale?.brokerIds ?? []).map((brokerId) => {
                      const stats = getMockStats(dayKey, brokerId);

                      return (
                        <div className="rounded-md border border-black/10 bg-white px-3 py-2 shadow-sm" key={brokerId}>
                          <p className="truncate text-sm font-semibold">{getBrokerName(brokerId)}</p>
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
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-black/10 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Definir escala</h2>
              <p className="mt-1 text-sm text-neutral-600">{selectedDays.size} dia(s) selecionado(s)</p>
            </div>
            <span className="rounded-full bg-[#f6efe3] px-3 py-1 text-xs font-semibold text-[#7d5d2f]">Mock</span>
          </div>

          <div className="mt-5 grid gap-4">
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
            <div className="mt-2 space-y-2">
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
                  {getBrokerName(brokerId)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="mt-6 w-full rounded-md bg-[#98743e] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={selectedDays.size === 0 || draftBrokerIds.length === 0}
            onClick={applyScale}
          >
            Definir escala
          </button>

          <div className="mt-5 rounded-md bg-neutral-100 p-3 text-xs text-neutral-600">
            Próxima etapa: salvar esta configuração no banco, usar a escala para atribuição automática e alimentar os indicadores com dados reais.
          </div>
        </aside>
      </div>
    </section>
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

function getBrokerName(brokerId: string) {
  return brokers.find((broker) => broker.id === brokerId)?.name ?? "Corretor";
}

function getMockStats(dayKey: string, brokerId: string): BrokerStats {
  const seed = Array.from(`${dayKey}-${brokerId}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const forwarded = (seed % 9) + 2;
  const answered = Math.max(0, forwarded - (seed % 3));

  return {
    forwarded,
    answered,
    sameDayReplies: Math.max(0, answered - (seed % 2)),
  };
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
