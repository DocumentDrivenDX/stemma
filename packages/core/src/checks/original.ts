// source.original (CONTRACT-002 C): a source file's original is one its upstream
// records name, and the newest fresh conversion of that original, with a
// person's corrections undone, gives the committed text.
import { type Corpus, isObject } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { currentRun, reconversions } from "../verification.ts";
import { active } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";
import { activeTexts } from "./structure.ts";

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });
const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });

export function originalResults(corpus: Corpus, tools: Record<string, string>): Result[] {
  const check = "source.original";
  return activeTexts(corpus).flatMap(([id, text]) => {
    const data = text.manifest.data!;
    const upstreams = active(corpus, "upstream").filter((u) => u.data!.source === data.source);
    const runs = reconversions(corpus, id);
    if (upstreams.length === 0 && runs.length === 0) return [];
    const files = isObject(data.original) && Array.isArray(data.original.files) ? data.original.files.filter(isObject) : [];
    const shared = {
      check, subject: subjectOf(text.manifest), source: String(data.source), item: itemOf(text.manifest),
    };
    const evidence: Evidence[] = [at("source_text", text.manifest.path), ...files.map((f) => meta("original_sha256", String(f.sha256)))];
    if (upstreams.length > 0 && !upstreams.some((u) => files.some((f) => f.sha256 === u.data!.sha256))) {
      return [result({ ...shared, outcome: "fail", reason: "original_not_upstream", locus: `${id}#upstream`, evidence: [...evidence, ...upstreams.map((u) => at("upstream_file", u.path))] })];
    }
    const upstreamWords = upstreams.length > 0 ? [meta("upstream", "the original's digest matches an upstream record")] : [];
    if (runs.length === 0) {
      return [result({ ...shared, outcome: "pass", locus: id, evidence: [...evidence, ...upstreamWords, meta("fresh_conversion", "none recorded: this says nothing about the text against the original")] })];
    }
    const run = runs.find((r) => currentRun(r.data!, text, tools));
    if (!run) {
      return [result({ ...shared, outcome: "unverifiable", reason: "comparison_stale", locus: id, evidence: [...evidence, at("comparison_file", runs[0]!.path)] })];
    }
    const pages = (Array.isArray(run.data!.pages) ? run.data!.pages : []).filter(isObject);
    const differing = pages.filter((p) => Number(p.differing_words) > 0);
    if (differing.length > 0) {
      const shown: Evidence[] = differing.slice(0, 5).flatMap((p) => (Array.isArray(p.differences) ? p.differences : []).filter(isObject).slice(0, 2).flatMap((d): Evidence[] => [
        { name: `committed_reading_at_index_${String(p.index)}`, class: "source_text", value: String(d.reading) },
        { name: `fresh_reading_at_index_${String(p.index)}`, class: "source_text", value: String(d.other) },
      ]));
      return [result({
        ...shared, outcome: "fail", reason: "conversion_differs", locus: `${id}#conversion`,
        evidence: [...evidence, at("comparison_file", run.path), meta("differing", `${differing.length} of ${pages.length} parts differ, at index ${differing.slice(0, 20).map((p) => String(p.index)).join(", ")}`), ...shown],
      })];
    }
    return [result({ ...shared, outcome: "pass", locus: id, evidence: [...evidence, ...upstreamWords, at("comparison_file", run.path), meta("fresh_conversion", `all ${pages.length} parts agree with a fresh conversion of the original`)] })];
  });
}
