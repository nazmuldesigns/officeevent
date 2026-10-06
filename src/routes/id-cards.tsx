import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  FileImage,
  IdCard,
  ImagePlus,
  LoaderCircle,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sheetsBackend } from "@/lib/api/sheets-client";
import { DEFAULT_SCRIPT_URL } from "@/lib/constants";
import { composeCardSvg, DEFAULT_LAYOUT, svgToJpg300, type CardLayout } from "@/lib/idcard/compose";
import { fileToTemplate, photoToDataUrl, templateDb, type CardTemplate } from "@/lib/idcard/templates";
import { syncRegistry, useRegistry, useSettings } from "@/lib/store";
import { PASS_TYPES, type PassType } from "@/lib/types";
import { cn, downloadBlob, downloadText, normalizeId } from "@/lib/utils";

export const Route = createFileRoute("/id-cards")({ component: IdCardPage });

const PASS_META: Record<PassType, { label: string; tone: string }> = {
  "Day 1 Only": { label: "Day 1", tone: "border-sky-500/50 text-sky-400" },
  "Day 2 Only": { label: "Day 2", tone: "border-violet-500/50 text-violet-400" },
  "Both Days": { label: "2-Day All Access", tone: "border-amber-500/50 text-amber-400" },
};

const SLIDERS: Array<{ key: keyof CardLayout; label: string; min: number; max: number }> = [
  { key: "photoX", label: "Photo X", min: 0, max: 0.9 },
  { key: "photoY", label: "Photo Y", min: 0, max: 0.9 },
  { key: "photoW", label: "Photo size", min: 0.1, max: 0.6 },
  { key: "infoY", label: "Info box Y", min: 0.2, max: 0.9 },
  { key: "infoH", label: "Info box height", min: 0.12, max: 0.5 },
  { key: "barcodeY", label: "Barcode Y", min: 0.5, max: 0.97 },
  { key: "barcodeH", label: "Barcode height", min: 0.03, max: 0.15 },
];

const LAYOUT_KEY = "nrb_idcard_layout_v1";

function IdCardPage() {
  const attendees = useRegistry((s) => s.attendees);
  const [templates, setTemplates] = useState<Partial<Record<PassType, CardTemplate>>>({});
  const [form, setForm] = useState({
    id: "",
    name: "",
    designation: "",
    organisation: "",
    country: "Bangladesh",
    passType: "Both Days" as PassType,
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [layout, setLayout] = useState<CardLayout>(DEFAULT_LAYOUT);
  const [showLayout, setShowLayout] = useState(false);
  const [sync, setSync] = useState<{ state: "idle" | "sending" | "ok" | "sent" | "error"; msg?: string }>({ state: "idle" });

  // Restore templates (IndexedDB) + layout (localStorage) after refresh.
  useEffect(() => {
    void Promise.all(PASS_TYPES.map((p) => templateDb.get(p).catch(() => undefined))).then((list) => {
      const next: Partial<Record<PassType, CardTemplate>> = {};
      list.forEach((t) => t && (next[t.passType] = t));
      setTemplates(next);
    });
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) setLayout({ ...DEFAULT_LAYOUT, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  const id = normalizeId(form.id);
  const template = templates[form.passType];

  const conflict = useMemo(() => {
    if (!id) return null;
    const hit = attendees.find((a) => a.id.toUpperCase() === id);
    if (hit && form.name.trim() && hit.name.trim().toLowerCase() !== form.name.trim().toLowerCase()) {
      return `ID ${id} already belongs to "${hit.name}" in the sheet.`;
    }
    return null;
  }, [attendees, id, form.name]);

  const svg = useMemo(() => {
    if (!template) return "";
    try {
      return composeCardSvg(template, { ...form, id: id || "NRB2026XXXX", photo }, layout);
    } catch {
      return "";
    }
  }, [template, form, id, photo, layout]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Autofill from registry when the ID matches an existing attendee.
  function onIdBlur() {
    const hit = attendees.find((a) => a.id.toUpperCase() === id);
    if (hit && !form.name) {
      setForm((f) => ({ ...f, name: hit.name, country: hit.country || f.country, passType: hit.passType }));
      toast.info(`Loaded ${hit.name} from the sheet`);
    }
  }

  async function onTemplate(pass: PassType, file?: File) {
    if (!file) return;
    try {
      const t = await fileToTemplate(file, pass);
      await templateDb.put(t);
      setTemplates((prev) => ({ ...prev, [pass]: t }));
      toast.success(`${PASS_META[pass].label} template saved (${Math.round(t.width)}×${Math.round(t.height)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Template upload failed");
    }
  }

  async function removeTemplate(pass: PassType) {
    await templateDb.remove(pass);
    setTemplates((prev) => {
      const next = { ...prev };
      delete next[pass];
      return next;
    });
  }

  const ready = Boolean(template && id && form.name.trim() && !conflict);
  const fileBase = `NRB_IDCard_${id}_${form.passType.replace(/\s+/g, "_")}`;

  function generate() {
    if (!ready) {
      toast.error(conflict ?? "Upload a template and fill ID No + Name first.");
      return;
    }
    if (svg) {
      downloadText(svg, `${fileBase}.svg`, "image/svg+xml;charset=utf-8");
      toast.success("Card downloaded — syncing to Google Sheet…");
    } else {
      toast.success("Syncing to Google Sheet…");
    }
    setSync({ state: "sending" });
    const { scriptUrl, apiKey } = useSettings.getState();
    // Fire-and-forget: never blocks downloads.
    void sheetsBackend
      .issueCard(
        { scriptUrl: scriptUrl?.trim() || DEFAULT_SCRIPT_URL, apiKey },
        {
          id,
          name: form.name.trim(),
          designation: form.designation.trim(),
          organisation: form.organisation.trim(),
          country: form.country.trim(),
          passType: form.passType,
          status: "Card Issued",
          timestamp: new Date().toISOString(),
        },
      )
      .then((res) => {
        if (!res.ok) {
          setSync({ state: "error", msg: res.error });
        } else {
          setSync({
            state: "ok",
            msg: "গুগল শিটের 'Registrations' তালিকায় সংরক্ষিত হয়েছে! এখন গেটে স্ক্যান করা যাবে।",
          });
          toast.success(`ID ${id} সফলভাবে রেজিস্ট্রেশন শিটে যুক্ত হয়েছে!`);
          void syncRegistry();
        }
      });
  }

  async function downloadJpg() {
    if (!svg || !template) return;
    try {
      const blob = await svgToJpg300(svg, template.width, template.height);
      downloadBlob(blob, `${fileBase}.jpg`);
      toast.success("300 DPI JPG downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "JPG export failed");
    }
  }

  return (
    <div className="space-y-5">
      <header className="px-1">
        <div className="flex items-center gap-2">
          <IdCard className="size-6 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Vector ID Card Maker</h1>
        </div>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Upload your blank Day 1 / Day 2 / 2-Day templates once, fill the details, and export Illustrator-ready SVG or
          300 DPI JPG. Every generated card is logged to Google Sheet.
        </p>
      </header>

      {/* 1. Templates */}
      <section className="grid gap-3 sm:grid-cols-3">
        {PASS_TYPES.map((pass) => {
          const t = templates[pass];
          return (
            <label
              key={pass}
              className={cn(
                "group relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-card p-3 text-center transition hover:bg-muted/60",
                t ? PASS_META[pass].tone : "border-border/80 text-muted-foreground",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onTemplate(pass, e.dataTransfer.files[0]);
              }}
            >
              <input
                type="file"
                accept=".svg,image/svg+xml,image/png"
                className="sr-only"
                onChange={(e) => {
                  void onTemplate(pass, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {t ? <CheckCircle2 className="size-5" /> : <CloudUpload className="size-5" />}
              <span className="text-xs font-bold uppercase tracking-wider">{PASS_META[pass].label} template</span>
              <span className="max-w-full truncate text-[11px] text-muted-foreground">
                {t ? `${t.fileName} · ${Math.round(t.width)}×${Math.round(t.height)} ${t.kind.toUpperCase()}` : "Drop or tap · SVG / PNG"}
              </span>
              {t ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground hover:bg-rose-500/15 hover:text-rose-400"
                  onClick={(e) => {
                    e.preventDefault();
                    void removeTemplate(pass);
                  }}
                  aria-label={`Remove ${PASS_META[pass].label} template`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </label>
          );
        })}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* 2. Form */}
        <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {PASS_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("passType", p)}
                className={cn(
                  "h-9 rounded-lg text-[11px] font-bold uppercase tracking-wide transition",
                  form.passType === p ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PASS_META[p].label}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-muted/50 p-2.5 hover:bg-muted">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-amber-500/60 bg-background">
              {photo ? <img src={photo} alt="Profile" className="size-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
            </span>
            <span className="text-xs">
              <span className="block font-bold">{photo ? "Change photo" : "Upload profile photo"}</span>
              <span className="text-muted-foreground">Auto center-cropped to the photo slot</span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(await photoToDataUrl(f));
                e.target.value = "";
              }}
            />
          </label>

          {(
            [
              ["id", "ID No", "NRB20260001"],
              ["name", "Name", "Full name"],
              ["designation", "Designation", "e.g. Director"],
              ["organisation", "Organization", "Company / Org"],
              ["country", "Country", "Bangladesh"],
            ] as const
          ).map(([key, label, ph]) => (
            <label key={key} className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
              <Input
                id={`idcard-${key}`}
                value={form[key]}
                placeholder={ph}
                className={cn("h-10", key === "id" && "font-mono font-bold tracking-wider")}
                onBlur={key === "id" ? onIdBlur : undefined}
                onChange={(e) => set(key, key === "id" ? e.target.value.toUpperCase() : e.target.value)}
              />
            </label>
          ))}

          {conflict ? (
            <p className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs font-semibold text-rose-300">
              <TriangleAlert className="size-4 shrink-0" /> {conflict}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowLayout((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-bold text-primary"
          >
            <SlidersHorizontal className="size-3.5" /> {showLayout ? "Hide" : "Adjust"} layout to match template
          </button>
          {showLayout ? (
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 p-3">
              {SLIDERS.map((s) => (
                <label key={s.key} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-[11px] font-semibold">
                  {s.label}
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={0.005}
                    value={layout[s.key] as number}
                    onChange={(e) => setLayout((l) => ({ ...l, [s.key]: Number(e.target.value) }))}
                    className="accent-[var(--primary)]"
                  />
                </label>
              ))}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-[11px] font-semibold">
                  <input
                    type="checkbox"
                    checked={layout.goldBorder}
                    onChange={(e) => setLayout((l) => ({ ...l, goldBorder: e.target.checked }))}
                  />
                  Gold photo border
                </label>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setLayout(DEFAULT_LAYOUT)}>
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Preview + export */}
        <section className="space-y-3">
          <div className="grid min-h-80 place-items-center rounded-[28px] border border-border/80 bg-slate-950/40 p-4">
            {svg ? (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                alt="ID card preview"
                className="max-h-[70vh] w-auto max-w-full rounded-xl shadow-2xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <FileImage className="size-8" />
                Upload the <strong className="text-foreground">{PASS_META[form.passType].label}</strong> template to preview.
              </div>
            )}
          </div>

          <Button size="lg" className="h-12 w-full font-bold" disabled={!ready} onClick={generate}>
            <Sparkles className="mr-2 size-4" /> Generate Card
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              size="lg"
              variant="secondary"
              className="h-11 border border-border/80 font-bold"
              disabled={!ready || !svg}
              onClick={() => {
                downloadText(svg, `${fileBase}.svg`, "image/svg+xml;charset=utf-8");
                toast.success("Vector SVG downloaded");
              }}
            >
              <Download className="mr-2 size-4" /> Download SVG
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 font-bold"
              disabled={!ready || !svg}
              onClick={() => void downloadJpg()}
            >
              <Download className="mr-2 size-4" /> JPG · 300 DPI
            </Button>
          </div>

          {sync.state !== "idle" ? (
            <p
              className={cn(
                "flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold",
                sync.state === "sending" && "border-sky-500/40 bg-sky-500/10 text-sky-300",
                (sync.state === "ok" || sync.state === "sent") && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                sync.state === "error" && "border-rose-500/40 bg-rose-500/10 text-rose-300",
              )}
            >
              {sync.state === "sending" ? <LoaderCircle className="size-4 animate-spin" /> : sync.state === "error" ? <TriangleAlert className="size-4" /> : <CheckCircle2 className="size-4" />}
              {sync.state === "sending" ? "Syncing to Google Sheet…" : `Google Sheet: ${sync.msg}`}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
