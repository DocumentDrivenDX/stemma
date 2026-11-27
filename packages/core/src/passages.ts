// Passages (CONTRACT-007 H; FR-90). Choosing a passage is judgment, recorded as
// who selected it. Its words, its address and its locator are copied from the
// source file by this code; nothing here accepts typed quotation text.
import { canonical, type Corpus, isObject, isRetired, type Json, type JsonObject, recordPath, RECORD_SCHEMA, KINDS } from "@stemma/records";
import { findQuotation, renderQuotation } from "./matching/quote-fold.ts";
import { type Anchor, codePoints, paragraphNumbers, placeOf, SourceTexts, type StreamName, type TextView, unitAt } from "./matching/texts.ts";
import { type Actor, InvalidInput } from "./operations.ts";
import { sourceBinding } from "./checks/changed.ts";
import { numberOf } from "./checks/locators.ts";

export interface Locator { label: string; value: string }

export const addressText = (text: string, anchor: Anchor[]): string =>
  `${text}/${anchor.map((a) => `${a.index}:${a.stream}:${a.start}-${a.end}`).join("+")}`;

/**
 * `txt-…/105:main:120-240`, or a range across parts such as
 * `txt-…/105:main:900-+106:main:-80`: the start is in the first piece and the end in the last.
 */
export function parseAddress(address: string): { text: string; from: { index: number; offset: number }; to: { index: number; offset?: number }; stream: StreamName } {
  const slash = address.indexOf("/");
  const text = address.slice(0, slash);
  const pieces = address.slice(slash + 1).split("+").map((p) => /^(\d+):(main|notes):(\d*)-(\d*)$/.exec(p));
  const bad = () => new InvalidInput("An address looks like txt-…/105:main:120-240, or txt-…/105:main:900-+106:main:-80 across pages.");
  if (slash < 0 || pieces.some((p) => !p)) throw bad();
  const [first, last] = [pieces[0]!, pieces.at(-1)!];
  if (first[3] === "" || pieces.some((p) => p![2] !== first[2])) throw bad();
  return {
    text, stream: first[2] as StreamName, from: { index: Number(first[1]), offset: Number(first[3]) },
    to: { index: Number(last[1]), ...(last[4] === "" ? {} : { offset: Number(last[4]) }) },
  };
}

/** The span of a joined stream that an address names. */
export function resolveSpan(view: TextView, address: ReturnType<typeof parseAddress>): { start: number; end: number } {
  const place = (index: number, offset: number | undefined) => {
    const span = view.streams[address.stream].spans.find((s) => s.index === index);
    const part = view.part(index);
    if (!span || !part) throw new InvalidInput(`The source file has no ${address.stream} text at index ${index}.`);
    const text = part.streams[address.stream];
    if (offset !== undefined && offset > codePoints(text)) throw new InvalidInput(`Index ${index} has fewer than ${offset} characters.`);
    return span.start + (offset === undefined ? text.length : unitAt(text, offset));
  };
  const start = place(address.from.index, address.from.offset);
  const end = place(address.to.index, address.to.offset);
  if (end <= start) throw new InvalidInput("The address ends before it starts.");
  return { start, end };
}

const rangeOf = (labels: string[]): string => (labels.length === 1 ? labels[0]! : `${labels[0]}-${labels.at(-1)}`);

/**
 * The locator of a span, from the printed labels of its pages, or from chapter
 * and paragraph where there are no pages. Undefined when the source file cannot
 * say, such as a page with no established label.
 */
export function locatorOf(view: TextView, stream: StreamName, start: number, end: number): Locator | undefined {
  const indexes = view.partsOf(stream, start, end);
  const parts = indexes.map((i) => view.part(i)!);
  if (parts.length === 0) return undefined;
  if (view.paged) {
    return parts.every((p) => p.label !== undefined) ? { label: "page", value: rangeOf(parts.map((p) => p.label!)) } : undefined;
  }
  const chapter = parts[0]!.chapter;
  if (parts.some((p) => p.chapter !== chapter)) return undefined;
  if (stream === "main") {
    const numbers = parts.flatMap((p) => {
      const span = view.streams.main.spans.find((s) => s.index === p.index)!;
      return paragraphNumbers(p, start - span.start, end - span.start);
    });
    // With chapters, the chapter is the locator; without, the paragraph is.
    if (!chapter && numbers.length > 0) return { label: "paragraph", value: rangeOf([...new Set(numbers.map(String))]) };
  }
  return chapter && (numberOf(chapter) || /^[a-z]+$/i.test(chapter)) ? { label: "chapter", value: chapter } : undefined;
}

export interface FoundPassage { text: string; address: string; match: string; places: string[]; locator?: Locator; exact: string; quotation: string }

/** Every place the words occur in a source's text, under the quotation rules. */
export function findPassages(corpus: Corpus, source: string, words: string, most = 20): FoundPassage[] {
  const texts = new SourceTexts(corpus);
  const out: FoundPassage[] = [];
  for (const view of texts.of(source).views) {
    for (const stream of ["main", "notes"] as const) {
      let after = -1;
      while (out.length < most) {
        const found = findQuotation(view.folded(stream), words, (s) => s.start > after);
        if (!found) break;
        // The occurrence nearest the start is taken first, so that every one is listed.
        let first = found;
        for (let earlier; (earlier = findQuotation(view.folded(stream), words, (s) => s.start > after && s.start < first.start)); ) first = earlier;
        after = first.start;
        const exact = view.streams[stream].text.slice(first.start, first.end);
        const locator = locatorOf(view, stream, first.start, first.end);
        out.push({
          text: view.id, address: addressText(view.id, view.address(stream, first.start, first.end)), match: first.match,
          places: view.partsOf(stream, first.start, first.end).map((i) => placeOf(view, i)), ...(locator ? { locator } : {}),
          exact, quotation: renderQuotation(exact),
        });
      }
    }
  }
  return out;
}

export interface CaptureRequest { address: string; locator?: never; note?: string; actor: Actor; now: Date; token: () => string }

export function capturePassage(corpus: Corpus, request: CaptureRequest) {
  const address = parseAddress(request.address);
  const texts = new SourceTexts(corpus);
  if (!corpus.texts.has(address.text)) throw new InvalidInput(`No source file has the ID ${address.text}.`);
  if (isRetired(corpus.texts.get(address.text)!.manifest.data!)) throw new InvalidInput(`The source file ${address.text} is retired.`);
  const view = texts.view(address.text);
  if (!view) throw new InvalidInput("That source file is damaged, so nothing is copied from it. `check` explains why.");
  const { start, end } = resolveSpan(view, address);
  const exact = view.streams[address.stream].text.slice(start, end);
  if (!/\S/u.test(exact)) throw new InvalidInput("The address holds only white space.");
  const locator = locatorOf(view, address.stream, start, end);
  if (!locator) {
    throw new InvalidInput(view.paged
      ? "A page this passage lies on has no established printed label, so no locator can be copied. Label the page first (`source pages`, `source label`)."
      : "This source has no pages, and the passage lies in no one chapter or numbered paragraph, so no locator can be copied.");
  }
  const source = corpus.byId.get(view.source);
  if (source?.data?.kind !== "source") throw new InvalidInput("The source file names no readable source record.");
  const id = `${KINDS.passage!.prefix}${request.token()}`;
  const anchor = view.address(address.stream, start, end);
  const record = {
    schema: RECORD_SCHEMA, id, kind: "passage", created: { at: request.now.toISOString().replace(/\.\d+Z$/, "Z"), by: { ...request.actor } },
    source: view.source, text: view.id, anchor: anchor as unknown as Json, quote: { exact }, locator: { ...locator },
    source_record_sha256: sourceBinding(source.data),
  };
  return {
    record: { id, path: recordPath("passage", id), text: canonical(record) },
    passage: id, text: view.id, address: addressText(view.id, anchor), exact, quotation: renderQuotation(exact), locator,
    places: view.partsOf(address.stream, start, end).map((i) => placeOf(view, i)), method: view.method,
  };
}

/** The anchors a passage record holds, if they are well formed. */
export const anchorsOf = (passage: JsonObject): Anchor[] =>
  (Array.isArray(passage.anchor) ? passage.anchor.filter(isObject) : []) as unknown as Anchor[];

/** The text a passage's address names now, or why it cannot be read. */
export function textAt(texts: SourceTexts, passage: JsonObject):
  { state: "ok"; view: TextView; stream: StreamName; text: string; indexes: number[] } | { state: "unavailable" } | { state: "changed"; index: number } {
  const view = texts.view(String(passage.text));
  const anchor = anchorsOf(passage);
  if (!view || anchor.length === 0) return { state: "unavailable" };
  const pieces: string[] = [];
  for (const a of anchor) {
    const part = view.part(a.index);
    if (!part || part.digest !== a.page_sha256) return { state: "changed", index: a.index };
    const points = [...part.streams[a.stream]];
    pieces.push(points.slice(a.start, a.end).join(""));
  }
  return { state: "ok", view, stream: anchor[0]!.stream, text: pieces.join("\n"), indexes: anchor.map((a) => a.index) };
}

/** A citation made from a passage takes its quotation and locator from it (CONTRACT-001 G). */
export function citationFromPassage(corpus: Corpus, record: JsonObject): void {
  const passage = corpus.byId.get(String(record.passage))?.data;
  if (passage?.kind !== "passage" || isRetired(passage)) throw new InvalidInput(`No passage record in effect has the ID ${String(record.passage)}.`);
  if (record.quotation !== undefined || record.locator !== undefined) {
    throw new InvalidInput("A citation made from a passage takes its quotation and locator from the passage. Leave both out; they are never typed.");
  }
  const at = textAt(new SourceTexts(corpus), passage);
  if (at.state !== "ok" || !isObject(passage.quote) || at.text !== passage.quote.exact) {
    throw new InvalidInput("The text at the passage's address is no longer what the passage copied. Capture it again.");
  }
  record.quotation = renderQuotation(at.text);
  record.locator = { ...(passage.locator as JsonObject) };
  const source = corpus.byId.get(String(passage.source))?.data;
  if (record.key === undefined && record.source === undefined && source) {
    if (typeof source.citation_key === "string") record.key = source.citation_key;
    else record.source = passage.source!;
  }
}
