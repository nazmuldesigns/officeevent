import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import {
  CheckCircle2,
  Database,
  Download,
  Link as LinkIcon,
  Moon,
  Radio,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sun,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resetDemo,
  syncRegistry,
  testConnection,
  useSettings,
} from "@/lib/store";
import { downloadBlob } from "@/lib/utils";
import { GATES } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const mode = useSettings((s) => s.mode);
  const setMode = useSettings((s) => s.setMode);
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

  async function connect() {
    setBusy(true);
    const result = await testConnection();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setMode("live");
    const synced = await syncRegistry();
    if (synced) toast.success(result.message);
    else toast.error("Connected to Apps Script, but registry failed to hydrate.");
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
            System & Cloud Setup
          </h1>
        </div>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Connect your Google Sheet database, configure station gates, and customize dark/light theme.
        </p>
      </header>

      {/* Mode Switcher Card */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Connection Environment
          </h2>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
              mode === "live"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/15 text-amber-400",
            )}
          >
            {mode === "live" ? "Live Cloud Mode" : "Local Demo Mode"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(["demo", "live"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                void syncRegistry();
              }}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 active:scale-95",
                mode === value
                  ? "border border-primary/50 bg-primary text-primary-foreground shadow-md"
                  : "border border-border/80 bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "demo" ? <Zap className="size-4" /> : <Radio className="size-4" />}
              <span>{value === "demo" ? "Demo Mode" : "Live Google Sheet"}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Google Apps Script Connection */}
      <section className="space-y-3.5 rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2 text-foreground">
          <Database className="size-4.5 text-primary" />
          <h2 className="text-sm font-bold tracking-tight">Google Apps Script Web App</h2>
        </div>
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Apps Script Deployment URL</span>
            <Input
              value={scriptUrl}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="h-11 font-mono text-xs"
              onChange={(event) => setScriptUrl(event.target.value.trim())}
            />
          </label>
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
        </div>
        <Button
          className="h-11 w-full font-bold shadow-md active:scale-95"
          disabled={busy}
          onClick={() => void connect()}
        >
          <LinkIcon className="mr-2 size-4" />
          {busy ? "Testing Connection…" : "Test Connection & Sync Live Sheet"}
        </Button>
      </section>

      {/* Station & Theme Settings */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="size-4.5 text-primary" />
          <h2 className="text-sm font-bold tracking-tight">Device & Station Settings</h2>
        </div>

        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Select Station Gate</span>
            <select
              value={gate}
              onChange={(event) => setGate(event.target.value as (typeof GATES)[number])}
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
            <span className="text-xs font-semibold text-muted-foreground">Operator Staff Name</span>
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
            Theme Preference
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

      {/* Google Sheets Guide & Pack */}
      <section className="space-y-3 rounded-[24px] border border-border/80 bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-bold text-foreground">
          Step-by-Step Free Google Sheets Backend Guide
        </h2>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs sm:text-sm">
          <li>Create a Google Sheet with a tab named <strong>Registrations</strong>.</li>
          <li>
            Header Row: <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">ID | Name | Country | Registration Status | Entry Status | Entry Time | Entry Gate | Checked By</code>
          </li>
          <li>Click <strong>Extensions → Apps Script</strong> and paste <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">Code.gs</code>.</li>
          <li>Click <strong>Deploy → New deployment → Web app</strong> (Access: Anyone).</li>
          <li>Paste the generated <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">/exec</code> URL above and tap Test Connection.</li>
        </ol>
        <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="h-11 font-semibold border border-border/80 active:scale-95"
            onClick={() => void downloadPack()}
          >
            <Download className="mr-2 size-4 text-primary" />
            Download Setup Pack (.zip)
          </Button>
          <Button
            variant="outline"
            className="h-11 font-semibold border border-border/80 active:scale-95"
            onClick={() => {
              void resetDemo();
              toast.success("Demo attendee registry reset.");
            }}
          >
            <RotateCcw className="mr-2 size-4 text-amber-400" />
            Reset Demo Data
          </Button>
        </div>
      </section>
    </div>
  );
}
