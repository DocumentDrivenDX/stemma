// The evidence ledger of a report (CONTRACT-006 J): for each sentence, who is
// recorded as writing its words and what the records tie to it. It counts what
// is recorded. It gives no score, and nothing unrecorded counts as a person's.
import { activeTexts, byPerson, currentReview, type ReportBody } from "@stemma/core";
import { doubleQuotes, type Range, SENTENCE_PROFILE, splitSentences } from "@stemma/manuscript";
import { type Corpus, isObject, isRetired, type JsonObject, type LoadedText, normalizeSentence, sha256 } from "@stemma/records";
import type { Assembly, Rendered, ReportSpec, Segment } from "./report.ts";

export const EVIDENCE_SCHEMA = "stemma.evidence/0";
/** The tool-neutral shape of subjects, units, and totals. */
export const EVIDENCE_LEDGER = "evidence-ledger/1";

/** Weakest first. A model can only flag source text (CONTRACT-001 G), so no level says a model agreed. */
const COMPARED = ["flagged", "none_recorded", "person"] as const;
export type Compared = (typeof COMPARED)[number];
const weakest = (all: Compared[]): Compared => COMPARED.find((c) => all.includes(c)) ?? "none_recorded";

export interface Unit {
  id: string; place: "body" | "comment"; note?: number; block: number; sentence: number; sha256: string;
  labels: {
    wording: string; declared_by: string; basis: "quotation" | "cited" | "uncited"; typed_quotation: "yes" | "no";
    compared: Compared | "not_applicable"; support: "not_judged" | "not_applicable";
  };
  chars: { quoted: number; wording: number };
  quotations: string[];
}

export interface Totals { units: number; chars: Record<string, number>; labels: Record<string, Record<string, number>> }

/** The totals of units; anyone holding the ledger can compute them again. */
export function totalsOf(units: Unit[]): Totals {
  const chars: Record<string, number> = {};
  const labels: Record<string, Record<string, number>> = {};
  for (const unit of units) {
    for (const [name, n] of Object.entries(unit.chars)) chars[name] = (chars[name] ?? 0) + n;
    for (const [name, value] of Object.entries(unit.labels)) {
      const counts = (labels[name] ??= {});
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return { units: units.length, chars, labels };
}

const digestOf = (text: string): string => sha256(normalizeSentence(text));

const sentencesOf = (text: string, whole: Range[] = []): Range[] => splitSentences(text, [...whole, ...doubleQuotes(text).pairs]);

interface Mark { wording: Set<string>; by: Set<string> }

/** Authorship records by the digest of each sentence they hold. */
function marksOf(corpus: Corpus): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  for (const { data } of corpus.records) {
    if (data?.kind !== "authorship_mark" || isRetired(data)) continue;
    const { text, authorship, marked } = data;
    // A mark applies to the exact text it holds: one edited by hand applies to nothing.
    if (typeof text !== "string" || typeof authorship !== "string" || data.text_sha256 !== digestOf(text)) continue;
    const by = isObject(marked) && isObject(marked.by) ? String(marked.by.kind) : "";
    if (!["human_written", "edited", "ai_drafted"].includes(authorship) || !["person", "model", "software"].includes(by)) continue;
    for (const paragraph of text.split("\n\n")) {
      for (const r of sentencesOf(paragraph)) {
        const digest = digestOf(paragraph.slice(r.start, r.end));
        const mark = marks.get(digest) ?? { wording: new Set<string>(), by: new Set<string>() };
        mark.wording.add(authorship);
        mark.by.add(by);
        marks.set(digest, mark);
      }
    }
  }
  return marks;
}

/** What current text reviews record about one passage against its original. */
function comparedOf(corpus: Corpus, texts: Map<string, LoadedText>, passage: JsonObject): Compared {
  const text = texts.get(String(passage.text));
  if (!text) return "none_recorded";
  const reviews = corpus.records.flatMap(({ data }) => (
    data?.kind === "text_review" && !isRetired(data) && data.text === passage.text && currentReview(data, text) ? [data] : []));
  const pages = (Array.isArray(passage.anchor) ? passage.anchor.filter(isObject) : []).map((a) => Number(a.index));
  return weakest(pages.map((index): Compared => {
    const here = reviews.filter((r) => {
      const covers = Array.isArray(r.pages) && r.pages.some((p) => isObject(p) && Number(p.index) === index);
      if (r.scope === "passage") return r.passage === passage.id && covers;
      return (r.scope === "whole_page" || r.scope === "quotations") && covers;
    });
    if (here.some((r) => r.outcome === "disagrees" || r.outcome === "flagged")) return "flagged";
    return here.some((r) => byPerson(r) && (r.outcome === "agrees" || r.outcome === "corrected")) ? "person" : "none_recorded";
  }));
}

export interface LedgerInput {
  corpus: Corpus;
  spec: ReportSpec;
  assembly: Assembly;
  quotations: Map<string, Rendered>;
  /** The outputs a signer seals, by file name. */
  outputs: Record<string, string>;
  inputs: { spec_sha256: string; template_sha256: string };
  /** One run of the checks over the whole project. */
  checks: ReportBody;
}

/** A paragraph or comment as the report words it, with where its quotations and note markers fall. */
function flatten(segments: Segment[], quotations: Map<string, Rendered>) {
  let text = "";
  const quoted: (Range & { id: string })[] = [];
  const notes: { at: number; number: number }[] = [];
  for (const s of segments) {
    if (s.kind === "text") text += s.text;
    else if (s.kind === "note") notes.push({ at: text.length, number: s.number });
    else {
      const start = text.length;
      text += `“${quotations.get(s.id)!.text}”`;
      quoted.push({ id: s.id, start, end: text.length });
    }
  }
  return { text, quoted, notes };
}

export function evidenceLedger(input: LedgerInput): string {
  const { corpus, assembly, quotations } = input;
  const texts = new Map(activeTexts(corpus));
  const marks = marksOf(corpus);
  const compared = new Map<string, Compared>([...quotations].map(([id, q]) => [
    id, weakest(q.spec.passages.map((p) => comparedOf(corpus, texts, corpus.byId.get(p.passage)!.data!))),
  ]));
  const units: Unit[] = [];
  const seen = new Map<string, number>();

  const add = (segments: Segment[], block: number, comment?: number) => {
    const flat = flatten(segments, quotations);
    if (comment === undefined && /^#{1,6} /.test(flat.text)) return;
    const ranges = sentencesOf(flat.text, flat.quoted);
    ranges.forEach((range, n) => {
      const sentence = flat.text.slice(range.start, range.end);
      const inline = flat.quoted.filter((q) => q.start >= range.start && q.start < range.end);
      // A note belongs to the sentence its marker follows.
      const owned = flat.notes.filter((note) => (
        ranges.findLastIndex((r) => r.start < note.at) === n || (n === 0 && note.at <= range.start)));
      const cited = owned.flatMap((o) => assembly.notes[o.number - 1]!.passages);
      const ids = [...new Set([...inline.map((q) => q.id), ...cited])];
      const basis = inline.length > 0 ? "quotation" : cited.length > 0 ? "cited" : "uncited";

      // The words outside the script-copied quotations.
      let rest = "";
      let at = range.start;
      for (const q of inline) {
        rest += `${flat.text.slice(at, q.start)}\u0000`;
        at = q.end;
      }
      rest += flat.text.slice(at, range.end);
      const typed = doubleQuotes(rest).pairs.some((p) => /[\p{L}\p{N}]/u.test(rest.slice(p.start, p.end)));

      const digest = digestOf(sentence);
      const count = (seen.get(digest) ?? 0) + 1;
      seen.set(digest, count);
      const mark = marks.get(digest);
      units.push({
        id: `u-${digest.slice(0, 16)}-${count}`,
        place: comment === undefined ? "body" : "comment",
        ...(comment === undefined ? {} : { note: comment }),
        block, sentence: n + 1, sha256: digest,
        labels: {
          wording: mark?.wording.size === 1 ? [...mark.wording][0]! : "unrecorded",
          declared_by: !mark ? "none" : mark.by.size === 1 ? [...mark.by][0]! : "mixed",
          basis, typed_quotation: typed ? "yes" : "no",
          compared: basis === "uncited" ? "not_applicable" : weakest(ids.map((id) => compared.get(id)!)),
          support: basis === "uncited" ? "not_applicable" : "not_judged",
        },
        chars: {
          quoted: inline.reduce((sum, q) => sum + [...quotations.get(q.id)!.text].length, 0),
          wording: [...rest.replace(/[\u0000\p{White_Space}]/gu, "")].length,
        },
        quotations: ids,
      });
    });
  };

  assembly.paragraphs.forEach((paragraph, i) => {
    if (paragraph.kind !== "text") return;
    add(paragraph.segments, i + 1);
    for (const s of paragraph.segments) {
      if (s.kind !== "note") continue;
      const comment = assembly.notes[s.number - 1]!.comment;
      if (comment) add(comment, i + 1, s.number);
    }
  });

  const open = input.checks.results.filter((r) => r.open);
  const byCheck: Record<string, number> = {};
  for (const r of open) byCheck[r.check] = (byCheck[r.check] ?? 0) + 1;

  const ledger = {
    schema: EVIDENCE_SCHEMA,
    ledger: EVIDENCE_LEDGER,
    subjects: Object.entries(input.outputs).map(([path, text]) => ({ path, sha256: sha256(text) })),
    inputs: { spec_sha256: input.inputs.spec_sha256, template_sha256: input.inputs.template_sha256 },
    profiles: { sentences: SENTENCE_PROFILE },
    covers: "Each sentence of the report's body paragraphs and note comments. It counts what is recorded. It is not a measure of truth and gives no score.",
    not_covered: [
      "headings", "formatted citations and the bibliography", "the quotations that notes give before their citations",
      "text between single quotation marks, which is not read as a quotation", "whether any source supports any sentence",
    ],
    checks: { label: input.checks.label, open: open.length, open_by_check: byCheck, not_implemented: input.checks.not_run.map((n) => n.check) },
    quotations: [...quotations].map(([id, q]) => ({
      id, source: String(corpus.byId.get(q.spec.passages[0]!.passage)!.data!.source),
      passages: q.spec.passages.map((p) => p.passage), compared: compared.get(id)!,
      corrections: {
        person: (q.spec.corrections ?? []).filter((c) => c.by.startsWith("person:")).length,
        other: (q.spec.corrections ?? []).filter((c) => !c.by.startsWith("person:")).length,
      },
      stated_check: q.spec.checked !== undefined,
    })),
    units,
    totals: totalsOf(units),
  };
  return `${JSON.stringify(ledger, null, 1)}\n`;
}

/** The ledger's totals in plain words, for the build's output. */
export function ledgerWords(ledger: string): string {
  const { totals, checks } = JSON.parse(ledger) as { totals: Totals; checks: { open: number; not_implemented: string[] } };
  const n = (label: string, value: string) => totals.labels[label]?.[value] ?? 0;
  return [
    `Evidence ledger: ${totals.units} sentences. ${n("basis", "quotation")} hold a quotation copied by script, ${n("basis", "cited")} a citation only, ${n("basis", "uncited")} neither.`,
    `No writer is recorded for ${n("wording", "unrecorded")}. Support is not judged for any. ${n("typed_quotation", "yes")} hold typed quotation marks.`,
    `Checks over the project: ${checks.open} open, ${checks.not_implemented.length} not implemented.`,
  ].join("\n");
}
