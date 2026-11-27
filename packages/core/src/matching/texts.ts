// What a check, an excerpt, or a passage reads from a source file: the main and
// notes streams of its parts joined in order, with every offset mapped back to
// the part it lies in (CONTRACT-007 G and H). Running heads, folios and
// boilerplate are never part of either stream.
import {
  type Corpus, idOf, isObject, isRetired, type LoadedPart, type LoadedText, PARAGRAPH_ROLES, blockText, streamsOf, type Streams, textDigest,
} from "@stemma/records";
import { type Folded, fold } from "./quote-fold.ts";

export type StreamName = "main" | "notes";

export interface PartView {
  index: number;
  path: string;
  part: LoadedPart;
  label?: string;
  labelStatus: string;
  section?: string;
  chapter?: string;
  streams: Streams;
  digest: string;
  /** Paragraphs as spans of the part's main stream, numbered within the chapter from `firstParagraph`. */
  paragraphs: { start: number; end: number }[];
  firstParagraph: number;
}

export interface Joined {
  text: string;
  /** Where each part's text lies, in string units of `text`. */
  spans: { index: number; start: number; end: number }[];
}

/** One part's piece of a passage address. Offsets count code points in the part's stream. */
export interface Anchor { index: number; page_sha256: string; stream: StreamName; start: number; end: number }

export interface TextView {
  id: string;
  source: string;
  loaded: LoadedText;
  paged: boolean;
  method: string;
  level: string;
  parts: PartView[];
  streams: Record<StreamName, Joined>;
  folded(stream: StreamName): Folded;
  part(index: number): PartView | undefined;
  /** The part indexes a span of a joined stream lies on. */
  partsOf(stream: StreamName, start: number, end: number): number[];
  /** The passage address of a span of a joined stream. */
  address(stream: StreamName, start: number, end: number): Anchor[];
}

export const codePoints = (text: string): number => {
  let n = 0;
  for (const _ of text) n++;
  return n;
};
/** The string offset of a code-point offset. */
export const unitAt = (text: string, points: number): number => [...text].slice(0, points).join("").length;

function paragraphsOf(part: LoadedPart, main: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let at = 0;
  for (const block of part.blocks) {
    const text = blockText(block);
    if (text === "" || ["footnote", "running-head", "folio", "boilerplate", "figure", "note"].includes(block.role)) continue;
    const found = main.indexOf(text, at);
    if (found < 0) continue;
    at = found + text.length;
    if (PARAGRAPH_ROLES.includes(block.role)) spans.push({ start: found, end: at });
  }
  return spans;
}

export function viewOf(loaded: LoadedText): TextView {
  const data = loaded.manifest.data!;
  const conversion = isObject(data.conversion) ? data.conversion : {};
  const counted = new Map<string, number>();
  const parts: PartView[] = loaded.parts.map((part) => {
    const front = part.front;
    const streams = streamsOf(part.blocks);
    const paragraphs = paragraphsOf(part, streams.main);
    const chapter = typeof front.chapter === "string" ? front.chapter : undefined;
    const before = counted.get(chapter ?? "") ?? 0;
    counted.set(chapter ?? "", before + paragraphs.length);
    return {
      index: part.index, path: part.path, part, labelStatus: String(front.label_status),
      ...(typeof front.label === "string" ? { label: front.label } : {}),
      ...(typeof front.section === "string" ? { section: front.section } : {}),
      ...(chapter ? { chapter } : {}),
      streams, digest: textDigest(part.blocks), paragraphs, firstParagraph: before + 1,
    };
  });
  const join = (name: StreamName): Joined => {
    let text = "";
    const spans: Joined["spans"] = [];
    for (const part of parts) {
      const piece = part.streams[name];
      if (piece === "") continue;
      if (text !== "") text += "\n";
      spans.push({ index: part.index, start: text.length, end: text.length + piece.length });
      text += piece;
    }
    return { text, spans };
  };
  const streams = { main: join("main"), notes: join("notes") };
  const folded: Partial<Record<StreamName, Folded>> = {};
  const byIndex = new Map(parts.map((p) => [p.index, p]));
  return {
    id: idOf(loaded.manifest)!, source: String(data.source), loaded, paged: data.paged === true,
    method: String(conversion.method), level: String(conversion.level), parts, streams,
    folded: (name) => (folded[name] ??= fold(streams[name].text, "stored")),
    part: (index) => byIndex.get(index),
    partsOf: (name, start, end) => streams[name].spans.filter((s) => s.start < end && s.end > start).map((s) => s.index),
    address: (name, start, end) => streams[name].spans.filter((s) => s.start < end && s.end > start).map((s) => {
      const part = byIndex.get(s.index)!;
      const text = part.streams[name];
      return {
        index: s.index, page_sha256: part.digest, stream: name,
        start: codePoints(text.slice(0, Math.max(0, start - s.start))),
        end: codePoints(text.slice(0, Math.min(text.length, end - s.start))),
      };
    }),
  };
}

/** Reads each source file once in a run. A damaged one yields no view. */
export class SourceTexts {
  private readonly known = new Map<string, TextView | undefined>();
  constructor(readonly corpus: Corpus) {}

  view(id: string): TextView | undefined {
    if (!this.known.has(id)) {
      const loaded = this.corpus.texts.get(id);
      this.known.set(id, loaded?.usable ? viewOf(loaded) : undefined);
    }
    return this.known.get(id);
  }

  /** The IDs of a source's non-retired source files, damaged ones included, in path order. */
  idsOf(source: string): string[] {
    return [...this.corpus.texts].filter(([, t]) => t.manifest.data!.source === source && !isRetired(t.manifest.data!))
      .sort(([, a], [, b]) => (a.directory < b.directory ? -1 : 1)).map(([id]) => id);
  }

  /** The usable views of a source, and how many source files could not be used. */
  of(source: string): { views: TextView[]; unusable: number } {
    const ids = this.idsOf(source);
    const views = ids.flatMap((id) => this.view(id) ?? []);
    return { views, unusable: ids.length - views.length };
  }
}

/** "printed page 89 (index 106)", "chapter IV, section 3", and so on. */
export function placeOf(view: TextView, index: number): string {
  const part = view.part(index);
  if (!part) return `index ${index}`;
  if (view.paged) return part.label !== undefined ? `printed page ${part.label} (index ${index})` : `page index ${index}, no printed label`;
  return [part.chapter ? `chapter ${part.chapter}` : "", `section ${index}${part.section ? ` "${part.section}"` : ""}`].filter(Boolean).join(", ");
}

/** The paragraph numbers, within their chapter, that a span of one part's main stream touches. */
export function paragraphNumbers(part: PartView, start: number, end: number): number[] {
  return part.paragraphs.flatMap((p, i) => (p.start < end && p.end > start ? [part.firstParagraph + i] : []));
}
