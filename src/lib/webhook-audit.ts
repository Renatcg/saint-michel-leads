import { getPrisma } from "@/lib/prisma";

type WebhookAuditInput = {
  provider: string;
  providerId: string | null;
  phone: string | null;
  fromMe: boolean | null;
  eventType: string | null;
  parsed: boolean;
  saved: boolean | null;
  reason: string | null;
  payloadKeys: string[];
};

type WebhookAuditRow = {
  id: string;
  provider: string;
  providerId: string | null;
  phoneSuffix: string | null;
  fromMe: boolean | null;
  eventType: string | null;
  parsed: boolean;
  saved: boolean | null;
  reason: string | null;
  payloadKeys: unknown;
  createdAt: Date;
};

export async function recordWebhookAudit(input: WebhookAuditInput) {
  const prisma = getPrisma();

  await ensureWebhookAuditTable();

  await prisma.$executeRaw`
    INSERT INTO "WebhookAudit" (
      "provider",
      "providerId",
      "phoneSuffix",
      "fromMe",
      "eventType",
      "parsed",
      "saved",
      "reason",
      "payloadKeys"
    )
    VALUES (
      ${input.provider},
      ${input.providerId},
      ${input.phone ? input.phone.replace(/\D/g, "").slice(-4) : null},
      ${input.fromMe},
      ${input.eventType},
      ${input.parsed},
      ${input.saved},
      ${input.reason},
      ${JSON.stringify(input.payloadKeys.slice(0, 30))}
    )
  `;
}

export async function listWebhookAudits(limit = 20) {
  const prisma = getPrisma();

  await ensureWebhookAuditTable();

  const rows = await prisma.$queryRaw<WebhookAuditRow[]>`
    SELECT
      "id",
      "provider",
      "providerId",
      "phoneSuffix",
      "fromMe",
      "eventType",
      "parsed",
      "saved",
      "reason",
      "payloadKeys",
      "createdAt"
    FROM "WebhookAudit"
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row: WebhookAuditRow) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    payloadKeys: parsePayloadKeys(row.payloadKeys),
  }));
}

async function ensureWebhookAuditTable() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WebhookAudit" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "provider" TEXT NOT NULL,
      "providerId" TEXT,
      "phoneSuffix" TEXT,
      "fromMe" BOOLEAN,
      "eventType" TEXT,
      "parsed" BOOLEAN NOT NULL DEFAULT false,
      "saved" BOOLEAN,
      "reason" TEXT,
      "payloadKeys" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "WebhookAudit_provider_createdAt_idx"
    ON "WebhookAudit" ("provider", "createdAt" DESC)
  `);
}

function parsePayloadKeys(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
}
