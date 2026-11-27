// The quotation profile `quote-fold/0` (CONTRACT-002 D, SD-007 BR-705 to
// BR-709). It folds both texts the same way, keeps a map back to the unchanged
// originals, and allows exactly the differences the product owner approved:
//   - runs of white space and line breaks
//   - soft hyphens
//   - Latin presentation ligatures against their letters
//   - Unicode canonical equivalence
//   - straight against curly quotation marks of the same level
//   - a word that the stored text splits with a hyphen at a line end, joined
// Nothing else. No stored text is ever changed.

export const QUOTE_PROFILE = "quote-fold/0";

export type Fold = "white_space" | "soft_hyphen" | "ligature" | "canonical_form" | "quotation_marks" | "line_end_join";

export const FOLD_WORDS: Record<Fold, string> = {
  white_space: "white space and line breaks",
  soft_hyphen: "soft hyphens",
  ligature: "Latin ligatures",
  canonical_form: "two Unicode spellings of the same characters",
  quotation_marks: "straight and curly quotation marks",
  line_end_join: "a word joined across a hyphen at a line end",
};

/** Only the Latin presentation forms U+FB00 to U+FB06, as their own letters. */
const LIGATURES: Record<string, string> = {
  "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ſt", "ﬆ": "st",
};
const QUOTES: Record<string, string> = { "“": '"', "”": '"', "‘": "'", "’": "'" };
const SOFT_HYPHEN = "­";

interface Applied { fold: Fold; at: number; joined?: string }

export interface Folded {
  original: string;
  text: string;
  /** For each unit of `text`, the span of `original` it came from. */
  from: number[];
  to: number[];
  /** Whether a match may start at this unit: it begins a character of the original. */
  starts: boolean[];
  applied: Applied[];
}

const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;

/** A line-end hyphen inside a word at `at`: where the word goes on, or undefined. */
function joinAfter(text: string, at: number): number | undefined {
  let back = at - 1;
  while (back >= 0 && (text[back] === SOFT_HYPHEN || MARK.test(text[back]!))) back--;
  if (!LETTER.test(codeBefore(text, back + 1))) return undefined;
  // Directly before the line break: a hyphen followed by a space is not a split word.
  const rest = /^\r?\n[ \t]*/.exec(text.slice(at + 1, at + 200));
  if (!rest) return undefined;
  const next = at + 1 + rest[0].length;
  const code = text.codePointAt(next);
  return code !== undefined && LETTER.test(String.fromCodePoint(code)) ? next : undefined;
}

/** The word around a join, for the evidence. */
function joinedWord(original: string, hyphen: number, next: number): string {
  const before = /[\p{L}\p{M}­]*$/u.exec(original.slice(Math.max(0, hyphen - 60), hyphen))![0];
  const after = /^[\p{L}\p{M}­]*/u.exec(original.slice(next, next + 60))![0];
  return `${before}-|${after}`.replaceAll(SOFT_HYPHEN, "");
}

/** `stored` text may split words at line ends; a quotation's own hyphens are never joined. */
export function fold(original: string, side: "stored" | "quotation"): Folded {
  const out: string[] = [];
  const from: number[] = [];
  const to: number[] = [];
  const starts: boolean[] = [];
  const applied: Applied[] = [];
  let length = 0;
  let space: { start: number; end: number; plain: boolean } | undefined;

  const push = (text: string, start: number, end: number) => {
    for (let i = 0; i < text.length; i++) {
      from.push(start);
      to.push(end);
      starts.push(i === 0);
    }
    out.push(text);
    length += text.length;
  };
  const flush = () => {
    if (!space) return;
    if (!space.plain) applied.push({ fold: "white_space", at: length });
    push(" ", space.start, space.end);
    space = undefined;
  };

  for (let i = 0; i < original.length; ) {
    const char = original[i]!;
    if (side === "stored" && (char === "-" || char === "‐" || char === SOFT_HYPHEN)) {
      const next = joinAfter(original, i);
      if (next !== undefined) {
        applied.push({ fold: "line_end_join", at: length, joined: joinedWord(original, i, next) });
        i = next;
        continue;
      }
    }
    if (char === SOFT_HYPHEN) {
      applied.push({ fold: "soft_hyphen", at: length });
      i++;
      continue;
    }
    if (/\s/.test(char)) {
      if (space) {
        space.end = i + 1;
        space.plain = false;
      } else space = { start: i, end: i + 1, plain: char === " " };
      i++;
      continue;
    }
    // One character with the marks that follow it: canonical reordering stays inside it.
    let end = i + String.fromCodePoint(original.codePointAt(i)!).length;
    while (end < original.length) {
      const next = String.fromCodePoint(original.codePointAt(end)!);
      if (!MARK.test(next)) break;
      end += next.length;
    }
    flush();
    const cluster = original.slice(i, end);
    let text = cluster.normalize("NFD");
    if (text !== cluster) applied.push({ fold: "canonical_form", at: length });
    if (Object.hasOwn(LIGATURES, text[0]!)) {
      applied.push({ fold: "ligature", at: length });
      text = LIGATURES[text[0]!]! + text.slice(1);
    }
    if (Object.hasOwn(QUOTES, text[0]!)) {
      applied.push({ fold: "quotation_marks", at: length });
      text = QUOTES[text[0]!]! + text.slice(1);
    }
    push(text, i, end);
    i = end;
  }
  flush();
  return { original, text: out.join(""), from, to, starts, applied };
}

/** The quotation as it is searched for: folded, without white space at its ends. */
export const foldQuotation = (quotation: string): Folded => fold(quotation.trim(), "quotation");

const WORDISH = /[\p{L}\p{M}\p{N}]/u;
/** Scripts written without spaces between words: a boundary may fall between any two of their characters. */
const UNSPACED = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}]/u;
const JOINER = /['\-‐]/;

const codeBefore = (text: string, at: number): string => {
  if (at <= 0) return "";
  const low = text.charCodeAt(at - 1);
  return low >= 0xdc00 && low <= 0xdfff && at >= 2 ? text.slice(at - 2, at) : text[at - 1]!;
};
const codeAt = (text: string, at: number): string => (at < text.length ? String.fromCodePoint(text.codePointAt(at)!) : "");

/** Whether `at` falls inside a word, counting an apostrophe or hyphen between letters as part of it. */
export function insideWord(text: string, at: number): boolean {
  let left = codeBefore(text, at);
  let right = codeAt(text, at);
  if (JOINER.test(left) && WORDISH.test(right)) left = codeBefore(text, at - 1);
  else if (JOINER.test(right) && WORDISH.test(left)) right = codeAt(text, at + 1);
  return WORDISH.test(left) && WORDISH.test(right) && !UNSPACED.test(left) && !UNSPACED.test(right);
}

export interface Span {
  /** Offsets in the original stored text (UTF-16 units). */
  start: number;
  end: number;
}

export interface Found extends Span {
  match: "exact" | "normalized";
  folds: Fold[];
  joined: string[];
}

export type Within = (span: Span) => boolean;

const anywhere: Within = () => true;

/**
 * Every place the folded quotation stands as one unbroken span that starts and
 * ends at word boundaries. A verbatim occurrence is preferred.
 */
export function findQuotation(stored: Folded, quotation: string, within: Within = anywhere): Found | undefined {
  const needle = foldQuotation(quotation);
  if (needle.text.length === 0) return undefined;
  const verbatim = quotation.trim();
  let first: Found | undefined;
  for (let at = stored.text.indexOf(needle.text); at !== -1; at = stored.text.indexOf(needle.text, at + 1)) {
    const after = at + needle.text.length;
    if (!stored.starts[at] || (after < stored.text.length && !stored.starts[after])) continue;
    if (insideWord(stored.text, at) || insideWord(stored.text, after)) continue;
    const span = { start: stored.from[at]!, end: stored.to[after - 1]! };
    if (!within(span)) continue;
    if (stored.original.slice(span.start, span.end) === verbatim) return { ...span, match: "exact", folds: [], joined: [] };
    if (first) continue;
    const here = stored.applied.filter((a) => a.at >= at && a.at < after);
    const folds = new Set<Fold>([...here, ...needle.applied].map((a) => a.fold));
    first = { ...span, match: "normalized", folds: [...folds].sort(), joined: here.flatMap((a) => a.joined ?? []) };
  }
  return first;
}

/** Starting values, to be tuned on pilot sources (SD-007 BR-709). */
export const NEAR_SHARE = 0.15;
export const CLOSEST_SHARE = 0.4;
/** Longer quotations get no closest-text search. */
export const CLOSEST_LIMIT = 2000;

export interface Closest extends Span {
  /** Insertions, deletions and substitutions between the folded texts. */
  distance: number;
  /** `near` within the near share of the folded quotation's length. */
  near: boolean;
}

/**
 * The stored span closest to the quotation, widened to whole words. It is
 * evidence for a person to compare. It never makes a quotation pass.
 */
export function findClosest(stored: Folded, quotation: string, within: Within = anywhere): Closest | undefined {
  const needle = foldQuotation(quotation).text;
  const m = needle.length;
  if (m === 0 || m > CLOSEST_LIMIT) return undefined;
  const limit = Math.floor(m * CLOSEST_SHARE);
  const hay = stored.text;
  // Approximate substring search, keeping only the rows that can still be within the limit.
  const cost = new Int32Array(m + 1);
  const origin = new Int32Array(m + 1);
  for (let i = 0; i <= m; i++) cost[i] = i;
  let last = Math.min(m, limit);
  const candidates: { start: number; end: number; distance: number }[] = [];
  for (let j = 0; j < hay.length; j++) {
    let diagonal = cost[0]!;
    let diagonalOrigin = origin[0]!;
    cost[0] = 0;
    origin[0] = j + 1;
    const top = Math.min(m, last + 1);
    for (let i = 1; i <= top; i++) {
      const left = i <= last ? cost[i]! : limit + 1;
      const leftOrigin = origin[i]!;
      let best = diagonal + (needle[i - 1] === hay[j] ? 0 : 1);
      let start = diagonalOrigin;
      if (left + 1 < best) {
        best = left + 1;
        start = leftOrigin;
      }
      if (cost[i - 1]! + 1 < best) {
        best = cost[i - 1]! + 1;
        start = origin[i - 1]!;
      }
      diagonal = left;
      diagonalOrigin = leftOrigin;
      cost[i] = best;
      origin[i] = start;
    }
    last = top;
    while (last > 0 && cost[last]! > limit) last--;
    if (last === m && cost[m]! <= limit) candidates.push({ start: origin[m]!, end: j + 1, distance: cost[m]! });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.start - b.start || a.end - b.end);
  // The distance that counts is to the whole words shown, not to a stretch that cuts into one.
  let best: Closest | undefined;
  const tried = new Set<string>();
  for (const candidate of candidates) {
    if (tried.size >= WIDENED_CANDIDATES) break;
    let { start, end } = candidate;
    while (start < end && hay[start] === " ") start++;
    while (end > start && hay[end - 1] === " ") end--;
    while (start > 0 && (insideWord(hay, start) || !stored.starts[start])) start--;
    while (end < hay.length && (insideWord(hay, end) || !stored.starts[end])) end++;
    const key = `${start} ${end}`;
    if (end <= start || tried.has(key)) continue;
    const span = { start: stored.from[start]!, end: stored.to[end - 1]! };
    if (!within(span)) continue;
    tried.add(key);
    const distance = editDistance(needle, hay.slice(start, end));
    if (distance <= limit && (!best || distance < best.distance)) best = { ...span, distance, near: distance <= m * NEAR_SHARE };
  }
  return best;
}

const WIDENED_CANDIDATES = 40;

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length]!;
}
