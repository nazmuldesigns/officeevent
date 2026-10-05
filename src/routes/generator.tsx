import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import {
  Barcode,
  Download,
  FileArchive,
  Layers,
  LoaderCircle,
  Printer,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { renderCode128Svg, svgFileName } from "@/lib/barcode/svg";
import { encodeCode128B } from "@/lib/barcode/code128";
import { useRegistry } from "@/lib/store";
import type { PassType } from "@/lib/types";
import { cn, downloadBlob, downloadText, normalizeId } from "@/lib/utils";

export const Route = createFileRoute("/generator")({ component: GeneratorPage });

function GeneratorPage() {
  const [tab, setTab] = useState<"single" | "bulk">("single");

  return (
    <div className="space-y-5">
      <header className="px-1">
        <div className="flex items-center gap-2">
          <Barcode className="size-6 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Event Badge & Barcode Studio
          </h1>
        </div>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Generate print-ready vector Code 128 badges tailored for 3 pass styles (Day 1, Day 2, and 2-Day All Access).
        </p>
      </header>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 rounded-2xl border border-border/80 bg-muted/80 p-1">
        <button
          type="button"
          onClick={() => setTab("single")}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150",
            tab === "single"
              ? "border border-border/80 bg-card text-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Barcode className="size-4" />
          <span>Single Badge Design</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("bulk")}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150",
            tab === "bulk"
              ? "border border-border/80 bg-card text-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="size-4" />
          <span>Bulk ZIP Generator</span>
        </button>
      </div>

      {tab === "single" ? <SingleStudio /> : <BulkStudio />}
    </div>
  );
}

function SingleStudio() {
  const [raw, setRaw] = useState("NRB20260001");
  const [attendeeName, setAttendeeName] = useState("Guest Attendee");
  const [passStyle, setPassStyle] = useState<PassType>("Both Days");

  const id = normalizeId(raw);
  const preview = useMemo(() => {
    if (!id) return { svg: "", error: "Please enter an attendee ID." };
    try {
      encodeCode128B(id);
      return { svg: renderCode128Svg(id), error: "" };
    } catch (error) {
      return {
        svg: "",
        error: error instanceof Error ? error.message : "Could not encode barcode.",
      };
    }
  }, [id]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* Configuration Controls */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Attendee ID Code
          </span>
          <Input
            value={raw}
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 font-mono text-base font-bold tracking-wider"
            placeholder="e.g. NRB20260001"
            onChange={(event) => setRaw(event.target.value.toUpperCase())}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Badge Name
          </span>
          <Input
            value={attendeeName}
            className="h-11 font-medium text-sm"
            placeholder="e.g. Tanvir Ahmed"
            onChange={(event) => setAttendeeName(event.target.value)}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Pass Style
          </span>
          <select
            value={passStyle}
            onChange={(e) => setPassStyle(e.target.value as PassType)}
            className="h-11 w-full rounded-xl border border-border/80 bg-muted px-3 text-sm font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Both Days">Style 3: Both Days (All Access)</option>
            <option value="Day 1 Only">Style 1: Day 1 Pass Only</option>
            <option value="Day 2 Only">Style 2: Day 2 Pass Only</option>
          </select>
        </label>
      </div>

      {/* Badge Visual Card Preview */}
      <div className="overflow-hidden rounded-[28px] border border-border/80 bg-white p-6 shadow-2xl transition-all text-slate-900 print:m-0 print:p-0 print:border-none print:shadow-none">
        <div className="mx-auto max-w-sm rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-md space-y-4 text-center">
          {/* Header Pass Banner */}
          <div
            className={cn(
              "rounded-2xl py-2 px-4 font-black uppercase tracking-[0.2em] text-xs shadow-sm",
              passStyle === "Both Days" &&
                "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
              passStyle === "Day 1 Only" &&
                "bg-gradient-to-r from-sky-600 to-blue-600 text-white",
              passStyle === "Day 2 Only" &&
                "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white",
            )}
          >
            {passStyle === "Both Days"
              ? "★ ALL ACCESS · BOTH DAYS ★"
              : passStyle === "Day 1 Only"
                ? "DAY 1 PASS · OPENING"
                : "DAY 2 PASS · GRAND FINALE"}
          </div>

          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {attendeeName || "Guest Attendee"}
            </h3>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-0.5">
              NRB World Event 2026
            </p>
          </div>

          {/* Barcode Render Area */}
          <div className="py-2">
            {preview.svg ? (
              <div
                className="mx-auto max-w-full [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{
                  __html: preview.svg.replace(/^<\?xml[^>]*>/, ""),
                }}
              />
            ) : (
              <p className="py-8 text-sm font-medium text-slate-400">{preview.error}</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>ID: {id || "NRB2026..."}</span>
            <span className="font-sans font-bold text-slate-700">{passStyle}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          variant="secondary"
          className="h-12 font-bold shadow-md active:scale-95 border border-border/80"
          onClick={handlePrint}
          disabled={!preview.svg}
        >
          <Printer className="mr-2 size-4.5 text-primary" />
          Print Badge
        </Button>

        <Button
          size="lg"
          className="h-12 font-bold shadow-md active:scale-95"
          disabled={!preview.svg}
          onClick={() => {
            if (!preview.svg || !id) return;
            downloadText(preview.svg, svgFileName(id), "image/svg+xml;charset=utf-8");
            toast.success(`Exported ${svgFileName(id)} vector badge`);
          }}
        >
          <Download className="mr-2 size-4.5" />
          Download SVG
        </Button>
      </div>
    </div>
  );
}

function BulkStudio() {
  const attendees = useRegistry((s) => s.attendees);
  const [text, setText] = useState("NRB20260001\nNRB20260002\nNRB20260003\nNRB20260004");
  const [busy, setBusy] = useState(false);
  const ids = text
    .split(/\r?\n/)
    .map((line) => normalizeId(line))
    .filter(Boolean);
  const unique = [...new Set(ids)];
  const previews = unique.slice(0, 6);

  async function downloadZip() {
    if (!unique.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const failed: string[] = [];
      for (const id of unique) {
        try {
          zip.file(svgFileName(id), renderCode128Svg(id));
        } catch {
          failed.push(id);
        }
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadBlob(blob, "NRB-World-Barcodes.zip");
      if (failed.length) {
        toast.error(`Skipped ${failed.length} invalid ID${failed.length === 1 ? "" : "s"}.`);
      } else {
        toast.success(`Successfully saved ${unique.length} SVG barcodes to ZIP.`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Bulk ID List (One per line)
          </span>
          <span className="text-xs font-semibold text-primary">
            {unique.length} unique ID{unique.length === 1 ? "" : "s"}
          </span>
        </div>
        <Textarea
          value={text}
          spellCheck={false}
          rows={5}
          className="font-mono text-sm font-semibold tracking-wider placeholder:text-muted-foreground/60"
          placeholder="NRB20260001&#10;NRB20260002&#10;NRB20260003"
          onChange={(event) => setText(event.target.value.toUpperCase())}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-10 border border-border/80 text-xs font-bold active:scale-95"
          onClick={() => {
            const list = attendees.map((row) => row.id).join("\n");
            if (!list) {
              toast.error("No IDs in the current registry.");
              return;
            }
            setText(list);
            toast.success(`Loaded ${attendees.length} IDs from attendee registry.`);
          }}
        >
          <Sparkles className="mr-1.5 size-3.5 text-primary" />
          Load All IDs from Sheet ({attendees.length})
        </Button>
      </div>

      {previews.length ? (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Sample Vector Previews
          </span>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {previews.map((id) => {
              try {
                const svg = renderCode128Svg(id, {
                  moduleWidth: 2,
                  barHeight: 52,
                  textSize: 11,
                  padding: 8,
                }).replace(/^<\?xml[^>]*>/, "");
                return (
                  <div
                    key={id}
                    className="overflow-hidden rounded-2xl border border-border/80 bg-white p-2.5 shadow-sm"
                  >
                    <div
                      className="[&_svg]:h-auto [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>
                );
              } catch {
                return (
                  <div
                    key={id}
                    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-400"
                  >
                    {id} invalid format
                  </div>
                );
              }
            })}
          </div>
        </div>
      ) : null}

      <Button
        size="lg"
        className="h-12 w-full font-bold shadow-md active:scale-95"
        disabled={!unique.length || busy}
        onClick={() => void downloadZip()}
      >
        {busy ? (
          <>
            <LoaderCircle className="mr-2 size-4.5 animate-spin" />
            Generating Vector ZIP…
          </>
        ) : (
          <>
            <FileArchive className="mr-2 size-4.5" />
            Download {unique.length} Barcodes as ZIP
          </>
        )}
      </Button>
    </div>
  );
}
