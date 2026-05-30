import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  messageUsername: z.string().trim().max(80, "Nome de mensagem muito longo.").optional().default(""),
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").optional().or(z.literal("")),
  role: z.enum(UserRole),
  active: z.boolean(),
});

type AdminUserResponse = {
  id: string;
  name: string;
  messageUsername: string | null;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { response } = await requireAdminUser(["ADMIN"]);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const current = await prisma.user.findUnique({ where: { id } });

  if (!current) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (current.role === "ADMIN" && (parsed.data.role !== "ADMIN" || !parsed.data.active)) {
    const activeAdmins = await prisma.user.count({
      where: {
        role: "ADMIN",
        active: true,
        id: { not: id },
      },
    });

    if (activeAdmins === 0 && (parsed.data.role !== "ADMIN" || !parsed.data.active)) {
      return NextResponse.json({ error: "Não é possível remover ou desativar o último admin ativo." }, { status: 400 });
    }
  }

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;
  const [user] = passwordHash
    ? await prisma.$queryRaw<AdminUserResponse[]>`
        UPDATE "User"
        SET
          "name" = ${parsed.data.name},
          "messageUsername" = ${parsed.data.messageUsername || parsed.data.name},
          "email" = ${parsed.data.email},
          "role" = CAST(${parsed.data.role} AS "UserRole"),
          "active" = ${parsed.data.active},
          "passwordHash" = ${passwordHash},
          "updatedAt" = NOW()
        WHERE "id" = ${id}
        RETURNING "id", "name", "messageUsername", "email", "role", "active", "createdAt"
      `
    : await prisma.$queryRaw<AdminUserResponse[]>`
        UPDATE "User"
        SET
          "name" = ${parsed.data.name},
          "messageUsername" = ${parsed.data.messageUsername || parsed.data.name},
          "email" = ${parsed.data.email},
          "role" = CAST(${parsed.data.role} AS "UserRole"),
          "active" = ${parsed.data.active},
          "updatedAt" = NOW()
        WHERE "id" = ${id}
        RETURNING "id", "name", "messageUsername", "email", "role", "active", "createdAt"
      `;

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { response } = await requireAdminUser(["ADMIN"]);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const prisma = getPrisma();
  const current = await prisma.user.findUnique({ where: { id } });

  if (!current) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (current.role === "ADMIN" && current.active) {
    const activeAdmins = await prisma.user.count({
      where: {
        role: "ADMIN",
        active: true,
        id: { not: id },
      },
    });

    if (activeAdmins === 0) {
      return NextResponse.json({ error: "Não é possível excluir o último admin ativo." }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
