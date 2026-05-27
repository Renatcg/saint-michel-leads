export const leadStatusValues = ["NEW", "CONTACTED", "QUALIFIED", "LOST", "WON"] as const;

export type LeadStatusValue = (typeof leadStatusValues)[number];

export const leadStatusLabels: Record<LeadStatusValue, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  LOST: "Perdido",
  WON: "Ganho",
};
