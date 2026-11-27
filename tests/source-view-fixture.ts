// An invented project for the source view: a letter that is part of a volume, a
// three-page book with a footnote and characters outside the basic plane, and
// passages and citations that each test changes. Nothing here is a real source.
import { renderQuotation, sourceBinding } from "@stemma/core";
import {
  type Block, canonical, type Corpus, fileDigest, loadCorpus, normalizeSentence, type ProjectContent, recordPath, serializeManifest,
  serializePart, sha256, type SourceFile, streamsOf, textDigest,
} from "@stemma/records";

export type Rec = Record<string, any>;
export const AT = "2026-01-05T09:00:00Z";
const BY = { kind: "person", name: "Author" };
const created = { at: AT, by: BY };

export const VOLUME = "src-volume000001";
export const LETTER = "src-letter000001";
export const OTHER = "src-other0000001";
export const TEXT = "txt-volumetext01";
export const ORIGINAL = "a".repeat(64);

export const source = (id: string, key: string, more: Rec = {}): Rec => ({
  schema: "stemma.record/0", id, kind: "source", created, citation_key: key, title: { value: `The ${key} book` }, type: "book",
  intake: "parsed", admission: "candidate", ...more,
});

export interface Page { label?: string; blocks: Block[] }
const block = (content: string, role = "paragraph"): Block => ({ role, content, ...(role === "footnote" ? { label: "1" } : {}) });

/** Page 1 ends in a hyphenated word that page 2 finishes. Page 2 opens with characters outside the basic plane. */
export const PAGES: Page[] = [
  { label: "1", blocks: [block("THE REEF 1", "running-head"), block("The reef was old. We saw the la-")] },
  { label: "2", blocks: [block("\u{1D49C}\u{1F600}goon was deep, and nothing more is known of it."), block("1 An invented note about \u{1D49C} soundings.", "footnote")] },
  { label: "3", blocks: [block("The islets were few.")] },
];

export interface Project {
  sources: Rec[];
  records: Rec[];
  pages: Page[];
  /** Changes to the source file's manifest before it is written. */
  manifest: Rec;
  /** Changes to a written part file, after its digest is listed: an unsealed edit. */
  tamper?: (path: string, text: string) => string;
}

export const partText = (page: Page, index: number, paged: boolean): string => serializePart({
  index, method: "ocr", level: "unassessed", note: "invented page note", columns: "1",
  ...(paged ? { label_status: page.label ? "labelled" : "undetermined", ...(page.label ? { label: page.label, label_basis: "printed_sequence" } : {}) } : { label_status: "unpaged", chapter: "I" }),
}, page.blocks);

const file = (path: string, text: string): SourceFile => ({ path, bytes: new TextEncoder().encode(text) });

/** The anchor of a stretch of one page's stream, found by its words. */
export function anchorOf(pages: Page[], index: number, stream: "main" | "notes", words: string): Rec {
  const text = streamsOf(pages[index]!.blocks)[stream];
  const at = text.indexOf(words);
  if (at < 0) throw new Error(`no ${words} on page ${index}`);
  const start = [...text.slice(0, at)].length;
  return { index, page_sha256: textDigest(pages[index]!.blocks), stream, start, end: start + [...words].length };
}

export const sources = (): Rec[] => [
  source(VOLUME, "volume1850"),
  source(LETTER, "letter1850", { relations: [{ lid: "a", type: "part_of", target: VOLUME }] }),
  source(OTHER, "other1850"),
];

export function passage(id: string, anchor: Rec[], exact: string, more: Rec = {}): Rec {
  return {
    schema: "stemma.record/0", id, kind: "passage", created, source: VOLUME, text: TEXT, anchor, quote: { exact },
    locator: { label: "page", value: "2" }, source_record_sha256: sourceBinding(source(VOLUME, "volume1850") as never), ...more,
  };
}

export function citation(id: string, of: Rec, more: Rec = {}): Rec {
  const sentence = normalizeSentence(`It says “${of.quote.exact}”.`);
  return {
    schema: "stemma.record/0", id, kind: "citation", created, intake: "parsed", key: "volume1850", passage: of.id,
    quotation: renderQuotation(of.quote.exact), locator: { ...of.locator }, sentence: { text: sentence, sha256: sha256(sentence) }, ...more,
  };
}

/** The standard passages: one page, across a break, and in a note. */
export function standard(pages: Page[] = PAGES) {
  const one = passage("psg-onepage00001", [anchorOf(pages, 1, "main", "nothing more is known")], "nothing more is known");
  const first = anchorOf(pages, 0, "main", "We saw the la-");
  const second = anchorOf(pages, 1, "main", "\u{1D49C}\u{1F600}goon was deep");
  const two = passage("psg-twopages0001", [first, second], "We saw the la-\n\u{1D49C}\u{1F600}goon was deep", { locator: { label: "page", value: "1-2" } });
  const note = passage("psg-footnote0001", [anchorOf(pages, 1, "notes", "\u{1D49C} soundings")], "\u{1D49C} soundings");
  return { one, two, note };
}

export function project(change: Partial<Project> = {}): Project {
  const pages = change.pages ?? structuredClone(PAGES);
  const { one, two, note } = standard(pages);
  return { sources: sources(), records: [one, two, note, citation("cit-onepage00001", one)], pages, manifest: {}, ...change };
}

export function content(made: Project, paged = true): ProjectContent {
  const parts = made.pages.map((p, i) => ({ index: i, file: `${paged ? "pages/p" : "sections/s"}${String(i).padStart(4, "0")}.md`, text: partText(p, i, paged) }));
  const manifest = {
    schema: "stemma.record/0", id: TEXT, kind: "source_text", created, source: VOLUME, paged, coverage: "all",
    conversion: { method: "ocr", level: "unassessed", recognition: "an invented engine", note: "compared with nothing", tools: [{ name: "stemma-convert", version: "1" }] },
    original: { form: "file", files: [{ sha256: ORIGINAL, size: 10, media_type: "application/pdf" }], obtained_from: "https://example.invalid/book.pdf", acquired_at: AT },
    pages: parts.map((p) => ({ index: p.index, file: p.file, sha256: fileDigest(p.text) })),
    ...made.manifest,
  };
  return {
    settings: file("stemma.json", canonical({ schema: "stemma.project/0", format: 0, project_id: "sourceviewtest" })),
    records: [...made.sources, ...made.records].map((r) => file(recordPath(r.kind, r.id), canonical(r))),
    sources: [
      file("sources/volume1850/source.md", serializeManifest(manifest)),
      ...parts.map((p) => {
        const path = `sources/volume1850/${p.file}`;
        return file(path, made.tamper ? made.tamper(path, p.text) : p.text);
      }),
    ],
    manuscript: [], research: [],
  };
}

export const corpusOf = (change: Partial<Project> = {}, paged = true): Corpus => loadCorpus(content(project(change), paged));
