import type { PassType } from "@/lib/types";

/** A blank badge template, persisted in IndexedDB. */
export type CardTemplate = {
  passType: PassType;
  kind: "svg" | "png";
  /** Raw SVG markup (kind=svg) or a data URL (kind=png). */
  data: string;
  fileName: string;
  /** Output canvas in user units; viewBox origin may be non-zero for SVG. */
  width: number;
  height: number;
  viewBox: { x: number; y: number; w: number; h: number };
};

const DB_NAME = "nrb-idcard";
const STORE = "templates";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const templateDb = {
  get: (pass: PassType) => tx<CardTemplate | undefined>("readonly", (s) => s.get(pass)),
  put: (t: CardTemplate) => tx("readwrite", (s) => s.put(t, t.passType)),
  remove: (pass: PassType) => tx("readwrite", (s) => s.delete(pass)),
};

const readText = (f: File) => f.text();
const readDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

function num(v: string | null): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Parse an uploaded file into a template, detecting native size & viewBox. */
export async function fileToTemplate(file: File, passType: PassType): Promise<CardTemplate> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (isSvg) {
    const data = await readText(file);
    const doc = new DOMParser().parseFromString(data, "image/svg+xml");
    const svg = doc.documentElement;
    if (svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
      throw new Error("Invalid SVG file.");
    }
    const vbParts = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
    let w = num(svg.getAttribute("width"));
    let h = num(svg.getAttribute("height"));
    const vb =
      vbParts.length === 4 && vbParts.every(Number.isFinite) && vbParts[2] > 0 && vbParts[3] > 0
        ? { x: vbParts[0], y: vbParts[1], w: vbParts[2], h: vbParts[3] }
        : { x: 0, y: 0, w: w || 1000, h: h || 1500 };
    // Percent/unitless edge cases: fall back to viewBox size.
    if (!w || /%/.test(svg.getAttribute("width") ?? "")) w = vb.w;
    if (!h || /%/.test(svg.getAttribute("height") ?? "")) h = vb.h;
    return { passType, kind: "svg", data, fileName: file.name, width: w, height: h, viewBox: vb };
  }
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Please upload an SVG or PNG template.");
  const data = await readDataUrl(file);
  const { w, h } = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image."));
    img.src = data;
  });
  return { passType, kind: "png", data, fileName: file.name, width: w, height: h, viewBox: { x: 0, y: 0, w, h } };
}

/** Downscale + JPEG-encode a profile photo so the SVG stays light. */
export async function photoToDataUrl(file: File, max = 900): Promise<string> {
  const src = await readDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not read photo."));
    i.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

/** Load the bundled NRB World Summit Dhaka 2026 sample template. */
export async function loadDefaultSampleTemplate(passType: PassType): Promise<CardTemplate> {
  const resp = await fetch("/templates/nrb-summit-sample.png");
  if (!resp.ok) throw new Error("Built-in template not found.");
  const blob = await resp.blob();
  const file = new File([blob], "NRB_Summit_Dhaka_2026.png", { type: "image/png" });
  const t = await fileToTemplate(file, passType);
  await templateDb.put(t);
  return t;
}
