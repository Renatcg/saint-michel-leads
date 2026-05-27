import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function requireAdminUser(allowedRoles?: UserRole[]) {
  const session = await getCurrentUser();

  if (!session) {
    return {
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
      user: null,
    };
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
    },
  });

  if (!user?.active) {
    return {
      response: NextResponse.json({ error: "Usuário inativo." }, { status: 403 }),
      user: null,
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
      user: null,
    };
  }

  return {
    response: null,
    user,
  };
}
