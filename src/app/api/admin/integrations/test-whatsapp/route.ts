import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getActiveWhatsappProvider, normalizeWhatsappNumber, sendWhatsappTextMessage } from "@/lib/integrations";

const testWhatsAppSchema = z.object({
  number: z.string().trim().min(10, "Informe um WhatsApp válido."),
  text: z.string().trim().min(2, "Informe uma mensagem."),
});

export async function POST(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = testWhatsAppSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const provider = await getActiveWhatsappProvider();
    const data = await sendWhatsappTextMessage({
      number: parsed.data.number,
      text: parsed.data.text,
    });

    return NextResponse.json({
      ok: true,
      number: normalizeWhatsappNumber(parsed.data.number),
      provider,
      providerId: extractProviderMessageId(data),
      status: getProviderStatus(data),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar a mensagem de teste.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function extractProviderMessageId(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  const key = record.key && typeof record.key === "object" ? (record.key as Record<string, unknown>) : null;

  return typeof key?.id === "string"
    ? key.id
    : typeof record.id === "string"
      ? record.id
      : typeof record.messageId === "string"
        ? record.messageId
        : null;
}

function getProviderStatus(result: unknown) {
  return result && typeof result === "object" && "status" in result ? String((result as { status?: unknown }).status ?? "") : "";
}
