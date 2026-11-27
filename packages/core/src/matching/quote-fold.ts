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
  /** For each unit of `text`, the span of `original` it came from. Neither ever goes down. */
  from: Int32Array;
  to: Int32Array;
  /** Whether a match may start at this unit: it begins a character of the original. */
  starts: Uint8Array;
  /** In the order of `at`, which never goes down. */
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
  // A whole project's source text is folded in one run, so the maps are held as
  // typed arrays, which take a fraction of the memory of arrays of values.
  const chunks: string[] = [];
  let out: string[] = [];
  let capacity = original.length + 16;
  let from = new Int32Array(capacity);
  let to = new Int32Array(capacity);
  let starts = new Uint8Array(capacity);
  const applied: Applied[] = [];
  let length = 0;
  let space: { start: number; end: number; plain: boolean } | undefined;

  const push = (text: string, start: number, end: number) => {
    if (length + text.length > capacity) {
      capacity = 2 * (length + text.length);
      const grown = <T extends Int32Array | Uint8Array>(old: T, made: T): T => { made.set(old.subarray(0, length)); return made; };
      from = grown(from, new Int32Array(capacity));
      to = grown(to, new Int32Array(capacity));
      starts = grown(starts, new Uint8Array(capacity));
    }
    for (let i = 0; i < text.length; i++) {
      from[length + i] = start;
      to[length + i] = end;
    }
    if (text.length > 0) starts[length] = 1;
    out.push(text);
    if (out.length === 4096) {
      chunks.push(out.join(""));
      out = [];
    }
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
  chunks.push(out.join(""));
  const exact = capacity - length > 64;
  return {
    original, text: chunks.join(""), applied,
    from: exact ? from.slice(0, length) : from.subarray(0, length),
    to: exact ? to.slice(0, length) : to.subarray(0, length),
    starts: exact ? starts.slice(0, length) : starts.subarray(0, length),
  };
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
    const here = appliedWithin(stored.applied, at, after);
    const folds = new Set<Fold>([...here, ...needle.applied].map((a) => a.fold));
    first = { ...span, match: "normalized", folds: [...folds].sort(), joined: here.flatMap((a) => a.joined ?? []) };
  }
  return first;
}

/** Those applied from `start` up to `end`, found without reading the rest. */
function appliedWithin(applied: Applied[], start: number, end: number): Applied[] {
  let low = 0;
  let high = applied.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (applied[middle]!.at < start) low = middle + 1;
    else high = middle;
  }
  const out: Applied[] = [];
  for (let i = low; i < applied.length && applied[i]!.at < end; i++) out.push(applied[i]!);
  return out;
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

interface Candidate { start: number; end: number; distance: number }

/**
 * Every offset in `hay` from `begin` to `until` where some stretch ending there
 * is within `limit` edits of the needle, with the fewest edits. This is Myers'
 * bit-parallel form of the approximate substring search, 32 rows at a time
 * (Hyyro's blocks), so that text which holds nothing like the needle is passed
 * over quickly. It gives distances only, not where each stretch starts.
 */
function endsWithin(needle: string, hay: string, begin: number, until: number, limit: number): { end: number; distance: number }[] {
  const m = needle.length;
  const blocks = Math.ceil(m / 32);
  const rows = new Map<number, number>();
  for (let i = 0; i < m; i++) if (!rows.has(needle.charCodeAt(i))) rows.set(needle.charCodeAt(i), rows.size + 1);
  // Row 0 is for every unit the needle does not hold.
  const match = new Int32Array((rows.size + 1) * blocks);
  for (let i = 0; i < m; i++) match[rows.get(needle.charCodeAt(i))! * blocks + (i >> 5)]! |= 1 << (i & 31);
  const plus = new Int32Array(blocks).fill(-1);
  const minus = new Int32Array(blocks);
  const lastRow = 1 << ((m - 1) & 31);
  const found: { end: number; distance: number }[] = [];
  let score = m;
  for (let j = begin; j < until; j++) {
    const offset = (rows.get(hay.charCodeAt(j)) ?? 0) * blocks;
    let carry = 0;
    for (let b = 0; b < blocks; b++) {
      let equal = match[offset + b]!;
      const pv = plus[b]!;
      const mv = minus[b]!;
      const xv = equal | mv;
      if (carry < 0) equal |= 1;
      const xh = (((((equal & pv) >>> 0) + (pv >>> 0)) | 0) ^ pv) | equal;
      let ph = mv | ~(xh | pv);
      let mh = pv & xh;
      const high = b === blocks - 1 ? lastRow : 0x80000000 | 0;
      const out = (ph & high) !== 0 ? 1 : (mh & high) !== 0 ? -1 : 0;
      ph <<= 1;
      mh <<= 1;
      if (carry < 0) mh |= 1;
      else if (carry > 0) ph |= 1;
      plus[b] = mh | ~(xv | ph);
      minus[b] = ph & xv;
      carry = out;
    }
    score += carry;
    if (score <= limit) found.push({ end: j + 1, distance: score });
  }
  return found;
}

/**
 * The same search cell by cell from `begin` to `until`, which also follows where
 * each stretch starts; `at` is told for each offset where one ends within the
 * limit. Only the rows that can still be within the limit are kept.
 */
function startsWithin(needle: string, hay: string, begin: number, until: number, limit: number, at: (end: number, start: number) => void): void {
  const m = needle.length;
  const cost = new Int32Array(m + 1);
  const origin = new Int32Array(m + 1).fill(begin);
  for (let i = 0; i <= m; i++) cost[i] = i;
  let last = Math.min(m, limit);
  for (let j = begin; j < until; j++) {
    const unit = hay[j];
    let diagonal = cost[0]!;
    let diagonalOrigin = origin[0]!;
    cost[0] = 0;
    origin[0] = j + 1;
    const top = Math.min(m, last + 1);
    for (let i = 1; i <= top; i++) {
      const left = i <= last ? cost[i]! : limit + 1;
      const leftOrigin = origin[i]!;
      let best = diagonal + (needle[i - 1] === unit ? 0 : 1);
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
    if (last === m && cost[m]! <= limit) at(j + 1, origin[m]!);
  }
}

/**
 * The candidates of one distance at a time, fewest edits first, each with its
 * start. A start depends only on the text a short way before the end, so it is
 * worked out there, unless so much would be read again that reading the whole
 * stretch once costs less.
 */
function* byDistance(needle: string, hay: string, begin: number, until: number, limit: number, keep: (end: number) => boolean): Generator<Candidate[]> {
  const groups: number[][] = Array.from({ length: limit + 1 }, () => []);
  for (const { end, distance } of endsWithin(needle, hay, begin, until, limit)) if (keep(end)) groups[distance]!.push(end);
  // No optimal path to a cell within the limit begins further back than this.
  const reach = needle.length + 2 * limit + 2;
  let whole: Map<number, number> | undefined;
  let reread = 0;
  for (let distance = 0; distance <= limit; distance++) {
    const ends = groups[distance]!;
    if (ends.length === 0) continue;
    const windows: { from: number; to: number; ends: Set<number> }[] = [];
    for (const end of ends) {
      const from = Math.max(begin, end - reach);
      const open = windows.at(-1);
      if (open && from <= open.to) {
        open.to = end;
        open.ends.add(end);
      } else windows.push({ from, to: end, ends: new Set([end]) });
    }
    reread += windows.reduce((n, w) => n + w.to - w.from, 0);
    const starts = new Map<number, number>();
    if (!whole && reread > until - begin) {
      const all = new Map<number, number>();
      startsWithin(needle, hay, begin, until, limit, (end, start) => all.set(end, start));
      whole = all;
    }
    if (!whole) {
      for (const w of windows) startsWithin(needle, hay, w.from, w.to, limit, (end, start) => { if (w.ends.has(end)) starts.set(end, start); });
    }
    yield ends.map((end) => ({ start: (whole ?? starts).get(end)!, end, distance }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }
}

/** The first of `count` places where `test` holds, when it holds at every place after it. */
function firstWhere(count: number, test: (i: number) => boolean): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (test(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * The stored span closest to the quotation, widened to whole words. It is
 * evidence for a person to compare. It never makes a quotation pass.
 *
 * `region`, when given, is a stretch of the original that `within` never lets a
 * span reach outside. Only the text that could give such a span is then read.
 */
export function findClosest(stored: Folded, quotation: string, within: Within = anywhere, region?: Span): Closest | undefined {
  const needle = foldQuotation(quotation).text;
  const m = needle.length;
  if (m === 0 || m > CLOSEST_LIMIT) return undefined;
  const limit = Math.floor(m * CLOSEST_SHARE);
  const hay = stored.text;
  let begin = 0;
  let until = hay.length;
  let keep: (end: number) => boolean = () => true;
  if (region) {
    const first = firstWhere(hay.length, (i) => stored.from[i]! >= region.start);
    until = firstWhere(hay.length, (i) => stored.to[i]! > region.end);
    while (until < hay.length && hay[until] === " ") until++;
    begin = Math.max(0, first - m - 2 * limit - 2);
    // A span widened from a candidate holds the candidate's last unit that is not a space.
    keep = (end) => {
      let at = end - 1;
      while (at >= 0 && hay[at] === " ") at--;
      return at >= 0 && stored.from[at]! >= region.start && stored.to[at]! <= region.end;
    };
  }
  // The distance that counts is to the whole words shown, not to a stretch that cuts into one.
  let best: Closest | undefined;
  const tried = new Set<string>();
  for (const candidates of byDistance(needle, hay, begin, until, limit, keep)) {
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
    if (tried.size >= WIDENED_CANDIDATES) break;
  }
  return best;
}

const WIDENED_CANDIDATES = 40;

function editDistance(a: string, b: string): number {
  let row = Int32Array.from({ length: b.length + 1 }, (_, j) => j);
  let next = new Int32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    next[0] = i;
    const unit = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (unit === b[j - 1] ? 0 : 1));
    }
    [row, next] = [next, row];
  }
  return row[b.length]!;
}

/**
 * A passage's words as a quotation prints them: only the approved line-end join,
 * soft-hyphen removal, and runs of white space made one space. No character is
 * otherwise changed.
 */
export function renderQuotation(exact: string): string {
  let out = "";
  for (let i = 0; i < exact.length; ) {
    const char = exact[i]!;
    if (char === "-" || char === "‐" || char === SOFT_HYPHEN) {
      const next = joinAfter(exact, i);
      if (next !== undefined) {
        i = next;
        continue;
      }
    }
    if (char !== SOFT_HYPHEN) out += char;
    i++;
  }
  return out.replace(/\s+/g, " ").trim();
}
