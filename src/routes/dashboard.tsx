import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  LayoutDashboard,
  RefreshCw,
  Ticket,
  TrendingUp,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GATES } from "@/lib/types";
import {
  computeStats,
  syncRegistry,
  undoCheckIn,
  useRegistry,
  useSettings,
} from "@/lib/store";
import { cn, formatEntryTime } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const attendees = useRegistry((s) => s.attendees);
  const recent = useRegistry((s) => s.recent);
  const syncStatus = useRegistry((s) => s.syncStatus);
  const lastSyncAt = useRegistry((s) => s.lastSyncAt);
  const syncError = useRegistry((s) => s.syncError);
  const gate = useSettings((s) => s.gate);
  const setGate = useSettings((s) => s.setGate);
  const staffName = useSettings((s) => s.staffName);
  const setStaffName = useSettings((s) => s.setStaffName);
  const eventDay = useSettings((s) => s.eventDay);
  const setEventDay = useSettings((s) => s.setEventDay);

  const stats = computeStats(attendees, eventDay);
  const eligibleToday =
    eventDay === 1
      ? stats.day1OnlyPasses + stats.bothDaysPasses
      : stats.day2OnlyPasses + stats.bothDaysPasses;
  const ratio = eligibleToday === 0 ? 0 : stats.activeDayCheckedIn / eligibleToday;
  const percentage = Math.round(ratio * 100);

  // Calculate country breakdown
  const countryCounts = attendees.reduce<Record<string, number>>((acc, row) => {
    if (row.country) acc[row.country] = (acc[row.country] || 0) + 1;
    return acc;
  }, {});
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-6 text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Live Event Dashboard
            </h1>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
            <Clock className="size-3.5" />
            <span>
              {lastSyncAt
                ? `Last synced ${formatEntryTime(lastSyncAt)}`
                : "Synchronizing with Google Sheet…"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Day Selector */}
          <button
            type="button"
            onClick={() => setEventDay(eventDay === 1 ? 2 : 1)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 text-xs font-bold text-sky-400 active:scale-95 transition-all"
            title="Switch focus between Day 1 and Day 2"
          >
            <Calendar className="size-3.5" />
            <span>Focus: Day {eventDay}</span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            className="h-10 border border-border/80 px-3 font-semibold shadow-sm active:scale-95"
            onClick={() => void syncRegistry()}
            disabled={syncStatus === "syncing"}
          >
            <RefreshCw
              className={cn("mr-1.5 size-4", syncStatus === "syncing" && "animate-spin text-primary")}
            />
            <span>{syncStatus === "syncing" ? "Syncing" : "Refresh"}</span>
          </Button>
        </div>
      </header>

      {syncError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/15 p-4 text-sm font-medium text-rose-400">
          {syncError}
        </div>
      ) : null}

      {/* 2-Day Attendance KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Registered"
          value={stats.totalRegistered}
          subtext="Across all 3 pass styles"
          icon={<Users className="size-5 text-sky-400" />}
          tone="default"
        />
        <StatCard
          label="Day 1 Check-ins"
          value={stats.day1CheckedIn}
          subtext={`${stats.day1OnlyPasses + stats.bothDaysPasses} eligible`}
          icon={<UserCheck className="size-5 text-emerald-400" />}
          tone="ok"
        />
        <StatCard
          label="Day 2 Check-ins"
          value={stats.day2CheckedIn}
          subtext={`${stats.day2OnlyPasses + stats.bothDaysPasses} eligible`}
          icon={<UserCheck className="size-5 text-purple-400" />}
          tone="purple"
        />
        <StatCard
          label={`Day ${eventDay} Remaining`}
          value={stats.remaining}
          subtext={`Unchecked for Day ${eventDay}`}
          icon={<TrendingUp className="size-5 text-amber-400" />}
          tone="warn"
        />
      </div>

      {/* Pass Type Distribution Box */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Pass Style Distribution</h2>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">3 Pass Categories</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Day 1 Pass</span>
            <p className="mt-1 font-mono text-2xl font-extrabold text-foreground">{stats.day1OnlyPasses}</p>
          </div>
          <div className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-3 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Day 2 Pass</span>
            <p className="mt-1 font-mono text-2xl font-extrabold text-foreground">{stats.day2OnlyPasses}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">2-Day All Access</span>
            <p className="mt-1 font-mono text-2xl font-extrabold text-foreground">{stats.bothDaysPasses}</p>
          </div>
        </div>
      </section>

      {/* Hall Turnout Capacity Bar for Active Day */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DoorOpen className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Day {eventDay} Hall Turnout & Capacity</span>
          </div>
          <span className="font-mono text-base font-extrabold text-emerald-400 tabular-nums">
            {percentage}% ({stats.activeDayCheckedIn}/{eligibleToday})
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted p-0.5 border border-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-400 to-emerald-500 transition-[width] duration-700 ease-out shadow-sm"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </section>

      {/* Top Countries Breakdown */}
      {topCountries.length > 0 && (
        <section className="rounded-[24px] border border-border/80 bg-card p-4 shadow-[var(--shadow-border)] space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Top Attendee Origins
          </span>
          <div className="flex flex-wrap gap-2 pt-1">
            {topCountries.map(([country, count]) => (
              <span
                key={country}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <span>{country}</span>
                <span className="font-mono text-primary font-bold">({count})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Station Config Box */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          This Station Configuration
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground/80">Assigned Gate</span>
            <select
              value={gate}
              onChange={(event) => setGate(event.target.value)}
              className="h-11 w-full rounded-xl border border-border/80 bg-muted px-3 text-sm font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {GATES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground/80">Staff Operator Name</span>
            <input
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
              placeholder="e.g. Officer Rahat / Volunteer"
              className="h-11 w-full rounded-xl border border-border/80 bg-muted px-3 text-sm font-medium shadow-inner placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </section>

      {/* Live Stream */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Live Check-in Stream ({recent.length})
          </h2>
          <span className="text-[11px] font-medium text-muted-foreground">Synchronized across all 10+ stations</span>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-[24px] border border-border/80 bg-card px-4 py-10 text-center text-muted-foreground shadow-sm">
            <UserCheck className="mx-auto mb-2 size-8 opacity-40 text-primary" />
            <p className="text-sm font-medium">No check-ins recorded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Scan attendee badges from the Check-in tab to stream live updates.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {recent.map((row) => (
              <li
                key={`${row.id}-${row.entryTime}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-sm transition-transform hover:border-border hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                        row.passType === "Both Days" && "bg-amber-500/20 text-amber-400",
                        row.passType === "Day 1 Only" && "bg-sky-500/20 text-sky-400",
                        row.passType === "Day 2 Only" && "bg-purple-500/20 text-purple-400",
                      )}
                    >
                      {row.passType}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-semibold tracking-wide text-primary">
                      {row.id}
                    </span>
                    {row.country && (
                      <>
                        <span>·</span>
                        <span>{row.country}</span>
                      </>
                    )}
                    {row.entryGate && (
                      <>
                        <span>·</span>
                        <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-foreground/80">
                          {row.entryGate}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-right">
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      <span>Entered</span>
                    </span>
                    <p className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                      {formatEntryTime(row.entryTime)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const dayToUndo = (eventDay === 2 && row.day2Status === "ENTERED") ? 2 : (row.day1Status === "ENTERED" ? 1 : eventDay);
                      const res = await undoCheckIn(row.id, dayToUndo as any);
                      if (res.ok) toast.success(res.message);
                    }}
                    className="grid size-8 place-items-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 active:scale-95 transition-all"
                    title="ভুল স্ক্যান বাতিল করুন (Undo check-in)"
                  >
                    <Undo2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "purple";
}) {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-border/80 bg-card p-4 shadow-[var(--shadow-border)] transition-all hover:border-primary/40">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p
        className={cn(
          "mt-2 font-mono text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl",
          tone === "ok" && "text-emerald-400",
          tone === "warn" && "text-amber-400",
          tone === "purple" && "text-purple-400",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-[10px] font-medium text-muted-foreground truncate">
          {subtext}
        </p>
      )}
    </article>
  );
}
