export const messageChannelValues = ["EMAIL", "WHATSAPP", "BOTH"] as const;
export const messageTriggerValues = ["ON_LEAD_CREATED", "AFTER_DAYS", "MANUAL"] as const;

export type MessageChannelValue = (typeof messageChannelValues)[number];
export type MessageTriggerValue = (typeof messageTriggerValues)[number];

export const messageChannelLabels: Record<MessageChannelValue, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  BOTH: "Ambos",
};

export const messageTriggerLabels: Record<MessageTriggerValue, string> = {
  ON_LEAD_CREATED: "Ao cadastrar",
  AFTER_DAYS: "Após X dias",
  MANUAL: "Manual",
};
