import type { Attendee, DashboardStats, Gate } from "@/lib/types";
import { normalizeId } from "@/lib/utils";

const STORAGE_KEY = "gateflow-demo-registry-v1";

type SeedRow = {
  id: string;
  name: string;
  country: string;
  registrationStatus?: Attendee["registrationStatus"];
  enteredMinutesAgo?: number;
  entryGate?: Gate;
  checkedBy?: string;
};

const SEED: SeedRow[] = [
  { id: "NRB20260001", name: "Amina Rahman", country: "Bangladesh" },
  {
    id: "NRB20260002",
    name: "Kenji Sato",
    country: "Japan",
    enteredMinutesAgo: 42,
    entryGate: "Gate 1",
    checkedBy: "Staff 12",
  },
  { id: "NRB20260003", name: "Sofia Alvarez", country: "Mexico" },
  { id: "NRB20260004", name: "Noah Williams", country: "United Kingdom" },
  {
    id: "NRB20260005",
    name: "Priya Nair",
    country: "India",
    enteredMinutesAgo: 18,
    entryGate: "VIP",
    checkedBy: "Maya",
  },
  { id: "NRB20260006", name: "Omar Haddad", country: "United Arab Emirates" },
  { id: "NRB20260007", name: "Elena Rossi", country: "Italy" },
  { id: "NRB20260008", name: "Daniel Kim", country: "South Korea" },
  { id: "NRB20260009", name: "Fatima Diallo", country: "Kenya" },
  { id: "NRB20260010", name: "Lucas Moreau", country: "France" },
  {
    id: "NRB20260011",
    name: "Mei Chen",
    country: "Singapore",
    registrationStatus: "NEW ENTRY",
    enteredMinutesAgo: 7,
    entryGate: "Gate 2",
    checkedBy: "Rafi",
  },
  { id: "NRB20260012", name: "Hannah Berg", country: "Germany" },
  { id: "NRB20260013", name: "Carlos Mendes", country: "Brazil" },
  { id: "NRB20260014", name: "Yara Hassan", country: "Egypt" },
  { id: "NRB20260015", name: "James Okafor", country: "Nigeria" },
  { id: "NRB20260016", name: "Ines Duarte", country: "Spain" },
  { id: "NRB20260017", name: "Arjun Patel", country: "India" },
  { id: "NRB20260018", name: "Lina Bergström", country: "Sweden" },
  { id: "NRB20260019", name: "Tomás Silva", country: "Portugal" },
  { id: "NRB20260020", name: "Hana Suzuki", country: "Japan" },
  { id: "NRB20260021", name: "Grace Mwangi", country: "Kenya" },
  { id: "NRB20260022", name: "Victor Lopez", country: "United States" },
  { id: "NRB20260023", name: "Nadia Rahman", country: "Bangladesh" },
  { id: "NRB20260024", name: "Farhan Ahmed", country: "Bangladesh" },
];

function fromSeed(row: SeedRow, now: number): Attendee {
  const entered = row.enteredMinutesAgo != null;
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    registrationStatus: row.registrationStatus ?? "REGISTERED",
    entryStatus: entered ? "ENTERED" : "NOT ENTERED",
    entryTime: entered
      ? new Date(now - (row.enteredMinutesAgo ?? 0) * 60_000).toISOString()
      : null,
    entryGate: entered ? (row.entryGate ?? "Gate 1") : null,
    checkedBy: entered ? (row.checkedBy ?? "Demo") : null,
  };
}

function loadRaw(): Attendee[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attendee[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveRaw(rows: Attendee[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function seed(): Attendee[] {
  const now = Date.now();
  return SEED.map((row) => fromSeed(row, now));
}

let memory: Attendee[] | null = null;

function rows(): Attendee[] {
  if (!memory) memory = loadRaw() ?? seed();
  return memory;
}

function commit(next: Attendee[]) {
  memory = next;
  saveRaw(next);
}

export function resetDemoStore(): Attendee[] {
  const next = seed();
  commit(next);
  return next;
}

export function getDemoStats(list = rows()): DashboardStats {
  const checkedIn = list.filter((row) => row.entryStatus === "ENTERED").length;
  return {
    totalRegistered: list.length,
    checkedIn,
    remaining: list.length - checkedIn,
    newEntries: list.filter((row) => row.registrationStatus === "NEW ENTRY")
      .length,
  };
}

export const demoBackend = {
  async list(): Promise<Attendee[]> {
    return rows().map((row) => ({ ...row }));
  },

  async lookup(id: string): Promise<Attendee | null> {
    const key = normalizeId(id);
    return rows().find((row) => row.id === key) ?? null;
  },

  async checkIn(input: {
    id: string;
    gate: string;
    checkedBy: string;
  }): Promise<
    | { result: "verified"; attendee: Attendee }
    | { result: "already"; attendee: Attendee }
    | { result: "not_registered" }
  > {
    const key = normalizeId(input.id);
    const list = rows();
    const index = list.findIndex((row) => row.id === key);
    if (index < 0) return { result: "not_registered" };
    const current = list[index];
    if (!current) return { result: "not_registered" };
    if (current.entryStatus === "ENTERED") {
      return { result: "already", attendee: { ...current } };
    }
    const updated: Attendee = {
      ...current,
      entryStatus: "ENTERED",
      entryTime: new Date().toISOString(),
      entryGate: input.gate || current.entryGate,
      checkedBy: input.checkedBy || current.checkedBy,
    };
    const next = [...list];
    next[index] = updated;
    commit(next);
    return { result: "verified", attendee: updated };
  },

  async newEntry(input: {
    id: string;
    name: string;
    country: string;
    gate: string;
    checkedBy: string;
  }): Promise<
    | { result: "verified"; attendee: Attendee }
    | { result: "already"; attendee: Attendee }
  > {
    const key = normalizeId(input.id);
    const list = rows();
    const existing = list.find((row) => row.id === key);
    if (existing?.entryStatus === "ENTERED") {
      return { result: "already", attendee: { ...existing } };
    }
    if (existing) {
      const updated: Attendee = {
        ...existing,
        name: input.name.trim() || existing.name,
        country: input.country.trim() || existing.country,
        entryStatus: "ENTERED",
        entryTime: new Date().toISOString(),
        entryGate: input.gate,
        checkedBy: input.checkedBy,
      };
      commit(list.map((row) => (row.id === key ? updated : row)));
      return { result: "verified", attendee: updated };
    }
    const created: Attendee = {
      id: key,
      name: input.name.trim(),
      country: input.country.trim(),
      registrationStatus: "NEW ENTRY",
      entryStatus: "ENTERED",
      entryTime: new Date().toISOString(),
      entryGate: input.gate,
      checkedBy: input.checkedBy,
    };
    commit([created, ...list]);
    return { result: "verified", attendee: created };
  },
};
