import type { Attendee, EventDay, GasResponse, PassType } from "@/lib/types";

const TIMEOUT_MS = 5_000;

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

function parsePassType(val: unknown): PassType {
  const s = String(val ?? "").toLowerCase().trim();
  if (s.includes("1") && !s.includes("2") && !s.includes("both")) return "Day 1 Only";
  if (s.includes("2") && !s.includes("1") && !s.includes("both")) return "Day 2 Only";
  return "Both Days";
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

  const passType = parsePassType(row.passType || row.pass || row.ticketType || row.type);

  const d1 =
    String(row.day1Status ?? row.entryStatus ?? "NOT ENTERED").toUpperCase() === "ENTERED"
      ? "ENTERED"
      : "NOT ENTERED";
  const d2 = String(row.day2Status ?? "NOT ENTERED").toUpperCase() === "ENTERED"
    ? "ENTERED"
    : "NOT ENTERED";
  const d1Time = row.day1Time ? String(row.day1Time) : (row.entryTime ? String(row.entryTime) : null);
  const d2Time = row.day2Time ? String(row.day2Time) : null;

  return {
    id,
    name: String(row.name ?? "").trim(),
    country: String(row.country ?? "").trim(),
    passType,
    registrationStatus,
    entryStatus: d1 === "ENTERED" || d2 === "ENTERED" ? "ENTERED" : "NOT ENTERED",
    entryTime: d2Time || d1Time,
    day1Status: d1,
    day1Time: d1Time,
    day2Status: d2,
    day2Time: d2Time,
    entryGate: row.entryGate ? String(row.entryGate) : null,
    checkedBy: row.checkedBy ? String(row.checkedBy) : null,
  };
}

function gasJsonp<T>(url: string, timeoutMs: number): Promise<GasResponse<T>> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !document?.head) {
      resolve({ ok: false, error: "Browser environment required for JSONP.", code: "network" });
      return;
    }
    const callbackName = `_gas_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      settled = true;
      try {
        if ((window as unknown as Record<string, unknown>)[callbackName]) {
          delete (window as unknown as Record<string, unknown>)[callbackName];
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch {
        /* cleanup safe */
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      cleanup();
      resolve({
        ok: false,
        error: "Google Sheets request timed out. Please check deployment access ('Execute as: Me', 'Who has access: Anyone').",
        code: "network",
      });
    }, timeoutMs);

    (window as unknown as Record<string, (data: GasResponse<T>) => void>)[callbackName] = (data: GasResponse<T>) => {
      if (settled) return;
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      window.clearTimeout(timer);
      cleanup();
      resolve({
        ok: false,
        error: "Google Apps Script Access Error: In Apps Script, set 'Execute as' to 'Me' and 'Who has access' to 'Anyone'.",
        code: "network",
      });
    };

    const delim = url.includes("?") ? "&" : "?";
    script.src = `${url}${delim}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

async function gasGet<T>(
  config: LiveConfig,
  params: Record<string, string>,
): Promise<GasResponse<T>> {
  const rawUrl = config.scriptUrl?.trim();
  if (!rawUrl) {
    return { ok: false, error: "Google Apps Script URL is missing.", code: "config" };
  }

  const query = {
    ...params,
    ...(config.apiKey ? { key: config.apiKey } : {}),
  };
  const url = withParams(rawUrl, query);
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
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error: "Permission Denied: In Apps Script, set 'Execute as: Me' and 'Who has access: Anyone'.",
          code: "auth",
        };
      }
      return {
        ok: false,
        error: `Google Sheets responded with HTTP status ${response.status}.`,
        code: "server",
      };
    }

    const text = await response.text();
    if (
      text.includes("<!DOCTYPE") ||
      text.includes("<html") ||
      text.includes("accounts.google.com") ||
      text.includes("ServiceLogin") ||
      text.includes("আপনাকে অ্যাক্সেস পেতে হবে")
    ) {
      return {
        ok: false,
        error: "Google Apps Script Access Error: In Apps Script, click Deploy -> Manage Deployments -> Edit -> set 'Execute as' to 'Me' and 'Who has access' to 'Anyone'.",
        code: "auth",
      };
    }

    try {
      const data = JSON.parse(text) as GasResponse<T>;
      if (!data || typeof data !== "object") {
        return { ok: false, error: "Unexpected Google Sheets response format.", code: "server" };
      }
      return data;
    } catch {
      return gasJsonp<T>(url, 4_500);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "Google Sheets request timed out.", code: "network" };
    }
    // Try JSONP fallback
    return gasJsonp<T>(url, 4_500);
  } finally {
    window.clearTimeout(timer);
  }
}

export const sheetsBackend = {
  async ping(config: LiveConfig) {
    return gasGet<{ now: string; sheet: string; rows?: number }>(config, { action: "health" });
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
    input: { id: string; gate: string; checkedBy: string; day: EventDay },
  ) {
    const result = await gasGet<{
      result: string;
      attendee?: unknown;
      id?: string;
      reason?: string;
    }>(config, {
      action: "checkin",
      id: input.id,
      gate: input.gate,
      checkedBy: input.checkedBy,
      day: String(input.day),
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      result: result.result as "verified" | "already" | "invalid_day" | "not_registered",
      attendee: result.attendee ? asAttendee(result.attendee) : null,
      id: result.id,
      reason: result.reason,
    };
  },

  async newEntry(
    config: LiveConfig,
    input: {
      id: string;
      name: string;
      country: string;
      passType: PassType;
      gate: string;
      checkedBy: string;
      day: EventDay;
    },
  ) {
    const result = await gasGet<{ result: string; attendee?: unknown }>(config, {
      action: "newEntry",
      id: input.id,
      name: input.name,
      country: input.country,
      passType: input.passType,
      gate: input.gate,
      checkedBy: input.checkedBy,
      day: String(input.day),
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      result: result.result as "verified" | "already",
      attendee: result.attendee ? asAttendee(result.attendee) : null,
    };
  },

  async undoCheckIn(
    config: LiveConfig,
    input: { id: string; day: EventDay },
  ) {
    const result = await gasGet<{ result: string; attendee?: unknown; message?: string }>(config, {
      action: "undoCheckin",
      id: input.id,
      day: String(input.day),
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      message: result.message || "Check-in undone successfully.",
      attendee: result.attendee ? asAttendee(result.attendee) : null,
    };
  },
};
