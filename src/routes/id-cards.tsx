import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Barcode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Download,
  FileImage,
  IdCard,
  ImagePlus,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  Type,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sheetsBackend } from "@/lib/api/sheets-client";
import { DEFAULT_SCRIPT_URL } from "@/lib/constants";
import {
  composeCardSvg,
  NRB_SUMMIT_2026_LAYOUT,
  STANDARD_BLANK_LAYOUT,
  svgToJpg300,
  type CardLayout,
} from "@/lib/idcard/compose";
import {
  fileToTemplate,
  loadDefaultSampleTemplate,
  photoToDataUrl,
  templateDb,
  type CardTemplate,
} from "@/lib/idcard/templates";
import { syncRegistry, useRegistry, useSettings } from "@/lib/store";
import { PASS_TYPES, type PassType } from "@/lib/types";
import { cn, downloadBlob, downloadText, normalizeId } from "@/lib/utils";

export const Route = createFileRoute("/id-cards")({ component: IdCardPage });

const PASS_META: Record<PassType, { label: string; tone: string }> = {
  "Day 1 Only": { label: "Day 1", tone: "border-sky-500/50 text-sky-400" },
  "Day 2 Only": { label: "Day 2", tone: "border-violet-500/50 text-violet-400" },
  "Both Days": { label: "2-Day All Access", tone: "border-amber-500/50 text-amber-400" },
};

const LAYOUT_KEY = "nrb_idcard_layout_v2";

type LayoutTab = "photo" | "info" | "barcode";

export function IdCardPage() {
  const attendees = useRegistry((s) => s.attendees);
  const [templates, setTemplates] = useState<Partial<Record<PassType, CardTemplate>>>({});
  const [form, setForm] = useState({
    id: "NRB2026-001",
    name: "Dr. Mohammed Nazmul",
    designation: "Managing Director",
    organisation: "NRB World Business Forum",
    country: "United States",
    passType: "Both Days" as PassType,
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [layout, setLayout] = useState<CardLayout>(NRB_SUMMIT_2026_LAYOUT);
  const [showLayout, setShowLayout] = useState(false);
  const [activeTab, setActiveTab] = useState<LayoutTab>("photo");
  const [showFineTune, setShowFineTune] = useState(false);
  const [sync, setSync] = useState<{ state: "idle" | "sending" | "ok" | "sent" | "error"; msg?: string }>({ state: "idle" });

  // Restore templates (IndexedDB) + layout (localStorage) after refresh.
  useEffect(() => {
    void Promise.all(PASS_TYPES.map((p) => templateDb.get(p).catch(() => undefined))).then(async (list) => {
      const next: Partial<Record<PassType, CardTemplate>> = {};
      list.forEach((t) => t && (next[t.passType] = t));

      // Auto-load Dhaka 2026 summit template for "Both Days" if empty so preview is instant
      if (!next["Both Days"]) {
        try {
          const sample = await loadDefaultSampleTemplate("Both Days");
          next["Both Days"] = sample;
        } catch {
          /* ignore fetch errors */
        }
      }
      setTemplates(next);
    });

    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) {
        setLayout({ ...NRB_SUMMIT_2026_LAYOUT, ...JSON.parse(saved) });
      }
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

  function updateLayout<K extends keyof CardLayout>(key: K, value: CardLayout[K]) {
    setLayout((prev) => ({ ...prev, [key]: value }));
  }

  // Autofill from registry when the ID matches an existing attendee.
  function onIdBlur() {
    const hit = attendees.find((a) => a.id.toUpperCase() === id);
    if (hit && (!form.name || form.name === "Dr. Mohammed Nazmul")) {
      setForm((f) => ({
        ...f,
        name: hit.name,
        country: hit.country || f.country,
        passType: hit.passType,
      }));
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

  async function loadSampleTemplate() {
    try {
      const t = await loadDefaultSampleTemplate(form.passType);
      setTemplates((prev) => ({ ...prev, [form.passType]: t }));
      setLayout(NRB_SUMMIT_2026_LAYOUT);
      toast.success(`Loaded NRB Summit 2026 template for ${PASS_META[form.passType].label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sample template");
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
      toast.success("300 DPI print-ready JPG downloaded");
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
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Automatic auto-positioning for pre-printed templates (NRB World Summit 2026) and blank badges with full manual
          nudge controls. Outputs Adobe Illustrator vector SVG and 300 DPI JPG.
        </p>
      </header>

      {/* 1. Templates Bar */}
      <section className="grid gap-3 sm:grid-cols-3">
        {PASS_TYPES.map((pass) => {
          const t = templates[pass];
          return (
            <label
              key={pass}
              className={cn(
                "group relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-card p-3 text-center transition hover:bg-muted/60",
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
                accept=".svg,image/svg+xml,image/png,image/jpeg"
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

      {/* Quick Template Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs font-semibold"
            onClick={loadSampleTemplate}
          >
            <CloudUpload className="mr-1.5 size-3.5 text-primary" />
            Load Dhaka 2026 Sample Template
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {template ? `Loaded: ${template.fileName}` : "No template loaded"}
          </span>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">Presets:</span>
          <button
            type="button"
            onClick={() => {
              setLayout(NRB_SUMMIT_2026_LAYOUT);
              toast.success("Applied NRB Summit 2026 (Pre-printed) Layout Preset");
            }}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-bold transition",
              layout.templateMode === "preprinted"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            🎯 NRB Summit 2026
          </button>
          <button
            type="button"
            onClick={() => {
              setLayout(STANDARD_BLANK_LAYOUT);
              toast.success("Applied Standard Blank Badge Layout Preset");
            }}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-bold transition",
              layout.templateMode === "blank"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            📄 Blank Badge
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_1.1fr]">
        {/* 2. Form & Manual Adjustment System */}
        <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-4">
          {/* Pass Type Switcher */}
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

          {/* Photo Upload */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-muted/50 p-2.5 hover:bg-muted">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-amber-500/60 bg-background">
              {photo ? (
                <img src={photo} alt="Profile" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-5 text-muted-foreground" />
              )}
            </span>
            <span className="text-xs">
              <span className="block font-bold">{photo ? "Change photo" : "Upload attendee photo"}</span>
              <span className="text-muted-foreground">Auto-fits into template photo slot with center cropping</span>
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

          {/* Attendee Details */}
          {(
            [
              ["id", "ID No", "NRB2026-001"],
              ["name", "Name", "Full name"],
              ["designation", "Designation", "e.g. Managing Director"],
              ["organisation", "Organization", "Company / Organization"],
              ["country", "Country", "e.g. Bangladesh / United States"],
            ] as const
          ).map(([key, label, ph]) => (
            <label key={key} className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
              <Input
                id={`idcard-${key}`}
                value={form[key]}
                placeholder={ph}
                className={cn("h-9", key === "id" && "font-mono font-bold tracking-wider")}
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

          {/* Manual Positioning Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowLayout((s) => !s)}
              className="flex w-full items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-bold text-primary transition hover:bg-primary/15"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" />
                Manual Positioning System (Photo, Text & Barcode Controls)
              </span>
              {showLayout ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>

          {/* COMPREHENSIVE MANUAL POSITIONING SYSTEM */}
          {showLayout ? (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/30 p-3.5">
              {/* Category Navigation */}
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-background p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("photo")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-bold transition",
                    activeTab === "photo" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <User className="size-3.5" /> Photo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("info")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-bold transition",
                    activeTab === "info" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Type className="size-3.5" /> Text / Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("barcode")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-bold transition",
                    activeTab === "barcode" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Barcode className="size-3.5" /> Barcode
                </button>
              </div>

              {/* TAB 1: PHOTO CONTROLS */}
              {activeTab === "photo" ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Photo Slot Position</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground"
                      onClick={() => {
                        updateLayout("photoX", NRB_SUMMIT_2026_LAYOUT.photoX);
                        updateLayout("photoY", NRB_SUMMIT_2026_LAYOUT.photoY);
                        updateLayout("photoW", NRB_SUMMIT_2026_LAYOUT.photoW);
                        updateLayout("photoH", NRB_SUMMIT_2026_LAYOUT.photoH);
                        updateLayout("photoRadius", NRB_SUMMIT_2026_LAYOUT.photoRadius);
                      }}
                    >
                      <RotateCcw className="mr-1 size-3" /> Reset Photo
                    </Button>
                  </div>

                  <NudgeControl
                    label="Horizontal Position (X)"
                    value={layout.photoX}
                    min={0.0}
                    max={0.9}
                    step={0.002}
                    onChange={(v) => updateLayout("photoX", v)}
                  />
                  <NudgeControl
                    label="Vertical Position (Y)"
                    value={layout.photoY}
                    min={0.0}
                    max={0.9}
                    step={0.002}
                    onChange={(v) => updateLayout("photoY", v)}
                  />
                  <NudgeControl
                    label="Photo Width (W)"
                    value={layout.photoW}
                    min={0.05}
                    max={0.7}
                    step={0.002}
                    onChange={(v) => updateLayout("photoW", v)}
                  />
                  <NudgeControl
                    label="Photo Height (H)"
                    value={layout.photoH}
                    min={0.05}
                    max={0.7}
                    step={0.002}
                    onChange={(v) => updateLayout("photoH", v)}
                  />
                  <PixelNudgeControl
                    label="Corner Radius"
                    value={layout.photoRadius}
                    min={0}
                    max={30}
                    step={1}
                    unit="px"
                    onChange={(v) => updateLayout("photoRadius", v)}
                  />

                  {/* Border Options */}
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs">
                    <label className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={layout.goldBorder}
                        onChange={(e) => updateLayout("goldBorder", e.target.checked)}
                        className="rounded"
                      />
                      Draw Gold Frame Border
                    </label>
                    {layout.goldBorder ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <PixelNudgeControl
                          label="Border Width"
                          value={layout.borderWidth}
                          min={1}
                          max={12}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("borderWidth", v)}
                        />
                        <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">Border Color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={layout.borderColor}
                              onChange={(e) => updateLayout("borderColor", e.target.value)}
                              className="size-7 cursor-pointer rounded border border-border bg-transparent p-0"
                            />
                            <span className="font-mono text-xs">{layout.borderColor}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* TAB 2: TEXT & INFO CONTROLS */}
              {activeTab === "info" ? (
                <div className="space-y-3">
                  {/* Mode Selector */}
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/40 p-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Template Text Mode</span>
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => updateLayout("templateMode", "preprinted")}
                        className={cn(
                          "rounded-md border p-2 text-left font-semibold transition",
                          layout.templateMode === "preprinted"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span className="block font-bold">🎯 Pre-printed Template</span>
                        <span className="text-[10px] text-muted-foreground">Values only, aligns in empty space</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayout("templateMode", "blank")}
                        className={cn(
                          "rounded-md border p-2 text-left font-semibold transition",
                          layout.templateMode === "blank"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span className="block font-bold">📄 Blank Template</span>
                        <span className="text-[10px] text-muted-foreground">Draws white box & printed labels</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Values Alignment & Typography</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground"
                      onClick={() => {
                        updateLayout("valuesX", NRB_SUMMIT_2026_LAYOUT.valuesX);
                        updateLayout("valuesStartY", NRB_SUMMIT_2026_LAYOUT.valuesStartY);
                        updateLayout("lineGap", NRB_SUMMIT_2026_LAYOUT.lineGap);
                        updateLayout("fontSize", NRB_SUMMIT_2026_LAYOUT.fontSize);
                        updateLayout("fontColor", NRB_SUMMIT_2026_LAYOUT.fontColor);
                        updateLayout("fontWeight", NRB_SUMMIT_2026_LAYOUT.fontWeight);
                      }}
                    >
                      <RotateCcw className="mr-1 size-3" /> Reset Text
                    </Button>
                  </div>

                  <NudgeControl
                    label="Values Start X (Horizontal)"
                    value={layout.valuesX}
                    min={0.1}
                    max={0.8}
                    step={0.002}
                    onChange={(v) => updateLayout("valuesX", v)}
                  />
                  <NudgeControl
                    label="Values Start Y (Line 1 ID No)"
                    value={layout.valuesStartY}
                    min={0.2}
                    max={0.8}
                    step={0.002}
                    onChange={(v) => updateLayout("valuesStartY", v)}
                  />
                  <NudgeControl
                    label="Line Gap / Row Pitch"
                    value={layout.lineGap}
                    min={0.015}
                    max={0.08}
                    step={0.001}
                    onChange={(v) => updateLayout("lineGap", v)}
                  />
                  <PixelNudgeControl
                    label="Font Size"
                    value={layout.fontSize}
                    min={12}
                    max={36}
                    step={1}
                    unit="px"
                    onChange={(v) => updateLayout("fontSize", v)}
                  />

                  {/* Font Color & Weight */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">Text Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={layout.fontColor}
                          onChange={(e) => updateLayout("fontColor", e.target.value)}
                          className="size-7 cursor-pointer rounded border border-border bg-transparent p-0"
                        />
                        <span className="font-mono text-xs">{layout.fontColor}</span>
                      </div>
                    </div>

                    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">Font Weight</span>
                      <select
                        value={layout.fontWeight}
                        onChange={(e) => updateLayout("fontWeight", Number(e.target.value))}
                        className="h-7 w-full rounded border border-border bg-background px-2 text-xs font-semibold"
                      >
                        <option value={400}>Regular (400)</option>
                        <option value={600}>Semi-Bold (600)</option>
                        <option value={700}>Bold (700)</option>
                        <option value={800}>Extra-Bold (800)</option>
                      </select>
                    </div>
                  </div>

                  {/* Micro-adjust individual lines */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <button
                      type="button"
                      onClick={() => setShowFineTune((s) => !s)}
                      className="flex w-full items-center justify-between text-[11px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      <span>Fine-tune Individual Line Offsets (Y-Nudge)</span>
                      {showFineTune ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                    {showFineTune ? (
                      <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                        <PixelNudgeControl
                          label="ID No Y"
                          value={layout.idOffsetY}
                          min={-30}
                          max={30}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("idOffsetY", v)}
                        />
                        <PixelNudgeControl
                          label="Name Y"
                          value={layout.nameOffsetY}
                          min={-30}
                          max={30}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("nameOffsetY", v)}
                        />
                        <PixelNudgeControl
                          label="Designation Y"
                          value={layout.desigOffsetY}
                          min={-30}
                          max={30}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("desigOffsetY", v)}
                        />
                        <PixelNudgeControl
                          label="Organization Y"
                          value={layout.orgOffsetY}
                          min={-30}
                          max={30}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("orgOffsetY", v)}
                        />
                        <PixelNudgeControl
                          label="Country Y"
                          value={layout.countryOffsetY}
                          min={-30}
                          max={30}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("countryOffsetY", v)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* TAB 3: BARCODE CONTROLS */}
              {activeTab === "barcode" ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Barcode Position & Style</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground"
                      onClick={() => {
                        updateLayout("barcodeX", NRB_SUMMIT_2026_LAYOUT.barcodeX);
                        updateLayout("barcodeY", NRB_SUMMIT_2026_LAYOUT.barcodeY);
                        updateLayout("barcodeW", NRB_SUMMIT_2026_LAYOUT.barcodeW);
                        updateLayout("barcodeH", NRB_SUMMIT_2026_LAYOUT.barcodeH);
                        updateLayout("barcodePill", NRB_SUMMIT_2026_LAYOUT.barcodePill);
                        updateLayout("barcodePillRadius", NRB_SUMMIT_2026_LAYOUT.barcodePillRadius);
                      }}
                    >
                      <RotateCcw className="mr-1 size-3" /> Reset Barcode
                    </Button>
                  </div>

                  <NudgeControl
                    label="Horizontal Center X"
                    value={layout.barcodeX}
                    min={0.1}
                    max={0.9}
                    step={0.002}
                    onChange={(v) => updateLayout("barcodeX", v)}
                  />
                  <NudgeControl
                    label="Vertical Position Y"
                    value={layout.barcodeY}
                    min={0.5}
                    max={0.98}
                    step={0.002}
                    onChange={(v) => updateLayout("barcodeY", v)}
                  />
                  <NudgeControl
                    label="Barcode Width"
                    value={layout.barcodeW}
                    min={0.15}
                    max={0.85}
                    step={0.005}
                    onChange={(v) => updateLayout("barcodeW", v)}
                  />
                  <NudgeControl
                    label="Barcode Height"
                    value={layout.barcodeH}
                    min={0.02}
                    max={0.16}
                    step={0.002}
                    onChange={(v) => updateLayout("barcodeH", v)}
                  />

                  {/* Pill Background Toggle & Controls */}
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs">
                    <label className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={layout.barcodePill}
                        onChange={(e) => updateLayout("barcodePill", e.target.checked)}
                        className="rounded"
                      />
                      White Pill Background (Ensures 100% Scan Accuracy)
                    </label>
                    {layout.barcodePill ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <PixelNudgeControl
                          label="Pill Corner Radius"
                          value={layout.barcodePillRadius}
                          min={0}
                          max={25}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("barcodePillRadius", v)}
                        />
                        <PixelNudgeControl
                          label="Pill Padding X"
                          value={layout.barcodePillPadX}
                          min={4}
                          max={30}
                          step={1}
                          unit="px"
                          onChange={(v) => updateLayout("barcodePillPadX", v)}
                        />
                      </div>
                    ) : null}
                  </div>

                  <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={layout.barcodeShowText}
                      onChange={(e) => updateLayout("barcodeShowText", e.target.checked)}
                      className="rounded"
                    />
                    Display ID Number Text under Barcode
                  </label>
                </div>
              ) : null}

              {/* Reset to All Defaults */}
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <span className="text-[11px] text-muted-foreground">Changes auto-save locally</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold"
                  onClick={() => {
                    setLayout(NRB_SUMMIT_2026_LAYOUT);
                    toast.info("Reset all layout values to default NRB Summit 2026 preset");
                  }}
                >
                  <RotateCcw className="mr-1.5 size-3" /> Reset All to Default
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* 3. Live Preview + Export Options */}
        <section className="space-y-3">
          <div className="grid min-h-80 place-items-center rounded-[28px] border border-border/80 bg-slate-950/40 p-4">
            {svg ? (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                alt="ID card preview"
                className="max-h-[70vh] w-auto max-w-full rounded-xl shadow-2xl transition-all"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <FileImage className="size-8" />
                Upload the <strong className="text-foreground">{PASS_META[form.passType].label}</strong> template or click
                <strong className="text-primary cursor-pointer hover:underline" onClick={loadSampleTemplate}>
                  {" "}Load Dhaka 2026 Sample Template
                </strong>{" "}
                to preview.
              </div>
            )}
          </div>

          <Button size="lg" className="h-12 w-full font-bold shadow-lg" disabled={!ready} onClick={generate}>
            <Sparkles className="mr-2 size-4" /> Generate Card & Sync to Sheet
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button
              size="lg"
              variant="secondary"
              className="h-11 border border-border/80 font-bold"
              disabled={!ready || !svg}
              onClick={() => {
                downloadText(svg, `${fileBase}.svg`, "image/svg+xml;charset=utf-8");
                toast.success("Vector SVG downloaded (Illustrator Compatible)");
              }}
            >
              <Download className="mr-2 size-4" /> Vector SVG
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 font-bold"
              disabled={!ready || !svg}
              onClick={() => void downloadJpg()}
            >
              <Download className="mr-2 size-4" /> Print JPG · 300 DPI
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
              {sync.state === "sending" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : sync.state === "error" ? (
                <TriangleAlert className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {sync.state === "sending" ? "Syncing to Google Sheet…" : `Google Sheet: ${sync.msg}`}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

/** Reusable percentage / fractional slider with micro-nudge buttons */
function NudgeControl({
  label,
  value,
  min,
  max,
  step = 0.005,
  displayMultiplier = 100,
  unit = "%",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayMultiplier?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const displayVal = Math.round(value * displayMultiplier * 10) / 10;
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground font-bold">
          {displayVal}{unit}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10000) / 10000))}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
          title="Nudge decrease (-)"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 accent-primary"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 10000) / 10000))}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
          title="Nudge increase (+)"
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}

/** Reusable pixel / integer slider with micro-nudge buttons */
function PixelNudgeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground font-bold">
          {value}{unit}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
          title="Decrease (-)"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 accent-primary"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
          title="Increase (+)"
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}
