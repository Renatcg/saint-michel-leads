import { cookies } from "next/headers";
import type { Route } from "next";
import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@prisma/client";

export const AUTH_COOKIE = "saint_michel_admin_token";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

const encoder = new TextEncoder();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return encoder.encode(secret);
}

function getExpiration() {
  return process.env.JWT_EXPIRES_IN ?? "1d";
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(getExpiration())
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    if (!payload.sub || !payload.email || !payload.name || !payload.role) {
      return null;
    }

    return {
      id: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function canManageUsers(role: UserRole) {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canEditLeads(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";
}

export function canAccessManagement(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";
}

export function getAdminNavItems(role: UserRole): Array<{ href: Route; label: string }> {
  if (role === "BROKER" || role === "VIEWER") {
    return [
      { href: "/admin/leads", label: "Leads" },
      { href: "/admin/chat", label: "Chat" },
    ];
  }

  const items: Array<{ href: Route; label: string }> = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/landing", label: "Landing" },
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/chat", label: "Chat" },
    { href: "/admin/schedule", label: "Escala" },
    { href: "/admin/messages", label: "Mensagens" },
    { href: "/admin/integrations", label: "Integrações" },
  ];

  if (role === "ADMIN" || role === "SUPERVISOR") {
    items.splice(4, 0, { href: "/admin/users", label: "Usuários" });
  }

  return items;
}
