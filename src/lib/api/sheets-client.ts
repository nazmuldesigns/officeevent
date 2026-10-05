import type { Attendee, GasResponse } from "@/lib/types";

const TIMEOUT_MS = 12_000;

export type LiveConfig = {
  scriptUrl: string;
  apiKey: string;
};

function withParams(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function asAttendee(raw: unknown): Attendee | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim().toUpperCase();
  if (!id) return null;
  const registrationStatus =
    String(row.registrationStatus ?? "REGISTERED").toUpperCase() === "NEW ENTRY"
      ? "NEW ENTRY"
      : "REGISTERED";
  const entryStatus =
    String(row.entryStatus ?? "NOT ENTERED").toUpperCase() === "ENTERED"
      ? "ENTERED"
      : "NOT ENTERED";
  return {
    id,
    name: String(row.name ?? "").trim(),
    country: String(row.country ?? "").trim(),
    registrationStatus,
    entryStatus,
    entryTime: row.entryTime ? String(row.entryTime) : null,
    entryGate: row.entryGate ? String(row.entryGate) : null,
    checkedBy: row.checkedBy ? String(row.checkedBy) : null,
  };
}

async function gasGet<T>(
  config: LiveConfig,
  params: Record<string, string>,
): Promise<GasResponse<T>> {
  if (!config.scriptUrl.trim()) {
    return { ok: false, error: "Google Apps Script URL is missing.", code: "config" };
  }

  const query = {
    ...params,
    ...(config.apiKey ? { key: config.apiKey } : {}),
  };
  const url = withParams(config.scriptUrl.trim(), query);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Google Sheets responded ${response.status}.`,
        code: "server",
      };
    }
    const data = (await response.json()) as GasResponse<T>;
    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected Google Sheets response.", code: "server" };
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "Google Sheets timed out.", code: "network" };
    }
    return {
      ok: false,
      error:
        "Could not reach Google Sheets. Check the deployment URL, access (Anyone), and your network.",
      code: "network",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export const sheetsBackend = {
  async ping(config: LiveConfig) {
    return gasGet<{ now: string; sheet: string }>(config, { action: "health" });
  },

  async list(config: LiveConfig) {
    const result = await gasGet<{ attendees: unknown[] }>(config, { action: "list" });
    if (!result.ok) return result;
    return {
      ok: true as const,
      attendees: (result.attendees ?? []).map(asAttendee).filter(Boolean) as Attendee[],
    };
  },

  async lookup(config: LiveConfig, id: string) {
    const result = await gasGet<{ found: boolean; attendee?: unknown }>(config, {
      action: "lookup",
      id,
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      found: Boolean(result.found),
      attendee: result.attendee ? asAttendee(result.attendee) : null,
    };
  },

  async checkIn(
    config: LiveConfig,
    input: { id: string; gate: string; checkedBy: string },
  ) {
    const result = await gasGet<{ result: string; attendee?: unknown; id?: string }>(
      config,
      {
        action: "checkin",
        id: input.id,
        gate: input.gate,
        checkedBy: input.checkedBy,
      },
    );
    if (!result.ok) return result;
    return {
      ok: true as const,
      result: result.result as "verified" | "already" | "not_registered",
      attendee: result.attendee ? asAttendee(result.attendee) : null,
      id: result.id,
    };
  },

  async newEntry(
    config: LiveConfig,
    input: {
      id: string;
      name: string;
      country: string;
      gate: string;
      checkedBy: string;
    },
  ) {
    const result = await gasGet<{ result: string; attendee?: unknown }>(config, {
      action: "newEntry",
      id: input.id,
      name: input.name,
      country: input.country,
      gate: input.gate,
      checkedBy: input.checkedBy,
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      result: result.result as "verified" | "already",
      attendee: result.attendee ? asAttendee(result.attendee) : null,
    };
  },
};
