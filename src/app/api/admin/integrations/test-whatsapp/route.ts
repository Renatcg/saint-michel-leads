import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { normalizeWhatsappNumber, sendEvolutionTextMessage } from "@/lib/integrations";

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
    const data = await sendEvolutionTextMessage({
      number: parsed.data.number,
      text: parsed.data.text,
    });

    return NextResponse.json({
      ok: true,
      number: normalizeWhatsappNumber(parsed.data.number),
      providerId: data?.key?.id,
      status: data?.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar a mensagem de teste.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
