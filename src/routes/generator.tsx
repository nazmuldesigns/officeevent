import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import {
  Barcode,
  CheckCircle2,
  Download,
  FileArchive,
  HelpCircle,
  IdCard,
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
import {
  badgeCardFileName,
  renderBadgeCardSvg,
  renderCode128Svg,
  svgFileName,
} from "@/lib/barcode/svg";
import { encodeCode128B } from "@/lib/barcode/code128";
import { useRegistry } from "@/lib/store";
import type { Attendee, PassType } from "@/lib/types";
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
          Generate print-ready vector color badges & Code 128 barcodes tailored for 3 pass styles (Day 1, Day 2, and 2-Day All Access).
        </p>
      </header>

      {/* How it Works / Explainer Banner */}
      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
          <HelpCircle className="size-4 shrink-0" />
          <span>পাস ও বারকোড যাচাই পদ্ধতি কীভাবে কাজ করে?</span>
        </div>
        <p className="text-xs text-sky-200/90 leading-relaxed">
          <strong>১. বারকোড:</strong> বারকোডের দাগগুলোতে মূলত ব্যক্তির <strong>ইউনিক আইডি (যেমন NRB20260001)</strong> এনকোড করা থাকে।<br />
          <strong>২. গুগল শিট:</strong> গুগল শিটের <strong>Col D (Pass Type)</strong>-এ সংরক্ষিত থাকে উক্ত ব্যক্তি <strong>Day 1 Only</strong>, <strong>Day 2 Only</strong> নাকি <strong>Both Days</strong> এর জন্য রেজিস্টার্ড।<br />
          <strong>৩. স্ক্যানার যাচাই:</strong> গেটের স্ক্যানার আইডিটি পড়া মাত্রই শিটের সাথে মিলিয়ে মুহূর্তের মধ্যে অ্যাক্সেস অনুমোদন বা বাতিল করে।
        </p>
      </div>

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
          <IdCard className="size-4" />
          <span>Single Badge Studio</span>
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
          <span>Bulk ZIP Export</span>
        </button>
      </div>

      {tab === "single" ? <SingleStudio /> : <BulkStudio />}
    </div>
  );
}

function SingleStudio() {
  const [raw, setRaw] = useState("NRB20260001");
  const [attendeeName, setAttendeeName] = useState("Tanvir Ahmed");
  const [country, setCountry] = useState("Bangladesh");
  const [passStyle, setPassStyle] = useState<PassType>("Both Days");

  const id = normalizeId(raw);
  const preview = useMemo(() => {
    if (!id) return { barcodeSvg: "", badgeSvg: "", error: "Please enter an attendee ID." };
    try {
      encodeCode128B(id);
      const barcodeSvg = renderCode128Svg(id);
      const badgeSvg = renderBadgeCardSvg({
        id,
        name: attendeeName,
        country,
        passType: passStyle,
      });
      return { barcodeSvg, badgeSvg, error: "" };
    } catch (error) {
      return {
        barcodeSvg: "",
        badgeSvg: "",
        error: error instanceof Error ? error.message : "Could not encode barcode.",
      };
    }
  }, [id, attendeeName, country, passStyle]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* Configuration Controls */}
      <div className="grid gap-3 sm:grid-cols-4">
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
            Country / Org
          </span>
          <Input
            value={country}
            className="h-11 font-medium text-sm"
            placeholder="e.g. USA / Bangladesh"
            onChange={(event) => setCountry(event.target.value)}
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
            <option value="Both Days">Style 3: Both Days (VIP Gold)</option>
            <option value="Day 1 Only">Style 1: Day 1 Only (Sky Blue)</option>
            <option value="Day 2 Only">Style 2: Day 2 Only (Purple)</option>
          </select>
        </label>
      </div>

      {/* Badge Visual Card Preview */}
      <div className="overflow-hidden rounded-[28px] border border-border/80 bg-slate-950/40 p-4 sm:p-6 shadow-2xl transition-all text-slate-900 print:m-0 print:p-0 print:border-none print:shadow-none">
        <div className="mx-auto max-w-sm">
          {preview.badgeSvg ? (
            <div
              className="mx-auto max-w-full [&_svg]:h-auto [&_svg]:w-full rounded-3xl overflow-hidden shadow-2xl transition-transform duration-200 hover:scale-[1.01]"
              dangerouslySetInnerHTML={{
                __html: preview.badgeSvg.replace(/^<\?xml[^>]*>/, ""),
              }}
            />
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
              {preview.error}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Button
          size="lg"
          variant="secondary"
          className="h-12 font-bold shadow-md active:scale-95 border border-border/80"
          onClick={handlePrint}
          disabled={!preview.badgeSvg}
        >
          <Printer className="mr-2 size-4.5 text-primary" />
          Print Badge Card
        </Button>

        <Button
          size="lg"
          className="h-12 font-bold shadow-md active:scale-95 bg-primary text-primary-foreground"
          disabled={!preview.badgeSvg}
          onClick={() => {
            if (!preview.badgeSvg || !id) return;
            const fileName = badgeCardFileName(id, passStyle);
            downloadText(preview.badgeSvg, fileName, "image/svg+xml;charset=utf-8");
            toast.success(`Exported ${fileName} full event badge`);
          }}
        >
          <Download className="mr-2 size-4.5" />
          Download Full Badge (SVG)
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="h-12 font-bold shadow-md active:scale-95 border-border/80"
          disabled={!preview.barcodeSvg}
          onClick={() => {
            if (!preview.barcodeSvg || !id) return;
            downloadText(preview.barcodeSvg, svgFileName(id), "image/svg+xml;charset=utf-8");
            toast.success(`Exported ${svgFileName(id)} raw barcode`);
          }}
        >
          <Barcode className="mr-2 size-4.5 text-sky-400" />
          Download Barcode Only
        </Button>
      </div>
    </div>
  );
}

function BulkStudio() {
  const attendees = useRegistry((s) => s.attendees);
  const [text, setText] = useState(
    "NRB20260001\tTanvir Ahmed\tBangladesh\tBoth Days\n" +
    "NRB20260002\tFarhana Rahman\tUSA\tDay 1 Only\n" +
    "NRB20260003\tKazi Mahbub\tUK\tDay 2 Only\n" +
    "NRB20260004\tNusrat Jahan\tCanada\tBoth Days"
  );
  const [exportType, setExportType] = useState<"fullBadges" | "barcodesOnly">("fullBadges");
  const [busy, setBusy] = useState(false);

  const parsedItems = useMemo(() => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const list: Array<{ id: string; name: string; country: string; passType: PassType }> = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      const rawId = parts[0] || "";
      const id = normalizeId(rawId);
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const name = parts[1] || "Guest Attendee";
      const country = parts[2] || "Bangladesh";
      let passType: PassType = "Both Days";
      const rawPass = (parts[3] || "").toLowerCase();
      if (rawPass.includes("1") && !rawPass.includes("2") && !rawPass.includes("both")) {
        passType = "Day 1 Only";
      } else if (rawPass.includes("2") && !rawPass.includes("1") && !rawPass.includes("both")) {
        passType = "Day 2 Only";
      }

      list.push({ id, name, country, passType });
    }
    return list;
  }, [text]);

  const previews = parsedItems.slice(0, 3);

  async function downloadZip() {
    if (!parsedItems.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const failed: string[] = [];

      for (const item of parsedItems) {
        try {
          if (exportType === "fullBadges") {
            const svgContent = renderBadgeCardSvg(item);
            zip.file(badgeCardFileName(item.id, item.passType), svgContent);
          } else {
            const svgContent = renderCode128Svg(item.id);
            zip.file(svgFileName(item.id), svgContent);
          }
        } catch {
          failed.push(item.id);
        }
      }

      const zipName =
        exportType === "fullBadges"
          ? "NRB-World-Event-Badges-Color.zip"
          : "NRB-World-Barcodes-Only.zip";
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadBlob(blob, zipName);

      if (failed.length) {
        toast.error(`Skipped ${failed.length} invalid ID${failed.length === 1 ? "" : "s"}.`);
      } else {
        toast.success(`Successfully saved ${parsedItems.length} vector badges to ${zipName}.`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Input Box */}
      <label className="block space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Bulk Attendee List (ID &bull; Name &bull; Country &bull; Pass Type)
          </span>
          <span className="text-xs font-semibold text-primary">
            {parsedItems.length} unique attendee{parsedItems.length === 1 ? "" : "s"}
          </span>
        </div>
        <Textarea
          value={text}
          spellCheck={false}
          rows={6}
          className="font-mono text-xs font-semibold tracking-wider placeholder:text-muted-foreground/60"
          placeholder="NRB20260001&#9;Tanvir Ahmed&#9;Bangladesh&#9;Both Days"
          onChange={(event) => setText(event.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Tip: You can paste directly from Excel or Google Sheets (Columns: ID, Name, Country, Pass Type).
        </p>
      </label>

      {/* Helper Load Button */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-10 border border-border/80 text-xs font-bold active:scale-95"
          onClick={() => {
            if (!attendees.length) {
              toast.error("No attendees loaded in the live registry. Please connect & sync sheet first.");
              return;
            }
            const rows = attendees
              .map((a) => `${a.id}\t${a.name}\t${a.country}\t${a.passType}`)
              .join("\n");
            setText(rows);
            toast.success(`Loaded ${attendees.length} attendees with their pass types from Google Sheet!`);
          }}
        >
          <Sparkles className="mr-1.5 size-3.5 text-primary" />
          Load All {attendees.length} Attendees from Google Sheet
        </Button>
      </div>

      {/* Export Format Selector */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          ZIP Export Package Format
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setExportType("fullBadges")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all active:scale-95",
              exportType === "fullBadges"
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                : "border-border/80 bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <IdCard className="size-4 mb-1" />
            <span>Full Color Event Badges (SVG)</span>
            <span className="text-[10px] font-normal text-muted-foreground">With Pass Type colors & Name</span>
          </button>
          <button
            type="button"
            onClick={() => setExportType("barcodesOnly")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all active:scale-95",
              exportType === "barcodesOnly"
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                : "border-border/80 bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Barcode className="size-4 mb-1" />
            <span>Pure Barcodes Only (Code 128)</span>
            <span className="text-[10px] font-normal text-muted-foreground">Plain vector barcode strips</span>
          </button>
        </div>
      </div>

      {/* Sample Badges Preview */}
      {previews.length && exportType === "fullBadges" ? (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Sample Color Badges Preview
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {previews.map((item) => {
              try {
                const svg = renderBadgeCardSvg(item).replace(/^<\?xml[^>]*>/, "");
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-border/80 bg-slate-900/40 p-2 shadow-sm"
                  >
                    <div
                      className="[&_svg]:h-auto [&_svg]:w-full rounded-xl overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>
                );
              } catch {
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-400"
                  >
                    {item.id} invalid format
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
        disabled={!parsedItems.length || busy}
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
            Download {parsedItems.length} {exportType === "fullBadges" ? "Badges" : "Barcodes"} as ZIP
          </>
        )}
      </Button>
    </div>
  );
}

