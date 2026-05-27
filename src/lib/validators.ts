import { z } from "zod";
import { leadStatusValues } from "@/lib/leads";

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
