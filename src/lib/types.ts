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

export const PASS_TYPES = ["Day 1 Only", "Day 2 Only", "Both Days"] as const;
export type PassType = (typeof PASS_TYPES)[number];

export type EventDay = 1 | 2;

export const REGISTRATION_STATUSES = ["REGISTERED", "NEW ENTRY"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const ENTRY_STATUSES = ["NOT ENTERED", "ENTERED"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export type Attendee = {
  id: string;
  name: string;
  country: string;
  passType: PassType;
  registrationStatus: RegistrationStatus;
  entryStatus: EntryStatus;
  entryTime: string | null;
  day1Status: EntryStatus;
  day1Time: string | null;
  day2Status: EntryStatus;
  day2Time: string | null;
  entryGate: string | null;
  checkedBy: string | null;
};

export type PendingCheckIn = {
  id: string;
  day: EventDay;
  time: string;
  gate: string;
  checkedBy: string;
};

export type ConnectionMode = "live";

export type SyncStatus = "idle" | "syncing" | "ok" | "error" | "offline";

export type CheckinKind = "verified" | "already" | "invalid_day" | "missing" | "error";

export type CheckinResult =
  | { kind: "verified"; attendee: Attendee; day: EventDay }
  | { kind: "already"; attendee: Attendee; day: EventDay }
  | { kind: "invalid_day"; attendee: Attendee; currentDay: EventDay; reason: string }
  | { kind: "missing"; id: string }
  | { kind: "error"; id: string; message: string; attendee?: Attendee };

export type DashboardStats = {
  totalRegistered: number;
  day1CheckedIn: number;
  day2CheckedIn: number;
  activeDayCheckedIn: number;
  bothDaysPasses: number;
  day1OnlyPasses: number;
  day2OnlyPasses: number;
  remaining: number;
  newEntries: number;
};

export type GasResponse<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string };
