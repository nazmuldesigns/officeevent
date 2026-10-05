import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import {
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  Link as LinkIcon,
  Lock,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_LOCK_PIN, DEFAULT_SCRIPT_URL } from "@/lib/constants";
import {
  syncRegistry,
  testConnection,
  useSettings,
} from "@/lib/store";
import { downloadBlob } from "@/lib/utils";
import { GATES } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const scriptUrl = useSettings((s) => s.scriptUrl);
  const setScriptUrl = useSettings((s) => s.setScriptUrl);
  const apiKey = useSettings((s) => s.apiKey);
  const setApiKey = useSettings((s) => s.setApiKey);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const gate = useSettings((s) => s.gate);
  const setGate = useSettings((s) => s.setGate);
  const staffName = useSettings((s) => s.staffName);
  const setStaffName = useSettings((s) => s.setStaffName);

  const [busy, setBusy] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);

  async function connect() {
    setBusy(true);
    const result = await testConnection();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const synced = await syncRegistry();
    if (synced) toast.success(result.message);
    else toast.error("Connected to Apps Script, but registry failed to hydrate.");
  }

  function handleUnlock() {
    if (pinInput.trim() === ADMIN_LOCK_PIN) {
      setIsUnlocked(true);
      setShowPinModal(false);
      setPinInput("");
      toast.success("Configuration Unlocked!");
    } else {
      toast.error("Incorrect Admin PIN! Access denied.");
    }
  }

  async function downloadPack() {
    const [code, manifest, csv] = await Promise.all([
      fetch("/setup/Code.gs").then((res) => res.text()).catch(() => ""),
      fetch("/setup/appsscript.json").then((res) => res.text()).catch(() => ""),
      fetch("/setup/sheet-template.csv").then((res) => res.text()).catch(() => ""),
    ]);
    const zip = new JSZip();
    zip.file("apps-script/Code.gs", code);
    zip.file("apps-script/appsscript.json", manifest);
    zip.file("sheet-template.csv", csv);
    zip.file(
      "README.txt",
      [
        "NRB World Event - Google Sheets Setup Pack",
        "============================================",
        "",
        "1. Create a new Google Spreadsheet.",
        "2. Rename the tab to: Registrations",
        "3. Header columns (Row 1):",
        "   ID | Name | Country | Registration Status | Entry Status | Entry Time | Entry Gate | Checked By",
        "4. Go to Extensions -> Apps Script.",
        "5. Paste the Code.gs script into your Apps Script editor.",
        "6. Click Deploy -> New Deployment -> Web App.",
        "   - Execute as: Me",
        "   - Who has access: Anyone",
        "7. Copy the Web App /exec URL and paste into NRB World Setup.",
        "8. Click 'Test Connection' to verify live Google Sheets sync.",
        "",
      ].join("\n"),
    );
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    downloadBlob(blob, "NRB-World-Google-Setup-Pack.zip");
    toast.success("Downloaded Google Sheets setup pack");
  }

  return (
    <div className="space-y-5">
      <header className="px-1">
        <div className="flex items-center gap-2">
          <Settings className="size-6 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Station & Cloud Setup
          </h1>
        </div>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Manage station gates, operator identification, theme preference, and cloud backend configuration.
        </p>
      </header>

      {/* Station & Operator Configuration */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="size-4.5 text-primary" />
          <h2 className="text-sm font-bold tracking-tight">Active Station & Operator Details</h2>
        </div>

        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Assigned Gate Station</span>
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
            <span className="text-xs font-semibold text-muted-foreground">Staff Operator Name / ID</span>
            <Input
              value={staffName}
              placeholder="e.g. Officer Rahat / VIP Desk"
              className="h-11 text-sm font-medium"
              onChange={(event) => setStaffName(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 pt-3 border-t border-border/60">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Display Theme
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {(["dark", "light"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 active:scale-95",
                  theme === value
                    ? "border border-primary/50 bg-primary text-primary-foreground shadow-md"
                    : "border border-border/80 bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "dark" ? (
                  <Moon className="size-4 text-amber-400" />
                ) : (
                  <Sun className="size-4 text-blue-500" />
                )}
                <span>{value === "dark" ? "Navy Blue Dark" : "Clean Light"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Password-Protected Google Apps Script URL */}
      <section className="space-y-3.5 rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Database className="size-4.5 text-primary" />
            <h2 className="text-sm font-bold tracking-tight">Google Apps Script Web App Endpoint</h2>
          </div>
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
              <Unlock className="size-3" />
              <span>Unlocked</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/30">
              <Lock className="size-3" />
              <span>Locked</span>
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Google Apps Script Deployment URL</span>
            <div className="relative">
              <Input
                value={scriptUrl || DEFAULT_SCRIPT_URL}
                disabled={!isUnlocked}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={cn(
                  "h-11 font-mono text-xs pr-10",
                  !isUnlocked && "opacity-75 cursor-not-allowed bg-muted/80",
                )}
                onChange={(event) => setScriptUrl(event.target.value.trim())}
              />
              {!isUnlocked && (
                <Lock className="absolute right-3 top-3.5 size-4 text-muted-foreground pointer-events-none" />
              )}
            </div>
          </label>

          {isUnlocked ? (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">API Secret Key (Optional)</span>
              <Input
                value={apiKey}
                type="password"
                placeholder="Leave blank if no key is configured in Code.gs"
                className="h-11 font-mono text-xs"
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Button
            className="h-11 flex-1 font-bold shadow-md active:scale-95"
            disabled={busy}
            onClick={() => void connect()}
          >
            <LinkIcon className="mr-2 size-4" />
            {busy ? "Testing Connection…" : "Test Connection & Sync Live Sheet"}
          </Button>

          {!isUnlocked ? (
            <Button
              variant="secondary"
              className="h-11 font-semibold border border-border/80 active:scale-95 shrink-0"
              onClick={() => setShowPinModal(true)}
            >
              <KeyRound className="mr-1.5 size-4 text-amber-400" />
              Unlock to Edit URL
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-11 font-semibold border border-border/80 active:scale-95 shrink-0"
              onClick={() => {
                setIsUnlocked(false);
                toast.info("Configuration Re-locked.");
              }}
            >
              <Lock className="mr-1.5 size-4" />
              Lock URL
            </Button>
          )}
        </div>
      </section>

      {/* Unlock PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-400">
                <Lock className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Admin PIN Required</h3>
                <p className="text-xs text-muted-foreground">Enter password to edit Google Apps Script URL.</p>
              </div>
            </div>

            <Input
              type="password"
              value={pinInput}
              autoFocus
              placeholder="Enter Admin PIN"
              className="h-12 text-center font-mono text-lg tracking-[0.25em]"
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnlock();
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-11 font-semibold"
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                }}
              >
                Cancel
              </Button>
              <Button className="h-11 font-bold" onClick={handleUnlock}>
                Unlock
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Setup Documentation */}
      <section className="space-y-3 rounded-[24px] border border-border/80 bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-bold text-foreground">
          Google Sheets Cloud Backend Guide
        </h2>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs sm:text-sm">
          <li>Google Spreadsheet Tab Name: <strong>Registrations</strong>.</li>
          <li>
            Header Row: <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">ID | Name | Country | Registration Status | Entry Status | Entry Time | Entry Gate | Checked By</code>
          </li>
          <li>Click <strong>Extensions → Apps Script</strong> and paste <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">Code.gs</code>.</li>
          <li>Click <strong>Deploy → New deployment → Web app</strong> (Access: Anyone).</li>
          <li>Copy the generated <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">/exec</code> URL.</li>
        </ol>
        <div className="pt-2">
          <Button
            variant="secondary"
            className="h-11 w-full font-semibold border border-border/80 active:scale-95"
            onClick={() => void downloadPack()}
          >
            <Download className="mr-2 size-4 text-primary" />
            Download Setup Pack (.zip)
          </Button>
        </div>
      </section>
    </div>
  );
}
