import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  DoorOpen,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GATES } from "@/lib/types";
import {
  computeStats,
  syncRegistry,
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
  const stats = computeStats(attendees);
  const ratio =
    stats.totalRegistered === 0 ? 0 : stats.checkedIn / stats.totalRegistered;
  const percentage = Math.round(ratio * 100);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 px-1">
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
      </header>

      {syncError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/15 p-4 text-sm font-medium text-rose-400">
          {syncError}
        </div>
      ) : null}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Registered"
          value={stats.totalRegistered}
          icon={<Users className="size-5 text-sky-400" />}
          tone="default"
        />
        <StatCard
          label="Checked In"
          value={stats.checkedIn}
          icon={<UserCheck className="size-5 text-emerald-400" />}
          tone="ok"
        />
        <StatCard
          label="Remaining"
          value={stats.remaining}
          icon={<TrendingUp className="size-5 text-amber-400" />}
          tone="warn"
        />
        <StatCard
          label="Walk-up Entries"
          value={stats.newEntries}
          icon={<UserPlus className="size-5 text-purple-400" />}
          tone="purple"
        />
      </div>

      {/* Hall Turnout Capacity Bar */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DoorOpen className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Hall Turnout & Capacity</span>
          </div>
          <span className="font-mono text-base font-extrabold text-emerald-400 tabular-nums">
            {percentage}% Checked In
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted p-0.5 border border-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-[width] duration-700 ease-out shadow-sm"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </section>

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

      {/* Recent Activity Stream */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Live Check-in Stream ({recent.length})
          </h2>
          <span className="text-[11px] font-medium text-muted-foreground">Synchronized across all stations</span>
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
                    {row.registrationStatus === "NEW ENTRY" && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">
                        Walk-up
                      </span>
                    )}
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
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    <span>Entered</span>
                  </span>
                  <p className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                    {formatEntryTime(row.entryTime)}
                  </p>
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
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
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
    </article>
  );
}
