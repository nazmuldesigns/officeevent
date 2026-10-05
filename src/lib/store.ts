import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sheetsBackend, type LiveConfig } from "@/lib/api/sheets-client";
import { DEFAULT_SCRIPT_URL } from "@/lib/constants";
import type {
  Attendee,
  CheckinResult,
  ConnectionMode,
  DashboardStats,
  Gate,
  SyncStatus,
} from "@/lib/types";
import { GATES } from "@/lib/types";
import { normalizeId } from "@/lib/utils";

export type SettingsState = {
  scriptUrl: string;
  apiKey: string;
  mode: ConnectionMode;
  gate: Gate;
  staffName: string;
  soundEnabled: boolean;
  theme: "dark" | "light";
  setScriptUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setGate: (value: Gate) => void;
  setStaffName: (value: string) => void;
  setSoundEnabled: (value: boolean) => void;
  setTheme: (value: "dark" | "light") => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      scriptUrl: DEFAULT_SCRIPT_URL,
      apiKey: "",
      mode: "live",
      gate: "Gate 1",
      staffName: "",
      soundEnabled: true,
      theme: "dark",
      setScriptUrl: (scriptUrl) => set({ scriptUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setGate: (gate) => set({ gate }),
      setStaffName: (staffName) => set({ staffName }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "nrb-world-settings-v3" },
  ),
);

type RegistryState = {
  attendees: Attendee[];
  recent: Attendee[];
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  syncError: string | null;
  inflight: Record<string, true>;
  hydrate: (rows: Attendee[]) => void;
  upsert: (row: Attendee) => void;
  pushRecent: (row: Attendee) => void;
  setSync: (patch: Partial<Pick<RegistryState, "syncStatus" | "lastSyncAt" | "syncError">>) => void;
  markInflight: (id: string, on: boolean) => void;
};

export const useRegistry = create<RegistryState>((set, get) => ({
  attendees: [],
  recent: [],
  syncStatus: "idle",
  lastSyncAt: null,
  syncError: null,
  inflight: {},
  hydrate: (rows) =>
    set({
      attendees: rows,
      recent: rows
        .filter((row) => row.entryStatus === "ENTERED" && row.entryTime)
        .sort((a, b) => (b.entryTime ?? "").localeCompare(a.entryTime ?? ""))
        .slice(0, 30),
    }),
  upsert: (row) => {
    const attendees = get().attendees;
    const index = attendees.findIndex((item) => item.id === row.id);
    const next =
      index >= 0
        ? attendees.map((item, i) => (i === index ? row : item))
        : [row, ...attendees];
    set({ attendees: next });
  },
  pushRecent: (row) =>
    set({
      recent: [row, ...get().recent.filter((item) => item.id !== row.id)].slice(0, 30),
    }),
  setSync: (patch) => set(patch),
  markInflight: (id, on) => {
    const inflight = { ...get().inflight };
    if (on) inflight[id] = true;
    else delete inflight[id];
    set({ inflight });
  },
}));

function liveConfig(): LiveConfig {
  const { scriptUrl, apiKey } = useSettings.getState();
  return {
    scriptUrl: scriptUrl?.trim() || DEFAULT_SCRIPT_URL,
    apiKey,
  };
}

export function computeStats(attendees: Attendee[]): DashboardStats {
  const checkedIn = attendees.filter((row) => row.entryStatus === "ENTERED").length;
  return {
    totalRegistered: attendees.length,
    checkedIn,
    remaining: Math.max(0, attendees.length - checkedIn),
    newEntries: attendees.filter((row) => row.registrationStatus === "NEW ENTRY").length,
  };
}

export async function syncRegistry(): Promise<boolean> {
  const registry = useRegistry.getState();
  registry.setSync({ syncStatus: "syncing", syncError: null });
  try {
    const result = await sheetsBackend.list(liveConfig());
    if (!result.ok) {
      useRegistry.getState().setSync({
        syncStatus: "error",
        syncError: result.error,
      });
      return false;
    }
    useRegistry.getState().hydrate(result.attendees);
    useRegistry.getState().setSync({
      syncStatus: "ok",
      lastSyncAt: new Date().toISOString(),
      syncError: null,
    });
    return true;
  } catch (error) {
    useRegistry.getState().setSync({
      syncStatus: "offline",
      syncError: error instanceof Error ? error.message : "Network sync failed",
    });
    return false;
  }
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const { scriptUrl } = useSettings.getState();
  const url = scriptUrl?.trim() || DEFAULT_SCRIPT_URL;
  if (!url) {
    return { ok: false, message: "Apps Script web app URL is missing." };
  }
  const result = await sheetsBackend.ping(liveConfig());
  if (!result.ok) return { ok: false, message: result.error };
  return {
    ok: true,
    message: `Connected to Google Sheet tab: "${result.sheet || "Registrations"}" (${result.rows || 0} rows found)`,
  };
}

function fromCache(id: string): Attendee | undefined {
  return useRegistry.getState().attendees.find((row) => row.id === id);
}

/**
 * Real-time check-in with Google Sheets backend.
 */
export async function verifyAndCheckIn(rawId: string): Promise<CheckinResult> {
  const id = normalizeId(rawId);
  if (!id) return { kind: "error", id: rawId, message: "Enter a valid attendee ID." };

  const { inflight } = useRegistry.getState();
  if (inflight[id]) {
    return { kind: "error", id, message: "This ID is currently being processed." };
  }

  useRegistry.getState().markInflight(id, true);
  const { gate, staffName } = useSettings.getState();

  try {
    const cached = fromCache(id);
    if (cached?.entryStatus === "ENTERED") {
      return { kind: "already", attendee: cached };
    }

    const written = await sheetsBackend.checkIn(liveConfig(), {
      id,
      gate: gate || "Gate 1",
      checkedBy: staffName || "Staff",
    });

    if (!written.ok) {
      return { kind: "error", id, message: written.error, attendee: cached };
    }

    if (written.result === "not_registered") {
      return { kind: "missing", id };
    }

    if (written.result === "already" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      return { kind: "already", attendee: written.attendee };
    }

    if (written.result === "verified" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      useRegistry.getState().pushRecent(written.attendee);
      return { kind: "verified", attendee: written.attendee };
    }

    return {
      kind: "error",
      id,
      message: "Google Sheets did not confirm the check-in.",
      attendee: cached,
    };
  } finally {
    useRegistry.getState().markInflight(id, false);
  }
}

export async function addAndCheckIn(input: {
  id: string;
  name: string;
  country: string;
}): Promise<CheckinResult> {
  const id = normalizeId(input.id);
  const name = input.name.trim();
  const country = input.country.trim();
  if (!id || !name || !country) {
    return { kind: "error", id: input.id, message: "ID, name, and country are required." };
  }

  const { gate, staffName } = useSettings.getState();
  useRegistry.getState().markInflight(id, true);
  try {
    const written = await sheetsBackend.newEntry(liveConfig(), {
      id,
      name,
      country,
      gate: gate || "Gate 1",
      checkedBy: staffName || "Staff",
    });

    if (!written.ok) return { kind: "error", id, message: written.error };

    if (written.result === "already" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      return { kind: "already", attendee: written.attendee };
    }

    if (written.result === "verified" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      useRegistry.getState().pushRecent(written.attendee);
      return { kind: "verified", attendee: written.attendee };
    }

    return { kind: "error", id, message: "Google Sheets did not confirm the new entry." };
  } finally {
    useRegistry.getState().markInflight(id, false);
  }
}
