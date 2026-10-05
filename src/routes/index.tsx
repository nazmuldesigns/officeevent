import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
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
          Point camera at Code 128 badge or type ID for instant verification.
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
