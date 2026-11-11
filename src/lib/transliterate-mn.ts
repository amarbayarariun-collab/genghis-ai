/**
 * Informal Mongolian Latin → Cyrillic (phone-keyboard style).
 * Pure client-side helper; leaves non-Latin characters unchanged.
 */

export const TRANSLIT_STORAGE_KEY = "genghis:latin-cyrillic";

/** Longest-first multi-letter rules (lowercase keys). */
const MULTI: ReadonlyArray<readonly [string, string]> = [
  ["kh", "х"],
  ["sh", "ш"],
  ["ch", "ч"],
  ["ts", "ц"],
  ["ya", "я"],
  ["yo", "ё"],
  ["yu", "ю"],
  ["ye", "е"],
  ["yi", "ы"],
  ["ai", "ай"],
  ["ei", "эй"],
  ["oi", "ой"],
  ["ui", "уй"],
  ["ii", "ий"],
  ["o'", "ө"],
  ["u'", "ү"],
  ["ö", "ө"],
  ["ü", "ү"],
];

const SINGLE: Readonly<Record<string, string>> = {
  a: "а",
  b: "б",
  v: "в",
  g: "г",
  d: "д",
  e: "э",
  j: "ж",
  z: "з",
  i: "и",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  u: "у",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  f: "ф",
  x: "х",
  h: "х",
  y: "й",
  w: "в",
  c: "с",
  q: "к",
  ö: "ө",
  ü: "ү",
};

function applyCase(source: string, cyr: string): string {
  if (!cyr) return cyr;
  const allUpper =
    source === source.toUpperCase() && source !== source.toLowerCase();
  if (allUpper) return cyr.toLocaleUpperCase("mn-MN");
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return cyr[0].toLocaleUpperCase("mn-MN") + cyr.slice(1);
  }
  return cyr;
}

function isLatinLetter(ch: string): boolean {
  return /[A-Za-zÖöÜü]/.test(ch);
}

/**
 * Convert Mongolian written in Latin letters to Cyrillic.
 * Digraphs: kh→х, ts→ц, ch→ч, sh→ш, ya→я, yo→ё, yu→ю.
 * ө/ү via ö/ü or o'/u'.
 */
export function latinToCyrillicMn(input: string): string {
  if (!input) return input;
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (!isLatinLetter(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    let matched = false;
    for (const [latin, cyr] of MULTI) {
      const slice = input.slice(i, i + latin.length);
      if (slice.toLowerCase() === latin) {
        out += applyCase(slice, cyr);
        i += latin.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const lower = ch.toLowerCase();
    const mapped = SINGLE[lower];
    if (mapped) {
      out += applyCase(ch, mapped);
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }
  return out;
}

/** True when the string has Latin letters that transliteration would change. */
export function hasLatinForTranslit(input: string): boolean {
  return /[A-Za-zÖöÜü]/.test(input);
}

export function readStoredTranslitEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TRANSLIT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredTranslitEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRANSLIT_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
