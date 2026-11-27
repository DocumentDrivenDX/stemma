// The one reader of the Stemma copy of a manuscript (CONTRACT-006 A to D). It is
// pure: it reads bytes it is given, and checks no reference against records.
//
// Where the contract is silent, this reader assumes:
// - a block quote's attribute line stands directly above the quote;
// - `cite` on a block quote counts the citations in the quote, or in the
//   introducing sentence when the quote has none;
// - a citation after the space that follows a sentence belongs to that sentence;
// - CRLF line ends from a checkout are read as LF, as for record files;
// - character references such as `&amp;` are refused, like other unlisted syntax.
import { compareCodePoints, decodeUtf8, isRecordId, normalizeSentence, sha256, type SourceFile } from "@stemma/records";
import { spanAttributes } from "./attributes.ts";
import { type Line, type QuoteGroup, type RawBlock, readBlocks } from "./blocks.ts";
import { type Inline, readInline, type Span } from "./inline.ts";
import {
  type Chapter, type Citation, malformed, type Manuscript, type ManuscriptProblem, type Position, Refusal, type Sentence, unsupported,
} from "./model.ts";
import { doubleQuotes, type Range, splitSentences } from "./sentences.ts";

export * from "./model.ts";
export { LOCATOR_TERMS } from "./attributes.ts";
export { SENTENCE_PROFILE, splitSentences } from "./sentences.ts";

const CHAPTER_PATH = /^manuscript\/([^/]+)\.md$/;

const bare = (text: string): string => {
  const trimmed = normalizeSentence(text);
  return /^(?:".*"|“.*”)$/s.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
};

/** One block with its sentences, before footnotes are attached. */
interface Parsed {
  raw: RawBlock;
  index: number;
  inline: Inline;
  ranges: Range[];
  sentences: Sentence[];
}

/** A citation and where it falls in its block's text, for deciding what a span holds. */
interface Placed { citation: Citation; places: { block: number; offset: number }[] }

/** The sentence holding an offset; a point between sentences belongs to the one before. */
const sentenceAt = (ranges: Range[], offset: number): number => Math.max(0, ranges.findLastIndex((r) => r.start < offset));

function readChapter(path: string, id: string, source: string): Chapter {
  const lines: Line[] = source.split("\n").map((text, i) => ({ text, line: i + 1, column: 1 }));
  const raw = readBlocks(lines);
  const chapter: Chapter = {
    path, id, blocks: [], sentences: [], citations: [], quotations: [], claims: [], needsSource: [], notQuotes: [], unpairedQuoteMarks: [],
  };

  const parse = (block: RawBlock): Parsed => {
    const index = chapter.blocks.length;
    const inline: Inline = block.kind === "unconverted"
      ? { text: block.lines.map((l) => l.text).join("\n"), clusters: [], markers: [], spans: [], positionAt: () => block }
      : readInline(block.lines);
    chapter.blocks.push({
      kind: block.kind, line: block.line, column: block.column, quoted: block.quote !== undefined, list: block.list, text: inline.text,
      ...(block.level ? { level: block.level } : {}), ...(block.id ? { id: block.id } : {}), ...(block.note ? { note: block.note } : {}),
    });
    const marked = inline.spans.filter((s) => s.attributes.mark === "quote");
    // Unconverted text is carried, not read, so it has no sentences.
    const ranges = block.kind === "unconverted" ? [] : splitSentences(inline.text, [...marked, ...doubleQuotes(inline.text).pairs]);
    // A block that holds only citations still needs a sentence to carry them.
    if (ranges.length === 0 && (inline.clusters.length > 0 || inline.markers.length > 0)) ranges.push({ start: 0, end: inline.text.length });
    return { raw: block, index, inline, ranges, sentences: [] };
  };

  const body = raw.blocks.map(parse);
  const notes = new Map([...raw.notes].map(([label, note]) => [label, { at: note.at, blocks: note.blocks.map(parse) }]));
  const all = [...body, ...[...notes.values()].flatMap((n) => n.blocks)];

  // A note that holds only citations belongs to the sentence that carries its marker.
  const citationOnly = (label: string): boolean => notes.get(label)!.blocks.every((b) => !/[\p{L}\p{N}]/u.test(b.inline.text));

  for (const parsed of all) {
    parsed.sentences = parsed.ranges.map((range) => {
      const text = normalizeSentence(parsed.inline.text.slice(range.start, range.end));
      return {
        text, sha256: sha256(text), block: parsed.index, citations: [], ...parsed.inline.positionAt(range.start),
        ...(parsed.raw.note ? { note: parsed.raw.note } : {}),
      };
    });
  }
  for (const parsed of all) {
    if (!parsed.raw.note || !citationOnly(parsed.raw.note)) chapter.sentences.push(...parsed.sentences);
  }

  const placed: Placed[] = [];
  const referenced = new Set<string>();
  const attach = (target: Sentence, item: Citation | Parsed["inline"]["clusters"][number]["items"][number], at: Position): Citation => {
    const citation: Citation = { ...item, line: at.line, column: at.column, sentence: chapter.sentences.indexOf(target), ordinal: 0 };
    citation.ordinal = target.citations.filter(
      (c) => c.key === citation.key && c.locator?.label === citation.locator?.label && c.locator?.value === citation.locator?.value).length;
    target.citations.push(citation);
    chapter.citations.push(citation);
    return citation;
  };

  /** Clusters and footnote markers of one block, in reading order. */
  const walk = (parsed: Parsed, carrier?: { sentence: Sentence; block: number; offset: number }) => {
    const events = [
      ...parsed.inline.clusters.map((c) => ({ offset: c.offset, line: c.line, column: c.column, cluster: c })),
      ...parsed.inline.markers.map((m) => ({ offset: m.offset, line: m.line, column: m.column, marker: m })),
    ].sort((a, b) => a.line - b.line || a.column - b.column);
    for (const event of events) {
      const here = carrier ?? {
        sentence: parsed.sentences[sentenceAt(parsed.ranges, event.offset)]!, block: parsed.index, offset: event.offset,
      };
      if ("cluster" in event) {
        for (const item of event.cluster.items) {
          placed.push({ citation: attach(here.sentence, item, event), places: [{ block: here.block, offset: here.offset }] });
        }
        continue;
      }
      if (parsed.raw.note) throw unsupported("footnote inside a footnote", event);
      const { label } = event.marker;
      const note = notes.get(label);
      if (!note) throw malformed("a footnote marker has no definition", event);
      if (referenced.has(label)) throw unsupported("a footnote referred to twice", event);
      referenced.add(label);
      const only = citationOnly(label);
      for (const block of note.blocks) {
        if (only) walk(block, here);
        else {
          walk(block);
          // The note keeps its own sentences, but a claim span around its marker still holds its citations.
          for (const p of placed) {
            if (p.places[0]!.block === block.index) p.places.push({ block: here.block, offset: here.offset });
          }
        }
      }
    }
  };
  for (const parsed of body) walk(parsed);
  for (const [label, note] of notes) {
    if (!referenced.has(label)) throw malformed("a footnote is defined but never referred to", note.at);
  }

  const within = (parsed: Parsed, span: Range): Citation[] => placed
    .filter((p) => p.places.some((at) => at.block === parsed.index && at.offset >= span.start && at.offset <= span.end))
    .map((p) => p.citation);
  const indexOf = (parsed: Parsed, offset: number): number | undefined => {
    if (parsed.sentences.length === 0) return undefined;
    const sentence = parsed.sentences[Math.max(0, parsed.ranges.findLastIndex((r) => r.start <= offset))]!;
    const found = chapter.sentences.indexOf(sentence);
    return found < 0 ? undefined : found;
  };

  /** `cite`, or the only citation there is (CONTRACT-006 C). */
  const attributed = (citations: Citation[], cite: number | undefined, at: Position): Citation | undefined => {
    if (cite === undefined) return citations.length === 1 ? citations[0] : undefined;
    const named = citations[cite - 1];
    if (!named) throw malformed("cite names a citation the sentence does not have", at);
    return named;
  };

  const quoteGroups = new Map<QuoteGroup, Parsed[]>();
  for (const parsed of all) {
    const { inline, raw: block } = parsed;
    if (block.quote) quoteGroups.set(block.quote, [...(quoteGroups.get(block.quote) ?? []), parsed]);
    for (const span of inline.spans) {
      const text = normalizeSentence(inline.text.slice(span.start, span.end));
      const at = { line: span.line, column: span.column };
      const sentence = indexOf(parsed, span.start);
      const { mark, cite, claims } = span.attributes;
      if (mark === "claim") chapter.claims.push({ ...at, ids: claims!, text, citations: within(parsed, span) });
      if (mark === "not-quote") chapter.notQuotes.push({ ...at, text });
      if (mark === "needs-source") {
        const near = [...within(parsed, span),
          ...parsed.sentences.filter((_, n) => parsed.ranges[n]!.start < span.end && span.start < parsed.ranges[n]!.end)
            .flatMap((s) => s.citations)];
        chapter.needsSource.push({ ...at, text, sourced: near.some((c) => c.key !== "?" && c.locator !== undefined) });
      }
      if (mark === "quote") {
        const items = sentence === undefined ? [] : chapter.sentences[sentence]!.citations;
        const citation = attributed(items, cite, at);
        chapter.quotations.push({
          ...at, form: "marked", text: bare(text), ...(sentence === undefined ? {} : { sentence }), ...(citation ? { citation } : {}),
        });
      }
    }

    // Marks inside a block quote are part of the quoted words.
    if (block.quote || block.kind === "unconverted") continue;
    const { pairs, unpaired } = doubleQuotes(inline.text);
    chapter.unpairedQuoteMarks.push(...unpaired.map((offset) => inline.positionAt(offset)));
    const settled = inline.spans.filter((s) => s.attributes.mark === "quote" || s.attributes.mark === "not-quote");
    const covered = (pair: Range) => settled.some((s: Span) =>
      (s.start <= pair.start && pair.end <= s.end)
      // `"[words]{.quote}"`: the span is all that the marks enclose.
      || (inline.text.slice(pair.start + 1, s.start).trim() === "" && inline.text.slice(s.end, pair.end - 1).trim() === ""
        && s.start > pair.start && s.end < pair.end));
    let done = 0;
    for (const pair of pairs) {
      // Marks nested inside a quotation belong to it.
      if (pair.start < done || covered(pair)) continue;
      done = pair.end;
      const text = normalizeSentence(inline.text.slice(pair.start + 1, pair.end - 1));
      if (text === "") continue;
      const sentence = indexOf(parsed, pair.start);
      const items = sentence === undefined ? [] : chapter.sentences[sentence]!.citations;
      chapter.quotations.push({
        ...inline.positionAt(pair.start), form: "double", text,
        ...(sentence === undefined ? {} : { sentence }), ...(items.length === 1 ? { citation: items[0]! } : {}),
      });
    }
  }

  for (const [group, parts] of quoteGroups) {
    const attributes = group.attributes ? spanAttributes(group.attributes, group) : undefined;
    // An attribute line that only names a language does not change what is quoted.
    if (attributes?.mark === "not-quote") {
      chapter.notQuotes.push({ line: group.line, column: group.column, text: normalizeSentence(parts.map((p) => p.inline.text).join(" ")) });
      continue;
    }
    if (attributes?.mark && attributes.mark !== "quote") throw unsupported("this class on a block quote", group);
    const inside = parts.flatMap((p) => p.sentences.flatMap((s) => s.citations));
    const first = parts[0]!.index;
    const before = body.findLast((p) => p.index < first && !p.raw.quote && p.raw.kind === "paragraph");
    const introducing = before && before.index === first - 1 ? before.sentences.at(-1) : undefined;
    const candidates = inside.length > 0 ? inside : introducing?.citations ?? [];
    const citation = attributed(candidates, attributes?.cite, group);
    const sentence = introducing ? chapter.sentences.indexOf(introducing) : -1;
    chapter.quotations.push({
      line: group.line, column: group.column, form: "block",
      text: bare(parts.map((p) => p.inline.text).join(" ")),
      ...(sentence < 0 ? {} : { sentence }), ...(citation ? { citation } : {}),
    });
  }
  chapter.quotations.sort((a, b) => a.line - b.line || a.column - b.column);
  return chapter;
}

/** Reads every chapter file. One file's problem does not stop the others being read. */
export function readManuscript(files: SourceFile[]): Manuscript {
  const out: Manuscript = { chapters: [], problems: [], unread: [] };
  const seen = new Set<string>();
  for (const file of [...files].sort((a, b) => compareCodePoints(a.path, b.path))) {
    if (!file.path.endsWith(".md")) {
      out.unread.push(file.path);
      continue;
    }
    const refuse = (code: ManuscriptProblem["code"], detail: string, at: Position = { line: 1, column: 1 }) =>
      out.problems.push({ path: file.path, code, detail, line: at.line, column: at.column });
    const id = CHAPTER_PATH.exec(file.path)?.[1];
    if (!id || !isRecordId("chapter", id)) {
      refuse("manuscript_unsupported", "a chapter file is named manuscript/<chapter ID>.md");
      continue;
    }
    let text: string;
    try {
      if (!file.bytes) throw new Error("unreadable");
      text = decodeUtf8(file.bytes);
      if (text.startsWith("\ufeff")) throw new Error("byte-order mark");
    } catch {
      refuse("manuscript_syntax", "the file cannot be read as UTF-8 without a byte-order mark");
      continue;
    }
    try {
      const chapter = readChapter(file.path, id, text.replace(/\r\n/g, "\n"));
      const ids = chapter.citations.filter((c) => c.id !== undefined);
      const twice = ids.find((c, n) => seen.has(c.id!) || ids.findIndex((d) => d.id === c.id) !== n);
      if (twice) {
        refuse("manuscript_duplicate_id", "a citation id is used more than once", twice);
        continue;
      }
      for (const citation of ids) seen.add(citation.id!);
      out.chapters.push(chapter);
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      refuse(error.code, error.detail, error.at);
    }
  }
  return out;
}
