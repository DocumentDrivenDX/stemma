// quote.present and quote.page (CONTRACT-002 D; SD-007 BR-705 to BR-715).
// quote.present: a quotation is in the cited source's text, apart from the
// owner-approved differences; a passage's words are the words at its address;
// and a citation made from a passage still says what the passage says.
// quote.page: the words are on the cited pages, or in the cited chapter or
// paragraph. A match against recognized text shows agreement with that text only.
import { canonical, type Corpus, idOf, isObject, type JsonObject, type LoadedFile, sha256 } from "@stemma/records";
import { result } from "../findings.ts";
import { type Closest, findClosest, findQuotation, FOLD_WORDS, type Found, QUOTE_PROFILE, renderQuotation, type Span, type Within } from "../matching/quote-fold.ts";
import { paragraphNumbers, placeOf, SourceTexts, type StreamName, type TextView } from "../matching/texts.ts";
import { addressText, textAt } from "../passages.ts";
import type { Evidence, Result } from "../report.ts";
import { active, hasManuscript } from "./bibliography.ts";
import { cited, manuscriptOf, positionOf, type QuotedUse, type Unattributed } from "./cited.ts";
import { citedPages, locatorParts, numberOf } from "./locators.ts";
import { itemOf, subjectOf } from "./records.ts";

const CHECK = "quote.present";

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });
const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });
const sourceText = (name: string, value: string): Evidence => ({ name, class: "source_text", value });

/** Where to look for a quotation in one stream of one source file. */
interface Search { view: TextView; stream: StreamName; within?: Within; /** The stretch `within` holds a span to. */ region?: Span }

type Verdict =
  | { outcome: "pass"; evidence: Evidence[] }
  | { outcome: "fail"; reason: "near_match" | "absent" | "passage_differs" | "citation_differs"; evidence: Evidence[] }
  | { outcome: "unverifiable"; reason: "text_unavailable" | "poor_quality" | "anchor_not_found"; evidence: Evidence[] };

function place(search: Search, start: number, end: number): Evidence[] {
  const { view, stream } = search;
  const indexes = view.partsOf(stream, start, end);
  return [
    at("source_text", view.loaded.manifest.path),
    at("found_on", `${indexes.map((i) => placeOf(view, i)).join("; ")}${stream === "notes" ? ", in a note" : ""}`),
    at("address", addressText(view.id, view.address(stream, start, end))),
    meta("text_method", `${view.method}, quality ${view.level}`),
  ];
}

/**
 * One quotation against the streams that may hold it. A pass names how it was
 * compared; anything else shows the closest source text where one is close.
 */
export function compareQuotation(quotation: string, searches: Search[], skipped: number): Verdict {
  const profile = meta("profile", QUOTE_PROFILE);
  let found: { search: Search; match: Found } | undefined;
  for (const search of searches) {
    const match = findQuotation(search.view.folded(search.stream), quotation, search.within);
    if (match && (!found || (found.match.match === "normalized" && match.match === "exact"))) found = { search, match };
  }
  if (found) {
    const { search, match } = found;
    return {
      outcome: "pass",
      evidence: [
        meta("match", match.match), profile,
        ...(match.folds.length > 0 ? [meta("differences_allowed", match.folds.map((f) => FOLD_WORDS[f]).join("; "))] : []),
        ...match.joined.map((word) => sourceText("joined_at_line_end", word)),
        ...(match.match === "normalized" ? [sourceText("source_passage", search.view.streams[search.stream].text.slice(match.start, match.end))] : []),
        ...place(search, match.start, match.end),
      ],
    };
  }
  if (searches.length === 0) return { outcome: "unverifiable", reason: "text_unavailable", evidence: [profile] };
  let closest: { search: Search; span: Closest } | undefined;
  for (const search of searches) {
    const span = findClosest(search.view.folded(search.stream), quotation, search.within, search.region);
    if (span && (!closest || span.distance < closest.span.distance)) closest = { search, span };
  }
  const shown = closest ? [
    sourceText("source_passage", closest.search.view.streams[closest.search.stream].text.slice(closest.span.start, closest.span.end)),
    ...place(closest.search, closest.span.start, closest.span.end),
  ] : [meta("closest", "no passage of the source text is close enough to show")];
  const evidence = [meta("match", closest?.span.near ? "near" : "none"), profile, ...shown,
    ...(skipped > 0 ? [meta("not_searched", `${skipped} other source file(s) of this source could not be used`)] : [])];
  // A text that could not be searched, or only poor text, cannot show that the words are absent.
  if (searches.every((s) => s.view.level === "poor")) return { outcome: "unverifiable", reason: "poor_quality", evidence };
  if (closest?.span.near) return { outcome: "fail", reason: "near_match", evidence };
  if (skipped > 0) return { outcome: "unverifiable", reason: "text_unavailable", evidence };
  return { outcome: "fail", reason: "absent", evidence };
}

const searchesOf = (views: TextView[]): Search[] =>
  views.flatMap((view) => (["main", "notes"] as const).filter((s) => view.streams[s].text !== "").map((stream) => ({ view, stream })));

/** The passage's words are the words at its address, copied unchanged. */
function passageVerdict(texts: SourceTexts, passage: JsonObject): Verdict {
  const quote = isObject(passage.quote) && typeof passage.quote.exact === "string" ? passage.quote.exact : "";
  const now = textAt(texts, passage);
  if (now.state === "unavailable") return { outcome: "unverifiable", reason: "text_unavailable", evidence: [meta("profile", QUOTE_PROFILE)] };
  if (now.state === "changed") {
    return { outcome: "fail", reason: "passage_differs", evidence: [meta("problem", `the page or section at index ${now.index} changed after the passage was captured`)] };
  }
  if (now.text !== quote) {
    return {
      outcome: "fail", reason: "passage_differs",
      evidence: [meta("problem", "the words recorded are not the words at the passage's address"), sourceText("source_passage", now.text)],
    };
  }
  return {
    outcome: "pass",
    evidence: [meta("match", "exact"), meta("profile", QUOTE_PROFILE), at("source_text", now.view.loaded.manifest.path),
      at("found_on", now.indexes.map((i) => placeOf(now.view, i)).join("; ")), meta("text_method", `${now.view.method}, quality ${now.view.level}`)],
  };
}

/** How a citation made from a passage departs from it, if it does. */
function departures(corpus: Corpus, citation: JsonObject): Evidence[] | undefined {
  if (citation.passage === undefined) return undefined;
  const passage = corpus.byId.get(String(citation.passage))?.data;
  if (passage?.kind !== "passage" || !isObject(passage.quote)) return undefined;
  const expected = renderQuotation(String(passage.quote.exact));
  const out: Evidence[] = [];
  if (citation.quotation !== expected) out.push(sourceText("passage_quotation", expected));
  if (citation.locator === undefined || canonical(citation.locator) !== canonical(passage.locator)) {
    out.push(meta("passage_locator", isObject(passage.locator) ? `${String(passage.locator.label)} ${String(passage.locator.value)}` : "none"));
  }
  return out.length > 0 ? out : undefined;
}

function usedPassages(corpus: Corpus): LoadedFile[] {
  const used = new Set<string>();
  for (const note of active(corpus, "note")) for (const id of [note.data!.passages].flat()) used.add(String(id));
  for (const link of active(corpus, "attestation")) used.add(String(link.data!.evidence));
  for (const record of active(corpus, "support_record")) used.add(String(record.data!.passage));
  for (const record of active(corpus, "citation")) used.add(String(record.data!.passage));
  return active(corpus, "passage").filter((p) => used.has(idOf(p)!));
}

/** A quoted-looking span whose citation cannot be told (CONTRACT-006 D). */
const unattributed = (found: Unattributed): Result => result({
  check: CHECK, outcome: "unverifiable", reason: "unattributed_quotation", subject: found.subject, locus: `${found.locus}#quotation`,
  evidence: [...found.where, { name: "cited_text", class: "manuscript", value: found.text }],
  ...(found.sentence ? { sentence: found.sentence } : {}),
});

/** A mark with no partner hides what it quotes. One result for each line that holds one. */
function unpairedResults(corpus: Corpus): Result[] {
  if (!hasManuscript(corpus)) return [];
  const files = new Map(corpus.manuscript.map((f) => [f.path, f]));
  return manuscriptOf(corpus).chapters.flatMap((chapter) => {
    if (chapter.unpairedQuoteMarks.length === 0) return [];
    const lines = new TextDecoder().decode(files.get(chapter.path)!.bytes).replace(/\r\n/g, "\n").split("\n");
    const byLine = new Map<number, number>();
    for (const mark of chapter.unpairedQuoteMarks) if (!byLine.has(mark.line)) byLine.set(mark.line, mark.column);
    const seen = new Map<string, number>();
    return [...byLine].sort(([a], [b]) => a - b).map(([line, column]) => {
      // The line's own digest, so that a note on this finding does not outlast its words.
      const digest = sha256(lines[line - 1] ?? "");
      const n = seen.get(digest) ?? 0;
      seen.set(digest, n + 1);
      return result({
        check: CHECK, outcome: "unverifiable", reason: "unpaired_quote_mark", subject: chapter.path,
        locus: `${chapter.id}#unpaired#${digest}#${n}`, evidence: [positionOf(chapter.path, { line, column })],
      });
    });
  });
}

export function quoteResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const results: Result[] = [];

  for (const { use, text: quotation, locus } of cited(corpus).quoted) {
    const { key, matches } = use;
    // A key that names no single source is cite.key's finding.
    if (matches.length !== 1) continue;
    const source = idOf(matches[0]!)!;
    const { views, unusable } = texts.of(source);
    // A record's quotation and locator are history once the manuscript says what is quoted.
    const departed = use.written ? undefined : departures(corpus, use.record!.data!);
    const verdict: Verdict = departed
      ? { outcome: "fail", reason: "citation_differs", evidence: departed }
      : compareQuotation(quotation, searchesOf(views), unusable);
    results.push(result({
      check: CHECK, outcome: verdict.outcome, ...("reason" in verdict ? { reason: verdict.reason } : {}),
      subject: use.subject, locus: `${locus}#quotation`, source,
      evidence: [...use.where, meta("key", key ?? String(matches[0]!.data!.citation_key ?? source)),
        { name: "cited_text", class: "manuscript", value: quotation }, ...verdict.evidence],
      ...(use.item ? { item: use.item } : {}), ...(use.sentence ? { sentence: use.sentence } : {}),
    }));
  }
  results.push(...cited(corpus).unattributed.map(unattributed), ...unpairedResults(corpus));

  const record = (file: LoadedFile, verdict: Verdict, cited: string, locus: string) => {
    results.push(result({
      check: CHECK, outcome: verdict.outcome, ...("reason" in verdict ? { reason: verdict.reason } : {}),
      subject: subjectOf(file), locus: `${idOf(file) ?? file.path}#${locus}`, source: String(file.data!.source),
      evidence: [at("record_file", file.path), sourceText("cited_text", cited), ...verdict.evidence],
      item: itemOf(file),
    }));
  };

  for (const passage of usedPassages(corpus)) {
    record(passage, passageVerdict(texts, passage.data!), isObject(passage.data!.quote) ? String(passage.data!.quote.exact) : "", "passage");
  }

  // A note extract is searched only in the passages it is anchored to.
  for (const note of active(corpus, "note").filter((n) => n.data!.type === "extract")) {
    const body = String(note.data!.body);
    const searches = [note.data!.passages ?? []].flat().flatMap((id): Search[] => {
      const passage = corpus.byId.get(String(id))?.data;
      const now = passage?.kind === "passage" ? textAt(texts, passage) : undefined;
      if (now?.state !== "ok") return [];
      const found = findQuotation(now.view.folded(now.stream), now.text);
      return found ? [{ view: now.view, stream: now.stream, within: (s) => s.start >= found.start && s.end <= found.end, region: found }] : [];
    });
    record(note, searches.length === 0
      ? { outcome: "unverifiable", reason: "anchor_not_found", evidence: [meta("profile", QUOTE_PROFILE)] }
      : compareQuotation(body, searches, 0), body, "extract");
  }
  return results;
}

interface Occurrence { view: TextView; stream: StreamName; start: number; end: number }

function occurrences(views: TextView[], quotation: string, most = 50): Occurrence[] {
  const out: Occurrence[] = [];
  for (const { view, stream } of searchesOf(views)) {
    let after = -1;
    while (out.length < most) {
      let found = findQuotation(view.folded(stream), quotation, (s) => s.start > after);
      if (!found) break;
      for (let earlier; (earlier = findQuotation(view.folded(stream), quotation, (s) => s.start > after && s.start < found!.start)); ) found = earlier;
      after = found.start;
      out.push({ view, stream, start: found.start, end: found.end });
    }
  }
  return out;
}

type Where = "covered" | "partly" | "elsewhere" | "unknown";

const sameNumber = (a: string, b: string) => {
  const [x, y] = [numberOf(a.toUpperCase()) ?? numberOf(a.toLowerCase()), numberOf(b.toUpperCase()) ?? numberOf(b.toLowerCase())];
  return x && y ? x.value === y.value : a.toLowerCase() === b.toLowerCase();
};

/** Where one occurrence lies against what a locator cites. */
function whereIs(o: Occurrence, term: string, cited: string[]): Where {
  const parts = o.view.partsOf(o.stream, o.start, o.end).map((i) => o.view.part(i)!);
  const among = (found: string[], same: (a: string, b: string) => boolean): Where => {
    const inside = found.filter((f) => cited.some((c) => same(c, f))).length;
    return inside === found.length ? "covered" : inside > 0 ? "partly" : "elsewhere";
  };
  if (term === "page" || term === "folio") {
    if (!o.view.paged || parts.some((p) => p.label === undefined)) return "unknown";
    return among(parts.map((p) => p.label!), (a, b) => a === b);
  }
  if (term === "chapter") {
    return parts.some((p) => p.chapter === undefined) ? "unknown" : among(parts.map((p) => p.chapter!), sameNumber);
  }
  if (term === "paragraph" && o.stream === "main" && !o.view.paged) {
    const numbers = parts.flatMap((p) => {
      const span = o.view.streams.main.spans.find((s) => s.index === p.index)!;
      return paragraphNumbers(p, o.start - span.start, o.end - span.start).map(String);
    });
    return numbers.length === 0 ? "unknown" : among(numbers, (a, b) => a === b);
  }
  return "unknown";
}

/** The labels a locator cites, for the terms this check reads. */
function citedLabels(locator: JsonObject): string[] | undefined {
  const term = String(locator.label);
  if (term === "page" || term === "folio") return citedPages(locator);
  if (term !== "chapter" && term !== "paragraph") return undefined;
  return locatorParts(String(locator.value), locator.end).flatMap((p) => {
    const [a, b] = [Number(p.first), Number(p.last)];
    return p.first !== p.last && Number.isInteger(a) && Number.isInteger(b) && b >= a && b - a < 100
      ? Array.from({ length: b - a + 1 }, (_, i) => String(a + i)) : [p.first, ...(p.last === p.first ? [] : [p.last])];
  });
}

const PAGE_TERMS = ["page", "folio", "chapter", "paragraph"];

const pageQuotations = (corpus: Corpus): QuotedUse[] =>
  cited(corpus).quoted.filter(({ use }) => PAGE_TERMS.includes(String(use.locator?.label)));

export function quotePageResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  return pageQuotations(corpus).flatMap(({ use, text, locus }) => {
    const { key, matches } = use;
    if (matches.length !== 1) return [];
    const source = idOf(matches[0]!)!;
    const locator = use.locator!;
    const named = citedLabels(locator);
    const found = occurrences(texts.of(source).views, text);
    // Words that are not found are quote.present's finding; an unreadable locator is locator.extent's.
    if (!named || found.length === 0) return [];
    const judged = found.map((o) => ({ o, where: whereIs(o, String(locator.label), named) }));
    const best = (["covered", "partly", "elsewhere", "unknown"] as const).find((w) => judged.some((j) => j.where === w))!;
    const shown = judged.filter((j) => j.where === best).slice(0, 5);
    const outcome = best === "covered" ? "pass" : best === "unknown" ? "unverifiable" : "fail";
    const reason = best === "partly" ? "partly_on_page" : best === "elsewhere" ? "wrong_page" : best === "unknown" ? "place_unknown" : undefined;
    return [result({
      check: "quote.page", outcome, ...(reason ? { reason } : {}), subject: use.subject, locus: `${locus}#page`, source,
      evidence: [
        ...use.where, meta("key", key ?? String(matches[0]!.data!.citation_key ?? source)),
        // A chapter can hold several quotations under one citation, so each is shown.
        ...(use.written ? [{ name: "cited_text", class: "manuscript" as const, value: text }] : []),
        { name: "locator", class: "manuscript", value: `${String(locator.label)} ${String(locator.value)}` },
        ...shown.flatMap((j) => place(j.o, j.o.start, j.o.end).slice(0, 3)),
      ],
      ...(use.item ? { item: use.item } : {}), ...(use.sentence ? { sentence: use.sentence } : {}),
    })];
  });
}
