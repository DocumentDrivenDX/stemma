// Record states for the graph export (CONTRACT-005 J, `stemma.states/0`). Only
// states that can be computed from the files the data identity covers (record
// files, stemma.json, rules.md, source files and manuscript files) are given.
// A record with no state has not been shown to be clear of anything.
import { compareCodePoints, type Corpus, idOf, isObject, isRetired, type LoadedFile } from "@stemma/records";
import { annotate } from "./annotations.ts";
import { itemOf } from "./checks/records.ts";
import { sortResults } from "./findings.ts";
import { SourceTexts } from "./matching/texts.ts";
import type { Result } from "./report.ts";
import { guarded, IMPLEMENTED_CHECKS, unreviewedItems } from "./run.ts";

export type RecordState = "unreviewed" | "retired_link" | "support_missing" | "support_stale" | "support_unsupported" | "annotated" | "open_finding";

export const COMPUTED_STATES: RecordState[] = ["unreviewed", "retired_link", "annotated", "open_finding"];
export const NOT_COMPUTED_STATES: RecordState[] = ["support_missing", "support_stale", "support_unsupported"];

/**
 * The checks behind `open_finding` and `annotated`: each reads nothing but what
 * the data identity covers, and not the tools on this machine or a saved
 * catalogue lookup.
 */
export const STATE_CHECKS = [
  "record.valid", "source.held", "source.pages", "source.labels", "source.footnotes", "source.changed",
  "cite.key", "bib.uncited", "quote.present", "quote.page", "locator.extent", "number.present",
];

/** The other checks this version runs, with why their findings give no state. */
export const CHECKS_WITHOUT_STATE: Record<string, string> = {
  "project.binary": "reads which files git holds",
  "source.original": "depends on the versions of the conversion tools",
  "meta.source": "reads saved catalogue lookups",
  "meta.resolver": "reads saved catalogue lookups",
  "id.resolves": "reads saved catalogue lookups",
  "coordinate.stray": "reads research notes",
};

export interface RecordStates {
  /** States by record ID, for records that are not retired; each list is sorted. */
  records: Map<string, RecordState[]>;
  computed: RecordState[];
  not_computed: RecordState[];
  checks: string[];
  /** Checks whose findings give no state: left out by design, or failed in this run. */
  checks_left_out: { check: string; why: string }[];
}

/** The record a finding is about: its subject or bound record, or the source file a part belongs to. */
function recordOf(corpus: Corpus, found: Result, byPath: Map<string, string>): string | undefined {
  if (corpus.byId.has(found.subject)) return found.subject;
  if (found.item && corpus.byId.has(found.item.record)) return found.item.record;
  return byPath.get(found.subject) ?? byPath.get(found.subject.replace(/^(sources\/[^/]+)\/.*$/, "$1/source.md"));
}

export function recordStates(corpus: Corpus): RecordStates {
  const found = new Map<string, Set<RecordState>>();
  const live = (file: LoadedFile) => file.state === "ok" && file.data !== undefined && !isRetired(file.data) && idOf(file) !== undefined;
  const add = (id: string, state: RecordState) => {
    const file = corpus.byId.get(id);
    if (file && live(file)) found.set(id, (found.get(id) ?? new Set()).add(state));
  };

  for (const item of unreviewedItems(corpus)) add(item.record, "unreviewed");
  for (const file of corpus.records.filter(live)) {
    const id = idOf(file)!;
    const { review } = file.data!;
    // CONTRACT-001 G: a review mark applies only while the content is what was reviewed.
    if (isObject(review) && (review.state !== "reviewed" || review.content_sha256 !== itemOf(file)!.content_sha256)) add(id, "unreviewed");
    const retired = file.references.some((r) => {
      if (/^\/(legacy|retired)\//.test(r.field)) return false;
      const target = corpus.byId.get(r.id);
      return target?.data !== undefined && isRetired(target.data);
    });
    if (retired) add(id, "retired_link");
  }

  const context = { texts: new SourceTexts(corpus), tools: {} };
  const left = Object.entries(CHECKS_WITHOUT_STATE).map(([check, why]) => ({ check, why }));
  const ran: string[] = [];
  const results = STATE_CHECKS.flatMap((check) => {
    const errors: string[] = [];
    const out = guarded(check, corpus, (c) => IMPLEMENTED_CHECKS[check]!(c, context), errors);
    if (errors.length > 0) {
      left.push({ check, why: "failed to run, which is a Stemma defect" });
      return [];
    }
    ran.push(check);
    return out;
  });
  const byPath = new Map(corpus.records.filter(live).map((f) => [f.path, idOf(f)!]));
  for (const result of annotate(corpus, sortResults(results))) {
    const record = recordOf(corpus, result, byPath);
    if (record === undefined) continue;
    if (result.open) add(record, "open_finding");
    if (result.annotations.length > 0) add(record, "annotated");
  }

  return {
    records: new Map([...found].sort(([a], [b]) => compareCodePoints(a, b)).map(([id, states]) => [id, [...states].sort()])),
    computed: [...COMPUTED_STATES],
    not_computed: [...NOT_COMPUTED_STATES],
    checks: ran,
    checks_left_out: left.sort((a, b) => compareCodePoints(a.check, b.check)),
  };
}
