import { z } from "zod";
import { leadStatusValues } from "@/lib/leads";
import { messageChannelValues, messageTriggerValues } from "@/lib/messages";

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  phone: z.string().trim().min(10, "Informe um WhatsApp válido."),
  acceptedDataUsage: z.coerce.boolean().default(true),
});

export const adminLeadUpdateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  phone: z.string().trim().min(10, "Informe um WhatsApp válido."),
  status: z.enum(leadStatusValues),
  source: z.string().trim().min(1, "Informe a origem.").default("landing"),
});

export const messageTemplateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da mensagem."),
    channel: z.enum(messageChannelValues),
    trigger: z.enum(messageTriggerValues),
    delayDays: z.coerce.number().int().min(0, "O prazo não pode ser negativo.").default(0),
    subject: z.string().trim().optional(),
    body: z.string().trim().min(5, "Informe o corpo da mensagem."),
    active: z.coerce.boolean().default(true),
  })
  .superRefine((data, context) => {
    if ((data.channel === "EMAIL" || data.channel === "BOTH") && !data.subject) {
      context.addIssue({
        code: "custom",
        message: "Informe o assunto para mensagens de e-mail.",
        path: ["subject"],
      });
    }

    if (data.trigger !== "AFTER_DAYS" && data.delayDays !== 0) {
      data.delayDays = 0;
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  password: z.string().min(6, "Informe sua senha."),
});

export function normalizePhone(phone: string) {
  const onlyDigits = phone.replace(/\D/g, "");

  if (onlyDigits.startsWith("55")) {
    return onlyDigits;
  }

  return `55${onlyDigits}`;
}
