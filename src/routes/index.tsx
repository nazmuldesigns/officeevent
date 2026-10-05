import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { NewEntryForm } from "@/components/checkin/new-entry-form";
import { ResultOverlay } from "@/components/checkin/result-overlay";
import { ScannerView } from "@/components/checkin/scanner-view";
import { playSound, unlockAudio } from "@/lib/audio/sounds";
import { verifyAndCheckIn, useSettings } from "@/lib/store";
import type { CheckinResult } from "@/lib/types";

export const Route = createFileRoute("/")({ component: CheckinPage });

type Phase =
  | { name: "scan" }
  | { name: "verifying"; id: string }
  | { name: "result"; result: CheckinResult }
  | { name: "new"; id: string };

function CheckinPage() {
  const [phase, setPhase] = useState<Phase>({ name: "scan" });
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const mode = useSettings((s) => s.mode);
  const gate = useSettings((s) => s.gate);

  const handleScan = useCallback(
    async (id: string) => {
      if (phase.name !== "scan") return;
      void unlockAudio();
      setPhase({ name: "verifying", id });
      const result = await verifyAndCheckIn(id);
      if (result.kind === "verified") playSound("verified", soundEnabled);
      else if (result.kind === "already") playSound("already", soundEnabled);
      else if (result.kind === "missing") playSound("missing", soundEnabled);
      else playSound("error", soundEnabled);
      setPhase({ name: "result", result });
    },
    [phase.name, soundEnabled],
  );

  const dismiss = useCallback(() => {
    setPhase({ name: "scan" });
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Attendee Check-in
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <ShieldCheck className="size-3.5" />
            <span>Station: {gate}</span>
          </span>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Scan attendee Code 128 barcode or enter manual ID for instant verification.
        </p>
      </header>

      <div className={phase.name === "new" ? "hidden" : "contents"}>
        <ScannerView
          armed={phase.name === "scan"}
          verifyingId={phase.name === "verifying" ? phase.id : null}
          onScan={(id) => {
            void handleScan(id);
          }}
        />
      </div>

      {phase.name === "new" ? (
        <NewEntryForm
          initialId={phase.id}
          onCancel={dismiss}
          onDone={(result) => {
            if (result.kind === "verified") playSound("verified", soundEnabled);
            else if (result.kind === "already") playSound("already", soundEnabled);
            else playSound("error", soundEnabled);
            setPhase({ name: "result", result });
          }}
        />
      ) : null}

      {phase.name === "scan" && mode === "live" ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-400">
          <Sparkles className="size-4 shrink-0" />
          <span>
            Connected to Live Google Sheet. Check-ins are instantly logged with timestamp and gate info.
          </span>
        </div>
      ) : null}

      {phase.name === "result" ? (
        <ResultOverlay
          result={phase.result}
          onDismiss={dismiss}
          onNewEntry={(id) => setPhase({ name: "new", id })}
        />
      ) : null}
    </div>
  );
}
