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

/** Granular layout settings for full manual positioning & auto pre-printed fit. */
export type CardLayout = {
  templateMode: "preprinted" | "blank";

  // Photo controls
  photoX: number; // 0..1 fraction of card width
  photoY: number; // 0..1 fraction of card height
  photoW: number; // 0..1 fraction of card width
  photoH: number; // 0..1 fraction of card height
  photoRadius: number; // border radius in design units
  goldBorder: boolean; // draw border on photo
  borderWidth: number; // border width in design units
  borderColor: string; // border hex color

  // Info box background (optional)
  showInfoBg: boolean; // draw background rect
  infoBgColor: string; // background color
  infoBgOpacity: number; // 0..1
  infoBgRadius: number; // radius in design units
  infoX: number; // fraction of width
  infoY: number; // fraction of height
  infoW: number; // fraction of width
  infoH: number; // fraction of height

  // Info values text positioning
  valuesX: number; // fraction of width (where value text starts)
  valuesStartY: number; // fraction of height (where first line starts)
  lineGap: number; // vertical step between each row
  fontSize: number; // font size in design units
  fontColor: string; // font color
  fontWeight: number; // 400 | 600 | 700 | 800
  letterSpacing: number; // px

  // Individual line micro-offsets (Y offset in design units)
  idOffsetY: number;
  nameOffsetY: number;
  desigOffsetY: number;
  orgOffsetY: number;
  countryOffsetY: number;

  // Individual line micro-offsets (X offset in design units)
  idOffsetX: number;
  nameOffsetX: number;
  desigOffsetX: number;
  orgOffsetX: number;
  countryOffsetX: number;

  // Barcode controls
  barcodeX: number; // horizontal center fraction (0..1)
  barcodeY: number; // vertical position fraction (0..1)
  barcodeW: number; // width fraction (0..1)
  barcodeH: number; // height fraction (0..1)
  barcodePill: boolean; // white background pill
  barcodePillPadX: number; // padding in design units
  barcodePillPadY: number;
  barcodePillRadius: number;
  barcodeShowText: boolean; // show ID text below barcode
};

/** Pixel-perfect layout for NRB World Summit Dhaka 2026 pre-printed badge */
export const NRB_SUMMIT_2026_LAYOUT: CardLayout = {
  templateMode: "preprinted",

  // Photo slot fits exactly in the pre-printed gold frame: 458x161, 229x242 on 818x1024
  photoX: 0.5599,
  photoY: 0.1572,
  photoW: 0.28,
  photoH: 0.2363,
  photoRadius: 0,
  goldBorder: false, // already on template
  borderWidth: 4,
  borderColor: "#D4AF37",

  // Info container
  showInfoBg: false, // white container is already on template
  infoBgColor: "#FFFFFF",
  infoBgOpacity: 1,
  infoBgRadius: 15,
  infoX: 0.176,
  infoY: 0.43,
  infoW: 0.65,
  infoH: 0.24,

  // Text values start right after pre-printed labels (max label X is ~338px = 41.3%)
  valuesX: 0.435, // ~356px
  valuesStartY: 0.4873, // Line 1 (ID No) at ~499px
  lineGap: 0.0388, // row step ~39.7px
  fontSize: 22,
  fontColor: "#0F172A",
  fontWeight: 700,
  letterSpacing: 0,

  idOffsetY: 0,
  nameOffsetY: 0,
  desigOffsetY: 0,
  orgOffsetY: 0,
  countryOffsetY: 0,

  idOffsetX: 0,
  nameOffsetX: 0,
  desigOffsetX: 0,
  orgOffsetX: 0,
  countryOffsetX: 0,

  // Barcode in clean bottom area above flags
  barcodeX: 0.5,
  barcodeY: 0.772,
  barcodeW: 0.48,
  barcodeH: 0.062,
  barcodePill: true,
  barcodePillPadX: 16,
  barcodePillPadY: 8,
  barcodePillRadius: 10,
  barcodeShowText: false,
};

/** Default layout for blank / non-preprinted badges */
export const STANDARD_BLANK_LAYOUT: CardLayout = {
  templateMode: "blank",

  photoX: 0.6,
  photoY: 0.16,
  photoW: 0.3,
  photoH: 0.36,
  photoRadius: 12,
  goldBorder: true,
  borderWidth: 4,
  borderColor: "#D4AF37",

  showInfoBg: true,
  infoBgColor: "#FFFFFF",
  infoBgOpacity: 1,
  infoBgRadius: 15,
  infoX: 0.08,
  infoY: 0.5,
  infoW: 0.84,
  infoH: 0.27,

  valuesX: 0.12,
  valuesStartY: 0.53,
  lineGap: 0.045,
  fontSize: 22,
  fontColor: "#0F172A",
  fontWeight: 700,
  letterSpacing: 0,

  idOffsetY: 0,
  nameOffsetY: 0,
  desigOffsetY: 0,
  orgOffsetY: 0,
  countryOffsetY: 0,

  idOffsetX: 0,
  nameOffsetX: 0,
  desigOffsetX: 0,
  orgOffsetX: 0,
  countryOffsetX: 0,

  barcodeX: 0.5,
  barcodeY: 0.83,
  barcodeW: 0.6,
  barcodeH: 0.075,
  barcodePill: true,
  barcodePillPadX: 18,
  barcodePillPadY: 9,
  barcodePillRadius: 14,
  barcodeShowText: false,
};

export const DEFAULT_LAYOUT: CardLayout = NRB_SUMMIT_2026_LAYOUT;

const FONT = "Inter, Montserrat, Arial, Helvetica, sans-serif";
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const esc = (s: string) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const r = (n: number) => Math.round(n * 100) / 100;

/** Pure-vector Code 128 bars via JsBarcode → returns { inner markup, width, height }. */
function barcodeVector(value: string) {
  const el = document.createElementNS(SVG_NS, "svg");
  JsBarcode(el, value || "NRB2026", {
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
  const inner = Array.from(el.childNodes)
    .map((n) => new XMLSerializer().serializeToString(n))
    .join("")
    .replace(/\s?xmlns="[^"]*"/g, "")
    .replace(/style="fill:\s*([^;"]+);?"/g, 'fill="$1"');
  return { inner, w, h };
}

/** Extracts template layer markup + namespace declarations from an SVG or PNG template. */
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
  const u = W / 600; // design scale unit relative to 600px width
  const tpl = templateLayer(t);

  // 1. Layer — Photo
  const pw = W * L.photoW;
  const ph = H * L.photoH;
  const px = vx + W * L.photoX;
  const py = vy + H * L.photoY;
  const prx = L.photoRadius * u;

  let photo = "";
  if (d.photo) {
    photo =
      `<g id="layer-photo">` +
      `<clipPath id="idc-photo-clip"><rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="${r(prx)}" ry="${r(prx)}"/></clipPath>` +
      `<image x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#idc-photo-clip)" href="${d.photo}" xlink:href="${d.photo}"/>` +
      (L.goldBorder
        ? `<rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="${r(prx)}" ry="${r(prx)}" fill="none" stroke="${L.borderColor}" stroke-width="${r(L.borderWidth * u)}"/>`
        : "") +
      `</g>`;
  } else {
    // Helpful preview dashed slot when no photo has been uploaded yet
    photo =
      `<g id="layer-photo-placeholder" opacity="0.35">` +
      `<rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="${r(prx)}" ry="${r(prx)}" fill="#CBD5E1" stroke="#64748B" stroke-width="${r(2 * u)}" stroke-dasharray="6,4"/>` +
      `<text x="${r(px + pw / 2)}" y="${r(py + ph / 2)}" font-family="${FONT}" font-size="${r(13 * u)}" font-weight="600" fill="#475569" text-anchor="middle" dominant-baseline="middle">PHOTO SLOT</text>` +
      `</g>`;
  }

  // 2. Layer — Attendee Info Fields
  let info = "";
  const rows: Array<{ label: string; value: string; offX: number; offY: number }> = [
    { label: "ID No", value: d.id, offX: L.idOffsetX, offY: L.idOffsetY },
    { label: "Name", value: d.name, offX: L.nameOffsetX, offY: L.nameOffsetY },
    { label: "Designation", value: d.designation, offX: L.desigOffsetX, offY: L.desigOffsetY },
    { label: "Organization", value: d.organisation, offX: L.orgOffsetX, offY: L.orgOffsetY },
    { label: "Country", value: d.country, offX: L.countryOffsetX, offY: L.countryOffsetY },
  ];

  if (L.templateMode === "preprinted") {
    // In pre-printed mode, the labels & white box are already on the template.
    // We only render the text values aligned in front of each pre-printed line.
    let bgRect = "";
    if (L.showInfoBg) {
      const ix = vx + W * L.infoX;
      const iy = vy + H * L.infoY;
      const iw = W * L.infoW;
      const ih = H * L.infoH;
      bgRect = `<rect x="${r(ix)}" y="${r(iy)}" width="${r(iw)}" height="${r(ih)}" rx="${r(L.infoBgRadius * u)}" fill="${L.infoBgColor}" opacity="${L.infoBgOpacity}"/>`;
    }

    const maxTextW = W * 0.38; // available width from valuesX (~43.5%) to right edge of box (~82%)
    const valueNodes = rows
      .map((row, i) => {
        const rowX = vx + W * L.valuesX + row.offX * u;
        const rowY = vy + H * (L.valuesStartY + i * L.lineGap) + row.offY * u;
        const baseFs = L.fontSize * u;
        const textVal = row.value || "—";
        const estW = textVal.length * baseFs * 0.58;
        const fs = estW > maxTextW ? Math.max((baseFs * maxTextW) / estW, 11 * u) : baseFs;
        return (
          `<text x="${r(rowX)}" y="${r(rowY)}" font-family="${FONT}" font-size="${r(fs)}" ` +
          `font-weight="${L.fontWeight}" fill="${L.fontColor}" dominant-baseline="central" letter-spacing="${L.letterSpacing}">` +
          `${esc(textVal)}</text>`
        );
      })
      .join("");

    info = `<g id="layer-info">${bgRect}${valueNodes}</g>`;
  } else {
    // In blank mode, render the full white card container with labels + values
    const ix = vx + W * L.infoX;
    const iy = vy + H * L.infoY;
    const iw = W * L.infoW;
    const ih = H * L.infoH;
    const lineH = ih / (rows.length + 0.9);
    const baseFs = Math.min(lineH * 0.58, 30 * u);
    const pad = 22 * u;

    const textNodes = rows
      .map((row, i) => {
        const s = `${row.label}: ${row.value}`;
        const est = s.length * baseFs * 0.56;
        const fs = est > iw - pad * 2 ? (baseFs * (iw - pad * 2)) / est : baseFs;
        const ty = iy + lineH * (i + 0.95) + fs * 0.35 + row.offY * u;
        const tx = ix + pad + row.offX * u;
        return (
          `<text x="${r(tx)}" y="${r(ty)}" font-family="${FONT}" font-size="${r(fs)}" fill="${L.fontColor}">` +
          `<tspan font-weight="500" fill="#475569">${esc(row.label)}: </tspan>` +
          `<tspan font-weight="${L.fontWeight}">${esc(row.value || "—")}</tspan>` +
          `</text>`
        );
      })
      .join("");

    info =
      `<g id="layer-info">` +
      `<rect x="${r(ix)}" y="${r(iy)}" width="${r(iw)}" height="${r(ih)}" rx="${r(L.infoBgRadius * u)}" fill="${L.infoBgColor}"/>` +
      textNodes +
      `</g>`;
  }

  // 3. Layer — Barcode
  const bc = barcodeVector(d.id || "NRB2026");
  const bh = H * L.barcodeH;
  const bw = W * L.barcodeW;
  const bx = vx + W * L.barcodeX - bw / 2;
  const by = vy + H * L.barcodeY;
  const pillPadX = L.barcodePillPadX * u;
  const pillPadY = L.barcodePillPadY * u;
  const scaleX = bc.w > 0 ? bw / bc.w : 1;
  const scaleY = bc.h > 0 ? bh / bc.h : 1;

  let barcodeBg = "";
  if (L.barcodePill) {
    barcodeBg = `<rect x="${r(bx - pillPadX)}" y="${r(by - pillPadY)}" width="${r(bw + pillPadX * 2)}" height="${r(bh + pillPadY * 2)}" rx="${r(L.barcodePillRadius * u)}" fill="#FFFFFF"/>`;
  }

  let barcodeText = "";
  if (L.barcodeShowText && d.id) {
    barcodeText = `<text x="${r(bx + bw / 2)}" y="${r(by + bh + 14 * u)}" text-anchor="middle" font-family="${FONT}" font-size="${r(12 * u)}" font-weight="700" fill="#0F172A">${esc(d.id)}</text>`;
  }

  const barcode =
    `<g id="layer-barcode">` +
    barcodeBg +
    `<g transform="translate(${r(bx)} ${r(by)}) scale(${r(scaleX * 1000) / 1000} ${r(scaleY * 1000) / 1000})" shape-rendering="crispEdges">${bc.inner}</g>` +
    barcodeText +
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
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
    buf[13] = 1;
    buf[14] = dpi >> 8;
    buf[15] = dpi & 0xff;
    buf[16] = dpi >> 8;
    buf[17] = dpi & 0xff;
  }
  return new Blob([buf], { type: "image/jpeg" });
}
