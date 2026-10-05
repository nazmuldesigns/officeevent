export const GATES = [
  "Gate 1",
  "Gate 2",
  "Gate 3",
  "Gate 4",
  "Gate 5",
  "Gate 6",
  "VIP Desk",
  "Media Desk",
  "Gate A",
  "Gate B",
] as const;

export type Gate = (typeof GATES)[number] | string;

export const REGISTRATION_STATUSES = ["REGISTERED", "NEW ENTRY"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const ENTRY_STATUSES = ["NOT ENTERED", "ENTERED"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export type Attendee = {
  id: string;
  name: string;
  country: string;
  registrationStatus: RegistrationStatus;
  entryStatus: EntryStatus;
  entryTime: string | null;
  entryGate: string | null;
  checkedBy: string | null;
};

export type ConnectionMode = "live";

export type SyncStatus = "idle" | "syncing" | "ok" | "error" | "offline";

export type CheckinKind = "verified" | "already" | "missing" | "error";

export type CheckinResult =
  | { kind: "verified"; attendee: Attendee }
  | { kind: "already"; attendee: Attendee }
  | { kind: "missing"; id: string }
  | { kind: "error"; id: string; message: string; attendee?: Attendee };

export type DashboardStats = {
  totalRegistered: number;
  checkedIn: number;
  remaining: number;
  newEntries: number;
};

export type GasResponse<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string };
