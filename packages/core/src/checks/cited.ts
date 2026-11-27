// What the project cites, quotes and locates now (CONTRACT-002 C, "Reading the
// manuscript"). With manuscript files, they are authoritative: a citation record
// then keeps only what was first written. Without them, the citation records say.
import { type Corpus, idOf, isObject, isRetired, type JsonObject, type LoadedFile, sha256 } from "@stemma/records";
import { type Chapter, type Citation, type Manuscript, type Position, type Quotation, readManuscript } from "@stemma/manuscript";
import type { Evidence, Result } from "../report.ts";
import { once } from "../corpus-index.ts";
import { hasManuscript, resolveCitations, sourcesByKey } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

export const manuscriptOf = (corpus: Corpus): Manuscript => once(corpus, "manuscript", () => readManuscript(corpus.manuscript));

/** One citation: an item in a chapter file, or without a manuscript a citation record. */
export interface Use {
  subject: string;
  /** The stable pointer within the project that findings about this citation share. */
  locus: string;
  /** The citation key. A record may name its source instead. */
  key?: string;
  /** The sources in effect that it names. */
  matches: LoadedFile[];
  locator?: JsonObject;
  sentence?: { text: string; sha256: string };
  /** What an annotation binds when there is no sentence. */
  item?: Result["item"];
  /** The chapter file that holds it, or the record's file. */
  path: string;
  /** Where it is, for evidence. */
  where: Evidence[];
  /** The citation record: this one, or the one a manuscript item names, which is then history. */
  record?: LoadedFile;
  /** Whether a chapter file holds it. */
  written: boolean;
  /** The claims of the claim spans around it, or those its record names. */
  claims: string[];
}

export interface QuotedUse {
  use: Use;
  text: string;
  /** The pointer of this quotation's findings, without the check's suffix. */
  locus: string;
}

export interface Unattributed {
  subject: string;
  locus: string;
  text: string;
  where: Evidence[];
  sentence?: { text: string; sha256: string };
}

/** One sentence with citations, for the figures in it. */
export interface CitingSentence {
  uses: Use[];
  /** Its words without quotations, or as recorded. */
  text: string;
  quotation?: string;
  locators: string[];
  /** Whether it cites more than one source, so that which holds a figure cannot be told. */
  several: boolean;
}

interface Cited {
  uses: Use[];
  quoted: QuotedUse[];
  unattributed: Unattributed[];
  sentences: CitingSentence[];
}

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });

export const positionOf = (path: string, place: Position): Evidence =>
  at("manuscript_position", `${path}, line ${place.line}, column ${place.column}`);

const sentenceIn = (data: JsonObject) => isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
  ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;

function fromRecords(corpus: Corpus): Cited {
  const out: Cited = { uses: [], quoted: [], unattributed: [], sentences: [] };
  for (const { citation, key, matches } of resolveCitations(corpus)) {
    const data = citation.data!;
    const sentence = sentenceIn(data);
    const claims = Array.isArray(data.claims) ? data.claims.map(String) : [];
    const use: Use = {
      subject: subjectOf(citation), locus: idOf(citation) ?? citation.path, matches,
      path: citation.path, where: [at("citation_file", citation.path)],
      record: citation, written: false, claims, item: itemOf(citation),
      ...(key !== undefined ? { key } : {}), ...(isObject(data.locator) ? { locator: data.locator } : {}), ...(sentence ? { sentence } : {}),
    };
    out.uses.push(use);
    if (typeof data.quotation === "string") out.quoted.push({ use, text: data.quotation, locus: use.locus });
  }
  // A record holds one citation and its sentence, so records that share a sentence cite it together.
  const sharing = new Map<unknown, number>();
  for (const use of out.uses) {
    const { sentence } = use.record!.data!;
    if (isObject(sentence)) sharing.set(sentence.sha256, (sharing.get(sentence.sha256) ?? 0) + 1);
  }
  for (const use of out.uses) {
    const { sentence, quotation } = use.record!.data!;
    if (!isObject(sentence) || typeof sentence.text !== "string") continue;
    out.sentences.push({
      uses: [use], text: sentence.text, several: sharing.get(sentence.sha256)! > 1,
      locators: use.locator ? [String(use.locator.value)] : [], ...(typeof quotation === "string" ? { quotation } : {}),
    });
  }
  return out;
}

/** Counts equal things in reading order, so that no two share a pointer. */
function ordinals(): (parts: string[]) => string {
  const seen = new Map<string, number>();
  return (parts) => {
    const key = JSON.stringify(parts);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return JSON.stringify([...parts, n]);
  };
}

function fromChapter(corpus: Corpus, chapter: Chapter, sources: (key: string) => LoadedFile[], out: Cited): void {
  const next = ordinals();
  const nextQuotation = ordinals();
  const claimsAround = new Map<Citation, string[]>();
  for (const span of chapter.claims) {
    for (const citation of span.citations) claimsAround.set(citation, [...new Set([...claimsAround.get(citation) ?? [], ...span.ids])]);
  }
  const sentenceOf = (index: number | undefined) => {
    const sentence = index === undefined ? undefined : chapter.sentences[index];
    // A block that holds only citations has no words to bind to.
    return sentence && sentence.text !== "" ? { text: sentence.text, sha256: sentence.sha256 } : undefined;
  };
  const shown = (sentence: { text: string } | undefined): Evidence[] =>
    sentence ? [{ name: "sentence", class: "manuscript", value: sentence.text }] : [];

  const used = new Map<Citation, Use>();
  const bySentence = new Map<number, Use[]>();
  for (const citation of chapter.citations) {
    const sentence = sentenceOf(citation.sentence);
    const { key, id, locator } = citation;
    const counted = next([chapter.sentences[citation.sentence]!.sha256, key, locator?.label ?? "", locator?.value ?? ""]);
    const named = id === undefined ? undefined : corpus.byId.get(id);
    const record = named?.data?.kind === "citation" ? named : undefined;
    const use: Use = {
      subject: id ?? chapter.path, locus: id ?? `${chapter.id}#${counted}`, key, matches: key === "?" ? [] : sources(key),
      path: chapter.path, where: [positionOf(chapter.path, citation), ...shown(sentence)], written: true, claims: claimsAround.get(citation) ?? [],
      ...(locator ? { locator: { label: locator.label, value: locator.value } } : {}), ...(sentence ? { sentence } : {}),
      ...(record ? { record } : {}),
    };
    used.set(citation, use);
    out.uses.push(use);
    const together = bySentence.get(citation.sentence);
    if (together) together.push(use);
    else bySentence.set(citation.sentence, [use]);
  }

  const words = new Map<number, Quotation[]>();
  const blocks: string[] = [];
  for (const quotation of chapter.quotations) {
    if (quotation.form === "block") blocks.push(quotation.text);
    else if (quotation.sentence !== undefined) words.set(quotation.sentence, [...words.get(quotation.sentence) ?? [], quotation]);
    if (quotation.text === "") continue;
    const use = quotation.citation ? used.get(quotation.citation) : undefined;
    const digest = sha256(quotation.text);
    if (use) {
      out.quoted.push({ use: { ...use, where: [positionOf(chapter.path, quotation), ...shown(use.sentence)] }, text: quotation.text,
        locus: `${use.locus}#${nextQuotation([use.locus, digest])}` });
    } else {
      const sentence = sentenceOf(quotation.sentence);
      out.unattributed.push({
        subject: chapter.path, text: quotation.text, ...(sentence ? { sentence } : {}),
        locus: `${chapter.id}#${nextQuotation([sentence?.sha256 ?? "", digest])}`,
        where: [positionOf(chapter.path, quotation), ...shown(sentence)],
      });
    }
  }

  for (const [index, uses] of bySentence) {
    const sentence = chapter.sentences[index]!;
    // The figures of a block quotation are quoted words, which quote.present compares.
    if (chapter.blocks[sentence.block]!.quoted && blocks.some((b) => b.includes(sentence.text.replace(/^["“]|["”]$/g, "")))) continue;
    let text = sentence.text;
    for (const quotation of words.get(index) ?? []) text = text.split(quotation.text).join(" ");
    const named = new Set(uses.map((u) => (u.matches.length === 1 ? idOf(u.matches[0]!)! : `key ${u.key}`)));
    out.sentences.push({ uses, text, several: named.size > 1, locators: uses.flatMap((u) => (u.locator ? [String(u.locator.value)] : [])) });
  }
}

/** The record's content while it is in effect. A chapter file may name a retired one. */
export const liveRecord = (use: Use): JsonObject | undefined =>
  use.record?.data && !isRetired(use.record.data) ? use.record.data : undefined;

export const cited = (corpus: Corpus): Cited => once(corpus, "cited", () => {
  if (!hasManuscript(corpus)) return fromRecords(corpus);
  const byKey = sourcesByKey(corpus);
  const out: Cited = { uses: [], quoted: [], unattributed: [], sentences: [] };
  for (const chapter of manuscriptOf(corpus).chapters) fromChapter(corpus, chapter, (key) => byKey.get(key) ?? [], out);
  return out;
});
