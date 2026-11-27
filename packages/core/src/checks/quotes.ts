// quote.present (CONTRACT-002 D; SD-007 BR-705 to BR-710): a quotation is in
// the stored text of the cited source, apart from the owner-approved
// differences. It covers the quotations of citation records, note extracts, and
// the quotations of passages that a note, attestation or support record uses.
// It says nothing about the cited page, and a match against recognized text
// shows agreement with that text only.
import { type Corpus, idOf, isObject, type JsonObject, type LoadedFile } from "@stemma/records";
import { result } from "../findings.ts";
import { type Closest, findClosest, findQuotation, FOLD_WORDS, type Found, QUOTE_PROFILE, type Within } from "../matching/quote-fold.ts";
import { labelOf, type StoredText, StoredTexts } from "../matching/stored.ts";
import type { Evidence, Result } from "../report.ts";
import { type BlobReader } from "../store.ts";
import { active, hasManuscript, resolveCitations } from "./bibliography.ts";
import { citedPages } from "./locators.ts";
import { itemOf, subjectOf } from "./records.ts";

const CHECK = "quote.present";

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });
const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });
const stored = (name: string, value: string): Evidence => ({ name, class: "source_text", value });

/** Where to look for a quotation in one stored text. */
interface Search { text: StoredText; within?: Within }

type Verdict =
  | { outcome: "pass"; evidence: Evidence[] }
  | { outcome: "fail"; reason: "near_match" | "absent"; evidence: Evidence[] }
  | { outcome: "unverifiable"; reason: "text_unavailable" | "poor_quality" | "anchor_not_found" | "record_unreadable"; evidence: Evidence[] };

function place(search: Search, start: number, end: number): Evidence[] {
  const { text } = search;
  const pages = text.pagesOf(start, end);
  return [
    at("extraction_file", text.extraction.path),
    ...(pages.length > 0 ? [at("found_on", pages.map((p) => labelOf(text, p)).join("; "))] : []),
    meta("text_method", `${text.method}, quality ${text.level}`),
  ];
}

/**
 * One quotation against the texts that may hold it. A pass names how it was
 * compared; anything else shows the closest stored text where one is close.
 */
export function compareQuotation(quotation: string, searches: Search[], skipped: number): Verdict & { found?: { text: StoredText; pages: number[]; match: Found } } {
  const profile = meta("profile", QUOTE_PROFILE);
  let found: { search: Search; match: Found } | undefined;
  for (const search of searches) {
    const match = findQuotation(search.text.folded(), quotation, search.within);
    if (match && (!found || (found.match.match === "normalized" && match.match === "exact"))) found = { search, match };
  }
  if (found) {
    const { search, match } = found;
    return {
      outcome: "pass",
      evidence: [
        meta("match", match.match), profile,
        ...(match.folds.length > 0 ? [meta("differences_allowed", match.folds.map((f) => FOLD_WORDS[f]).join("; "))] : []),
        ...match.joined.map((word) => stored("joined_at_line_end", word)),
        ...(match.match === "normalized" ? [stored("stored_text", search.text.text.slice(match.start, match.end))] : []),
        ...place(search, match.start, match.end),
      ],
      found: { text: search.text, pages: search.text.pagesOf(match.start, match.end), match },
    };
  }
  if (searches.length === 0) return { outcome: "unverifiable", reason: "text_unavailable", evidence: [profile] };
  let closest: { search: Search; span: Closest } | undefined;
  for (const search of searches) {
    const span = findClosest(search.text.folded(), quotation, search.within);
    if (span && (!closest || span.distance < closest.span.distance)) closest = { search, span };
  }
  const shown = closest ? [
    stored("stored_text", closest.search.text.text.slice(closest.span.start, closest.span.end)),
    ...place(closest.search, closest.span.start, closest.span.end),
  ] : [meta("closest", "no stored passage is close enough to show")];
  const evidence = [meta("match", closest?.span.near ? "near" : "none"), profile, ...shown,
    ...(skipped > 0 ? [meta("not_searched", `${skipped} other stored text(s) of this source could not be used`)] : [])];
  // A text that could not be searched, or only poor text, cannot show that the words are absent.
  if (searches.every((s) => s.text.level === "poor")) return { outcome: "unverifiable", reason: "poor_quality", evidence };
  if (closest?.span.near) return { outcome: "fail", reason: "near_match", evidence };
  if (skipped > 0) return { outcome: "unverifiable", reason: "text_unavailable", evidence };
  return { outcome: "fail", reason: "absent", evidence };
}

const unreadable = (corpus: Corpus): boolean =>
  corpus.records.some((f) => f.state !== "ok" && /^records\/(extractions|captures)\//.test(f.path));

function searchSource(corpus: Corpus, texts: StoredTexts, source: string): { searches: Search[]; skipped: number } {
  const all = texts.extractionsOf(source).map((e) => texts.of(e));
  const searches = all.flatMap((text) => (typeof text === "string" ? [] : [{ text }]));
  return { searches, skipped: all.length - searches.length + (unreadable(corpus) ? 1 : 0) };
}

/** The part of a passage's extraction it points at, or why it cannot be shown. */
function anchor(texts: StoredTexts, passage: JsonObject, corpus: Corpus):
  { verdict: Verdict; span?: { text: StoredText; start: number; end: number } } {
  const extraction = corpus.byId.get(String(passage.extraction));
  const quote = isObject(passage.quote) && typeof passage.quote.exact === "string" ? passage.quote.exact : "";
  const text = extraction?.data?.kind === "extraction" ? texts.of(extraction) : "text_unusable";
  if (typeof text === "string" || passage.text_sha256 !== text.extraction.data!.text_sha256) {
    return { verdict: { outcome: "unverifiable", reason: "text_unavailable", evidence: [meta("profile", QUOTE_PROFILE)] } };
  }
  const position = isObject(passage.position) ? passage.position : undefined;
  const within: Within | undefined = position
    ? (s) => s.start >= text.unit(Number(position.start)) && s.end <= text.unit(Number(position.end)) : undefined;
  const verdict = compareQuotation(quote, [{ text, ...(within ? { within } : {}) }], 0);
  if (verdict.outcome === "pass") return { verdict, span: { text, start: verdict.found!.match.start, end: verdict.found!.match.end } };
  if (within) {
    const elsewhere = findQuotation(text.folded(), quote);
    if (elsewhere) {
      return {
        verdict: {
          outcome: "fail", reason: "absent",
          evidence: [meta("match", "none"), meta("profile", QUOTE_PROFILE),
            meta("problem", "the words are in this text, but not at the position the passage records"), ...place({ text }, elsewhere.start, elsewhere.end)],
        },
      };
    }
  }
  return { verdict };
}

function usedPassages(corpus: Corpus): LoadedFile[] {
  const used = new Set<string>();
  for (const note of active(corpus, "note")) for (const id of [note.data!.passages].flat()) used.add(String(id));
  for (const link of active(corpus, "attestation")) used.add(String(link.data!.evidence));
  for (const record of active(corpus, "support_record")) used.add(String(record.data!.passage));
  return active(corpus, "passage").filter((p) => used.has(idOf(p)!));
}

/** Citation records that hold a quotation count only while no manuscript file is authoritative. */
export const quotationCitations = (corpus: Corpus) =>
  hasManuscript(corpus) ? [] : resolveCitations(corpus).filter(({ citation }) => typeof citation.data!.quotation === "string");

export const quotationSubjects = (corpus: Corpus): number =>
  quotationCitations(corpus).length + usedPassages(corpus).length + active(corpus, "note").filter((n) => n.data!.type === "extract").length;

export function quoteResults(corpus: Corpus, blobs: BlobReader, read: Set<string> = new Set()): Result[] {
  const texts = new StoredTexts(corpus, blobs, read);
  const results: Result[] = [];

  for (const { citation, key, matches } of quotationCitations(corpus)) {
    // A key that names no single source is cite.key's finding.
    if (matches.length !== 1) continue;
    const source = idOf(matches[0]!)!;
    const data = citation.data!;
    const quotation = data.quotation as string;
    const { searches, skipped } = searchSource(corpus, texts, source);
    const verdict = compareQuotation(quotation, searches, skipped);
    const evidence: Evidence[] = [
      at("citation_file", citation.path),
      meta("key", key ?? String(matches[0]!.data!.citation_key ?? source)),
      { name: "cited_text", class: "manuscript", value: quotation },
      ...verdict.evidence,
    ];
    // Information only: the quotation check does not test the cited page.
    const cited = citedPages(data.locator);
    if (verdict.found && cited) {
      const found = verdict.found.pages.map((p) => verdict.found!.text.labels.get(p));
      if (found.every((label) => label !== undefined) && found.length > 0 && !found.some((label) => cited.includes(label!))) {
        evidence.push(meta("cited_page_differs", `found on printed page ${found.join(", ")}; the citation gives ${cited.join(", ")}`));
      }
    }
    const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
      ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;
    results.push(result({
      check: CHECK, outcome: verdict.outcome, ...("reason" in verdict ? { reason: verdict.reason } : {}),
      subject: subjectOf(citation), locus: `${idOf(citation) ?? citation.path}#quotation`, source, evidence,
      item: itemOf(citation), ...(sentence ? { sentence } : {}),
    }));
  }

  const record = (file: LoadedFile, verdict: Verdict, cited: string, locus: string) => {
    results.push(result({
      check: CHECK, outcome: verdict.outcome, ...("reason" in verdict ? { reason: verdict.reason } : {}),
      subject: subjectOf(file), locus: `${idOf(file) ?? file.path}#${locus}`, source: String(file.data!.source),
      evidence: [at("record_file", file.path), { name: "cited_text", class: "source_text", value: cited }, ...verdict.evidence],
      item: itemOf(file),
    }));
  };

  for (const passage of usedPassages(corpus)) {
    const quote = isObject(passage.data!.quote) ? String(passage.data!.quote.exact) : "";
    record(passage, anchor(texts, passage.data!, corpus).verdict, quote, "passage");
  }

  // A note extract is searched only in the passages it is anchored to.
  for (const note of active(corpus, "note").filter((n) => n.data!.type === "extract")) {
    const body = String(note.data!.body);
    const anchors = [note.data!.passages ?? []].flat().flatMap((id) => {
      const passage = corpus.byId.get(String(id));
      const span = passage?.data?.kind === "passage" ? anchor(texts, passage.data, corpus).span : undefined;
      return span ? [span] : [];
    });
    const verdict: Verdict = anchors.length === 0
      ? { outcome: "unverifiable", reason: "anchor_not_found", evidence: [meta("profile", QUOTE_PROFILE)] }
      : compareQuotation(body, anchors.map((a) => ({ text: a.text, within: (s) => s.start >= a.start && s.end <= a.end })), 0);
    record(note, verdict, body, "extract");
  }
  return results;
}
