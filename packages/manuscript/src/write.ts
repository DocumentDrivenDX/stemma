// The writer of a Stemma copy chapter (CONTRACT-006 A to F; SD-015, Manuscript
// writer). It takes plain text with the places where citations and note markers
// stand, and writes markup that the one reader reads back as that same text.
// `writeChapter` is pure; `verifyChapter` says how a reading differs from what
// was meant, and an import whose copy differs fails.
import type { CitationItem } from "./attributes.ts";
import type { Chapter } from "./model.ts";
import { doubleQuotes, type Range, splitSentences } from "./sentences.ts";

export type { CitationItem } from "./attributes.ts";

/** A place in a block's plain text. Offsets are in UTF-16 units. */
export type Event = { at: number } & ({ cluster: CitationItem[] } | { marker: string });

export type OutBlock =
  /** `level` makes it a heading, from 1 to 4. `events` are in reading order. */
  | { kind: "text"; text: string; level?: number; events: Event[] }
  /** Text the markup cannot carry, kept as lines that no check reads. */
  | { kind: "unconverted"; id: string; lines: string[] };

export interface OutNote { label: string; blocks: OutBlock[] }

export interface OutChapter { blocks: OutBlock[]; notes: OutNote[] }

export interface WrittenClaim { id: string; items: string[] }

/** A block as the reader should see it. */
export interface Meant { note?: string; text: string; kind: "paragraph" | "heading" | "unconverted" }

export interface Written {
  text: string;
  /** The claim spans, one for each sentence that carries a citation (SD-015 BR-1512). */
  claims: WrittenClaim[];
  /** What the reader should find, in the order it lists blocks: the body, then each note. */
  meant: Meant[];
  /** Every citation item written, as it should be read. */
  items: CitationItem[];
}

/**
 * Brings plain text to a form that markup can carry, keeping each event beside
 * the same characters: control characters become spaces, line breaks lose the
 * spaces around them and never repeat, and the ends are trimmed.
 */
export function tidy(text: string, offsets: number[]): { text: string; offsets: number[] } {
  const flat = text.replace(/[^\S\n]/g, (c) => (c === " " || /\p{Zs}/u.test(c) ? c : " ")).replace(/(?!\n)\p{Cc}/gu, " ");
  const keep: boolean[] = new Array(flat.length).fill(true);
  for (const m of flat.matchAll(/[ ]*\n[ \n]*/g)) {
    let broken = false;
    for (let i = m.index; i < m.index + m[0].length; i++) {
      if (flat[i] === "\n" && !broken) broken = true;
      else keep[i] = false;
    }
  }
  // The ends are trimmed only as far as the outermost event: a space typed beside a citation stays.
  const first = Math.min(flat.length, ...offsets);
  const last = Math.max(0, ...offsets);
  let from = 0;
  let to = flat.length;
  while (from < Math.min(to, first) && (!keep[from] || /[ \n]/.test(flat[from]!))) from++;
  while (to > Math.max(from, last) && (!keep[to - 1] || /[ \n]/.test(flat[to - 1]!))) to--;
  const moved: number[] = [];
  let out = "";
  for (let i = 0; i <= flat.length; i++) {
    moved[i] = out.length;
    if (i < flat.length && keep[i] && i >= from && i < to) out += flat[i];
  }
  return { text: out, offsets: offsets.map((o) => moved[Math.max(0, Math.min(o, flat.length))]!) };
}

/** Characters that could be read as markup wherever they stand. */
const ALWAYS = new Set([..."\\`*_[]{}<@^"]);
/** Characters that start a block when they open a line. */
const AT_LINE_START = new Set([..."#>-+=|~:"]);

/** The markup of `text[start, end)`. */
function escaped(text: string, start: number, end: number, heading: boolean): string {
  let out = "";
  for (let i = start; i < end; i++) {
    const c = text[i]!;
    if (c === "\n") {
      out += "\\\n";
      continue;
    }
    const lineStart = i === 0 || text[i - 1] === "\n";
    let escape = ALWAYS.has(c);
    // A closing run of `#` would be dropped from a heading.
    if (c === "#" && heading) escape = true;
    if (lineStart && AT_LINE_START.has(c)) escape = true;
    if (c === "&" && /^&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/.test(text.slice(i))) escape = true;
    // `1.` or `1)` at the start of a line would start a list.
    if ((c === "." || c === ")") && /(?:^|\n)\d{1,9}$/.test(text.slice(Math.max(0, i - 11), i))) escape = true;
    out += escape ? `\\${c}` : c;
  }
  return out;
}

const value = (text: string): string => `"${text.replace(/\s+/g, " ").replace(/[\\"]/g, "\\$&")}"`;

export function writeCluster(items: CitationItem[]): string {
  return `[${items.map((item) => [
    `@${item.key}`,
    ...(item.id !== undefined ? [`id=${value(item.id)}`] : []),
    ...(item.locator ? [`${item.locator.label}=${value(item.locator.value)}`] : []),
    ...(item.prefix !== undefined ? [`prefix=${value(item.prefix)}`] : []),
    ...(item.suffix !== undefined ? [`suffix=${value(item.suffix)}`] : []),
    ...(item.mode !== undefined ? [`mode=${value(item.mode)}`] : []),
  ].join(" ")).join("; ")}]`;
}

/** The sentence holding an offset, as the reader decides it: a point between sentences belongs to the one before. */
const sentenceAt = (ranges: Range[], offset: number): number => Math.max(0, ranges.findLastIndex((r) => r.start < offset));

interface Span { start: number; end: number; first: number; last: number; claim: WrittenClaim }

export function writeChapter(chapter: OutChapter, newClaimId: () => string): Written {
  const claims: WrittenClaim[] = [];
  const meant: Meant[] = [];
  const items: CitationItem[] = [];
  const notes = new Map(chapter.notes.map((n) => [n.label, n]));
  const textBlocks = (note: OutNote) => note.blocks.filter((b): b is Extract<OutBlock, { kind: "text" }> => b.kind === "text");
  /** A note with no words of its own: its citations belong to the sentence that carries its marker. */
  const citationOnly = (note: OutNote): boolean => note.blocks.every((b) => b.kind === "text" && !/[\p{L}\p{N}]/u.test(b.text));

  const block = (out: OutBlock, note: OutNote | undefined): string => {
    if (out.kind === "unconverted") {
      // A line that is only `:::` would close the block early.
      const lines = out.lines.flatMap((l) => l.split("\n")).map((l) => (/^:::[ \t]*$/.test(l) ? ` ${l}.` : l));
      meant.push({ kind: "unconverted", text: lines.join("\n"), ...(note ? { note: note.label } : {}) });
      return [`::: unconverted {id="${out.id}"}`, ...lines, ":::"].join("\n");
    }
    const heading = out.level !== undefined;
    const text = heading ? out.text.replace(/\n/g, " ") : out.text;
    meant.push({ kind: heading ? "heading" : "paragraph", text, ...(note ? { note: note.label } : {}) });
    for (const event of out.events) if ("cluster" in event) items.push(...event.cluster);

    const ranges = splitSentences(text, doubleQuotes(text).pairs);
    if (ranges.length === 0 && out.events.length > 0) ranges.push({ start: 0, end: text.length });
    const spans: Span[] = [];
    // A citation-only note gets no claim: the sentence that carries its marker does.
    if (!note || !citationOnly(note)) {
      for (const [index, range] of ranges.entries()) {
        const own = out.events.map((event, n) => ({ event, n })).filter(({ event }) => sentenceAt(ranges, event.at) === index);
        const cited = own.flatMap(({ event }) => {
          if ("cluster" in event) return event.cluster;
          const referred = notes.get(event.marker);
          return referred && citationOnly(referred)
            ? textBlocks(referred).flatMap((b) => b.events.flatMap((e) => ("cluster" in e ? e.cluster : []))) : [];
        });
        // A sentence of citations alone states nothing, so it yields no claim.
        if (cited.length === 0 || !/[\p{L}\p{N}]/u.test(text.slice(range.start, range.end))) continue;
        const claim: WrittenClaim = { id: newClaimId(), items: cited.flatMap((c) => (c.id === undefined ? [] : [c.id])) };
        claims.push(claim);
        spans.push({
          claim,
          start: Math.min(range.start, ...own.map(({ event }) => event.at)),
          end: Math.max(range.end, ...own.map(({ event }) => event.at)),
          first: own[0]?.n ?? 0, last: own.at(-1)?.n ?? -1,
        });
      }
    }

    // Events and span edges, merged in order of place. At one place: the events
    // of the sentence that ends there, its closing edge, then the next opening one.
    let markup = "";
    let done = 0;
    let next = 0;
    const upTo = (to: number) => {
      if (to > done) markup += escaped(text, done, to, heading);
      done = Math.max(done, to);
    };
    const event = (n: number) => {
      const e = out.events[n]!;
      upTo(e.at);
      // `!` before a bracket would be read as an image.
      if (markup.endsWith("!") && !markup.endsWith("\\!")) markup = `${markup.slice(0, -1)}\\!`;
      markup += "cluster" in e ? writeCluster(e.cluster) : `[^${e.marker}]`;
      // `[^1]:` at the start of a line would be read as a note's definition.
      if ("marker" in e && text[e.at] === ":" && done === e.at) {
        markup += "\\:";
        done++;
      }
    };
    for (const span of spans) {
      while (next < out.events.length && next < span.first) event(next++);
      upTo(span.start);
      if (markup.endsWith("!") && !markup.endsWith("\\!")) markup = `${markup.slice(0, -1)}\\!`;
      markup += "[";
      while (next <= span.last) event(next++);
      upTo(span.end);
      markup += `]{.claim ids="${span.claim.id}"}`;
    }
    while (next < out.events.length) event(next++);
    upTo(text.length);
    return heading ? `${"#".repeat(out.level!)} ${markup}` : markup;
  };

  const body = chapter.blocks.map((b) => block(b, undefined));
  const definitions = chapter.notes.map((note) => {
    const written = note.blocks.map((b) => block(b, note)).join("\n\n");
    // Later lines of a definition are indented two spaces.
    return `[^${note.label}]: ${written.split("\n").map((l, n) => (n === 0 || l === "" ? l : `  ${l}`)).join("\n")}`;
  });
  return { text: `${[...body, ...definitions].join("\n\n")}\n`, claims, meant, items };
}

/** How a reading of the written chapter differs from what was meant; nothing when it does not. */
export function verifyChapter(read: Chapter, written: Written): string[] {
  const problems: string[] = [];
  const shown = (b: { note?: string; text: string; kind: string }) =>
    JSON.stringify([b.note ?? "", b.kind, b.kind === "unconverted" ? b.text.trimEnd() : b.text]);
  const meant = written.meant.map(shown).sort();
  const found = read.blocks.map(shown).sort();
  if (meant.length !== found.length) problems.push(`${meant.length} blocks were written and ${found.length} read`);
  const missing = meant.findIndex((m, i) => m !== found[i]);
  if (missing >= 0) problems.push("a block does not read back as its own text");

  const item = (c: CitationItem) => JSON.stringify([c.id, c.key, c.locator?.label, c.locator?.value, c.prefix?.replace(/\s+/g, " "), c.suffix?.replace(/\s+/g, " "), c.mode]);
  const wanted = written.items.map(item).sort();
  const got = read.citations.map(item).sort();
  if (JSON.stringify(wanted) !== JSON.stringify(got)) problems.push("the citations read differ from those written");

  const spans = new Map(read.claims.flatMap((span) => span.ids.map((id) => [id, span])));
  for (const claim of written.claims) {
    const span = spans.get(claim.id);
    const inside = new Set(span?.citations.map((c) => c.id));
    if (!span || claim.items.some((id) => !inside.has(id))) {
      problems.push("a claim span does not hold the citations of its sentence");
      break;
    }
  }
  if (read.claims.length !== written.claims.length) problems.push("the claim spans read differ from those written");
  return problems;
}
