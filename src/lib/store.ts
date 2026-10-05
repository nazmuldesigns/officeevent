import { create } from "zustand";
import { persist } from "zustand/middleware";
import { demoBackend, resetDemoStore } from "@/lib/api/demo-store";
import { sheetsBackend, type LiveConfig } from "@/lib/api/sheets-client";
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
  setMode: (value: ConnectionMode) => void;
  setGate: (value: Gate) => void;
  setStaffName: (value: string) => void;
  setSoundEnabled: (value: boolean) => void;
  setTheme: (value: "dark" | "light") => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      scriptUrl: "",
      apiKey: "",
      mode: "demo",
      gate: "Gate 1",
      staffName: "",
      soundEnabled: true,
      theme: "dark",
      setScriptUrl: (scriptUrl) => set({ scriptUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setMode: (mode) => set({ mode }),
      setGate: (gate) => set({ gate: GATES.includes(gate) ? gate : "Gate 1" }),
      setStaffName: (staffName) => set({ staffName }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "gateflow-settings" },
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
        .slice(0, 24),
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
      recent: [row, ...get().recent.filter((item) => item.id !== row.id)].slice(0, 24),
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
  return { scriptUrl, apiKey };
}

export function computeStats(attendees: Attendee[]): DashboardStats {
  const checkedIn = attendees.filter((row) => row.entryStatus === "ENTERED").length;
  return {
    totalRegistered: attendees.length,
    checkedIn,
    remaining: attendees.length - checkedIn,
    newEntries: attendees.filter((row) => row.registrationStatus === "NEW ENTRY")
      .length,
  };
}

export async function syncRegistry(): Promise<boolean> {
  const { mode } = useSettings.getState();
  const registry = useRegistry.getState();
  registry.setSync({ syncStatus: "syncing", syncError: null });
  try {
    if (mode === "demo") {
      const rows = await demoBackend.list();
      useRegistry.getState().hydrate(rows);
      useRegistry.getState().setSync({
        syncStatus: "ok",
        lastSyncAt: new Date().toISOString(),
        syncError: null,
      });
      return true;
    }
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
      syncError: error instanceof Error ? error.message : "Sync failed",
    });
    return false;
  }
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const { scriptUrl } = useSettings.getState();
  if (!scriptUrl.trim()) {
    return { ok: false, message: "Paste your Apps Script web app URL first." };
  }
  const result = await sheetsBackend.ping(liveConfig());
  if (!result.ok) return { ok: false, message: result.error };
  return {
    ok: true,
    message: `Connected to ${result.sheet || "Registrations"} · ${result.now}`,
  };
}

export async function resetDemo(): Promise<void> {
  resetDemoStore();
  await syncRegistry();
}

function fromCache(id: string): Attendee | undefined {
  return useRegistry.getState().attendees.find((row) => row.id === id);
}

/**
 * Check-in is never optimistic. GREEN is shown only after the backend
 * confirms the write. Cache is used to skip a round-trip on already-entered
 * IDs and to fill the UI while lookup is in flight — never to claim a save.
 */
export async function verifyAndCheckIn(rawId: string): Promise<CheckinResult> {
  const id = normalizeId(rawId);
  if (!id) return { kind: "error", id: rawId, message: "Enter a valid ID." };

  const { inflight } = useRegistry.getState();
  if (inflight[id]) {
    return { kind: "error", id, message: "This ID is already being processed." };
  }

  useRegistry.getState().markInflight(id, true);
  const { mode } = useSettings.getState();
  const { gate, staffName } = useSettings.getState();

  try {
    if (mode === "demo") {
      const found = await demoBackend.lookup(id);
      if (!found) return { kind: "missing", id };
      if (found.entryStatus === "ENTERED") {
        useRegistry.getState().upsert(found);
        return { kind: "already", attendee: found };
      }
      const written = await demoBackend.checkIn({
        id,
        gate,
        checkedBy: staffName,
      });
      if (written.result === "not_registered") return { kind: "missing", id };
      if (written.result === "already") {
        useRegistry.getState().upsert(written.attendee);
        return { kind: "already", attendee: written.attendee };
      }
      useRegistry.getState().upsert(written.attendee);
      useRegistry.getState().pushRecent(written.attendee);
      return { kind: "verified", attendee: written.attendee };
    }

    const cached = fromCache(id);
    if (cached?.entryStatus === "ENTERED") {
      return { kind: "already", attendee: cached };
    }

    const lookup = await sheetsBackend.lookup(liveConfig(), id);
    if (!lookup.ok) {
      return { kind: "error", id, message: lookup.error, attendee: cached };
    }
    if (!lookup.found || !lookup.attendee) return { kind: "missing", id };
    if (lookup.attendee.entryStatus === "ENTERED") {
      useRegistry.getState().upsert(lookup.attendee);
      return { kind: "already", attendee: lookup.attendee };
    }

    const written = await sheetsBackend.checkIn(liveConfig(), {
      id,
      gate,
      checkedBy: staffName,
    });
    if (!written.ok) {
      return { kind: "error", id, message: written.error, attendee: lookup.attendee };
    }
    if (written.result === "not_registered") return { kind: "missing", id };
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
      attendee: lookup.attendee,
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

  const { mode, gate, staffName } = useSettings.getState();
  useRegistry.getState().markInflight(id, true);
  try {
    if (mode === "demo") {
      const written = await demoBackend.newEntry({
        id,
        name,
        country,
        gate,
        checkedBy: staffName,
      });
      if (written.result === "already") {
        useRegistry.getState().upsert(written.attendee);
        return { kind: "already", attendee: written.attendee };
      }
      useRegistry.getState().upsert(written.attendee);
      useRegistry.getState().pushRecent(written.attendee);
      return { kind: "verified", attendee: written.attendee };
    }

    const written = await sheetsBackend.newEntry(liveConfig(), {
      id,
      name,
      country,
      gate,
      checkedBy: staffName,
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
