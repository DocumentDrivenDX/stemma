// locator.extent (CONTRACT-002 C; SD-007 BR-715): a cited page or other locator
// falls inside the work. A recorded extent for the locator's term governs;
// otherwise, for pages and folios, the page map of the source's stored copy.
// It tests range only: not that a quotation or a claim is on the cited page.
import { type Corpus, fromRoman, idOf, isObject, type Json, type JsonObject, type LoadedFile, pageLabels, type PageSegment, toRoman } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { active, hasManuscript, resolveCitations } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

type Style = "arabic" | "roman_lower" | "roman_upper";
export interface Numbered { style: Style; value: number }

/** A printed label as a number in its numbering style; labels such as `12r` have none. */
export function numberOf(label: string): Numbered | undefined {
  if (/^[1-9]\d{0,6}$/.test(label)) return { style: "arabic", value: Number(label) };
  const lower = fromRoman(label.toLowerCase());
  if (lower === undefined) return undefined;
  if (label === label.toLowerCase()) return { style: "roman_lower", value: lower };
  return label === label.toUpperCase() ? { style: "roman_upper", value: lower } : undefined;
}

const writeAs = (style: Style, value: number): string =>
  style === "arabic" ? String(value) : style === "roman_lower" ? toRoman(value) : toRoman(value).toUpperCase();

interface Part { first: string; last: string }

/** `41`, `41-43` or `41, 45`, with an optional separate end. `known` labels are taken whole. */
export function locatorParts(value: string, end: unknown, known: Set<string> = new Set()): Part[] {
  const whole = value.trim();
  if (typeof end === "string") return [{ first: whole, last: end.trim() }];
  if (known.has(whole)) return [{ first: whole, last: whole }];
  return whole.split(/\s*,\s*/).map((piece) => {
    const ends = piece.split(/\s*(?:-{1,2}|\u2013|\u2014)\s*/);
    return ends.length === 2 && !known.has(piece) ? { first: ends[0]!, last: ends[1]! } : { first: piece, last: piece };
  });
}

const PAGE_TERMS = new Set(["page", "folio"]);

/** The printed labels a page locator names, when it is plain enough to list. */
export function citedPages(locator: Json | undefined): string[] | undefined {
  if (!isObject(locator) || !PAGE_TERMS.has(String(locator.label)) || typeof locator.value !== "string") return undefined;
  const labels: string[] = [];
  for (const part of locatorParts(locator.value, locator.end)) {
    const [first, last] = [numberOf(part.first), numberOf(part.last)];
    if (part.first === part.last) labels.push(part.first);
    else if (first && last && first.style === last.style && last.value >= first.value && last.value - first.value < 100) {
      for (let v = first.value; v <= last.value; v++) labels.push(writeAs(first.style, v));
    } else return undefined;
  }
  return labels;
}

export interface MappedPages {
  labels: Set<string>;
  /** The extraction records whose page maps gave the labels. */
  from: LoadedFile[];
  /** File pages, in those extractions, that have no label. */
  unmapped: number;
}

/** The printed labels of the page maps of a source's non-retired copies. */
export function mappedPages(corpus: Corpus, source: string): MappedPages {
  const captures = new Set(active(corpus, "capture").filter((c) => c.data!.source === source).map(idOf));
  const out: MappedPages = { labels: new Set(), from: [], unmapped: 0 };
  for (const extraction of active(corpus, "extraction")) {
    if (!captures.has(String(extraction.data!.capture))) continue;
    const pages = extraction.data!.pages;
    const labels = pageLabels(Array.isArray(pages) ? (pages as unknown as PageSegment[]) : []);
    if (labels.size === 0) continue;
    for (const label of labels.values()) out.labels.add(label);
    const spans = extraction.data!.page_spans;
    out.unmapped = Math.max(out.unmapped, (Array.isArray(spans) ? spans.length : 0) - labels.size);
    out.from.push(extraction);
  }
  return out;
}

/** `ix-xii, 31-60`, with labels that are not plain numbers listed as they are. */
export function describeLabels(labels: Iterable<string>): string {
  const numbered = new Map<Style, number[]>();
  const other: string[] = [];
  for (const label of labels) {
    const n = numberOf(label);
    if (n) numbered.set(n.style, [...(numbered.get(n.style) ?? []), n.value]);
    else other.push(label);
  }
  const out: string[] = [];
  for (const style of ["roman_lower", "roman_upper", "arabic"] as const) {
    const values = [...new Set(numbered.get(style) ?? [])].sort((a, b) => a - b);
    for (let i = 0, j = 0; i < values.length; i = j + 1) {
      for (j = i; values[j + 1] === values[j]! + 1; j++);
      out.push(i === j ? writeAs(style, values[i]!) : `${writeAs(style, values[i]!)}-${writeAs(style, values[j]!)}`);
    }
  }
  if (other.length > 0) out.push(other.length > 12 ? `${other.slice(0, 12).join(", ")} and ${other.length - 12} more` : other.join(", "));
  return out.join(", ");
}

type Where = "inside" | "outside" | "gap" | "unparsable" | "no_style";

/** Where one part lies against ranges of numbers, each in one style. */
function against(part: Part, ranges: { style: Style; first: number; last: number }[]): Where {
  const [first, last] = [numberOf(part.first), numberOf(part.last)];
  if (!first || !last || first.style !== last.style || last.value < first.value) return "unparsable";
  const same = ranges.filter((r) => r.style === first.style);
  if (same.length === 0) return "no_style";
  if (same.some((r) => first.value >= r.first && last.value <= r.last)) return "inside";
  const low = Math.min(...same.map((r) => r.first));
  const high = Math.max(...same.map((r) => r.last));
  return first.value >= low && last.value <= high ? "gap" : "outside";
}

/** Runs of consecutive mapped numbers, by style. */
function runs(labels: Set<string>): { style: Style; first: number; last: number }[] {
  const values = [...labels].flatMap((l) => numberOf(l) ?? []).sort((a, b) => a.style.localeCompare(b.style) || a.value - b.value);
  const out: { style: Style; first: number; last: number }[] = [];
  for (const { style, value } of values) {
    const last = out.at(-1);
    if (last && last.style === style && value <= last.last + 1) last.last = Math.max(last.last, value);
    else out.push({ style, first: value, last: value });
  }
  return out;
}

type Reason = "outside_extent" | "outside_page_map" | "unparsable_locator" | "no_extent" | "page_not_mapped" | "record_unreadable";
interface Verdict { outcome: "pass" | "fail" | "unverifiable"; reason?: Reason; evidence: Evidence[] }

const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });
const unverifiable = (reason: Reason, ...evidence: Evidence[]): Verdict => ({ outcome: "unverifiable", reason, evidence });

/** Several parts: any outside fails; otherwise any that cannot be judged keeps it open. */
function overall(wheres: Where[], outside: Reason): { outcome: Verdict["outcome"]; reason?: Reason } {
  if (wheres.includes("outside")) return { outcome: "fail", reason: outside };
  if (wheres.includes("unparsable")) return { outcome: "unverifiable", reason: "unparsable_locator" };
  if (wheres.includes("no_style")) return { outcome: "unverifiable", reason: "no_extent" };
  if (wheres.includes("gap")) return { outcome: "unverifiable", reason: "page_not_mapped" };
  return { outcome: "pass" };
}

export function judgeLocator(corpus: Corpus, source: JsonObject, locator: JsonObject): Verdict {
  const term = String(locator.label);
  const value = String(locator.value);
  const recorded = (Array.isArray(source.extents) ? source.extents : []).filter(isObject).filter((e) => e.label === term);
  if (recorded.length > 0) {
    const shown = meta("extent", `${term} ${recorded.map((e) => `${String(e.first)}-${String(e.last)}`).join(", ")} (recorded on the source)`);
    const ranges = recorded.flatMap((e) => {
      const [first, last] = [numberOf(String(e.first)), numberOf(String(e.last))];
      return first && last && first.style === last.style ? [{ style: first.style, first: first.value, last: last.value }] : [];
    });
    const wheres = locatorParts(value, locator.end).map((p): Where => {
      if (recorded.some((e) => p.first === p.last && (p.first === e.first || p.first === e.last))) return "inside";
      const where = against(p, ranges);
      // A recorded extent is the whole of the work, so a number between two of its ranges is outside it.
      return where === "gap" ? "outside" : where;
    });
    return { ...overall(wheres, "outside_extent"), evidence: [shown] };
  }
  if (corpus.records.some((f) => f.state !== "ok" && /^records\/(extractions|captures)\//.test(f.path))) return unverifiable("record_unreadable");
  const mapped = PAGE_TERMS.has(term) ? mappedPages(corpus, String(source.id)) : undefined;
  if (!mapped || mapped.labels.size === 0) return unverifiable("no_extent");
  const evidence: Evidence[] = [
    meta("extent", `printed pages ${describeLabels(mapped.labels)} (mapped in your stored copy)`),
    ...mapped.from.map((e): Evidence => ({ name: "extraction_file", class: "location", value: e.path })),
    ...(mapped.unmapped > 0 ? [meta("pages_without_a_label", `${mapped.unmapped} page(s) of the stored file`)] : []),
  ];
  const ranges = runs(mapped.labels);
  const wheres = locatorParts(value, locator.end, mapped.labels).map((part): Where => {
    if (part.first === part.last && mapped.labels.has(part.first)) return "inside";
    return against(part, ranges);
  });
  return { ...overall(wheres, "outside_page_map"), evidence };
}

export const locatorCitations = (corpus: Corpus) =>
  hasManuscript(corpus) ? [] : resolveCitations(corpus).filter(({ citation }) => isObject(citation.data!.locator));

export function locatorResults(corpus: Corpus): Result[] {
  return locatorCitations(corpus).flatMap(({ citation, key, matches }) => {
    if (matches.length !== 1) return [];
    const data = citation.data!;
    const locator = data.locator as JsonObject;
    const source = matches[0]!;
    const verdict = judgeLocator(corpus, source.data!, locator);
    const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
      ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;
    const shown = typeof locator.end === "string" ? `${String(locator.value)} to ${locator.end}` : String(locator.value);
    return [result({
      check: "locator.extent", outcome: verdict.outcome, ...(verdict.reason ? { reason: verdict.reason } : {}),
      subject: subjectOf(citation), locus: `${idOf(citation) ?? citation.path}#locator`, source: idOf(source)!,
      evidence: [
        { name: "citation_file", class: "location", value: citation.path },
        meta("key", key ?? String(source.data!.citation_key ?? idOf(source))),
        { name: "locator", class: "manuscript", value: `${String(locator.label)} ${shown}` },
        { name: "source_file", class: "location", value: source.path },
        ...verdict.evidence,
      ],
      item: itemOf(citation), ...(sentence ? { sentence } : {}),
    })];
  });
}
