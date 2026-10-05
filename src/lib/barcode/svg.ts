import { encodeCode128B } from "./code128";

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
