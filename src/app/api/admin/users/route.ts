import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  messageUsername: z.string().trim().max(80, "Nome de mensagem muito longo.").optional().default(""),
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  role: z.enum(UserRole),
  active: z.boolean().default(true),
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

export async function POST(request: Request) {
  const { response } = await requireAdminUser(["ADMIN"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await prisma.$queryRaw<AdminUserResponse[]>`
    INSERT INTO "User" ("id", "name", "messageUsername", "email", "passwordHash", "role", "active", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      ${parsed.data.name},
      ${parsed.data.messageUsername || parsed.data.name},
      ${parsed.data.email},
      ${passwordHash},
      CAST(${parsed.data.role} AS "UserRole"),
      ${parsed.data.active},
      NOW(),
      NOW()
    )
    RETURNING "id", "name", "messageUsername", "email", "role", "active", "createdAt"
  `;

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
