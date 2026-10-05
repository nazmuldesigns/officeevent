import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Barcode,
  Calendar,
  LayoutDashboard,
  Maximize,
  Minimize,
  Moon,
  ScanLine,
  Settings2,
  Sun,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { unlockAudio } from "@/lib/audio/sounds";
import { APP_NAME } from "@/lib/constants";
import { syncRegistry, useRegistry, useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Check-in", icon: ScanLine },
  { to: "/directory", label: "Directory", icon: Users },
  { to: "/generator", label: "Barcodes", icon: Barcode },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const setSoundEnabled = useSettings((s) => s.setSoundEnabled);
  const gate = useSettings((s) => s.gate);
  const eventDay = useSettings((s) => s.eventDay);
  const setEventDay = useSettings((s) => s.setEventDay);
  const syncStatus = useRegistry((s) => s.syncStatus);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [logoLoaded, setLogoLoaded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (document.documentElement as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Real-time synchronization every 12 seconds across all devices
  useEffect(() => {
    void syncRegistry();
    const timer = window.setInterval(() => {
      void syncRegistry();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground transition-colors duration-200">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-3 transition-opacity active:opacity-80"
          >
            {logoLoaded ? (
              <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-card p-1 shadow-sm transition-transform duration-200 group-hover:scale-105">
                <img
                  src="/logo.png"
                  alt="NRB World Logo"
                  className="size-full object-contain"
                  onError={() => setLogoLoaded(false)}
                />
              </div>
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
                <ScanLine className="size-5" strokeWidth={2.2} />
              </span>
            )}

            <div className="min-w-0">
              <span className="block truncate text-[15px] font-bold tracking-tight text-foreground sm:text-base">
                {APP_NAME}
              </span>
              <span className="flex items-center gap-1.5 truncate text-[11px] font-medium text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/90">
                  {gate}
                </span>
                <span>·</span>
                <span className="font-semibold text-emerald-400">Sheet Connected</span>
              </span>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Quick Event Day Badge */}
            <button
              type="button"
              onClick={() => {
                const nextDay = eventDay === 1 ? 2 : 1;
                setEventDay(nextDay);
                toast.success(`Active Day switched to Day ${nextDay}`);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-sky-500/35 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-400 hover:bg-sky-500/25 active:scale-95 transition-all"
              title="Click to toggle between Event Day 1 and Day 2"
            >
              <Calendar className="size-3" />
              <span>Day {eventDay}</span>
            </button>

            <SyncChip status={syncStatus} />

            {/* Fullscreen Button */}
            <button
              type="button"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              onClick={() => void toggleFullscreen()}
              className="grid size-10 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
              title={isFullscreen ? "Exit Fullscreen (পূর্ণ স্ক্রিন বন্ধ)" : "Fullscreen Mode (সম্পূর্ণ স্ক্রিন চালু)"}
            >
              {isFullscreen ? (
                <Minimize className="size-4.5 text-sky-400" />
              ) : (
                <Maximize className="size-4.5 text-slate-300" />
              )}
            </button>

            <button
              type="button"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid size-10 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
              title={theme === "dark" ? "Light Mode" : "Dark Navy Mode"}
            >
              {theme === "dark" ? (
                <Sun className="size-4.5 text-amber-400" />
              ) : (
                <Moon className="size-4.5 text-blue-600" />
              )}
            </button>

            <button
              type="button"
              aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
              onClick={() => {
                void unlockAudio();
                setSoundEnabled(!soundEnabled);
              }}
              className="grid size-10 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
              title={soundEnabled ? "Sound ON" : "Sound Muted"}
            >
              {soundEnabled ? (
                <Volume2 className="size-4.5 text-emerald-400" />
              ) : (
                <VolumeX className="size-4.5 text-muted-foreground" />
              )}
            </button>

            <Link
              to="/setup"
              aria-label="Setup"
              className={cn(
                "grid size-10 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95",
                pathname === "/setup" && "border-primary/50 bg-primary/15 text-primary",
              )}
              title="Station & System Settings"
            >
              <Settings2 className="size-4.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 sm:px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* 4-Tab Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-4xl grid-cols-4 gap-1.5 px-2.5 py-2">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold tracking-wide transition-all duration-150 active:scale-95",
                  active
                    ? "border border-primary/30 bg-primary/12 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.3 : 1.9} />
                <span>{item.label}</span>
                {active && (
                  <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <Toaster
        theme={theme}
        position="top-center"
        toastOptions={{
          className: "!bg-card !text-foreground !border-border !shadow-[var(--shadow-elevated)]",
        }}
      />
    </div>
  );
}

function SyncChip({ status }: { status: string }) {
  const label =
    status === "syncing"
      ? "Syncing…"
      : status === "ok"
        ? "Live"
        : status === "error"
          ? "Sync Error"
          : status === "offline"
            ? "Offline"
            : "Live";
  const tone =
    status === "ok"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "error" || status === "offline"
        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
        : status === "syncing"
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide sm:inline-flex",
        tone,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "syncing" && "animate-ping",
        )}
      />
      {label}
    </span>
  );
}
