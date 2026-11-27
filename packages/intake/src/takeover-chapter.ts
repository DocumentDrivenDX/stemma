// From a Word reading and its author-date account to the blocks of one chapter
// of the Stemma copy (CONTRACT-006 F): which paragraphs are written, which are
// kept unconverted, and where each citation and note marker stands.
import type { CitationItem as Marked, OutBlock, OutChapter, OutNote } from "@stemma/manuscript";
import { tidy } from "@stemma/manuscript";
import type { Document, Location, Paragraph } from "./document.ts";
import type { ReferenceList } from "./lists.ts";
import type { Bracket } from "./match.ts";

type NoteKind = "footnote" | "endnote";

export interface NoteIn {
  kind: NoteKind;
  /** The reader's label, counted from 1 for each kind. */
  number: string;
  /** Its paragraphs, by index in the document. */
  paragraphs: number[];
  /** The paragraph that refers to it. */
  referrer: number;
}

export interface Layout {
  /** Body-flow paragraphs, in order. */
  flow: number[];
  notes: NoteIn[];
  /** Paragraphs of a reference list: carried as sources, not written (CONTRACT-006 F). */
  listed: Set<number>;
  /** Notes referred to only from text that is not written as prose, so no marker can stand for them. */
  detached: Set<NoteIn>;
  /** Referred to, with no text of their own. */
  empty: number;
}

export const labelOf = (note: Pick<NoteIn, "kind" | "number">): string => (note.kind === "endnote" ? `en-${note.number}` : note.number);

/** Sorts a document into its body flow and its notes. Each note's paragraphs follow the paragraph that refers to it. */
export function layout(document: Document, lists: ReferenceList[]): Layout {
  const { paragraphs } = document;
  const out: Layout = { flow: [], notes: [], listed: new Set(), detached: new Set(), empty: 0 };
  let waiting: { kind: NoteKind; number: string; referrer: number }[] = [];
  let open: NoteIn | undefined;
  for (const [index, paragraph] of paragraphs.entries()) {
    if (paragraph.note === undefined) {
      out.empty += waiting.length;
      open = undefined;
      waiting = (paragraph.noteRefs ?? []).map((r) => ({ kind: r.location, number: r.note, referrer: index }));
      out.flow.push(index);
      // A list's start and entries leave the copy; its subheadings, tables, and captions stay.
      if (paragraph.location === "body" && lists.some((l) => index >= l.start && index < l.end && (index === l.start || !l.subheadings.includes(index)))) {
        out.listed.add(index);
      }
      continue;
    }
    // A paragraph in a table inside a note is marked `table`, so only its label tells which note it is in.
    const fits = (n: { kind: NoteKind; number: string }) => n.number === paragraph.note && (paragraph.location === n.kind || paragraph.location === "table" || paragraph.location === "caption");
    if (!open || !fits(open)) {
      const next = waiting.findIndex(fits);
      if (next < 0) throw new Error(`paragraph ${index} is in a note that nothing before it refers to`);
      out.empty += next;
      const [found] = waiting.splice(0, next + 1).slice(-1);
      open = { ...found!, paragraphs: [] };
      out.notes.push(open);
    }
    open.paragraphs.push(index);
  }
  out.empty += waiting.length;
  for (const note of out.notes) {
    if (out.listed.has(note.referrer) || paragraphs[note.referrer]!.location === "table") out.detached.add(note);
  }
  return out;
}

/** The document the matcher reads: text that cannot take a citation marker is marked as a table's is, so nothing in it links. */
export function forMatching(document: Document, found: Layout): Document {
  const detached = new Set([...found.detached].flatMap((n) => n.paragraphs));
  return { ...document, paragraphs: document.paragraphs.map((p, i) => (detached.has(i) ? { ...p, location: "table" as Location } : p)) };
}

/** What a citation marker is made from. */
export interface Marking { bracket: Bracket; items: Marked[] }

/** One paragraph as plain text with its events: each marked bracket leaves the text and becomes a cluster. */
export function proseBlock(paragraph: Paragraph, marked: Marking[], known: (label: string) => boolean): Extract<OutBlock, { kind: "text" }> | undefined {
  const cuts = [...marked].sort((a, b) => a.bracket.start - b.bracket.start);
  let text = "";
  let from = 0;
  for (const cut of cuts) {
    text += paragraph.text.slice(from, cut.bracket.start);
    from = cut.bracket.end;
  }
  text += paragraph.text.slice(from);

  /** A place in the paragraph as typed, in the text that is left. A place inside a cut bracket moves to where it stood. */
  const moved = (at: number): number => at - cuts.reduce((gone, c) => gone + Math.max(0, Math.min(at, c.bracket.end) - c.bracket.start), 0);
  const events = [
    ...cuts.map((c) => ({ offset: moved(c.bracket.start), typed: c.bracket.start, rank: 1, cluster: c.items })),
    ...(paragraph.noteRefs ?? []).flatMap((r) => {
      const label = labelOf({ kind: r.location, number: r.note });
      return known(label) ? [{ offset: moved(r.at), typed: r.at, rank: 0, marker: label }] : [];
    }),
  ].sort((a, b) => a.offset - b.offset || a.typed - b.typed || a.rank - b.rank);

  const tidied = tidy(text, events.map((e) => e.offset));
  if (tidied.text === "" && events.length === 0) return undefined;
  const level = paragraph.location === "body" && paragraph.headingLevel !== undefined && tidied.text !== "" ? Math.min(4, paragraph.headingLevel) : undefined;
  return {
    kind: "text", text: tidied.text, ...(level !== undefined ? { level } : {}),
    events: events.map((e, n) => ("cluster" in e ? { at: tidied.offsets[n]!, cluster: e.cluster! } : { at: tidied.offsets[n]!, marker: e.marker! })),
  };
}

/** A table's text, a row on each line. */
export function tableLines(paragraphs: Paragraph[]): string[] {
  const rows = new Map<string, Map<number, string[]>>();
  for (const paragraph of paragraphs) {
    const at = paragraph.table ?? { table: 0, row: 0, cell: 0 };
    const row = `${at.table}.${at.row}`;
    const cells = rows.get(row) ?? new Map<number, string[]>();
    rows.set(row, cells);
    cells.set(at.cell, [...cells.get(at.cell) ?? [], paragraph.text.replace(/\s+/g, " ").trim()]);
  }
  return [...rows.values()].map((cells) => `| ${[...cells.values()].map((c) => c.join(" ")).join(" | ")} |`);
}

export interface ChapterPlan {
  chapter: OutChapter;
  /** Unconverted blocks, each with the intake item it needs. */
  unconverted: { id: string; reason: "table" | "note_not_in_text"; paragraph: number; text: string }[];
}

export function planChapter(
  document: Document, found: Layout, marked: Map<number, Marking[]>, newItemId: () => string,
): ChapterPlan {
  const { paragraphs } = document;
  const unconverted: ChapterPlan["unconverted"] = [];
  const keep = (reason: ChapterPlan["unconverted"][number]["reason"], paragraph: number, lines: string[]): OutBlock => {
    const id = newItemId();
    unconverted.push({ id, reason, paragraph, text: lines.join("\n") });
    return { kind: "unconverted", id, lines };
  };

  const written = new Map(found.notes.filter((n) => !found.detached.has(n)).map((n) => [labelOf(n), n]));
  const known = (label: string) => written.has(label);

  const blocks: OutBlock[] = [];
  const flow = found.flow.filter((i) => !found.listed.has(i));
  for (let n = 0; n < flow.length; n++) {
    const index = flow[n]!;
    if (paragraphs[index]!.location === "table") {
      const run = [index];
      while (n + 1 < flow.length && paragraphs[flow[n + 1]!]!.location === "table") run.push(flow[++n]!);
      const lines = tableLines(run.map((i) => paragraphs[i]!));
      blocks.push(keep("table", index, lines));
      continue;
    }
    const block = proseBlock(paragraphs[index]!, marked.get(index) ?? [], known);
    if (block) blocks.push(block);
  }
  // A note that no marker can point at is not written as a definition: it is kept as unconverted text.
  for (const note of found.notes.filter((n) => found.detached.has(n))) {
    blocks.push(keep("note_not_in_text", note.paragraphs[0]!,
      note.paragraphs.map((i, n) => `${n === 0 ? `${note.kind} ${note.number}: ` : ""}${paragraphs[i]!.text.trim()}`)));
  }

  const notes: OutNote[] = [...written].map(([label, note]) => ({
    label,
    blocks: note.paragraphs.flatMap((i) => {
      const paragraph = paragraphs[i]!;
      // Headings are not read inside a note.
      const { headingLevel: _, ...plain } = paragraph;
      const block = proseBlock(plain, marked.get(i) ?? [], () => false);
      return block ? [block] : [];
    }),
  }));
  // A note whose paragraphs held nothing to write loses its marker too.
  const hollow = new Set(notes.filter((n) => n.blocks.length === 0).map((n) => n.label));
  const unmarked = (b: OutBlock): OutBlock => (b.kind === "text" ? { ...b, events: b.events.filter((e) => !("marker" in e) || !hollow.has(e.marker)) } : b);
  return { chapter: { blocks: blocks.map(unmarked), notes: notes.filter((n) => !hollow.has(n.label)) }, unconverted };
}
