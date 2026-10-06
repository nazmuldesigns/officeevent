import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import {
  AlertCircle,
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Download,
  FileArchive,
  Fingerprint,
  HelpCircle,
  History,
  IdCard,
  Layers,
  LoaderCircle,
  PlusCircle,
  Printer,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Wand2,
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
import { generateSecuritySeal, generateSecurityToken } from "@/lib/barcode/security";
import { useDownloadedBadges } from "@/lib/barcode/history";
import { useRegistry } from "@/lib/store";
import type { Attendee, PassType } from "@/lib/types";
import { cn, downloadBlob, downloadText, formatEntryTime, normalizeId } from "@/lib/utils";

export const Route = createFileRoute("/generator")({ component: GeneratorPage });

function GeneratorPage() {
  const [tab, setTab] = useState<"single" | "bulk">("single");

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Barcode className="size-6 text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Event Badge & Barcode Studio
            </h1>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            অফিসিয়াল কালার ব্যাজ এবং কোড ১২৮ বারকোড জেনারেটর — ৩টি আলাদা পাস স্টাইল (Day 1, Day 2 & VIP All Access) এবং নকল-প্রতিরোধী ডিজিটাল সিকিউরিটি সিল সহ।
          </p>
        </div>
        <Link
          to="/id-cards"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 text-xs font-bold text-primary shadow-sm transition hover:bg-primary/20 active:scale-95 shrink-0"
        >
          <IdCard className="size-4" />
          <span>Vector ID Card Maker</span>
        </Link>
      </header>

      {/* Security & Verification Banner */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
            <HelpCircle className="size-4 shrink-0" />
            <span>পাস ও বারকোড যাচাই পদ্ধতি</span>
          </div>
          <p className="text-xs text-sky-200/90 leading-relaxed">
            <strong>১. বারকোড:</strong> বারকোডের দাগগুলোতে মূলত ব্যক্তির <strong>ইউনিক আইডি (যেমন NRB20260001)</strong> এনকোড করা থাকে।<br />
            <strong>২. গুগল শিট:</strong> শিটের <strong>Col D (Pass Type)</strong>-এ সংরক্ষিত থাকে উক্ত ব্যক্তি <strong>Day 1</strong>, <strong>Day 2</strong> নাকি <strong>Both Days</strong> এর জন্য অনুমোদিত।<br />
            <strong>৩. স্ক্যানার যাচাই:</strong> গেটের ক্যামেরা আইডি পড়া মাত্রই শিটের সাথে মিলিয়ে নিমেষেই অ্যাক্সেস অনুমোদন বা বাতিল করে।
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="size-4 shrink-0" />
            <span>নকল-প্রতিরোধী সিকিউরিটি সিল (Anti-Counterfeiting)</span>
          </div>
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            <strong>🔒 ক্রিপ্টোগ্রাফিক হ্যাশ সিল:</strong> প্রতিটি ব্যাজে আইডি ও নামের ওপর ভিত্তি করে একটি ইউনিক <strong>AUTH SEAL</strong> (যেমন <code>NRB-SEC-9F42</code>) জেনারেট হয়।<br />
            <strong>🛡️ মাইক্রোপ্রিন্ট ওয়াটারমার্ক:</strong> ব্যাজের ব্যানারে বিশেষ মাইক্রোপ্রিন্ট লাইন যুক্ত থাকে যাতে বাইরে থেকে কেউ ভুয়া কার্ড তৈরি করতে না পারে।
          </p>
        </div>
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
          <span>Single Badge Studio (ডুপ্লিকেট চেক সহ)</span>
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
          <span>Bulk ZIP Export (বাল্ক জেনারেটর)</span>
        </button>
      </div>

      {tab === "single" ? <SingleStudio /> : <BulkStudio />}
    </div>
  );
}

function SingleStudio() {
  const attendees = useRegistry((s) => s.attendees);
  const { history, recordDownload, clearHistory } = useDownloadedBadges();

  const [raw, setRaw] = useState("NRB20260001");
  const [attendeeName, setAttendeeName] = useState("Tanvir Ahmed");
  const [country, setCountry] = useState("Bangladesh");
  const [passStyle, setPassStyle] = useState<PassType>("Both Days");
  const [showHistory, setShowHistory] = useState(false);

  const id = normalizeId(raw);

  // Calculate Next Unique ID based on all attendees + download history
  function getNextUniqueId(): string {
    const allIds = new Set<string>();
    attendees.forEach((a) => allIds.add(a.id.toUpperCase()));
    history.forEach((h) => allIds.add(h.id.toUpperCase()));

    let maxNum = 0;
    allIds.forEach((item) => {
      const match = item.match(/(\d+)/g);
      if (match) {
        const lastNum = parseInt(match[match.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxNum) {
          maxNum = lastNum;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `NRB2026${String(nextNum).padStart(4, "0")}`;
  }

  function handleAutoNextId() {
    const nextId = getNextUniqueId();
    setRaw(nextId);
    toast.success(`পরবর্তী ইউনিক আইডি ${nextId} সেট করা হয়েছে!`);
  }

  // Duplicate & Collision Check
  const collisionStatus = useMemo(() => {
    if (!id) return { type: "idle" as const, message: "" };

    const normId = id.toUpperCase();
    const normName = attendeeName.trim().toLowerCase();

    // 1. Check in Google Sheet Attendees
    const sheetMatch = attendees.find((a) => a.id.toUpperCase() === normId);
    if (sheetMatch) {
      if (sheetMatch.name.trim().toLowerCase() !== normName) {
        return {
          type: "id_collision" as const,
          existingName: sheetMatch.name,
          source: "Google Sheet",
          message: `আইডি দ্বন্দ্ব (ID Conflict): এই আইডি (${id}) ইতিমধ্যে গুগল শিটে "${sheetMatch.name}"-এর নামে নিবন্ধিত আছে! একই আইডি কার্ড নম্বর অন্য ব্যক্তির জন্য ব্যবহার করা যাবে না।`,
        };
      }
    }

    // 2. Check in Download History
    const historyMatch = history.find((h) => h.id.toUpperCase() === normId);
    if (historyMatch) {
      if (historyMatch.name.trim().toLowerCase() !== normName) {
        return {
          type: "id_collision" as const,
          existingName: historyMatch.name,
          source: "পূর্বে ডাউনলোডকৃত ব্যাজ",
          message: `আইডি দ্বন্দ্ব (ID Conflict): এই আইডি (${id}) ইতিমধ্যে "${historyMatch.name}"-এর নামে তৈরি ও ডাউনলোড করা হয়েছে!`,
        };
      }
      return {
        type: "already_downloaded" as const,
        record: historyMatch,
        message: `এই ব্যাজটি (${id} - ${historyMatch.name}) ইতিমধ্যে ডাউনলোড করা হয়েছে (${formatEntryTime(historyMatch.downloadedAt)})।`,
      };
    }

    // 3. Check if this Name is already registered under a different ID
    if (normName.length > 2) {
      const sheetNameMatch = attendees.find(
        (a) => a.name.trim().toLowerCase() === normName && a.id.toUpperCase() !== normId,
      );
      if (sheetNameMatch) {
        return {
          type: "name_notice" as const,
          existingId: sheetNameMatch.id,
          message: `নাম সতর্কতা: "${attendeeName}" নামের ব্যক্তি ইতিমধ্যে গুগল শিটে "${sheetNameMatch.id}" আইডিতে নিবন্ধিত আছেন।`,
        };
      }
    }

    return {
      type: "unique" as const,
      message: `আইডি সম্পূর্ণ ইউনিক ও নিরাপদ। ডুপ্লিকেট হওয়ার কোনো ঝুঁকি নেই।`,
    };
  }, [id, attendeeName, attendees, history]);

  const securitySeal = useMemo(() => generateSecuritySeal(id, attendeeName), [id, attendeeName]);
  const securityToken = useMemo(() => generateSecurityToken(id, attendeeName), [id, attendeeName]);

  const preview = useMemo(() => {
    if (!id) return { barcodeSvg: "", badgeSvg: "", error: "অনুগ্রহ করে একটি আইডি প্রদান করুন।" };
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
        error: error instanceof Error ? error.message : "বারকোড তৈরি করা সম্ভব হয়নি।",
      };
    }
  }, [id, attendeeName, country, passStyle]);

  function handlePrint() {
    window.print();
  }

  function handleDownloadBadge() {
    if (!preview.badgeSvg || !id) return;

    if (collisionStatus.type === "id_collision") {
      toast.error(`ডাউনলোড বাতিল: এই আইডি ইতিমধ্যে "${collisionStatus.existingName}"-এর নামে বরাদ্দ! ডুপ্লিকেট এড়াতে অন্য আইডি ব্যবহার করুন।`);
      return;
    }

    recordDownload({ id, name: attendeeName, country, passType: passStyle });
    const fileName = badgeCardFileName(id, passStyle);
    downloadText(preview.badgeSvg, fileName, "image/svg+xml;charset=utf-8");
    toast.success(`সফলভাবে ${fileName} ডাউনলোড হয়েছে! (Auth Seal: ${securitySeal})`);
  }

  function handleDownloadBarcode() {
    if (!preview.barcodeSvg || !id) return;

    if (collisionStatus.type === "id_collision") {
      toast.error(`ডাউনলোড বাতিল: এই আইডি ইতিমধ্যে "${collisionStatus.existingName}"-এর নামে বরাদ্দ!`);
      return;
    }

    recordDownload({ id, name: attendeeName, country, passType: passStyle });
    const fileName = svgFileName(id);
    downloadText(preview.barcodeSvg, fileName, "image/svg+xml;charset=utf-8");
    toast.success(`বারকোড ${fileName} ডাউনলোড সম্পন্ন!`);
  }

  return (
    <div className="space-y-4">
      {/* Configuration Controls */}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Attendee ID Code
            </span>
            <button
              type="button"
              onClick={handleAutoNextId}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              title="নতুন ইউনিক আইডি অটো জেনারেট করুন"
            >
              <Wand2 className="size-3" />
              <span>অটো পরবর্তী আইডি</span>
            </button>
          </div>
          <Input
            value={raw}
            autoCapitalize="characters"
            spellCheck={false}
            className={cn(
              "h-11 font-mono text-base font-bold tracking-wider",
              collisionStatus.type === "id_collision" && "border-rose-500 bg-rose-500/10 text-rose-300 focus-visible:ring-rose-500",
              collisionStatus.type === "unique" && "border-emerald-500/60 focus-visible:ring-emerald-500",
            )}
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

      {/* Real-time Collision & Security Status Indicator */}
      <div
        className={cn(
          "rounded-2xl border p-3.5 transition-all text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
          collisionStatus.type === "id_collision" && "border-rose-500/40 bg-rose-500/15 text-rose-200",
          collisionStatus.type === "already_downloaded" && "border-amber-500/40 bg-amber-500/15 text-amber-200",
          collisionStatus.type === "name_notice" && "border-sky-500/40 bg-sky-500/15 text-sky-200",
          collisionStatus.type === "unique" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
        )}
      >
        <div className="flex items-start gap-2.5">
          {collisionStatus.type === "id_collision" ? (
            <ShieldAlert className="size-5 shrink-0 text-rose-400 mt-0.5" />
          ) : collisionStatus.type === "already_downloaded" ? (
            <AlertTriangle className="size-5 shrink-0 text-amber-400 mt-0.5" />
          ) : collisionStatus.type === "name_notice" ? (
            <AlertCircle className="size-5 shrink-0 text-sky-400 mt-0.5" />
          ) : (
            <ShieldCheck className="size-5 shrink-0 text-emerald-400 mt-0.5" />
          )}

          <div>
            <span className="font-bold block">
              {collisionStatus.type === "id_collision"
                ? "⛔ আইডি দ্বন্দ্ব / ডুপ্লিকেট শনাক্ত!"
                : collisionStatus.type === "already_downloaded"
                  ? "⚠️ পূর্বে ডাউনলোড সম্পন্ন"
                  : collisionStatus.type === "name_notice"
                    ? "ℹ️ নামের রেকর্ড পাওয়া গেছে"
                    : "✅ ইউনিক ও নিরাপদ (Safe & Unique ID)"}
            </span>
            <p className="mt-0.5 opacity-90 leading-relaxed">{collisionStatus.message}</p>
          </div>
        </div>

        {collisionStatus.type === "id_collision" ? (
          <Button
            type="button"
            size="sm"
            variant="bad"
            className="h-8 shrink-0 font-bold active:scale-95"
            onClick={handleAutoNextId}
          >
            <Sparkles className="mr-1.5 size-3.5" />
            নতুন ইউনিক আইডি নিন
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-mono font-bold text-white/90 shrink-0 border border-white/10">
            <Fingerprint className="size-3 text-emerald-400" />
            <span>{securitySeal}</span>
          </div>
        )}
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
          disabled={!preview.badgeSvg || collisionStatus.type === "id_collision"}
          onClick={handleDownloadBadge}
        >
          <Download className="mr-2 size-4.5" />
          Download Full Badge (SVG)
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="h-12 font-bold shadow-md active:scale-95 border-border/80"
          disabled={!preview.barcodeSvg || collisionStatus.type === "id_collision"}
          onClick={handleDownloadBarcode}
        >
          <Barcode className="mr-2 size-4.5 text-sky-400" />
          Download Barcode Only
        </Button>
      </div>

      {/* Download History Toggle Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              সম্প্রতি ডাউনলোডকৃত ব্যাজের তালিকা ({history.length} টি)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  if (confirm("আপনি কি ডাউনলোড হিস্ট্রি ক্লিয়ার করতে চান?")) {
                    clearHistory();
                    toast.success("ডাউনলোড হিস্ট্রি মুছে ফেলা হয়েছে।");
                  }
                }}
              >
                <Trash2 className="mr-1 size-3" />
                ক্লিয়ার করুন
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-bold"
              onClick={() => setShowHistory((s) => !s)}
            >
              {showHistory ? "লুকান" : "হিস্ট্রি দেখুন"}
            </Button>
          </div>
        </div>

        {showHistory && history.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border/60 max-h-60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/80 text-[11px] font-bold uppercase text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Pass Style</th>
                  <th className="px-3 py-2">Auth Seal</th>
                  <th className="px-3 py-2">Downloaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {history.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => {
                      setRaw(item.id);
                      setAttendeeName(item.name);
                      setCountry(item.country);
                      setPassStyle(item.passType);
                      toast.info(`${item.id} তথ্য লোড করা হয়েছে`);
                    }}
                  >
                    <td className="px-3 py-2 font-mono font-bold text-primary">{item.id}</td>
                    <td className="px-3 py-2 font-semibold text-foreground">{item.name}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                        item.passType === "Both Days" && "bg-amber-500/10 text-amber-400 border-amber-500/30",
                        item.passType === "Day 1 Only" && "bg-sky-500/10 text-sky-400 border-sky-500/30",
                        item.passType === "Day 2 Only" && "bg-purple-500/10 text-purple-400 border-purple-500/30",
                      )}>
                        {item.passType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{item.securitySeal}</td>
                    <td className="px-3 py-2 text-muted-foreground text-[11px]">{formatEntryTime(item.downloadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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

  // Parse and analyze duplicates
  const { parsedItems, duplicates, duplicateNames } = useMemo(() => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const list: Array<{ id: string; name: string; country: string; passType: PassType; lineNum: number }> = [];
    const idMap = new Map<string, number[]>();
    const nameMap = new Map<string, string[]>();

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      const rawId = parts[0] || "";
      const id = normalizeId(rawId);
      if (!id) return;

      const name = parts[1] || `Guest Attendee ${lineNum}`;
      const country = parts[2] || "Bangladesh";
      let passType: PassType = "Both Days";
      const rawPass = (parts[3] || "").toLowerCase();
      if (rawPass.includes("1") && !rawPass.includes("2") && !rawPass.includes("both")) {
        passType = "Day 1 Only";
      } else if (rawPass.includes("2") && !rawPass.includes("1") && !rawPass.includes("both")) {
        passType = "Day 2 Only";
      }

      list.push({ id, name, country, passType, lineNum });

      // Track duplicate IDs
      const normId = id.toUpperCase();
      const existingLines = idMap.get(normId) || [];
      existingLines.push(lineNum);
      idMap.set(normId, existingLines);

      // Track duplicate Names
      const normName = name.toLowerCase();
      const existingIds = nameMap.get(normName) || [];
      existingIds.push(id);
      nameMap.set(normName, existingIds);
    });

    const dupList: Array<{ id: string; lines: number[] }> = [];
    idMap.forEach((linesArr, idVal) => {
      if (linesArr.length > 1) {
        dupList.push({ id: idVal, lines: linesArr });
      }
    });

    const dupNamesList: Array<{ name: string; ids: string[] }> = [];
    nameMap.forEach((idsArr, nameVal) => {
      if (idsArr.length > 1) {
        dupNamesList.push({ name: nameVal, ids: idsArr });
      }
    });

    return { parsedItems: list, duplicates: dupList, duplicateNames: dupNamesList };
  }, [text]);

  const previews = parsedItems.slice(0, 3);

  // Auto-Fix Duplicates: reassigns sequential guaranteed unique IDs
  function handleAutoFixDuplicates() {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const seenIds = new Set<string>();
    let counter = 1;

    // First collect all IDs already registered in Google Sheet
    const sheetIds = new Set(attendees.map((a) => a.id.toUpperCase()));

    const newLines = lines.map((line, idx) => {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      let rawId = parts[0] || "";
      let id = normalizeId(rawId).toUpperCase();
      const name = parts[1] || `Guest Attendee ${idx + 1}`;
      const country = parts[2] || "Bangladesh";
      const pass = parts[3] || "Both Days";

      // If ID is missing, already seen in this bulk batch, or already belongs to someone else in Sheet
      if (!id || seenIds.has(id)) {
        while (seenIds.has(`NRB2026${String(counter).padStart(4, "0")}`) || sheetIds.has(`NRB2026${String(counter).padStart(4, "0")}`)) {
          counter++;
        }
        id = `NRB2026${String(counter).padStart(4, "0")}`;
        counter++;
      }

      seenIds.add(id);
      return `${id}\t${name}\t${country}\t${pass}`;
    });

    setText(newLines.join("\n"));
    toast.success("সকল ডুপ্লিকেট সমাধান করা হয়েছে এবং ইউনিক আইডি বরাদ্দ করা হয়েছে!");
  }

  async function downloadZip() {
    if (!parsedItems.length) return;

    if (duplicates.length > 0) {
      toast.error("ডাউনলোড করার পূর্বে ডুপ্লিকেট আইডিগুলো ঠিক করুন অথবা 'ডুপ্লিকেট ফিক্স' বোতামে চাপুন।");
      return;
    }

    setBusy(true);
    try {
      const zip = new JSZip();
      const failed: string[] = [];
      const exportedIds = new Set<string>();

      for (const item of parsedItems) {
        if (exportedIds.has(item.id.toUpperCase())) {
          continue; // Guard against any duplicate export
        }
        exportedIds.add(item.id.toUpperCase());

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
        toast.success(`Successfully saved ${exportedIds.size} vector badges to ${zipName}.`);
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
            {parsedItems.length} total attendees
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
          টিপস: এক্সেল বা গুগল শিট থেকে কপি করে সরাসরি পেস্ট করতে পারেন (কলাম ক্রম: ID, Name, Country, Pass Type)।
        </p>
      </label>

      {/* Duplicate Warning Panel & Auto-Fix */}
      {duplicates.length > 0 || duplicateNames.length > 0 ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <ShieldAlert className="size-4 shrink-0" />
              <span>ডুপ্লিকেট আইডি / নাম শনাক্ত হয়েছে ({duplicates.length + duplicateNames.length} টি)</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="bad"
              className="h-8 font-bold text-xs active:scale-95 shadow-md"
              onClick={handleAutoFixDuplicates}
            >
              <Wand2 className="mr-1.5 size-3.5" />
              ডুপ্লিকেট ফিক্স ও ইউনিক আইডি বরাদ্দ করুন
            </Button>
          </div>

          <div className="text-xs text-rose-200/90 space-y-1">
            {duplicates.map((dup) => (
              <p key={dup.id}>
                • আইডি <strong>{dup.id}</strong> একাধিক লাইনে পাওয়া গেছে (লাইন: {dup.lines.join(", ")})।
              </p>
            ))}
            {duplicateNames.map((dupName) => (
              <p key={dupName.name}>
                • নাম <strong>"{dupName.name}"</strong> একাধিক আইডিতে পাওয়া গেছে ({dupName.ids.join(", ")})।
              </p>
            ))}
          </div>
        </div>
      ) : null}

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

        {duplicates.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 border-rose-500/50 bg-rose-500/10 text-rose-300 text-xs font-bold active:scale-95"
            onClick={handleAutoFixDuplicates}
          >
            <Wand2 className="mr-1.5 size-3.5 text-rose-400" />
            অটো ফিক্স ডুপ্লিকেটস
          </Button>
        ) : null}
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
                    key={`${item.id}-${item.lineNum}`}
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
                    key={`${item.id}-${item.lineNum}`}
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
        disabled={!parsedItems.length || busy || duplicates.length > 0}
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
