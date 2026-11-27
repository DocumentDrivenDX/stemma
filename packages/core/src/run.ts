// One run over one parsed corpus, and the single label rule (CONTRACT-002 C).
import { type Corpus, compareCodePoints, corpusDigest, idOf, sha256 } from "@stemma/records";
import { SENTENCE_PROFILE } from "@stemma/manuscript";
import { annotate } from "./annotations.ts";
import { binaryResults } from "./checks/binaries.ts";
import { active, citeKeyResults, hasManuscript, uncitedResults } from "./checks/bibliography.ts";
import { cited, manuscriptOf, positionOf } from "./checks/cited.ts";
import { manuscriptFileResults } from "./checks/manuscript-files.ts";
import { coordinateResults } from "./checks/coordinates.ts";
import { changedResults } from "./checks/changed.ts";
import { claimResults } from "./checks/claims.ts";
import { heldResults } from "./checks/held.ts";
import { locatorResults } from "./checks/locators.ts";
import { identifierResults, resolverResults, sourceMetaResults } from "./checks/metadata.ts";
import { notRun } from "./checks/not-run.ts";
import { numberResults } from "./checks/numbers.ts";
import { originalResults } from "./checks/original.ts";
import { quotePageResults, quoteResults } from "./checks/quotes.ts";
import { activeTexts, footnoteResults, labelResults, pageResults } from "./checks/structure.ts";
import { SourceTexts } from "./matching/texts.ts";
import { coverageOf } from "./verification.ts";
import { fileResults, rulesResults } from "./checks/records.ts";
import { result, sortResults } from "./findings.ts";
import { claimReach, isReviewed } from "./review.ts";
import type { NotRun, ReportBody, Result, Summary, Unreviewed } from "./report.ts";
import { QUOTE_PROFILE } from "./matching/quote-fold.ts";

export function recordResults(corpus: Corpus): Result[] {
  return [corpus.settings, ...corpus.records, ...corpus.partFiles].flatMap(fileResults).concat(rulesResults(corpus));
}

/** A check that throws is reported as unverifiable, never dropped or passed. */
export function guarded(check: string, corpus: Corpus, run: (c: Corpus) => Result[], errors: string[]): Result[] {
  try {
    return run(corpus);
  } catch (error) {
    errors.push(`${check}: ${error instanceof Error ? error.message : "unknown error"}`);
    return [result({ check, outcome: "unverifiable", reason: "check_error", subject: "project", locus: "check" })];
  }
}

export function unreviewedItems(corpus: Corpus): Unreviewed[] {
  const reached = new Map<string, Unreviewed>();
  const add = (record: string, kind: string, reason: Unreviewed["reason"], location: string) => {
    const entry = reached.get(record) ?? { record, kind, reason, locations: [] };
    const seen = listed.get(record) ?? new Set<string>();
    listed.set(record, seen);
    if (!seen.has(location)) entry.locations.push(location);
    seen.add(location);
    reached.set(record, entry);
  };
  // The first claim in effect with each ID.
  const claimsById = new Map([...active(corpus, "claim")].reverse().map((c) => [idOf(c) as unknown, c]));
  const listed = new Map<string, Set<string>>();
  // What the manuscript or the citation records reach: each citation, and in a chapter each claim span.
  const reaches = cited(corpus).uses.map((use) => ({
    location: use.written && use.subject === use.path ? use.where[0]!.value : use.locus, matches: use.matches, claims: use.claims,
  }));
  if (hasManuscript(corpus)) {
    reaches.push(...manuscriptOf(corpus).chapters.flatMap((chapter) => chapter.claims.map((span) => ({
      location: positionOf(chapter.path, span).value, matches: [], claims: span.ids,
    }))));
  }
  for (const { location, matches, claims } of reaches) {
    for (const source of matches) {
      if (source.data!.admission !== "admitted") add(idOf(source)!, "source", "not_admitted", location);
    }
    for (const id of claims) {
      const claim = claimsById.get(id);
      for (const record of claim ? claimReach(corpus, claim) : []) {
        if (!isReviewed(record)) add(idOf(record)!, String(record.data!.kind), "unreviewed", location);
      }
    }
  }
  return [...reached.values()].sort((a, b) => compareCodePoints(a.record, b.record));
}

export function label(results: Result[], skipped: NotRun[]): ReportBody["label"] {
  return results.some((r) => r.open) || skipped.some((n) => n.reason === "not_implemented") ? "open_findings" : "checked_clean";
}

export interface CheckContext {
  texts: SourceTexts;
  /** The versions of the tools this program has, which decide whether a recorded comparison is current. */
  tools: Record<string, string>;
}

/** The checks this version runs. The check reference on the website is generated from this. */
export const IMPLEMENTED_CHECKS: Record<string, (corpus: Corpus, context: CheckContext) => Result[]> = {
  "record.valid": (c) => [...recordResults(c), ...manuscriptFileResults(c)],
  "project.binary": binaryResults,
  "source.held": (c, x) => heldResults(c, x.texts),
  "source.pages": pageResults,
  "source.labels": labelResults,
  "source.footnotes": footnoteResults,
  "source.original": (c, x) => originalResults(c, x.tools),
  "source.changed": (c, x) => changedResults(c, x.texts),
  "cite.key": citeKeyResults,
  "bib.uncited": uncitedResults,
  "quote.present": (c, x) => quoteResults(c, x.texts),
  "quote.page": (c, x) => quotePageResults(c, x.texts),
  "locator.extent": (c, x) => locatorResults(c, x.texts),
  "meta.source": (c, x) => sourceMetaResults(c, x.texts),
  "meta.resolver": (c, x) => resolverResults(c, x.texts),
  "id.resolves": (c, x) => identifierResults(c, x.texts),
  "number.present": (c, x) => numberResults(c, x.texts),
  "claim.complete": claimResults,
  "coordinate.stray": coordinateResults,
};

export function runChecks(corpus: Corpus, tools: Record<string, string>): { body: ReportBody; errors: string[] } {
  const errors: string[] = [];
  const context: CheckContext = { texts: new SourceTexts(corpus), tools };
  const results = annotate(corpus, sortResults(Object.entries(IMPLEMENTED_CHECKS)
    .flatMap(([check, run]) => guarded(check, corpus, (c) => run(c, context), errors))));
  const skipped = notRun(corpus);
  const unreviewed = unreviewedItems(corpus);
  const count = (test: (r: Result) => boolean) => results.filter(test).length;
  const summary: Summary = {
    pass: count((r) => r.outcome === "pass"),
    fail: count((r) => r.outcome === "fail"),
    unverifiable: count((r) => r.outcome === "unverifiable"),
    open: count((r) => r.open),
    dismissed: count((r) => !r.open && r.annotations.some((a) => a.effect === "dismiss")),
    confirmed: count((r) => r.confirmed_by !== undefined),
    unreviewed: unreviewed.length,
    could_not_check: count((r) => r.outcome === "unverifiable"),
    not_implemented: skipped.filter((n) => n.reason === "not_implemented").length,
  };
  const body: ReportBody = {
    mode: "work",
    scope: "all",
    changed: [],
    inputs: {
      corpus_sha256: corpusDigest(corpus),
      manuscript: corpus.manuscript
        .map((f) => ({ path: f.path, sha256: f.bytes ? sha256(f.bytes) : "unreadable" }))
        .sort((a, b) => compareCodePoints(a.path, b.path)),
      research: corpus.research
        .map((f) => ({ path: f.path, sha256: f.bytes ? sha256(f.bytes) : "unreadable" }))
        .sort((a, b) => compareCodePoints(a.path, b.path)),
      profiles: [
        ...(results.some((r) => r.check === "quote.present") ? [QUOTE_PROFILE] : []),
        ...(hasManuscript(corpus) && manuscriptOf(corpus).chapters.length > 0 ? [SENTENCE_PROFILE] : []),
      ],
    },
    tools,
    results,
    not_run: skipped,
    verification: activeTexts(corpus).map(([, text]) => coverageOf(corpus, text, tools)),
    unreviewed,
    redaction: "none",
    label: label(results, skipped),
    summary,
  };
  return { body, errors };
}
