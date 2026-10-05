import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sheetsBackend, type LiveConfig } from "@/lib/api/sheets-client";
import { DEFAULT_SCRIPT_URL } from "@/lib/constants";
import type {
  Attendee,
  CheckinResult,
  ConnectionMode,
  DashboardStats,
  EventDay,
  Gate,
  PassType,
  PendingCheckIn,
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
  eventDay: EventDay;
  soundEnabled: boolean;
  theme: "dark" | "light";
  setScriptUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setGate: (value: Gate) => void;
  setStaffName: (value: string) => void;
  setEventDay: (value: EventDay) => void;
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
      eventDay: 1,
      soundEnabled: true,
      theme: "dark",
      setScriptUrl: (scriptUrl) => set({ scriptUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setGate: (gate) => set({ gate }),
      setStaffName: (staffName) => set({ staffName }),
      setEventDay: (eventDay) => set({ eventDay }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "nrb-world-settings-v4" },
  ),
);

type RegistryState = {
  attendees: Attendee[];
  recent: Attendee[];
  offlineQueue: PendingCheckIn[];
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  syncError: string | null;
  inflight: Record<string, true>;
  hydrate: (rows: Attendee[]) => void;
  upsert: (row: Attendee) => void;
  pushRecent: (row: Attendee) => void;
  enqueueOffline: (item: PendingCheckIn) => void;
  dequeueOffline: (ids: string[]) => void;
  setSync: (patch: Partial<Pick<RegistryState, "syncStatus" | "lastSyncAt" | "syncError">>) => void;
  markInflight: (id: string, on: boolean) => void;
};

export const useRegistry = create<RegistryState>()(
  persist(
    (set, get) => ({
      attendees: [],
      recent: [],
      offlineQueue: [],
      syncStatus: "idle",
      lastSyncAt: null,
      syncError: null,
      inflight: {},
      hydrate: (rows) => {
        const current = get().attendees;
        const lookup = new Map<string, Attendee>();
        for (const item of rows) lookup.set(item.id, item);
        for (const item of current) {
          const fromRemote = lookup.get(item.id);
          if (fromRemote) {
            if (item.day1Status === "ENTERED" && fromRemote.day1Status !== "ENTERED") {
              lookup.set(item.id, { ...fromRemote, day1Status: "ENTERED", day1Time: item.day1Time });
            }
            if (item.day2Status === "ENTERED" && fromRemote.day2Status !== "ENTERED") {
              lookup.set(item.id, { ...fromRemote, day2Status: "ENTERED", day2Time: item.day2Time });
            }
          }
        }
        const merged = Array.from(lookup.values());
        set({
          attendees: merged,
          recent: merged
            .filter((row) => (row.day1Status === "ENTERED" || row.day2Status === "ENTERED") && row.entryTime)
            .sort((a, b) => (b.entryTime ?? "").localeCompare(a.entryTime ?? ""))
            .slice(0, 30),
        });
      },
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
      enqueueOffline: (item) =>
        set({
          offlineQueue: [...get().offlineQueue.filter((q) => q.id !== item.id || q.day !== item.day), item],
        }),
      dequeueOffline: (ids) =>
        set({
          offlineQueue: get().offlineQueue.filter((q) => !ids.includes(q.id)),
        }),
      setSync: (patch) => set(patch),
      markInflight: (id, on) => {
        const inflight = { ...get().inflight };
        if (on) inflight[id] = true;
        else delete inflight[id];
        set({ inflight });
      },
    }),
    {
      name: "nrb-world-registry-v4",
      partialize: (state) => ({
        attendees: state.attendees,
        recent: state.recent,
        offlineQueue: state.offlineQueue,
        lastSyncAt: state.lastSyncAt,
      }),
    },
  ),
);

function liveConfig(): LiveConfig {
  const { scriptUrl, apiKey } = useSettings.getState();
  return {
    scriptUrl: scriptUrl?.trim() || DEFAULT_SCRIPT_URL,
    apiKey,
  };
}

export function computeStats(attendees: Attendee[], activeDay: EventDay = 1): DashboardStats {
  const day1CheckedIn = attendees.filter((row) => row.day1Status === "ENTERED").length;
  const day2CheckedIn = attendees.filter((row) => row.day2Status === "ENTERED").length;
  const activeDayCheckedIn = activeDay === 1 ? day1CheckedIn : day2CheckedIn;

  const bothDaysPasses = attendees.filter((row) => row.passType === "Both Days").length;
  const day1OnlyPasses = attendees.filter((row) => row.passType === "Day 1 Only").length;
  const day2OnlyPasses = attendees.filter((row) => row.passType === "Day 2 Only").length;

  const eligibleForActiveDay = attendees.filter((row) =>
    activeDay === 1
      ? row.passType === "Day 1 Only" || row.passType === "Both Days"
      : row.passType === "Day 2 Only" || row.passType === "Both Days",
  ).length;

  return {
    totalRegistered: attendees.length,
    day1CheckedIn,
    day2CheckedIn,
    activeDayCheckedIn,
    bothDaysPasses,
    day1OnlyPasses,
    day2OnlyPasses,
    remaining: Math.max(0, eligibleForActiveDay - activeDayCheckedIn),
    newEntries: attendees.filter((row) => row.registrationStatus === "NEW ENTRY").length,
  };
}

export async function flushOfflineQueue(): Promise<void> {
  const { offlineQueue, dequeueOffline } = useRegistry.getState();
  if (!offlineQueue || offlineQueue.length === 0) return;
  const cfg = liveConfig();
  const successfulIds: string[] = [];
  for (const item of offlineQueue) {
    try {
      const res = await sheetsBackend.checkIn(cfg, {
        id: item.id,
        gate: item.gate,
        checkedBy: item.checkedBy,
        day: item.day,
      });
      if (res.ok) {
        successfulIds.push(item.id);
      }
    } catch {
      break;
    }
  }
  if (successfulIds.length > 0) {
    dequeueOffline(successfulIds);
  }
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
    void flushOfflineQueue();
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
 * Real-time 2-Day check-in verification with zero-latency optimistic verification.
 */
export async function verifyAndCheckIn(rawId: string): Promise<CheckinResult> {
  const id = normalizeId(rawId);
  if (!id) return { kind: "error", id: rawId, message: "Enter a valid attendee ID." };

  const { inflight } = useRegistry.getState();
  if (inflight[id]) {
    return { kind: "error", id, message: "This ID is currently being processed." };
  }

  useRegistry.getState().markInflight(id, true);
  const { gate, staffName, eventDay } = useSettings.getState();

  try {
    const cached = fromCache(id);

    // OPTIMISTIC ZERO-LATENCY PATH:
    // When the badge is in the registered attendee roster:
    if (cached) {
      // 1. Guard against wrong day pass
      if (eventDay === 1 && cached.passType === "Day 2 Only") {
        return {
          kind: "invalid_day",
          attendee: cached,
          currentDay: 1,
          reason: "This badge is valid for Day 2 only! Not permitted on Day 1.",
        };
      }
      if (eventDay === 2 && cached.passType === "Day 1 Only") {
        return {
          kind: "invalid_day",
          attendee: cached,
          currentDay: 2,
          reason: "This badge was valid for Day 1 only! Expired for Day 2.",
        };
      }

      // 2. Guard against duplicate check-in today
      const alreadyToday =
        eventDay === 1 ? cached.day1Status === "ENTERED" : cached.day2Status === "ENTERED";
      if (alreadyToday) {
        return { kind: "already", attendee: cached, day: eventDay };
      }

      // 3. INSTANT VERIFIED! (0ms delay)
      const nowIso = new Date().toISOString();
      const updated: Attendee = {
        ...cached,
        entryStatus: "ENTERED",
        entryTime: nowIso,
        day1Status: eventDay === 1 ? "ENTERED" : cached.day1Status,
        day1Time: eventDay === 1 ? nowIso : cached.day1Time,
        day2Status: eventDay === 2 ? "ENTERED" : cached.day2Status,
        day2Time: eventDay === 2 ? nowIso : cached.day2Time,
        entryGate: gate || "Gate 1",
        checkedBy: staffName || "Staff",
      };

      // Save instantly to local reactive store & recent list
      useRegistry.getState().upsert(updated);
      useRegistry.getState().pushRecent(updated);

      // Record in offline queue
      useRegistry.getState().enqueueOffline({
        id,
        day: eventDay,
        time: nowIso,
        gate: gate || "Gate 1",
        checkedBy: staffName || "Staff",
      });

      // Fire silent background sync to Google Sheets (doesn't hold up gate scanning!)
      void sheetsBackend
        .checkIn(liveConfig(), {
          id,
          gate: gate || "Gate 1",
          checkedBy: staffName || "Staff",
          day: eventDay,
        })
        .then((res) => {
          if (res.ok) {
            useRegistry.getState().dequeueOffline([id]);
            useRegistry.getState().setSync({ syncStatus: "ok", lastSyncAt: new Date().toISOString() });
          }
        })
        .catch(() => {
          useRegistry.getState().setSync({ syncStatus: "offline" });
        });

      // Return immediately without waiting for network round-trip!
      return { kind: "verified", attendee: updated, day: eventDay };
    }

    // Fallback: If not in local cache, query Google Sheet directly
    const written = await sheetsBackend.checkIn(liveConfig(), {
      id,
      gate: gate || "Gate 1",
      checkedBy: staffName || "Staff",
      day: eventDay,
    });

    if (!written.ok) {
      return { kind: "error", id, message: written.error, attendee: cached };
    }

    if (written.result === "not_registered") {
      return { kind: "missing", id };
    }

    if (written.result === "invalid_day" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      return {
        kind: "invalid_day",
        attendee: written.attendee,
        currentDay: eventDay,
        reason: written.reason || `Pass not valid for Day ${eventDay}`,
      };
    }

    if (written.result === "already" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      return { kind: "already", attendee: written.attendee, day: eventDay };
    }

    if (written.result === "verified" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      useRegistry.getState().pushRecent(written.attendee);
      return { kind: "verified", attendee: written.attendee, day: eventDay };
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
  passType: PassType;
}): Promise<CheckinResult> {
  const id = normalizeId(input.id);
  const name = input.name.trim();
  const country = input.country.trim();
  const passType = input.passType || "Both Days";

  if (!id || !name || !country) {
    return { kind: "error", id: input.id, message: "ID, name, and country are required." };
  }

  const { gate, staffName, eventDay } = useSettings.getState();
  useRegistry.getState().markInflight(id, true);

  try {
    const written = await sheetsBackend.newEntry(liveConfig(), {
      id,
      name,
      country,
      passType,
      gate: gate || "Gate 1",
      checkedBy: staffName || "Staff",
      day: eventDay,
    });

    if (!written.ok) return { kind: "error", id, message: written.error };

    if (written.result === "already" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      return { kind: "already", attendee: written.attendee, day: eventDay };
    }

    if (written.result === "verified" && written.attendee) {
      useRegistry.getState().upsert(written.attendee);
      useRegistry.getState().pushRecent(written.attendee);
      return { kind: "verified", attendee: written.attendee, day: eventDay };
    }

    return { kind: "error", id, message: "Google Sheets did not confirm the new entry." };
  } finally {
    useRegistry.getState().markInflight(id, false);
  }
}
