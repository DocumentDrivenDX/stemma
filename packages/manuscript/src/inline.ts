// A block's inline content: its plain text, and where the citations, footnote
// markers and marked spans lie in it (CONTRACT-006 B and C).
import { type CitationItem, readAttributes, readCluster, type SpanAttributes, spanAttributes } from "./attributes.ts";
import { type Line } from "./blocks.ts";
import { malformed, type Position, unsupported } from "./model.ts";

export interface Cluster extends Position { offset: number; items: CitationItem[] }
export interface Marker extends Position { offset: number; label: string }
export interface Span extends Position { start: number; end: number; attributes: SpanAttributes }

export interface Inline {
  /** Plain text; offsets in the other fields point into it. */
  text: string;
  clusters: Cluster[];
  markers: Marker[];
  spans: Span[];
  positionAt(offset: number): Position;
}

/** A piece of output: a literal character, or an emphasis delimiter run not yet matched. */
interface Piece { text: string; at: Position; run?: { mark: string; length: number; opens: boolean; closes: boolean } }

const PUNCTUATION = /[\p{P}\p{S}]/u;
const WHITE = /\s/u;

function flanking(mark: string, before: string, after: string): { opens: boolean; closes: boolean } {
  const space = (c: string) => c === "" || WHITE.test(c);
  const punct = (c: string) => c !== "" && PUNCTUATION.test(c);
  const left = !space(after) && (!punct(after) || space(before) || punct(before));
  const right = !space(before) && (!punct(before) || space(after) || punct(after));
  if (mark === "*") return { opens: left, closes: right };
  return { opens: left && (!right || punct(before)), closes: right && (!left || punct(after)) };
}

/**
 * CommonMark's delimiter matching, reduced to what the plain text needs: matched
 * delimiters disappear and unmatched ones stay as text.
 */
function matchEmphasis(pieces: Piece[]): void {
  const open: Piece[] = [];
  for (const piece of pieces) {
    const run = piece.run;
    if (!run) continue;
    while (run.closes && piece.text.length > 0) {
      let k = open.length - 1;
      for (; k >= 0; k--) {
        const other = open[k]!.run!;
        // The "multiple of three" rule for runs that can both open and close.
        const barred = (run.opens || other.closes) && (run.length + other.length) % 3 === 0 && !(run.length % 3 === 0 && other.length % 3 === 0);
        if (other.mark === run.mark && !barred) break;
      }
      if (k < 0) break;
      const opener = open[k]!;
      const used = Math.min(2, opener.text.length, piece.text.length);
      opener.text = opener.text.slice(used);
      piece.text = piece.text.slice(used);
      open.length = opener.text.length > 0 ? k + 1 : k;
    }
    if (run.opens && piece.text.length > 0) open.push(piece);
  }
}

export function readInline(lines: Line[]): Inline {
  const source = lines.map((l) => l.text).join("\n");
  const starts: number[] = [];
  lines.reduce((n, l) => (starts.push(n), n + l.text.length + 1), 0);
  const at = (i: number): Position => {
    let k = starts.length - 1;
    while (k > 0 && starts[k]! > i) k--;
    return { line: lines[k]!.line, column: lines[k]!.column + i - starts[k]! };
  };

  const pieces: Piece[] = [];
  // Markers are placed by piece index, then turned into text offsets once emphasis is settled.
  const clusters: (Position & { piece: number; items: CitationItem[] })[] = [];
  const markers: (Position & { piece: number; label: string })[] = [];
  const spans: (Position & { first: number; last: number; attributes: SpanAttributes })[] = [];
  const openSpans: { source: number; first: number }[] = [];
  const add = (text: string, i: number) => pieces.push({ text, at: at(i) });

  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    const rest = source.slice(i);
    if (c === "\\") {
      const next = source[i + 1] ?? "";
      if (next === "\n") i++; // a hard line break; the line end is added next
      else if (/^[!-/:-@[-`{-~]$/.test(next)) {
        add(next, i);
        i += 2;
      } else add(c, i++);
    } else if (c === "<" && /^<(?:!--|\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>])|[A-Za-z][A-Za-z0-9+.-]+:[^\s<>]*>|[^\s<>@]+@[^\s<>]+>|![A-Za-z]|\?)/.test(rest)) {
      throw unsupported("raw HTML or automatic link", at(i));
    } else if (c === "&" && /^&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/.test(rest)) {
      throw unsupported("character reference (write the character itself, or `\\&`)", at(i));
    } else if (c === "`") {
      const ticks = /^`+/.exec(rest)![0];
      if (new RegExp(`(?<!\`)${ticks}(?!\`)`).test(rest.slice(ticks.length))) throw unsupported("code span", at(i));
      for (let n = 0; n < ticks.length; n++) add("`", i++);
    } else if (c === "!" && source[i + 1] === "[") {
      throw unsupported("image", at(i));
    } else if (c === "*" || c === "_") {
      let n = 1;
      while (source[i + n] === c) n++;
      const run = { mark: c, length: n, ...flanking(c, source[i - 1] ?? "", source[i + n] ?? "") };
      pieces.push({ text: c.repeat(n), at: at(i), run });
      i += n;
    } else if (c === "[") {
      const footnote = /^\[\^([^\]\s]+)\]/.exec(rest);
      if (footnote) {
        if (footnote[1]!.startsWith("en-")) throw unsupported("endnote", at(i));
        markers.push({ ...at(i), piece: pieces.length, label: footnote[1]! });
        i += footnote[0].length;
      } else if (source[i + 1] === "@") {
        const { items, end } = readCluster(source, i, at(i));
        clusters.push({ ...at(i), piece: pieces.length, items });
        i = end;
      } else {
        openSpans.push({ source: i, first: pieces.length });
        i++;
      }
    } else if (c === "]") {
      const open = openSpans.pop();
      if (!open) throw malformed("`]` without `[` (write `\\]` for the character)", at(i));
      const from = at(open.source);
      if (source[i + 1] === "(") throw unsupported("link or cross-reference", from);
      if (source[i + 1] !== "{") throw malformed("`[…]` must be followed by `{…}` (write `\\[` for the character)", from);
      const { attributes, end } = readAttributes(source, i + 1, from);
      if (open.first === pieces.length) throw unsupported("empty span, such as an index entry", from);
      spans.push({ ...from, first: open.first, last: pieces.length, attributes: spanAttributes(attributes, from) });
      i = end;
    } else if (c === "{" || c === "}") {
      throw malformed("a brace outside attributes (write `\\{` or `\\}` for the character)", at(i));
    } else add(c, i++);
  }
  if (openSpans.length > 0) throw malformed("`[` is not closed (write `\\[` for the character)", at(openSpans.at(-1)!.source));

  matchEmphasis(pieces);

  let text = "";
  const offsets: number[] = [];
  const positions: { offset: number; at: Position }[] = [];
  for (const piece of pieces) {
    offsets.push(text.length);
    positions.push({ offset: text.length, at: piece.at });
    text += piece.text;
  }
  offsets.push(text.length);

  const out: Inline = {
    text,
    clusters: clusters.map(({ piece, ...c }) => ({ ...c, offset: offsets[piece]! })),
    markers: markers.map(({ piece, ...m }) => ({ ...m, offset: offsets[piece]! })),
    spans: spans.map(({ first, last, ...s }) => ({ ...s, start: offsets[first]!, end: offsets[last]! })),
    positionAt: (offset) => positions.findLast((p) => p.offset <= offset)?.at ?? at(0),
  };
  const claims = out.spans.filter((s) => s.attributes.mark === "claim").sort((a, b) => a.start - b.start || b.end - a.end);
  claims.forEach((span, n) => {
    if (n > 0 && span.start < claims[n - 1]!.end) throw malformed("claim spans may not overlap or nest", span);
  });
  return out;
}
