import { encodeCode128B } from "./code128";
import type { PassType } from "../types";

export type Code128SvgOptions = {
  moduleWidth?: number;
  barHeight?: number;
  quietModules?: number;
  padding?: number;
  textSize?: number;
  textGap?: number;
};

const DEFAULTS: Required<Code128SvgOptions> = {
  moduleWidth: 3,
  barHeight: 96,
  quietModules: 10,
  padding: 20,
  textSize: 18,
  textGap: 14,
};

/**
 * True vector Code 128 SVG: black bars on a white field, human-readable
 * ID centered under the bars. No fonts are embedded; a system mono stack
 * is referenced so the file stays tiny and prints at any size.
 */
export function renderCode128Svg(
  text: string,
  options: Code128SvgOptions = {},
): string {
  const opt = { ...DEFAULTS, ...options };
  const { modules } = encodeCode128B(text);
  const padded = `${"0".repeat(opt.quietModules)}${modules}${"0".repeat(opt.quietModules)}`;

  const barsWidth = padded.length * opt.moduleWidth;
  const innerWidth = barsWidth;
  const width = innerWidth + opt.padding * 2;
  const barsY = opt.padding;
  const textY = barsY + opt.barHeight + opt.textGap + opt.textSize * 0.82;
  const height = Math.ceil(textY + opt.padding);

  const rects: string[] = [];
  let index = 0;
  while (index < padded.length) {
    if (padded[index] !== "1") {
      index += 1;
      continue;
    }
    let run = 0;
    while (padded[index + run] === "1") run += 1;
    const x = opt.padding + index * opt.moduleWidth;
    const w = run * opt.moduleWidth;
    rects.push(
      `<rect x="${x}" y="${barsY}" width="${w}" height="${opt.barHeight}"/>`,
    );
    index += run;
  }

  const escaped = escapeXml(text);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Code 128 ${escaped}">`,
    `<title>Code 128 ${escaped}</title>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<g fill="#000000" shape-rendering="crispEdges">`,
    rects.join(""),
    `</g>`,
    `<text x="${width / 2}" y="${textY}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" font-size="${opt.textSize}" font-weight="600" fill="#000000" letter-spacing="0.08em">${escaped}</text>`,
    `</svg>`,
    ``,
  ].join("");
}

export type BadgeCardOptions = {
  id: string;
  name?: string;
  country?: string;
  passType?: PassType;
};

/**
 * Renders a full, printable, visually distinct vector ID card / badge with
 * vibrant pass-type color themes (Day 1 Sky Blue, Day 2 Purple, Both Days Gold VIP),
 * large typography, and centered Code 128 barcode.
 */
export function renderBadgeCardSvg(options: BadgeCardOptions): string {
  const id = (options.id || "NRB20260001").trim().toUpperCase();
  const name = (options.name || "Guest Attendee").trim();
  const country = (options.country || "Bangladesh").trim();
  const passType = options.passType || "Both Days";

  const width = 420;
  const height = 640;

  // Pass Theme Colors
  let headerColor1 = "#d97706"; // amber-600
  let headerColor2 = "#b45309"; // amber-700
  let borderColor = "#f59e0b"; // amber-500
  let badgeBg = "#fef3c7"; // amber-100
  let badgeText = "#92400e"; // amber-800
  let passTitle = "★ 2-DAY ALL ACCESS VIP ★";
  let passSub = "VALID FOR DAY 1 & DAY 2 ENTRY";
  let passTagColor = "#d97706";

  if (passType === "Day 1 Only") {
    headerColor1 = "#0284c7"; // sky-600
    headerColor2 = "#0369a1"; // sky-700
    borderColor = "#0ea5e9"; // sky-500
    badgeBg = "#e0f2fe"; // sky-100
    badgeText = "#075985"; // sky-900
    passTitle = "★ DAY 1 PASS ONLY ★";
    passSub = "VALID ON DAY 1 (OPENING) ONLY";
    passTagColor = "#0284c7";
  } else if (passType === "Day 2 Only") {
    headerColor1 = "#7c3aed"; // violet-600
    headerColor2 = "#6d28d9"; // violet-700
    borderColor = "#8b5cf6"; // violet-500
    badgeBg = "#f3e8ff"; // violet-100
    badgeText = "#581c87"; // violet-900
    passTitle = "★ DAY 2 PASS ONLY ★";
    passSub = "VALID ON DAY 2 (FINALE) ONLY";
    passTagColor = "#7c3aed";
  }

  // Generate barcode bars
  const { modules } = encodeCode128B(id);
  const quiet = 6;
  const padded = `${"0".repeat(quiet)}${modules}${"0".repeat(quiet)}`;
  const moduleW = 2.2;
  const barH = 68;
  const barsTotalWidth = padded.length * moduleW;
  const barcodeStartX = (width - barsTotalWidth) / 2;
  const barcodeStartY = 380;

  const rects: string[] = [];
  let index = 0;
  while (index < padded.length) {
    if (padded[index] !== "1") {
      index += 1;
      continue;
    }
    let run = 0;
    while (padded[index + run] === "1") run += 1;
    const x = barcodeStartX + index * moduleW;
    const w = run * moduleW;
    rects.push(
      `<rect x="${x.toFixed(1)}" y="${barcodeStartY}" width="${w.toFixed(1)}" height="${barH}"/>`,
    );
    index += run;
  }

  const escapedId = escapeXml(id);
  const escapedName = escapeXml(name);
  const escapedCountry = escapeXml(country);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="NRB Event Badge ${escapedId}">`,
    `<defs>`,
    `  <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `    <stop offset="0%" stop-color="${headerColor1}"/>`,
    `    <stop offset="100%" stop-color="${headerColor2}"/>`,
    `  </linearGradient>`,
    `  <filter id="cardShadow" x="-10%" y="-5%" width="120%" height="115%">`,
    `    <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>`,
    `  </filter>`,
    `</defs>`,
    `<!-- Card Background -->`,
    `<rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="28" ry="28" fill="#ffffff" stroke="${borderColor}" stroke-width="3" filter="url(#cardShadow)"/>`,
    ``,
    `<!-- Header Banner with Pass Color -->`,
    `<path d="M 12 38 Q 12 12 38 12 L ${width - 38} 12 Q ${width - 12} 12 ${width - 12} 38 L ${width - 12} 135 L 12 135 Z" fill="url(#headerGrad)"/>`,
    ``,
    `<!-- Header Content -->`,
    `<text x="${width / 2}" y="44" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="12" font-weight="800" fill="#ffffff" opacity="0.9" letter-spacing="0.22em">NRB WORLD EVENT 2026</text>`,
    `<text x="${width / 2}" y="78" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="0.06em">${passTitle}</text>`,
    `<text x="${width / 2}" y="102" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#ffffff" opacity="0.92" letter-spacing="0.14em">${passSub}</text>`,
    ``,
    `<!-- Pass Type Ribbon Pill -->`,
    `<rect x="${width / 2 - 90}" y="120" width="180" height="30" rx="15" ry="15" fill="${badgeBg}" stroke="${borderColor}" stroke-width="1.5"/>`,
    `<text x="${width / 2}" y="140" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="12" font-weight="800" fill="${badgeText}" letter-spacing="0.08em">${passType.toUpperCase()}</text>`,
    ``,
    `<!-- Attendee Information -->`,
    `<text x="${width / 2}" y="200" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="0.16em">DELEGATE / ATTENDEE</text>`,
    `<text x="${width / 2}" y="238" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#0f172a" letter-spacing="-0.02em">${escapedName}</text>`,
    `<text x="${width / 2}" y="268" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#475569" letter-spacing="0.04em">${escapedCountry}</text>`,
    ``,
    `<!-- Divider Line -->`,
    `<line x1="40" y1="295" x2="${width - 40}" y2="295" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4 4"/>`,
    ``,
    `<!-- Barcode Container Box -->`,
    `<rect x="30" y="320" width="${width - 60}" height="190" rx="18" ry="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>`,
    `<text x="${width / 2}" y="352" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="11" font-weight="800" fill="#64748b" letter-spacing="0.16em">OFFICIAL ENTRY BARCODE</text>`,
    ``,
    `<!-- Code 128 Barcode Elements -->`,
    `<g fill="#000000" shape-rendering="crispEdges">`,
    rects.join(""),
    `</g>`,
    `<text x="${width / 2}" y="${barcodeStartY + barH + 28}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" font-weight="800" fill="#0f172a" letter-spacing="0.12em">${escapedId}</text>`,
    ``,
    `<!-- Security Badge Footer -->`,
    `<rect x="12" y="${height - 70}" width="${width - 24}" height="42" rx="0" ry="0" fill="#f1f5f9"/>`,
    `<path d="M 12 ${height - 70} L ${width - 12} ${height - 70} L ${width - 12} ${height - 38} Q ${width - 12} ${height - 12} ${width - 38} ${height - 12} L 38 ${height - 12} Q 12 ${height - 12} 12 ${height - 38} Z" fill="#0f172a"/>`,
    `<text x="${width / 2}" y="${height - 32}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="0.15em">SCAN AT GATE CAMERA FOR ENTRY VERIFICATION</text>`,
    `</svg>`,
    ``,
  ].join("");
}

export function badgeCardFileName(id: string, passType: PassType = "Both Days"): string {
  const safeId = id.replace(/[^A-Za-z0-9._-]+/g, "_");
  const suffix = passType.replace(/\s+/g, "_");
  return `NRB_Badge_${safeId}_${suffix}.svg`;
}

export function svgFileName(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${safe}.svg`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&#38;";
    if (ch === "<") return "&#60;";
    if (ch === ">") return "&#62;";
    if (ch === '"') return "&#34;";
    return "&#39;";
  });
}

