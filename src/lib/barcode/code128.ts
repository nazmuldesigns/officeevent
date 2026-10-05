/**
 * Code 128 (Set B) encoder.
 * Patterns match the public Code 128 specification used by JsBarcode.
 * Output is a module bitstream: 1 = bar, 0 = space. Quiet zones are added
 * by the SVG renderer, not here.
 */

const PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
] as const;

const START_B = 104;
const STOP = 106;

export type Code128EncodeResult = {
  text: string;
  codes: number[];
  modules: string;
  checksum: number;
};

function expandPattern(pattern: string): string {
  let bar = true;
  let out = "";
  for (const digit of pattern) {
    const width = Number(digit);
    out += (bar ? "1" : "0").repeat(width);
    bar = !bar;
  }
  return out;
}

function charToCode(ch: string): number {
  const code = ch.charCodeAt(0) - 32;
  if (code < 0 || code > 94) {
    throw new Error(`Unsupported Code 128 character: ${JSON.stringify(ch)}`);
  }
  return code;
}

export function encodeCode128B(text: string): Code128EncodeResult {
  if (!text) throw new Error("ID is empty");
  const codes: number[] = [START_B];
  for (const ch of text) {
    codes.push(charToCode(ch));
  }
  let sum = codes[0] ?? 0;
  for (let i = 1; i < codes.length; i += 1) {
    sum += (codes[i] ?? 0) * i;
  }
  const checksum = sum % 103;
  codes.push(checksum, STOP);

  const modules = codes
    .map((value) => {
      const pattern = PATTERNS[value];
      if (!pattern) throw new Error(`Missing Code 128 pattern for ${value}`);
      return expandPattern(pattern);
    })
    .join("");

  return { text, codes, modules, checksum };
}

export function assertCode128Ready(): void {
  if (PATTERNS.length !== 107) {
    throw new Error(`Code 128 table is ${PATTERNS.length}, expected 107`);
  }
}
