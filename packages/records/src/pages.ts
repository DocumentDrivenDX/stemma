// Page maps and page spans of an extraction (CONTRACT-001 G, "Extraction and
// passages"). A page gets a printed label only from a segment that names its
// evidence; no label is ever worked out from a file position alone.
import type { Json } from "./json.ts";

export const LABEL_STYLES = ["arabic", "roman_lower", "roman_upper", "explicit", "unnumbered"] as const;

export interface PageSegment {
  first_index: number;
  last_index: number;
  style: (typeof LABEL_STYLES)[number];
  first_label?: string;
  labels?: string[];
  evidence?: "printed_sequence" | "embedded_label" | "author_statement";
}

export interface PageSpan { page_index: number; start: number; end: number }

const ROMAN: [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"],
  [5, "v"], [4, "iv"], [1, "i"],
];

export function toRoman(value: number): string {
  let left = value;
  let out = "";
  for (const [amount, letters] of ROMAN) {
    while (left >= amount) {
      out += letters;
      left -= amount;
    }
  }
  return out;
}

/** The number a lowercase roman numeral written the usual way stands for. */
export function fromRoman(text: string): number | undefined {
  let value = 0;
  let at = 0;
  for (const [amount, letters] of ROMAN) {
    while (value < 5000 && text.startsWith(letters, at)) {
      value += amount;
      at += letters.length;
    }
  }
  return value > 0 && at === text.length && toRoman(value) === text ? value : undefined;
}

/** The number a segment's first label stands for, if it fits the segment's style. */
function firstNumber(style: string, label: unknown): number | undefined {
  if (typeof label !== "string") return undefined;
  if (style === "arabic") return /^[1-9]\d{0,6}$/.test(label) ? Number(label) : undefined;
  if (style === "roman_lower") return fromRoman(label);
  return label === label.toUpperCase() ? fromRoman(label.toLowerCase()) : undefined;
}

export type PageProblem = "bad_page_range" | "bad_page_labels" | "label_evidence_missing" | "bad_page_spans";

const isIndex = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const asObject = (value: Json): Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};

/** Rules on segments that the schema cannot express. Shape errors are reported elsewhere. */
export function checkPageSegments(pages: Json): { code: PageProblem; index: number }[] {
  if (!Array.isArray(pages)) return [];
  const problems: { code: PageProblem; index: number }[] = [];
  const taken: [number, number][] = [];
  pages.forEach((entry, index) => {
    const { first_index: first, last_index: last, style, first_label, labels, evidence } = asObject(entry);
    const add = (code: PageProblem) => problems.push({ code, index });
    if (!isIndex(first) || !isIndex(last) || last < first || taken.some(([a, b]) => first <= b && last >= a)) {
      add("bad_page_range");
      return;
    }
    taken.push([first, last]);
    if (style === "unnumbered") {
      if (first_label !== undefined || labels !== undefined) add("bad_page_labels");
      return;
    }
    if (style === "explicit") {
      if (!Array.isArray(labels) || labels.length !== last - first + 1 || first_label !== undefined) add("bad_page_labels");
    } else if (typeof style === "string" && (labels !== undefined || firstNumber(style, first_label) === undefined)) {
      add("bad_page_labels");
    }
    if (evidence === undefined) add("label_evidence_missing");
  });
  return problems;
}

/** Spans are in page order, do not overlap, and lie inside a text of `length` code points when it is known. */
export function checkPageSpans(spans: Json, length?: number): number[] {
  if (!Array.isArray(spans)) return [];
  const bad: number[] = [];
  let page = -1;
  let end = 0;
  spans.forEach((entry, index) => {
    const span = asObject(entry);
    const ok = isIndex(span.page_index) && isIndex(span.start) && isIndex(span.end)
      && span.page_index > page && span.start >= end && span.end >= span.start
      && (length === undefined || span.end <= length);
    if (!ok) bad.push(index);
    else {
      page = span.page_index as number;
      end = span.end as number;
    }
  });
  return bad;
}

/** The printed label of each mapped file page. Pages in no segment have none. */
export function pageLabels(segments: PageSegment[]): Map<number, string> {
  const labels = new Map<number, string>();
  for (const segment of segments) {
    if (segment.style === "unnumbered") continue;
    const start = segment.style === "explicit" ? 0 : firstNumber(segment.style, segment.first_label);
    if (start === undefined) continue;
    for (let i = segment.first_index; i <= segment.last_index; i++) {
      const offset = i - segment.first_index;
      const label = segment.style === "explicit" ? segment.labels?.[offset]
        : segment.style === "arabic" ? String(start + offset)
        : segment.style === "roman_lower" ? toRoman(start + offset) : toRoman(start + offset).toUpperCase();
      if (label !== undefined) labels.set(i, label);
    }
  }
  return labels;
}
