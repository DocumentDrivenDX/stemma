// The stored texts a check or an excerpt may read: the intact text of an intact
// copy, with its pages and their printed labels.
import { checkPageSpans, type Corpus, idOf, isObject, type LoadedFile, pageLabels, type PageSegment, type PageSpan } from "@stemma/records";
import { active } from "../checks/bibliography.ts";
import { type BlobReader, isDigest } from "../store.ts";
import { type Folded, fold } from "./quote-fold.ts";

export interface StoredText {
  extraction: LoadedFile;
  capture: LoadedFile;
  text: string;
  spans: PageSpan[];
  labels: Map<number, string>;
  method: string;
  level: string;
  folded(): Folded;
  /** The offset in `text` of a code-point offset, as records count. */
  unit(codePoints: number): number;
  /** The file pages a span of `text` lies on. */
  pagesOf(start: number, end: number): number[];
}

export type Unusable = "copy_unusable" | "text_unusable";

function open(extraction: LoadedFile, capture: LoadedFile, bytes: Uint8Array): StoredText | undefined {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return undefined;
  }
  const { text_size, page_spans, pages, quality } = extraction.data!;
  // Offsets in records count code points; strings count UTF-16 units.
  const astral: number[] = [];
  for (let i = 0, points = 0; i < text.length; i++, points++) {
    if (text.codePointAt(i)! > 0xffff) {
      astral.push(points);
      i++;
    }
  }
  const length = text.length - astral.length;
  if (text_size !== bytes.length || (page_spans !== undefined && (!Array.isArray(page_spans) || checkPageSpans(page_spans, length).length > 0))) {
    return undefined;
  }
  const below = (test: (index: number) => boolean) => {
    let low = 0;
    let high = astral.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (test(middle)) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const unit = (points: number) => points + below((i) => astral[i]! < points);
  const spans = (page_spans ?? []) as unknown as PageSpan[];
  const ranges = spans.map((s) => ({ page: s.page_index, start: unit(s.start), end: unit(s.end) }));
  let folded: Folded | undefined;
  const about = isObject(quality) ? quality : {};
  return {
    extraction, capture, text, spans,
    labels: pageLabels(Array.isArray(pages) ? (pages as unknown as PageSegment[]) : []),
    method: String(about.method), level: String(about.level),
    folded: () => (folded ??= fold(text, "stored")),
    unit,
    pagesOf: (start, end) => ranges.filter((r) => r.start < end && r.end > start).map((r) => r.page),
  };
}

/** Reads and keeps each stored text once in a run. */
export class StoredTexts {
  private readonly known = new Map<string, StoredText | Unusable>();
  constructor(private readonly corpus: Corpus, private readonly blobs: BlobReader, private readonly read: Set<string> = new Set()) {}

  of(extraction: LoadedFile): StoredText | Unusable {
    const id = idOf(extraction) ?? extraction.path;
    const found = this.known.get(id) ?? this.load(extraction);
    this.known.set(id, found);
    return found;
  }

  private load(extraction: LoadedFile): StoredText | Unusable {
    const capture = this.corpus.byId.get(String(extraction.data!.capture));
    const sha = capture?.data?.sha256;
    if (capture?.data?.kind !== "capture" || !isDigest(sha) || sha !== extraction.data!.capture_sha256 || this.blobs.verify(sha) !== "ok") {
      return "copy_unusable";
    }
    const textSha = extraction.data!.text_sha256;
    const bytes = isDigest(textSha) ? this.blobs.get(textSha) : undefined;
    const opened = bytes && open(extraction, capture, bytes);
    if (!opened || !/\S/u.test(opened.text)) return "text_unusable";
    this.read.add(sha);
    this.read.add(textSha as string);
    return opened;
  }

  /** Every non-retired extraction of a source's non-retired copies, in record order. */
  extractionsOf(source: string): LoadedFile[] {
    const captures = new Set(active(this.corpus, "capture").filter((c) => c.data!.source === source).map(idOf));
    return active(this.corpus, "extraction").filter((e) => captures.has(String(e.data!.capture)));
  }
}

/** The printed label of a file page, or what to say when it has none. */
export const labelOf = (stored: StoredText, page: number): string =>
  stored.labels.has(page) ? `printed page ${stored.labels.get(page)} (file index ${page})` : `file index ${page}, no printed label`;
