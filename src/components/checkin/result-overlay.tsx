import { useEffect, useState } from "react";
import { Check, AlertTriangle, XCircle, ArrowRight, UserPlus, CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckinResult } from "@/lib/types";
import { cn, formatEntryTime } from "@/lib/utils";

const RETURN_MS = {
  verified: 2200,
  already: 2800,
  invalid_day: 3800,
  missing: 4000,
  error: 3600,
} as const;

export function ResultOverlay({
  result,
  onDismiss,
  onNewEntry,
}: {
  result: CheckinResult;
  onDismiss: () => void;
  onNewEntry: (id: string) => void;
}) {
  const kind = result.kind;
  const duration = RETURN_MS[kind];
  const [remaining, setRemaining] = useState<number>(duration);

  useEffect(() => {
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, duration - (Date.now() - started));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(tick);
        onDismiss();
      }
    }, 60);
    return () => window.clearInterval(tick);
  }, [duration, onDismiss, result]);

  // Handle keyboard ESC or Space for instant dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const palette =
    kind === "verified"
      ? "bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-950 text-white"
      : kind === "already"
        ? "bg-gradient-to-b from-amber-600 via-amber-700 to-amber-950 text-white"
        : kind === "invalid_day"
          ? "bg-gradient-to-b from-purple-700 via-rose-800 to-rose-950 text-white"
          : "bg-gradient-to-b from-rose-600 via-rose-700 to-rose-950 text-white";

  const title =
    kind === "verified"
      ? "Entry Verified"
      : kind === "already"
        ? "Already Entered Today"
        : kind === "invalid_day"
          ? "Invalid Event Day"
          : kind === "missing"
            ? "Not Registered"
            : "Check-in Error";

  const badgeText =
    kind === "verified"
      ? "ACCESS GRANTED · GREEN PATH"
      : kind === "already"
        ? "DUPLICATE SCAN · HELD AT GATE"
        : kind === "invalid_day"
          ? "WRONG DAY PASS · ACCESS RESTRICTED"
          : "UNREGISTERED ID · STOP";

  const attendee = "attendee" in result ? result.attendee : undefined;
  const id =
    result.kind === "missing" || result.kind === "error" ? result.id : result.attendee.id;

  return (
    <div
      className={cn(
        "result-enter fixed inset-0 z-50 flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        palette,
      )}
      role="status"
      aria-live="assertive"
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName !== "BUTTON") {
          onDismiss();
        }
      }}
    >
      {/* Top Progress bar */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/20" aria-hidden="true">
        <div
          className="progress-shrink h-full bg-white/90 shadow-sm"
          style={{ ["--return-ms" as string]: `${duration}ms` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {/* Status Icon Pop */}
        <div
          className={cn(
            "icon-pop mb-5 grid size-20 place-items-center rounded-3xl bg-white/15 backdrop-blur-md shadow-2xl border border-white/20",
            kind === "verified" && "glow-emerald",
            kind === "already" && "glow-amber",
            kind === "invalid_day" && "glow-purple shadow-[0_0_30px_rgba(217,70,239,0.5)]",
            (kind === "missing" || kind === "error") && "glow-crimson",
          )}
        >
          <StatusMark kind={kind} />
        </div>

        <div className="stagger-in">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-[0.2em] uppercase backdrop-blur-sm border border-white/20">
            {badgeText}
          </span>

          <h2 className="mt-3 text-4xl font-extrabold tracking-tight drop-shadow-md">
            {title}
          </h2>

          {attendee ? (
            <div className="mt-6 rounded-2xl bg-black/25 p-5 backdrop-blur-md border border-white/15 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Attendee Name</span>
                  <p className="text-2xl font-bold tracking-tight text-white">{attendee.name}</p>
                </div>
                <span className={cn(
                  "rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider border shadow-sm shrink-0",
                  attendee.passType === "Both Days" && "bg-amber-400/20 text-amber-300 border-amber-400/40",
                  attendee.passType === "Day 1 Only" && "bg-sky-400/20 text-sky-300 border-sky-400/40",
                  attendee.passType === "Day 2 Only" && "bg-purple-400/20 text-purple-300 border-purple-400/40",
                )}>
                  {attendee.passType}
                </span>
              </div>

              {kind === "invalid_day" && "reason" in result ? (
                <div className="rounded-xl bg-white/10 p-3 border border-white/20">
                  <p className="text-sm font-semibold text-white drop-shadow">
                    ⚠️ {result.reason}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/15 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Attendee ID</dt>
                  <dd className="font-mono text-base font-bold text-white tracking-wide">{attendee.id}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Country</dt>
                  <dd className="font-semibold text-white truncate">{attendee.country || "—"}</dd>
                </div>

                {kind === "already" ? (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Today's Entry Time</dt>
                    <dd className="font-semibold text-white tabular-nums">
                      {formatEntryTime(
                        ("day" in result && result.day === 1 ? attendee.day1Time : attendee.day2Time) ||
                        attendee.entryTime,
                      )}
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Registration</dt>
                    <dd className="font-semibold text-white">{attendee.registrationStatus}</dd>
                  </div>
                )}

                {attendee.entryGate ? (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Station Gate</dt>
                    <dd className="font-semibold text-white">{attendee.entryGate}</dd>
                  </div>
                ) : null}

                {kind === "already" && attendee.checkedBy ? (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Verified By</dt>
                    <dd className="font-semibold text-white truncate">{attendee.checkedBy}</dd>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-black/25 p-5 backdrop-blur-md border border-white/15 shadow-xl space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Scanned ID</span>
              <p className="font-mono text-2xl font-bold tracking-wider text-white">{id || "Unknown ID"}</p>
              {kind === "error" ? (
                <p className="text-sm leading-relaxed text-white/90">
                  {result.message} The sheet was not updated.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-white/90">
                  This ID was not found in the event registration database. Click <strong>New Entry</strong> below to register on spot.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 pt-4">
        {kind === "missing" ? (
          <Button
            variant="secondary"
            size="lg"
            className="h-14 bg-white text-rose-900 font-bold shadow-lg text-base hover:bg-white/90 active:scale-95 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onNewEntry(id);
            }}
          >
            <UserPlus className="mr-2 size-5" />
            New Entry Walk-up
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="lg"
          className="h-12 border border-white/20 bg-white/10 font-bold text-white hover:bg-white/20 active:scale-95 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <span>Next Scan ({Math.max(1, Math.ceil(remaining / 1000))}s)</span>
          <ArrowRight className="ml-2 size-4.5" />
        </Button>
      </div>
    </div>
  );
}

function StatusMark({ kind }: { kind: CheckinResult["kind"] }) {
  if (kind === "verified") {
    return <Check className="size-10 stroke-[3] text-white" />;
  }
  if (kind === "already") {
    return <AlertTriangle className="size-10 stroke-[2.5] text-white" />;
  }
  if (kind === "invalid_day") {
    return <CalendarX2 className="size-10 stroke-[2.5] text-white" />;
  }
  return <XCircle className="size-10 stroke-[2.5] text-white" />;
}
