// Comparison runs, text reviews and coverage (CONTRACT-001 G, FR-88, FR-89).
// A run or a review binds to the text digest of each page it looked at, so it
// goes stale exactly when that text changes. None of this blocks anything.
import {
  type Corpus, idOf, isObject, type JsonObject, type LoadedFile, type LoadedText, madeOnce, sha256, streamsOf, textDigest,
} from "@stemma/records";
import { activeWhere } from "./corpus-index.ts";

const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);
const atOf = (data: JsonObject, field: string): string => String(isObject(data[field]) ? data[field].at : "");

/** The reconversion runs of a source file, newest first. */
export const reconversions = (corpus: Corpus, text: string): LoadedFile[] =>
  activeWhere(corpus, "comparison_run", "text", text).filter((r) => r.data!.method === "reconversion")
    .sort((a, b) => atOf(b.data!, "run").localeCompare(atOf(a.data!, "run")) || (a.path < b.path ? 1 : -1));

/**
 * What a run binds to on one page. A fresh conversion is compared with the
 * as-converted reading, so marking a change as a person's correction ends it even
 * though the words now read the same.
 */
export const comparedDigest = (method: string, blocks: Parameters<typeof streamsOf>[0]): string =>
  method === "reconversion" ? madeOnce(blocks, "reconversion digest", () => sha256(`${textDigest(blocks)}\n${asConverted(blocks)}`)) : textDigest(blocks);

/** Whether a run still describes the text, made with the tools this version has. */
export function currentRun(run: JsonObject, text: LoadedText, tools: Record<string, string>): boolean {
  const now = new Map(text.parts.map((p) => [p.index, comparedDigest(String(run.method), p.blocks)]));
  const pages = list(run.pages);
  if (pages.some((p) => now.get(Number(p.index)) !== p.sha256)) return false;
  if (run.method !== "reconversion") return true;
  return pages.length === now.size && list(run.tools).every((t) => tools[String(t.name)] === undefined || tools[String(t.name)] === t.version);
}

/** What a review of one scope binds to on one page. */
export function reviewDigest(text: LoadedText, scope: string, index: number): string | undefined {
  const part = text.parts.find((p) => p.index === index);
  if (!part) return undefined;
  return scope === "page_number" ? sha256(String(part.front.label ?? "")) : textDigest(part.blocks);
}

export function currentReview(review: JsonObject, text: LoadedText): boolean {
  return list(review.pages).every((p) => reviewDigest(text, String(review.scope), Number(p.index)) === p.sha256);
}

export const byPerson = (review: JsonObject): boolean =>
  isObject(review.reviewed) && isObject(review.reviewed.by) && review.reviewed.by.kind === "person";

export interface Disagreement { index: number; reading: string; other: string }

export interface RunCoverage {
  run: string; method: string; against: string; independent: boolean; current: boolean;
  parts: number; differing_parts: number; agreement_permille: number; disagreements: Disagreement[];
}

export interface Coverage {
  text: string;
  source: string;
  directory: string;
  method: string;
  parts: number;
  /** Parts a person has reviewed whole, with a current review. */
  reviewed_by_person: number;
  stale_reviews: number;
  flags: number;
  runs: RunCoverage[];
  /** Present when the text is not in this copy of the project, so nothing about it could be looked at. */
  not_held?: boolean;
}

export function coverageOf(corpus: Corpus, text: LoadedText, tools: Record<string, string> = {}): Coverage {
  const id = idOf(text.manifest)!;
  const data = text.manifest.data!;
  const whole = new Set<number>();
  let stale = 0;
  let flags = 0;
  for (const file of activeWhere(corpus, "text_review", "text", id)) {
    const review = file.data!;
    if (!currentReview(review, text)) stale++;
    else if (byPerson(review) && review.scope === "whole_page" && review.outcome !== "flagged") {
      for (const p of list(review.pages)) whole.add(Number(p.index));
    }
    if (review.outcome === "flagged" || review.outcome === "disagrees") flags += Math.max(1, list(review.flags).length);
  }
  const runs = [...activeWhere(corpus, "comparison_run", "text", id)]
    .sort((a, b) => (a.path < b.path ? -1 : 1))
    .map((file): RunCoverage => {
      const run = file.data!;
      const pages = list(run.pages);
      const words = pages.reduce((n, p) => n + Number(p.words), 0);
      const differing = pages.reduce((n, p) => n + Number(p.differing_words), 0);
      return {
        run: idOf(file)!, method: String(run.method), against: String(run.against), independent: run.independent === true,
        current: currentRun(run, text, tools), parts: pages.length, differing_parts: pages.filter((p) => Number(p.differing_words) > 0).length,
        agreement_permille: words === 0 ? 1000 : Math.max(0, Math.floor((1000 * (words - differing)) / words)),
        disagreements: pages.flatMap((p) => list(p.differences).map((d) => ({ index: Number(p.index), reading: String(d.reading), other: String(d.other) }))),
      };
    });
  return {
    text: id, source: String(data.source), directory: text.directory,
    method: String(isObject(data.conversion) ? data.conversion.method : ""), parts: text.parts.length,
    reviewed_by_person: whole.size, stale_reviews: stale, flags, runs, ...(text.notHeld ? { not_held: true } : {}),
  };
}

export function coverageWords(c: Coverage): string {
  if (c.not_held) return "its text is not held here";
  const compared = c.runs.filter((r) => r.current).map((r) =>
    `${r.method === "reconversion" ? "fresh conversion" : "second text"}: ${r.parts - r.differing_parts} of ${r.parts} parts agree`);
  return [
    `${c.reviewed_by_person} of ${c.parts} parts reviewed whole by a person`,
    ...compared, ...(c.flags > 0 ? [`${c.flags} flag(s)`] : []), ...(c.stale_reviews > 0 ? [`${c.stale_reviews} stale review(s)`] : []),
  ].join("; ");
}

export interface WordDiff { words: number; differing: number; differences: { reading: string; other: string }[] }

/** Word-by-word differences between two readings, with both readings of each stretch that differs. */
export function diffWords(reading: string, other: string, most = 20): WordDiff {
  const a = reading.split(/\s+/).filter(Boolean);
  const b = other.split(/\s+/).filter(Boolean);
  const words = Math.max(a.length, b.length);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  if (x.length === 0 && y.length === 0) return { words, differing: 0, differences: [] };
  // Past this size the whole differing stretch is reported as one difference.
  if (x.length * y.length > 4_000_000) {
    return { words, differing: Math.max(x.length, y.length), differences: [{ reading: x.slice(0, 40).join(" "), other: y.slice(0, 40).join(" ") }] };
  }
  const width = y.length + 1;
  const table = new Int32Array((x.length + 1) * width);
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      table[i * width + j] = x[i] === y[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const differences: WordDiff["differences"] = [];
  let differing = 0;
  let left: string[] = [];
  let right: string[] = [];
  const close = () => {
    if (left.length === 0 && right.length === 0) return;
    differing += Math.max(left.length, right.length);
    if (differences.length < most) differences.push({ reading: left.slice(0, 40).join(" "), other: right.slice(0, 40).join(" ") });
    left = [];
    right = [];
  };
  for (let i = 0, j = 0; i < x.length || j < y.length; ) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      close();
      i++;
      j++;
    } else if (j >= y.length || (i < x.length && table[(i + 1) * width + j]! >= table[i * width + j + 1]!)) left.push(x[i++]!);
    else right.push(y[j++]!);
  }
  close();
  return { words, differing, differences };
}

/** The committed reading of a part as it was converted: a person's corrections undone, all streams. */
export function asConverted(blocks: Parameters<typeof streamsOf>[0]): string {
  const s = streamsOf(blocks, true);
  return [s.main, s.notes, s.furniture].join("\n");
}
