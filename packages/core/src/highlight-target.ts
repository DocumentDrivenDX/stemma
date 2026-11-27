// What a page of a PDF must show for a passage to be marked on it (CONTRACT-005
// M, "Highlighting on originals"): the part's whole text, and where in it the
// quoted words lie, from the passage's recorded offsets. Nothing is searched
// for.
import { type Block, type Corpus, decodeText, MAIN_ROLES, NOTE_ROLES, sha256 } from "@stemma/records";
import { SourceTexts, type StreamName, type TextView, unitAt } from "./matching/texts.ts";
import { anchorsOf } from "./passages.ts";
import type { SourceView } from "./source-view.ts";

const ANNOTATION = /<!--stemma:(fnref|uncertain|corrected)((?: [a-z]+="[^"<>\n]*")*)-->([^<]*)<!--\/stemma:\1-->/g;

/** One part's text as a PDF page gives it, and for each unit of one of its streams, the unit of this text it is, or -1. */
export function partPageText(blocks: Block[], stream: StreamName): { text: string; stream: string; at: number[] } | undefined {
  const roles = stream === "main" ? MAIN_ROLES : NOTE_ROLES;
  let text = "";
  let words = "";
  const at: number[] = [];
  for (const block of blocks) {
    // A table's text is laid out again for its stream, so its units are not these.
    const streamed = roles.includes(block.role);
    if (streamed && block.role === "table") return undefined;
    const pieces: { text: string; streamed: boolean }[] = [];
    let from = 0;
    for (const match of block.content.matchAll(ANNOTATION)) {
      pieces.push({ text: block.content.slice(from, match.index), streamed: true }, { text: match[3]!, streamed: match[1] !== "fnref" });
      from = match.index + match[0].length;
    }
    pieces.push({ text: block.content.slice(from), streamed: true });
    const whole = pieces.map((p) => decodeText(p.text)).join("");
    if (whole === "") continue;
    if (text !== "") text += "\n";
    // A block with nothing in its stream puts no line feed there either.
    let begun = false;
    for (const piece of pieces) {
      const decoded = decodeText(piece.text);
      if (streamed && piece.streamed && decoded !== "") {
        if (!begun && words !== "") {
          words += "\n";
          at.push(-1);
        }
        begun = true;
        words += decoded;
        for (let i = 0; i < decoded.length; i++) at.push(text.length + i);
      }
      text += decoded;
    }
  }
  return { text, stream: words, at };
}

/** Hyphens that split a word at a line end. A dash between words is not one. */
const SPLIT_AT_END = /[-­‐‑¬][^\S\n]*$/u;
const SPLIT_INSIDE = /[-­‐‑¬][^\S\n]*\n/u;

export type TargetRanges =
  | { text_sha256: string; ranges: [number, number][] }
  /** No highlight can be placed. What is known of the place is kept for an estimate on a scan. */
  | { refused: "hyphen_split"; text_sha256: string; ranges: [number, number][] }
  | { refused: "unsupported_text" | "no_segment" };

/**
 * The text of the part with this index, and where in it the stretch of its
 * stream from `start` to `end`, counted in code points, lies.
 */
export function targetRanges(view: TextView, index: number, stream: StreamName, start: number, end: number): TargetRanges {
  const part = view.part(index);
  if (!part) return { refused: "no_segment" };
  const made = partPageText(part.part.blocks, stream);
  const words = part.streams[stream];
  if (!made || made.stream !== words) return { refused: "unsupported_text" };
  const from = unitAt(words, start);
  const to = unitAt(words, end);
  const quoted = words.slice(from, to);
  const before = words.slice(0, from);
  const rest = words.slice(to);
  const earlier = view.parts.slice(0, view.parts.indexOf(part)).map((p) => p.streams[stream]).filter((t) => t !== "").at(-1);
  const startsLine = /(^|\n)[^\S\n]*$/u.test(before);
  const split = SPLIT_INSIDE.test(quoted)
    // It ends with the first half.
    || (SPLIT_AT_END.test(quoted) && /^[^\S\n]*(\n|$)/u.test(rest))
    // It begins with the second half, on this page or from the page before.
    || (startsLine && (/\n/.test(before) ? SPLIT_INSIDE.test(before.slice(before.lastIndexOf("\n", before.lastIndexOf("\n") - 1) + 1)) : earlier !== undefined && SPLIT_AT_END.test(earlier)));
  const ranges: [number, number][] = [];
  for (let unit = from; unit < to; unit++) {
    const place = made.at[unit]!;
    if (place < 0 || /\s/.test(words[unit]!)) continue;
    const last = ranges.at(-1);
    // Only white space may lie between two stretches that are one.
    if (last && /^\s*$/u.test(made.text.slice(last[1], place))) last[1] = place + 1;
    else ranges.push([place, place + 1]);
  }
  if (ranges.length === 0) return { refused: "no_segment" };
  return { ...(split ? { refused: "hyphen_split" as const } : {}), text_sha256: sha256(made.text), ranges };
}

/** By passage and part index. */
export type HighlightTargets = Record<string, Record<number, TargetRanges>>;

/**
 * For each highlighted passage view, where on each of its parts the quoted words
 * lie in the part's text. Made when the data is built, from the passage's own
 * recorded offsets, so that none of the project's text need be kept for it.
 */
export function highlightTargets(corpus: Corpus, views: Record<string, SourceView>): HighlightTargets {
  const texts = new SourceTexts(corpus);
  const found: HighlightTargets = {};
  for (const [id, view] of Object.entries(views)) {
    if (view.kind !== "passage" || view.state !== "highlighted" || !view.source_text) continue;
    const record = corpus.byId.get(id)?.data;
    const text = texts.view(view.source_text.id);
    if (!record || !text) continue;
    found[id] = Object.fromEntries(anchorsOf(record).map((a) => [a.index, targetRanges(text, a.index, a.stream, a.start, a.end)]));
  }
  return found;
}
