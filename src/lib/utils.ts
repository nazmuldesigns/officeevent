import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isLikelyId(id: string): boolean {
  return /^[A-Z0-9][A-Z0-9._-]{4,31}$/.test(id);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadText(text: string, filename: string, mime: string) {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function parseEntryDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return new Date(iso);
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss ?? 0),
  );
}

export function formatEntryTime(value: string | null | undefined): string {
  const date = parseEntryDate(value);
  if (!date) return value?.trim() || "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatClock(value: string | null | undefined): string {
  const date = parseEntryDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function nextSequentialId(ids: string[], prefix = "NRB", year = 2026): string {
  const pattern = new RegExp(`^${prefix}${year}(\\d{4})$`, "i");
  let max = 0;
  for (const id of ids) {
    const match = id.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${year}${String(max + 1).padStart(4, "0")}`;
}
