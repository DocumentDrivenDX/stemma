// One run over one parsed corpus, and the single label rule (CONTRACT-002 C).
import { type Corpus, compareCodePoints, corpusDigest, idOf, sha256 } from "@stemma/records";
import { active, citeKeyResults, resolveCitations, uncitedResults } from "./checks/bibliography.ts";
import { coordinateResults } from "./checks/coordinates.ts";
import { heldResults } from "./checks/held.ts";
import { notRun } from "./checks/not-run.ts";
import { fileResults, rulesResults } from "./checks/records.ts";
import { result, sortResults } from "./findings.ts";
import type { NotRun, ReportBody, Result, Summary, Unreviewed } from "./report.ts";
import { type BlobReader, NO_STORE } from "./store.ts";

export function recordResults(corpus: Corpus): Result[] {
  return [corpus.settings, ...corpus.records].flatMap(fileResults).concat(rulesResults(corpus));
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

function unreviewedItems(corpus: Corpus): Unreviewed[] {
  const reached = new Map<string, Unreviewed>();
  const add = (record: string, kind: string, reason: Unreviewed["reason"], location: string) => {
    const entry = reached.get(record) ?? { record, kind, reason, locations: [] };
    if (!entry.locations.includes(location)) entry.locations.push(location);
    reached.set(record, entry);
  };
  for (const { citation, matches } of resolveCitations(corpus)) {
    const location = idOf(citation) ?? citation.path;
    for (const source of matches) {
      if (source.data!.admission !== "admitted") add(idOf(source)!, "source", "not_admitted", location);
    }
    const claims = citation.data!.claims;
    for (const id of Array.isArray(claims) ? claims : []) {
      const claim = active(corpus, "claim").find((c) => idOf(c) === id);
      const review = claim?.data!.review as { state?: string } | undefined;
      if (claim && review?.state !== "reviewed") add(String(id), "claim", "unreviewed", location);
    }
  }
  return [...reached.values()].sort((a, b) => compareCodePoints(a.record, b.record));
}

export function label(results: Result[], skipped: NotRun[]): ReportBody["label"] {
  return results.some((r) => r.open) || skipped.some((n) => n.reason === "not_implemented") ? "open_findings" : "checked_clean";
}

/** The checks this version runs. The check reference on the website is generated from this. */
export const IMPLEMENTED_CHECKS: Record<string, (corpus: Corpus, blobs: BlobReader, read: Set<string>) => Result[]> = {
  "record.valid": recordResults,
  "cite.key": citeKeyResults,
  "bib.uncited": uncitedResults,
  "source.held": heldResults,
  "coordinate.stray": coordinateResults,
};

export function runChecks(corpus: Corpus, tools: Record<string, string>, blobs: BlobReader = NO_STORE): { body: ReportBody; errors: string[] } {
  const errors: string[] = [];
  const read = new Set<string>();
  const results = sortResults(Object.entries(IMPLEMENTED_CHECKS)
    .flatMap(([check, run]) => guarded(check, corpus, (c) => run(c, blobs, read), errors)));
  const skipped = notRun(corpus);
  const unreviewed = unreviewedItems(corpus);
  const count = (test: (r: Result) => boolean) => results.filter(test).length;
  const summary: Summary = {
    pass: count((r) => r.outcome === "pass"),
    fail: count((r) => r.outcome === "fail"),
    unverifiable: count((r) => r.outcome === "unverifiable"),
    open: count((r) => r.open),
    dismissed: 0,
    confirmed: 0,
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
      blobs: [...read].sort(),
      profiles: [],
    },
    tools,
    results,
    not_run: skipped,
    unreviewed,
    redaction: "none",
    label: label(results, skipped),
    summary,
  };
  return { body, errors };
}
