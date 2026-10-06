import JsBarcode from "jsbarcode";
import type { PassType } from "@/lib/types";
import type { CardTemplate } from "./templates";

export type CardData = {
  id: string;
  name: string;
  designation: string;
  organisation: string;
  country: string;
  passType: PassType;
  photo: string | null;
};

/** Layout as fractions of the template's viewBox, so any template size works. */
export type CardLayout = {
  photoX: number;
  photoY: number;
  photoW: number;
  photoRatio: number;
  goldBorder: boolean;
  infoY: number;
  infoH: number;
  barcodeY: number;
  barcodeH: number;
};

export const DEFAULT_LAYOUT: CardLayout = {
  photoX: 0.6,
  photoY: 0.16,
  photoW: 0.3,
  photoRatio: 1.2,
  goldBorder: true,
  infoY: 0.5,
  infoH: 0.27,
  barcodeY: 0.82,
  barcodeH: 0.08,
};

const FONT = "Inter, Montserrat, Arial, Helvetica, sans-serif";
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const r = (n: number) => Math.round(n * 100) / 100;

/** Pure-vector Code 128 bars via JsBarcode → returns { inner markup, width, height }. */
function barcodeVector(value: string) {
  const el = document.createElementNS(SVG_NS, "svg");
  JsBarcode(el, value, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 2,
    height: 100,
    background: "transparent",
    lineColor: "#000000",
  });
  const w = parseFloat(el.getAttribute("width") || "0");
  const h = parseFloat(el.getAttribute("height") || "100");
  // Re-serialize children; strip JsBarcode's inline style in favour of fill attrs (Illustrator-friendly).
  const inner = Array.from(el.childNodes)
    .map((n) => new XMLSerializer().serializeToString(n))
    .join("")
    .replace(/\s?xmlns="[^"]*"/g, "")
    .replace(/style="fill:\s*([^;"]+);?"/g, 'fill="$1"');
  return { inner, w, h };
}

/** Extracts template layer markup + namespace declarations from an SVG template. */
function templateLayer(t: CardTemplate): { markup: string; ns: string } {
  const { x, y, w, h } = t.viewBox;
  if (t.kind === "png") {
    return {
      markup: `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" href="${t.data}" xlink:href="${t.data}"/>`,
      ns: "",
    };
  }
  const svg = new DOMParser().parseFromString(t.data, "image/svg+xml").documentElement;
  const ns = Array.from(svg.attributes)
    .filter((a) => a.name.startsWith("xmlns:") && a.name !== "xmlns:xlink")
    .map((a) => ` ${a.name}="${esc(a.value)}"`)
    .join("");
  const ser = new XMLSerializer();
  const markup = Array.from(svg.childNodes)
    .map((n) => ser.serializeToString(n))
    .join("")
    .replace(/\s?xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "")
    .replace(/\s?xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/g, "");
  return { markup, ns };
}

/**
 * Compose the final badge as standalone vector SVG. Root keeps the template's
 * native width/height/viewBox, so output dimensions match the template exactly.
 */
export function composeCardSvg(t: CardTemplate, d: CardData, L: CardLayout = DEFAULT_LAYOUT): string {
  const { x: vx, y: vy, w: W, h: H } = t.viewBox;
  const u = W / 600; // design unit: 1 at 600-wide cards
  const tpl = templateLayer(t);

  // Layer 2 — photo
  const pw = W * L.photoW;
  const ph = pw * L.photoRatio;
  const px = vx + W * L.photoX;
  const py = vy + H * L.photoY;
  const prx = 12 * u;
  const photo = d.photo
    ? `<g id="layer-photo">` +
      `<clipPath id="idc-photo-clip"><rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="${r(prx)}"/></clipPath>` +
      `<image x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#idc-photo-clip)" href="${d.photo}" xlink:href="${d.photo}"/>` +
      (L.goldBorder
        ? `<rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="${r(prx)}" fill="none" stroke="#D4AF37" stroke-width="${r(5 * u)}"/>`
        : "") +
      `</g>`
    : "";

  // Layer 3 — info container
  const ix = vx + W * 0.08;
  const iw = W * 0.84;
  const iy = vy + H * L.infoY;
  const ih = H * L.infoH;
  const rows: Array<[string, string]> = [
    ["ID No", d.id],
    ["Name", d.name],
    ["Designation", d.designation],
    ["Organization", d.organisation],
    ["Country", d.country],
  ];
  const lineH = ih / (rows.length + 0.9);
  const baseFs = Math.min(lineH * 0.58, 30 * u);
  const pad = 22 * u;
  const text = rows
    .map(([label, value], i) => {
      const s = `${label}: ${value}`;
      const est = s.length * baseFs * 0.56; // conservative avg glyph width
      const fs = est > iw - pad * 2 ? (baseFs * (iw - pad * 2)) / est : baseFs;
      const ty = iy + lineH * (i + 0.95) + fs * 0.35;
      return `<text x="${r(ix + pad)}" y="${r(ty)}" font-family="${FONT}" font-size="${r(fs)}" fill="#0F172A"><tspan font-weight="400" fill="#475569">${esc(label)}: </tspan><tspan font-weight="700">${esc(value || "—")}</tspan></text>`;
    })
    .join("");
  const info =
    `<g id="layer-info"><rect x="${r(ix)}" y="${r(iy)}" width="${r(iw)}" height="${r(ih)}" rx="15" ry="15" fill="#FFFFFF"/>` +
    text +
    `</g>`;

  // Layer 4 — barcode in a white pill
  const bc = barcodeVector(d.id || "NRB");
  const bh = H * L.barcodeH;
  const bw = Math.min(W * 0.62, bh * (bc.w / bc.h) * 3.2);
  const bx = vx + (W - bw) / 2;
  const by = vy + H * L.barcodeY;
  const pillPadX = bh * 0.45;
  const pillPadY = bh * 0.22;
  const barcode =
    `<g id="layer-barcode">` +
    `<rect x="${r(bx - pillPadX)}" y="${r(by - pillPadY)}" width="${r(bw + pillPadX * 2)}" height="${r(bh + pillPadY * 2)}" rx="${r((bh + pillPadY * 2) / 2)}" fill="#FFFFFF"/>` +
    `<g transform="translate(${r(bx)} ${r(by)}) scale(${r(bw / bc.w * 1000) / 1000} ${r(bh / bc.h * 1000) / 1000})" shape-rendering="crispEdges">${bc.inner}</g>` +
    `</g>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}"${tpl.ns} version="1.1" width="${t.width}" height="${t.height}" viewBox="${vx} ${vy} ${W} ${H}">` +
    `<title>NRB World Event Badge ${esc(d.id)}</title>` +
    `<g id="layer-template">${tpl.markup}</g>` +
    photo +
    info +
    barcode +
    `</svg>`
  );
}

/** Rasterize SVG to a 300-DPI JPG (template px assumed at 96 DPI). */
export async function svgToJpg300(svg: string, width: number, height: number): Promise<Blob> {
  let scale = 300 / 96;
  const maxSide = 9000;
  if (Math.max(width, height) * scale > maxSide) scale = maxSide / Math.max(width, height);
  const cw = Math.round(width * scale);
  const ch = Math.round(height * scale);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not render SVG for JPG export."));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPG encode failed."))), "image/jpeg", 0.95),
    );
    return setJpegDpi(blob, 300);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Patch the JFIF APP0 density so print software reads 300 DPI. */
async function setJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // SOI FFD8, APP0 FFE0, "JFIF\0" at 6..10, units at 13, Xdensity 14-15, Ydensity 16-17
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
    buf[13] = 1;
    buf[14] = dpi >> 8;
    buf[15] = dpi & 0xff;
    buf[16] = dpi >> 8;
    buf[17] = dpi & 0xff;
  }
  return new Blob([buf], { type: "image/jpeg" });
}
