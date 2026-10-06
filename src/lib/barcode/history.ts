import { useState, useEffect, useCallback } from "react";
import type { PassType } from "../types";
import { generateSecuritySeal, generateSecurityToken } from "./security";

export type DownloadedBadgeRecord = {
  id: string;
  name: string;
  country: string;
  passType: PassType;
  downloadedAt: string;
  securitySeal: string;
  securityToken: string;
};

const STORAGE_KEY = "nrb_downloaded_badges_registry_v1";

function loadDownloadedHistory(): DownloadedBadgeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDownloadedHistory(records: DownloadedBadgeRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 500)));
  } catch {
    // ignore
  }
}

export function useDownloadedBadges() {
  const [history, setHistory] = useState<DownloadedBadgeRecord[]>(() => loadDownloadedHistory());

  useEffect(() => {
    setHistory(loadDownloadedHistory());
  }, []);

  const recordDownload = useCallback((item: {
    id: string;
    name: string;
    country: string;
    passType: PassType;
  }) => {
    const cleanId = item.id.trim().toUpperCase();
    const cleanName = item.name.trim();
    const record: DownloadedBadgeRecord = {
      id: cleanId,
      name: cleanName,
      country: item.country.trim(),
      passType: item.passType,
      downloadedAt: new Date().toISOString(),
      securitySeal: generateSecuritySeal(cleanId, cleanName),
      securityToken: generateSecurityToken(cleanId, cleanName),
    };

    setHistory((prev) => {
      // Remove any previous entry for this exact ID to update it
      const filtered = prev.filter((r) => r.id.toUpperCase() !== cleanId);
      const next = [record, ...filtered];
      saveDownloadedHistory(next);
      return next;
    });

    return record;
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, recordDownload, clearHistory };
}
