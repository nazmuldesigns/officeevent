import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playSound, unlockAudio } from "@/lib/audio/sounds";
import { useSettings } from "@/lib/store";
import { cn, normalizeId } from "@/lib/utils";

type CameraState = "off" | "starting" | "live" | "denied" | "missing" | "error";

export function ScannerView({
  armed,
  verifyingId,
  onScan,
}: {
  armed: boolean;
  verifyingId: string | null;
  onScan: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const armedRef = useRef(armed);
  const lastRef = useRef({ id: "", at: 0 });
  const [camera, setCamera] = useState<CameraState>("off");
  const [message, setMessage] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "html5" | "none">("none");
  const [manual, setManual] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  const emit = useCallback((raw: string) => {
    if (!armedRef.current) return;
    const id = normalizeId(raw);
    if (!id) return;
    const now = Date.now();
    if (id === lastRef.current.id && now - lastRef.current.at < 800) return;
    lastRef.current = { id, at: now };
    playSound("tick", useSettings.getState().soundEnabled);
    onScanRef.current(id);
  }, []);

  const handleRescan = useCallback(() => {
    lastRef.current = { id: "", at: 0 };
    void unlockAudio();
    playSound("tick", useSettings.getState().soundEnabled);
    toast.info("Scanner reset & ready for scan");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let html5: { stop: () => Promise<void>; clear: () => void } | null = null;
    let html5Running = false;

    async function start() {
      setCamera("starting");
      setMessage(null);
      const Detector = (
        window as Window & {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;

      if (Detector && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          const video = videoRef.current;
          if (!video) throw new Error("Video element missing");
          video.srcObject = stream;
          await video.play();
          const detector = new Detector({ formats: ["code_128"] });
          setEngine("native");
          setCamera("live");
          const tick = async () => {
            if (cancelled) return;
            if (armedRef.current && video.readyState >= 2) {
              try {
                const codes = await detector.detect(video);
                const hit = codes.find((code) => code.rawValue);
                if (hit?.rawValue) emit(hit.rawValue);
              } catch {
                /* empty frame */
              }
            }
            raf = window.requestAnimationFrame(() => {
              void tick();
            });
          };
          void tick();
          return;
        } catch (error) {
          stream?.getTracks().forEach((track) => track.stop());
          stream = null;
          const name = error instanceof DOMException ? error.name : "";
          if (name === "NotAllowedError") {
            setCamera("denied");
            setMessage("Camera permission is blocked. Please allow camera access in browser settings.");
            return;
          }
        }
      }

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("gateflow-html5-scanner", {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
        });
        html5 = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            aspectRatio: 1.777,
            qrbox: (w: number, h: number) => ({
              width: Math.floor(Math.min(w, 460) * 0.9),
              height: Math.max(100, Math.floor(Math.min(h, 320) * 0.42)),
            }),
          },
          (text: string) => emit(text),
          () => undefined,
        );
        if (cancelled) {
          await scanner.stop().catch(() => undefined);
          try {
            scanner.clear();
          } catch {
            /* ignore */
          }
          return;
        }
        html5Running = true;
        setEngine("html5");
        setCamera("live");
      } catch (error) {
        html5Running = false;
        try {
          html5?.clear();
        } catch {
          /* never started */
        }
        html5 = null;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError") {
          setCamera("denied");
          setMessage("Camera permission is blocked.");
        } else if (name === "NotFoundError") {
          setCamera("missing");
          setMessage("No camera found. Use manual ID entry.");
        } else {
          setCamera("error");
          setMessage("Camera is ready or offline. Use manual entry below.");
        }
        setEngine("none");
      }
    }

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      const instance = html5;
      const running = html5Running;
      html5 = null;
      html5Running = false;
      if (!instance) return;
      void (async () => {
        try {
          if (running) await instance.stop();
        } catch {
          /* already stopped */
        }
        try {
          instance.clear();
        } catch {
          /* already cleared */
        }
      })();
    };
  }, [emit]);

  function submitManual(event: React.FormEvent) {
    event.preventDefault();
    void unlockAudio();
    const id = normalizeId(manual);
    if (!id) return;
    setManual("");
    emit(id);
  }

  return (
    <div className="space-y-4">
      {/* Camera Viewfinder */}
      <section className="relative overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-2xl transition-all">
        <div className="relative aspect-[4/5] max-h-[min(60dvh,520px)] min-h-[290px] w-full overflow-hidden bg-[#040814] sm:aspect-[16/11] sm:max-h-[400px]">
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 size-full object-cover",
              engine === "native" ? "opacity-100" : "opacity-0",
            )}
            playsInline
            muted
            autoPlay
          />
          <div
            id="gateflow-html5-scanner"
            className={cn(
              "absolute inset-0",
              engine === "html5" ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />

          {camera !== "live" ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3.5 px-6 text-center text-slate-200">
              {camera === "starting" ? (
                <div className="flex flex-col items-center gap-2">
                  <LoaderCircle className="size-10 animate-spin text-primary" />
                  <p className="mt-2 text-sm font-semibold tracking-wide text-slate-300">
                    Initializing Rear Camera for Code 128…
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="grid size-14 place-items-center rounded-2xl bg-card/80 text-muted-foreground shadow-md">
                    <CameraOff className="size-7 opacity-80" />
                  </div>
                  <p className="max-w-[17rem] text-xs leading-relaxed text-muted-foreground">
                    {message || "Camera feed ready. Point at barcode or use manual entry below."}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Scanner Overlay Box & Laser Reticle */}
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between p-6">
            <div className="flex w-full items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold tracking-wider text-sky-400 backdrop-blur-md border border-sky-500/30 uppercase">
                <Camera className="size-3.5" />
                <span>Rear Scanner</span>
              </span>
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-widest text-slate-300 backdrop-blur-md uppercase">
                Code 128
              </span>
            </div>

            <div className="relative h-[48%] w-[86%] sm:h-[45%] sm:w-[72%]">
              {/* Glowing Corner Accents */}
              <div className="absolute inset-0 rounded-2xl border border-sky-400/40 bg-sky-500/5 shadow-[0_0_20px_rgba(56,189,248,0.15)]" />
              <span className="absolute -left-1 -top-1 size-6 rounded-tl-xl border-t-[3px] border-l-[3px] border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
              <span className="absolute -right-1 -top-1 size-6 rounded-tr-xl border-t-[3px] border-r-[3px] border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
              <span className="absolute -bottom-1 -left-1 size-6 rounded-bl-xl border-b-[3px] border-l-[3px] border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
              <span className="absolute -bottom-1 -right-1 size-6 rounded-br-xl border-b-[3px] border-r-[3px] border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />

              {/* Sweeping Laser Line */}
              {armed ? (
                <div className="scan-sweep absolute inset-x-2 h-1 rounded-full bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_#38bdf8]" />
              ) : null}
            </div>

            <p className="text-center text-[11px] font-medium tracking-[0.16em] text-slate-300/80 drop-shadow uppercase">
              Align barcode inside frame
            </p>
          </div>

          {/* In-flight Verification Backdrop */}
          {verifyingId ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/75 px-6 text-center backdrop-blur-md">
              <div className="space-y-3">
                <LoaderCircle className="mx-auto size-10 animate-spin text-sky-400" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">
                  Verifying Attendee
                </p>
                <p className="pulse-id font-mono text-2xl font-bold tracking-wider text-white">
                  {verifyingId}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Rescan Barcode / Quick Camera Reset */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleRescan}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border-sky-500/35 bg-sky-500/10 px-4 text-xs font-bold tracking-wide text-sky-400 shadow-sm transition-all duration-150 hover:bg-sky-500/20 active:scale-95"
        >
          <RotateCcw className="size-4.5" />
          <span>Rescan Barcode / আবার স্ক্যান করুন</span>
        </Button>
      </div>

      {/* Manual ID Form */}
      <form
        onSubmit={submitManual}
        className="rounded-[24px] border border-border/80 bg-card p-4 shadow-[var(--shadow-border)]"
      >
        <div className="mb-2.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Keyboard className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.15em]">
              Manual ID Verification
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">Format: NRB2026...</span>
        </div>
        <div className="flex gap-2.5">
          <Input
            value={manual}
            placeholder="e.g. NRB20260001"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 font-mono text-base font-semibold tracking-wider placeholder:text-muted-foreground/60"
            onChange={(event) => setManual(event.target.value.toUpperCase())}
          />
          <Button type="submit" size="lg" className="h-12 shrink-0 px-6 font-bold shadow-md">
            Verify ID
          </Button>
        </div>
      </form>
    </div>
  );
}
