// Where the quoted words probably lie on a scanned page (CONTRACT-005 M,
// "Estimates on scans"). The only positions a scan has are those of the
// invisible text that character recognition laid over its picture, and nothing
// shows that they lie on the printed words. So what is made here is an estimate,
// is named by how it was derived, and is never shown as a highlight. A weak or
// doubtful place is no place: a mark on the wrong lines is worse than none.
//
// This knows nothing of PDFs. Another way to estimate adds a value to
// `EstimateMethod` and a branch of `estimatePlace`.
import type { EstimateMethod, HighlightWords, NoHighlightReason } from "../../core/src/highlight.ts";

/** One glyph of a scan's text layer, where it lies on the page as drawn: y grows downwards. */
export interface LayerGlyph { text: string; left: number; top: number; right: number; bottom: number; level: boolean }

export interface LayerRect { left: number; top: number; right: number; bottom: number }

/**
 * The thresholds of `ocr_layer_match`. `like` is the least part of the quotation's
 * letters that must agree; `lead` is how much worse, as a part of its length,
 * every other place must be; `around` and `settles` say when the words around the
 * quotation choose between places that are about as good.
 */
export const ESTIMATE_BOUNDS = { like: 0.85, lead: 0.06, least: 20, context: 80, around: 0.7, settles: 0.2, most: 4_000, work: 80_000_000, candidates: 8 };

export type Estimate =
  | { method: EstimateMethod; rects: LayerRect[] }
  | { refused: Extract<NoHighlightReason, "scan_weak_match" | "scan_ambiguous" | "scan_short" | "rotated_text" | "too_much"> };

/**
 * Letters and digits only, in one case, with ligatures and other joined forms
 * taken apart. So line breaks, hyphens at line ends, spacing, punctuation and
 * accents, which character recognition and layout change most, count for nothing.
 */
export const foldLetters = (text: string): string[] => [...text.normalize("NFKD").replace(/ſ/g, "s").toLowerCase()].filter((c) => /[\p{L}\p{N}]/u.test(c));

/** One box for each stretch of chosen glyphs that lies along one line, in the order given. */
export function lineRects(glyphs: LayerGlyph[]): LayerRect[] {
  const rects: LayerRect[] = [];
  let last: LayerGlyph | undefined;
  for (const glyph of glyphs) {
    if (glyph === last) continue;
    const rect = rects.at(-1);
    if (rect && last) {
      const height = Math.min(glyph.bottom - glyph.top, last.bottom - last.top);
      const shared = Math.min(glyph.bottom, last.bottom) - Math.max(glyph.top, last.top);
      const gap = glyph.left - last.right;
      if (shared > height * 0.5 && gap > -height && gap < height * 4) {
        Object.assign(rect, {
          left: Math.min(rect.left, glyph.left), top: Math.min(rect.top, glyph.top),
          right: Math.max(rect.right, glyph.right), bottom: Math.max(rect.bottom, glyph.bottom),
        });
        last = glyph;
        continue;
      }
    }
    rects.push({ left: glyph.left, top: glyph.top, right: glyph.right, bottom: glyph.bottom });
    last = glyph;
  }
  return rects;
}

interface Found { from: number; to: number; edits: number }

/**
 * For each end in `page`, the fewest edits that turn `wanted` into a stretch of
 * the page ending there, and where that stretch begins (Sellers' algorithm).
 */
function stretches(wanted: string[], page: string[]): Found[] {
  let edits = Int32Array.from({ length: wanted.length + 1 }, (_, i) => i);
  let begins = new Int32Array(wanted.length + 1);
  let nextEdits = new Int32Array(wanted.length + 1);
  let nextBegins = new Int32Array(wanted.length + 1);
  const found: Found[] = [];
  for (let at = 0; at < page.length; at++) {
    nextEdits[0] = 0;
    nextBegins[0] = at + 1;
    for (let i = 1; i <= wanted.length; i++) {
      let least = edits[i - 1]! + (wanted[i - 1] === page[at] ? 0 : 1);
      let begin = begins[i - 1]!;
      // Of two ways with as few edits, the shorter stretch: it reaches into no line beside the words.
      for (const [cost, from] of [[nextEdits[i - 1]! + 1, nextBegins[i - 1]!], [edits[i]! + 1, begins[i]!]] as const) {
        if (cost < least || (cost === least && from > begin)) {
          least = cost;
          begin = from;
        }
      }
      nextEdits[i] = least;
      nextBegins[i] = begin;
    }
    [edits, nextEdits] = [nextEdits, edits];
    [begins, nextBegins] = [nextBegins, begins];
    found.push({ from: begins[wanted.length]!, to: at + 1, edits: edits[wanted.length]! });
  }
  return found;
}

/** How alike `wanted` and the letters at one end of `page` are, from 0 to 1: the words just before or just after a place. */
function alikeAt(wanted: string[], page: string[], side: "before" | "after"): number {
  if (wanted.length === 0) return 0;
  const a = side === "before" ? [...wanted].reverse() : wanted;
  const b = (side === "before" ? [...page].reverse() : page).slice(0, Math.ceil(wanted.length * 1.2));
  // Anchored at the near end, free at the far end.
  let row = Int32Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = new Int32Array(b.length + 1);
    next[0] = i;
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1), row[j]! + 1, next[j - 1]! + 1);
    row = next;
  }
  return Math.max(0, 1 - Math.min(...row) / a.length);
}

/** The one place on the page whose letters are close enough to the quoted ones, as indexes into `page`. */
export function findWords(words: HighlightWords, page: string[]): { from: number; to: number } | { refused: "scan_weak_match" | "scan_ambiguous" | "scan_short" | "too_much" } {
  const wanted = foldLetters(words.quoted);
  if (wanted.length < ESTIMATE_BOUNDS.least) return { refused: "scan_short" };
  if (wanted.length > ESTIMATE_BOUNDS.most || wanted.length * page.length > ESTIMATE_BOUNDS.work) return { refused: "too_much" };
  const most = Math.floor(wanted.length * (1 - ESTIMATE_BOUNDS.like));
  const lead = Math.max(2, Math.ceil(wanted.length * ESTIMATE_BOUNDS.lead));
  // The places that are good enough, or near enough to the best to cast doubt on it, best first, none lying mostly on another.
  const places: Found[] = [];
  for (const one of stretches(wanted, page).filter((f) => f.edits <= most + lead).sort((a, b) => a.edits - b.edits || a.to - b.to)) {
    if (places.some((p) => Math.min(p.to, one.to) - Math.max(p.from, one.from) > wanted.length / 2)) continue;
    places.push(one);
    if (places.length > ESTIMATE_BOUNDS.candidates) break;
  }
  const best = places[0];
  if (!best || best.edits > most) return { refused: "scan_weak_match" };
  const close = places.filter((p) => p.edits < best.edits + lead);
  if (close.length === 1) return best;
  if (close.length > ESTIMATE_BOUNDS.candidates) return { refused: "scan_ambiguous" };
  // More than one place is about as good: only the words around them can choose.
  const before = foldLetters(words.before).slice(-ESTIMATE_BOUNDS.context);
  const after = foldLetters(words.after).slice(0, ESTIMATE_BOUNDS.context);
  const scored = close.map((place) => {
    const sides = [
      ...(before.length >= ESTIMATE_BOUNDS.least ? [{ weight: before.length, like: alikeAt(before, page.slice(0, place.from), "before") }] : []),
      ...(after.length >= ESTIMATE_BOUNDS.least ? [{ weight: after.length, like: alikeAt(after, page.slice(place.to), "after") }] : []),
    ];
    const weight = sides.reduce((sum, s) => sum + s.weight, 0);
    return { place, like: weight === 0 ? 0 : sides.reduce((sum, s) => sum + s.weight * s.like, 0) / weight };
  }).sort((a, b) => b.like - a.like);
  const [first, second] = scored;
  return first!.like >= ESTIMATE_BOUNDS.around && first!.like - second!.like >= ESTIMATE_BOUNDS.settles && first!.place.edits <= most
    ? first!.place : { refused: "scan_ambiguous" };
}

/**
 * The estimated place of the quoted words in a scan's text layer. `exact` is the
 * glyphs at the passage's recorded offsets, given when the page read again is
 * letter for letter the source text's page; otherwise the words are looked for.
 */
export function estimatePlace(layer: LayerGlyph[], from: { exact?: LayerGlyph[]; words?: HighlightWords }): Estimate {
  let chosen = from.exact;
  let method: EstimateMethod = "ocr_layer_offsets";
  if (!chosen) {
    if (!from.words) return { refused: "scan_weak_match" };
    const letters = layer.flatMap((glyph) => foldLetters(glyph.text).map((letter) => ({ letter, glyph })));
    const found = findWords(from.words, letters.map((l) => l.letter));
    if ("refused" in found) return found;
    chosen = letters.slice(found.from, found.to).map((l) => l.glyph);
    method = "ocr_layer_match";
  }
  if (chosen.length === 0) return { refused: "scan_weak_match" };
  // Boxes along lines are only made for words that run across the page as it is shown.
  if (chosen.some((glyph) => !glyph.level)) return { refused: "rotated_text" };
  return { method, rects: lineRects(chosen) };
}
