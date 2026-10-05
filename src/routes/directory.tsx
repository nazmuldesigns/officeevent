import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Globe,
  Search,
  Tag,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegistry, useSettings } from "@/lib/store";
import type { Attendee, PassType } from "@/lib/types";
import { cn, downloadText, formatEntryTime } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/directory")({ component: DirectoryPage });

function DirectoryPage() {
  const attendees = useRegistry((s) => s.attendees);
  const eventDay = useSettings((s) => s.eventDay);
  const [search, setSearch] = useState("");
  const [passFilter, setPassFilter] = useState<"ALL" | PassType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENTERED_TODAY" | "NOT_ENTERED_TODAY" | "ENTERED_ANY">("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendees.filter((row) => {
      if (q) {
        const matchesId = row.id.toLowerCase().includes(q);
        const matchesName = row.name.toLowerCase().includes(q);
        const matchesCountry = row.country.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesCountry) return false;
      }

      if (passFilter !== "ALL" && row.passType !== passFilter) {
        return false;
      }

      const isEnteredDay1 = row.day1Status === "ENTERED";
      const isEnteredDay2 = row.day2Status === "ENTERED";
      const isEnteredToday = eventDay === 1 ? isEnteredDay1 : isEnteredDay2;

      if (statusFilter === "ENTERED_TODAY" && !isEnteredToday) return false;
      if (statusFilter === "NOT_ENTERED_TODAY" && isEnteredToday) return false;
      if (statusFilter === "ENTERED_ANY" && !isEnteredDay1 && !isEnteredDay2) return false;

      return true;
    });
  }, [attendees, search, passFilter, statusFilter, eventDay]);

  function exportCsv() {
    if (attendees.length === 0) {
      toast.error("No attendees to export.");
      return;
    }
    const headers = [
      "ID",
      "Name",
      "Country",
      "Pass Type",
      "Registration Status",
      "Day 1 Status",
      "Day 1 Time",
      "Day 2 Status",
      "Day 2 Time",
      "Last Gate",
      "Verified By",
    ];

    const escape = (val: string | null | undefined) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = attendees.map((a) => [
      escape(a.id),
      escape(a.name),
      escape(a.country),
      escape(a.passType),
      escape(a.registrationStatus),
      escape(a.day1Status),
      escape(a.day1Time),
      escape(a.day2Status),
      escape(a.day2Time),
      escape(a.entryGate),
      escape(a.checkedBy),
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    downloadText(csvContent, `NRB-World-Event-Attendance-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
    toast.success(`Exported ${attendees.length} attendance records to CSV.`);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-6 text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Attendee Directory
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Instant search, filter by pass type, and export full 2-day attendance records.
          </p>
        </div>

        <Button
          onClick={exportCsv}
          className="h-10 font-bold shadow-md active:scale-95 shrink-0"
        >
          <Download className="mr-1.5 size-4" />
          Export CSV ({attendees.length})
        </Button>
      </header>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          placeholder="Search by attendee name, ID code (NRB...), or country..."
          className="h-12 pl-10.5 pr-9 font-medium text-sm rounded-2xl bg-card border-border/80 shadow-sm"
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="text-muted-foreground mr-1">Pass Style:</span>
          {(["ALL", "Both Days", "Day 1 Only", "Day 2 Only"] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setPassFilter(pt)}
              className={cn(
                "rounded-xl px-3 py-1.5 transition-all duration-150 active:scale-95 border",
                passFilter === pt
                  ? "bg-primary text-primary-foreground border-primary/50 shadow-sm"
                  : "bg-muted/80 text-muted-foreground border-border/60 hover:text-foreground",
              )}
            >
              {pt === "ALL" ? "All Passes" : pt}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="text-muted-foreground mr-1">Status:</span>
          {[
            { id: "ALL", label: "All Status" },
            { id: "ENTERED_TODAY", label: `Checked In (Day ${eventDay})` },
            { id: "NOT_ENTERED_TODAY", label: `Not Entered (Day ${eventDay})` },
            { id: "ENTERED_ANY", label: "Entered Either Day" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id as any)}
              className={cn(
                "rounded-xl px-3 py-1.5 transition-all duration-150 active:scale-95 border",
                statusFilter === item.id
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-sm"
                  : "bg-muted/80 text-muted-foreground border-border/60 hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>Showing {filtered.length} of {attendees.length} registered guests</span>
        <span>Active Focus: Day {eventDay}</span>
      </div>

      {/* Attendee Cards List */}
      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-border/80 bg-card p-10 text-center text-muted-foreground shadow-sm">
          <UserCheck className="mx-auto mb-2 size-8 opacity-40 text-primary" />
          <p className="text-sm font-semibold">No attendees found.</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Try adjusting your search query or filter selection.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-[22px] border border-border/80 bg-card p-4 shadow-sm hover:border-primary/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground truncate">{row.name}</h3>
                    {row.registrationStatus === "NEW ENTRY" && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400 shrink-0">
                        Walk-up
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <span className="font-bold text-primary">{row.id}</span>
                    {row.country && (
                      <>
                        <span>·</span>
                        <span className="font-sans text-muted-foreground">{row.country}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Pass Category Badge */}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider border shrink-0",
                    row.passType === "Both Days" && "bg-amber-500/15 text-amber-400 border-amber-500/30",
                    row.passType === "Day 1 Only" && "bg-sky-500/15 text-sky-400 border-sky-500/30",
                    row.passType === "Day 2 Only" && "bg-purple-500/15 text-purple-400 border-purple-500/30",
                  )}
                >
                  {row.passType}
                </span>
              </div>

              {/* 2-Day Status Indicators */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                {/* Day 1 Status */}
                <div className={cn(
                  "rounded-xl p-2 border",
                  row.day1Status === "ENTERED"
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-muted/50 border-border/50 text-muted-foreground",
                )}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Day 1 Status</span>
                    {row.day1Status === "ENTERED" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-medium">Not Entered</span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {row.day1Time ? formatEntryTime(row.day1Time) : "—"}
                  </p>
                </div>

                {/* Day 2 Status */}
                <div className={cn(
                  "rounded-xl p-2 border",
                  row.day2Status === "ENTERED"
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-muted/50 border-border/50 text-muted-foreground",
                )}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Day 2 Status</span>
                    {row.day2Status === "ENTERED" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-medium">Not Entered</span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {row.day2Time ? formatEntryTime(row.day2Time) : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
