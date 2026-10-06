import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Database,
  KeyRound,
  Link as LinkIcon,
  Lock,
  Moon,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  Unlock,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_LOCK_PIN, DEFAULT_SCRIPT_URL } from "@/lib/constants";
import { playSound, unlockAudio } from "@/lib/audio/sounds";
import {
  syncRegistry,
  testConnection,
  useSettings,
} from "@/lib/store";
import { GATES, type EventDay } from "@/lib/types";
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
  const eventDay = useSettings((s) => s.eventDay);
  const setEventDay = useSettings((s) => s.setEventDay);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const setSoundEnabled = useSettings((s) => s.setSoundEnabled);

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
      toast.success("Endpoint Configuration Unlocked!");
    } else {
      toast.error("Incorrect Admin PIN! Access denied.");
    }
  }

  function testSound(kind: "verified" | "already" | "invalid_day") {
    void unlockAudio();
    playSound(kind, true);
    toast.info(`Playing ${kind} sound effect`);
  }

  return (
    <div className="space-y-5">
      <header className="px-1">
        <div className="flex items-center gap-2">
          <Settings className="size-6 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Station & System Settings
          </h1>
        </div>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Configure active event day, station gates, staff identity, audio feedback, and cloud backend.
        </p>
      </header>

      {/* Event Day Configuration */}
      <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2 text-foreground">
          <Calendar className="size-4.5 text-primary" />
          <h2 className="text-sm font-bold tracking-tight">Active Event Day Schedule</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Set the active day to automatically enforce pass validity rules during check-in.
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-3">
          {([1, 2] as const).map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                setEventDay(day);
                toast.success(`Switched to Event Day ${day}`);
              }}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-2xl border text-xs font-bold transition-all duration-150 active:scale-95",
                eventDay === day
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-400 shadow-md ring-2 ring-sky-500/30"
                  : "border-border/80 bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-sm font-extrabold tracking-wide">
                Day {day}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {day === 1 ? "Opening & Main Event" : "Grand Finale & Closing"}
              </span>
            </button>
          ))}
        </div>
      </section>

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

        {/* Audio Effects Testing & Controls */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Audio Feedback & Sound Effects
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {soundEnabled ? "Enabled" : "Muted"}
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-[11px] font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => testSound("verified")}
            >
              <Volume2 className="mr-1 size-3.5" />
              Chime
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-[11px] font-bold border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => testSound("already")}
            >
              <Volume2 className="mr-1 size-3.5" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-[11px] font-bold border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={() => testSound("invalid_day")}
            >
              <Volume2 className="mr-1 size-3.5" />
              Wrong Day
            </Button>
          </div>
        </div>

        {/* Theme Preference */}
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
            <h2 className="text-sm font-bold tracking-tight">Cloud Google Sheets Endpoint</h2>
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

        {/* Google Apps Script Deployment Configuration Guide */}
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
            <span>Google Apps Script Deployment সঠিক সেটিংস:</span>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl bg-card/80 p-2.5 border border-border/60">
              <span className="font-semibold text-muted-foreground block text-[11px]">1. Execute as (কার হিসেবে চলবে):</span>
              <span className="font-bold text-emerald-400 text-xs">Me (আপনার ইমেইল অ্যাকাউন্ট)</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">কখনোই "User accessing the web app" রাখবেন না।</p>
            </div>
            <div className="rounded-xl bg-card/80 p-2.5 border border-border/60">
              <span className="font-semibold text-muted-foreground block text-[11px]">2. Who has access (কার অ্যাক্সেস আছে):</span>
              <span className="font-bold text-emerald-400 text-xs">Anyone (যে কেউ)</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">"Anyone with Google account" নয়, সম্পূর্ণ 'Anyone'।</p>
            </div>
          </div>
          <p className="text-[11px] text-sky-300/80 leading-relaxed">
            Apps Script এ <strong>Deploy &gt; Manage Deployments &gt; Edit</strong> করে ওপরের দুটি সেটিংস মিলিয়ে <strong>Deploy</strong> বাটনে ক্লিক করলেই গুগল লগইন ঝামেলা ছাড়া সরাসরি সিঙ্ক হবে।
          </p>
        </div>
      </section>

      {/* Google Sheet 10-Column Data Format Guide */}
      <section className="space-y-3.5 rounded-[24px] border border-border/80 bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Database className="size-4.5 text-primary" />
            <h2 className="text-sm font-bold tracking-tight">গুগল শিটের ১০টি কলামের তালিকা ও নিয়ম</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold border-border/80"
            onClick={() => {
              const headers = "ID\tName\tCountry\tPass Type\tDay 1 Entry\tDay 1 Time\tDay 2 Entry\tDay 2 Time\tGate\tChecked By";
              void navigator.clipboard.writeText(headers);
              toast.success("১০টি কলামের হেডার কপি করা হয়েছে! গুগল শিটের ১ম সারিতে পেস্ট করুন।");
            }}
          >
            Copy Sheet Headers
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          সাইট বুঝতে পারে কোন ব্যক্তি কোন দিনের পাস পেয়েছে কারণ গুগল শিটের <strong>Col D (Pass Type)</strong>-এ সেটি উল্লেখ থাকে:
        </p>

        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-muted/50">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/80 bg-muted font-bold text-foreground">
              <tr>
                <th className="px-3 py-2.5">কলাম</th>
                <th className="px-3 py-2.5">হেডার নাম</th>
                <th className="px-3 py-2.5">বর্ণনা ও অনুমোদিত মান</th>
                <th className="px-3 py-2.5">উদাহরণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-muted-foreground">
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">A (Col 1)</td>
                <td className="px-3 py-2 font-bold text-foreground">ID</td>
                <td className="px-3 py-2">ইউনিক মেম্বার আইডি (বারকোডেও এটি থাকে)</td>
                <td className="px-3 py-2 font-mono text-emerald-400">NRB20260001</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">B (Col 2)</td>
                <td className="px-3 py-2 font-bold text-foreground">Name</td>
                <td className="px-3 py-2">মেহমানের নাম</td>
                <td className="px-3 py-2">Tanvir Ahmed</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">C (Col 3)</td>
                <td className="px-3 py-2 font-bold text-foreground">Country</td>
                <td className="px-3 py-2">দেশ বা প্রতিষ্ঠান</td>
                <td className="px-3 py-2">Bangladesh</td>
              </tr>
              <tr className="bg-primary/10">
                <td className="px-3 py-2 font-mono font-black text-amber-400">D (Col 4)</td>
                <td className="px-3 py-2 font-black text-foreground">Pass Type</td>
                <td className="px-3 py-2 font-semibold text-foreground">
                  <span className="text-sky-400">Day 1 Only</span> | <span className="text-purple-400">Day 2 Only</span> | <span className="text-amber-400">Both Days</span>
                </td>
                <td className="px-3 py-2 font-bold text-amber-400">Both Days</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">E (Col 5)</td>
                <td className="px-3 py-2 font-bold text-foreground">Day 1 Entry</td>
                <td className="px-3 py-2">দিন ১ এন্ট্রি স্ট্যাটাস (স্ক্যান করলে অটো আপডেট হয়)</td>
                <td className="px-3 py-2 font-mono">ENTERED</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">F (Col 6)</td>
                <td className="px-3 py-2 font-bold text-foreground">Day 1 Time</td>
                <td className="px-3 py-2">দিন ১ এন্ট্রি টাইমস্ট্যাম্প (অটো আপডেট)</td>
                <td className="px-3 py-2 font-mono">2026-10-06 09:30:00</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">G (Col 7)</td>
                <td className="px-3 py-2 font-bold text-foreground">Day 2 Entry</td>
                <td className="px-3 py-2">দিন ২ এন্ট্রি স্ট্যাটাস (স্ক্যান করলে অটো আপডেট হয়)</td>
                <td className="px-3 py-2 font-mono">ENTERED</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">H (Col 8)</td>
                <td className="px-3 py-2 font-bold text-foreground">Day 2 Time</td>
                <td className="px-3 py-2">দিন ২ এন্ট্রি টাইমস্ট্যাম্প (অটো আপডেট)</td>
                <td className="px-3 py-2 font-mono">2026-10-07 10:15:00</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">I (Col 9)</td>
                <td className="px-3 py-2 font-bold text-foreground">Gate</td>
                <td className="px-3 py-2">যে গেটে স্ক্যান করা হয়েছে</td>
                <td className="px-3 py-2">Gate 1</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono font-bold text-sky-400">J (Col 10)</td>
                <td className="px-3 py-2 font-bold text-foreground">Checked By</td>
                <td className="px-3 py-2">যে স্টাফ মেম্বার স্ক্যান করেছেন</td>
                <td className="px-3 py-2">VIP Desk Officer</td>
              </tr>
            </tbody>
          </table>
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
    </div>
  );
}
