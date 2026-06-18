import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getEvolutionRuntimeSettings, getWuzRuntimeSettings } from "@/lib/integrations";

const WUZ_WEBHOOK_URL = "https://saint-michel-leads.vercel.app/api/wuz/webhook";
const WUZ_WEBHOOK_EVENTS = ["Message", "HistorySync", "ChatPresence"];

export async function GET() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const [evolution, wuz] = await Promise.all([getEvolutionStatus(), getWuzStatus()]);

  return NextResponse.json({
    ok: true,
    evolution,
    wuz,
  });
}

export async function POST() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const result = await setWuzWebhook();

  return NextResponse.json({
    ok: result.ok,
    wuz: result,
  }, { status: result.ok ? 200 : 400 });
}

async function getEvolutionStatus() {
  const settings = await getEvolutionRuntimeSettings();

  if (!settings) {
    return { configured: false, ok: false, error: "Evolution API não configurada." };
  }

  const baseUrl = settings.apiUrl.replace(/\/+$/, "");
  const candidates = Array.from(new Set([baseUrl, `${baseUrl}/api`, baseUrl.replace(/\/api$/i, "")]));

  for (const candidate of candidates) {
    const response: Response | Error = await fetch(`${candidate}/instance/connectionState/${encodeURIComponent(settings.instanceName)}`, {
      headers: {
        apikey: settings.apiKey,
      },
      cache: "no-store",
    }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

    if (response instanceof Error) {
      continue;
    }

    const payload = await response.json().catch(() => null);

    if (response.status === 404) {
      continue;
    }

    return {
      configured: true,
      ok: response.ok,
      status: response.status,
      state: extractEvolutionState(payload),
      error: response.ok ? null : extractError(payload) || `Evolution API retornou status ${response.status}.`,
    };
  }

  return {
    configured: true,
    ok: false,
    status: 404,
    state: null,
    error: "Evolution API retornou Not Found para a instância configurada.",
  };
}

async function getWuzStatus() {
  const settings = await getWuzRuntimeSettings();

  if (!settings) {
    return { configured: false, ok: false, error: "WUZ não configurada." };
  }

  const [session, webhook] = await Promise.all([
    fetch(`${getWuzRequestBaseUrl(settings.apiUrl)}/session/status`, {
      headers: {
        token: settings.apiToken,
      },
      cache: "no-store",
    }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error)))),
    getWuzWebhook(settings),
  ]);

  const response: Response | Error = session;

  if (response instanceof Error) {
    return {
      configured: true,
      ok: false,
      status: null,
      state: null,
      webhook,
      error: response.message,
    };
  }

  const payload = await response.json().catch(() => null);

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    state: extractWuzState(payload),
    webhook,
    error: response.ok ? null : extractError(payload) || `WUZ retornou status ${response.status}.`,
  };
}

async function getWuzWebhook(settings: NonNullable<Awaited<ReturnType<typeof getWuzRuntimeSettings>>>) {
  const response: Response | Error = await fetch(`${getWuzRequestBaseUrl(settings.apiUrl)}/webhook`, {
    headers: {
      token: settings.apiToken,
    },
    cache: "no-store",
  }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

  if (response instanceof Error) {
    return {
      ok: false,
      status: null,
      error: response.message,
    };
  }

  const payload = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    webhook: extractWuzWebhookUrl(payload),
    events: extractWuzWebhookEvents(payload),
    hasMessageEvent: hasWuzMessageEvent(extractWuzWebhookEvents(payload)),
    isExpectedUrl: extractWuzWebhookUrl(payload) === WUZ_WEBHOOK_URL,
    error: response.ok ? null : extractError(payload) || `WUZ webhook retornou status ${response.status}.`,
  };
}

async function setWuzWebhook() {
  const settings = await getWuzRuntimeSettings();

  if (!settings) {
    return { configured: false, ok: false, error: "WUZ não configurada." };
  }

  const response: Response | Error = await fetch(`${getWuzRequestBaseUrl(settings.apiUrl)}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: settings.apiToken,
    },
    body: JSON.stringify({
      webhook: WUZ_WEBHOOK_URL,
      WebhookURL: WUZ_WEBHOOK_URL,
      events: WUZ_WEBHOOK_EVENTS,
      Events: WUZ_WEBHOOK_EVENTS,
      Active: true,
    }),
    cache: "no-store",
  }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

  if (response instanceof Error) {
    return {
      configured: true,
      ok: false,
      error: response.message,
    };
  }

  const payload = await response.json().catch(() => null);

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    webhook: extractWuzWebhookUrl(payload) || WUZ_WEBHOOK_URL,
    events: extractWuzWebhookEvents(payload),
    error: response.ok ? null : extractError(payload) || `WUZ webhook retornou status ${response.status}.`,
  };
}

function extractEvolutionState(payload: unknown) {
  const record = getRecord(payload);
  const instance = getRecord(record?.instance);

  return getString(record?.state) || getString(instance?.state) || getString(record?.connectionState) || null;
}

function extractWuzState(payload: unknown) {
  const record = getRecord(payload);
  const data = getRecord(record?.data);

  return (
    getString(record?.state) ||
    getString(record?.status) ||
    getString(record?.connection) ||
    getString(data?.state) ||
    getString(data?.status) ||
    getString(data?.connection) ||
    null
  );
}

function extractError(payload: unknown) {
  const record = getRecord(payload);
  const data = getRecord(record?.data);

  return getString(record?.error) || getString(record?.message) || getString(record?.Details) || getString(data?.error) || getString(data?.message) || null;
}

function extractWuzWebhookUrl(payload: unknown) {
  const record = getRecord(payload);
  const data = getRecord(record?.data);

  return (
    getString(data?.webhook) ||
    getString(data?.WebhookURL) ||
    getString(data?.Webhook) ||
    getString(data?.url) ||
    getString(data?.URL) ||
    getString(data?.webhook_url) ||
    getString(record?.webhook) ||
    getString(record?.WebhookURL) ||
    getString(record?.Webhook) ||
    getString(record?.url) ||
    getString(record?.URL) ||
    getString(record?.webhook_url) ||
    null
  );
}

function extractWuzWebhookEvents(payload: unknown) {
  const record = getRecord(payload);
  const data = getRecord(record?.data);
  const candidates = [data?.subscribe, data?.events, data?.Events, record?.subscribe, record?.events, record?.Events];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is string => typeof item === "string");
    }
  }

  return [];
}

function hasWuzMessageEvent(events: string[]) {
  return events.some((event) => event === "Message" || event === "All");
}

function getWuzRequestBaseUrl(apiUrl: string) {
  return apiUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
}

function getRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
