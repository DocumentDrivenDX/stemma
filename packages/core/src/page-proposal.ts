// `source pages`: a page map proposed for a person or Claude to review. A page
// is proposed only where the numbers printed in its own text bear the mapping
// out (SD-002 BR-208). Page-number data that comes with a scan, and labels
// stated inside a PDF, are compared with that and reported; on their own they
// label nothing, and no label is ever worked out from a file position alone.
import { fromRoman, isObject, type Json, JsonUnreadable, type PageSegment, parseJson, toRoman } from "@stemma/records";
import { InvalidInput } from "./operations.ts";

/** Starting values (assumptions), to be tuned on pilot sources. */
export const PROPOSAL = { edge_lines: 3, widest_gap: 8, least_seen: 3, least_share: 0.5 };

type Style = "arabic" | "roman_lower";

const labelFor = (style: Style, value: number) => (style === "arabic" ? String(value) : toRoman(value));

/** Numbers standing at the start or end of a line near the top or bottom of a page. */
export function printedNumbers(page: string): { style: Style; value: number }[] {
  const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
  const edge = lines.length <= PROPOSAL.edge_lines * 2 ? lines : [...lines.slice(0, PROPOSAL.edge_lines), ...lines.slice(-PROPOSAL.edge_lines)];
  const found = new Map<string, { style: Style; value: number }>();
  for (const line of edge) {
    const words = line.split(/\s+/);
    for (const word of [words[0]!, words.at(-1)!]) {
      const bare = word.replace(/^[[(\u2014-]+|[\])\u2014.-]+$/g, "");
      const roman = /^[ivxlc]{1,8}$/.test(bare) ? fromRoman(bare) : undefined;
      if (/^[1-9]\d{0,3}$/.test(bare)) found.set(`a${bare}`, { style: "arabic", value: Number(bare) });
      else if (roman !== undefined) found.set(`r${bare}`, { style: "roman_lower", value: roman });
    }
  }
  return [...found.values()];
}

export interface ProposedRun {
  segment: PageSegment;
  pages: number;
  /** Pages of the run whose text shows the proposed number near its top or bottom. */
  seen: number;
  /** File indexes in the run where the number was not found in the text. */
  unseen: number[];
}

export interface Comparison {
  from: string;
  /** Pages of proposed runs where this data gives the same label. */
  agree: number;
  /** Pages of proposed runs where it gives another label. */
  differ: number[];
  /** Pages it labels that no proposed run covers. */
  only_there: { page_index: number; label: string }[];
}

export interface Proposal {
  page_count: number;
  runs: ProposedRun[];
  /** Labels that more than one file page would carry, as with a second numbering bound into one file. */
  repeated_labels: string[];
  unmapped: number[];
  comparisons: Comparison[];
}

export function proposePageMap(pages: string[], claimed: { from: string; labels: Map<number, string> }[] = []): Proposal {
  const hits = new Map<string, { style: Style; offset: number; at: number[] }>();
  pages.forEach((page, index) => {
    for (const { style, value } of printedNumbers(page)) {
      const key = `${style} ${value - index}`;
      const entry = hits.get(key) ?? { style, offset: value - index, at: [] };
      entry.at.push(index);
      hits.set(key, entry);
    }
  });
  const candidates: { style: Style; offset: number; at: number[] }[] = [];
  for (const { style, offset, at } of hits.values()) {
    let cluster: number[] = [];
    const close = () => {
      const length = cluster.length > 0 ? cluster.at(-1)! - cluster[0]! + 1 : 0;
      if (cluster.length >= PROPOSAL.least_seen && cluster.length / length >= PROPOSAL.least_share && cluster[0]! + offset >= 1) {
        candidates.push({ style, offset, at: cluster });
      }
    };
    for (const index of at) {
      if (cluster.length > 0 && index - cluster.at(-1)! > PROPOSAL.widest_gap) {
        close();
        cluster = [];
      }
      cluster.push(index);
    }
    close();
  }
  candidates.sort((a, b) => b.at.length - a.at.length || a.at[0]! - b.at[0]!);
  const runs: ProposedRun[] = [];
  for (const { style, offset, at } of candidates) {
    const [first, last] = [at[0]!, at.at(-1)!];
    if (runs.some((r) => first <= r.segment.last_index && last >= r.segment.first_index)) continue;
    const seen = new Set(at);
    const unseen = [];
    for (let i = first; i <= last; i++) if (!seen.has(i)) unseen.push(i);
    runs.push({
      segment: { first_index: first, last_index: last, style, first_label: labelFor(style, first + offset), evidence: "printed_sequence" },
      pages: last - first + 1, seen: at.length, unseen,
    });
  }
  runs.sort((a, b) => a.segment.first_index - b.segment.first_index);
  const proposed = new Map<number, string>();
  for (const { segment } of runs) {
    const start = segment.style === "arabic" ? Number(segment.first_label) : fromRoman(segment.first_label!)!;
    for (let i = segment.first_index; i <= segment.last_index; i++) {
      proposed.set(i, labelFor(segment.style as Style, start + i - segment.first_index));
    }
  }
  const comparisons = claimed.map(({ from, labels }): Comparison => {
    const out: Comparison = { from, agree: 0, differ: [], only_there: [] };
    for (const [page_index, label] of [...labels].sort(([a], [b]) => a - b)) {
      const mine = proposed.get(page_index);
      if (mine === undefined) out.only_there.push({ page_index, label });
      else if (mine === label) out.agree++;
      else out.differ.push(page_index);
    }
    return out;
  });
  const times = new Map<string, number>();
  for (const label of proposed.values()) times.set(label, (times.get(label) ?? 0) + 1);
  const repeated_labels = [...times].filter(([, n]) => n > 1).map(([label]) => label);
  return { page_count: pages.length, runs, repeated_labels, unmapped: pages.map((_, i) => i).filter((i) => !proposed.has(i)), comparisons };
}

/**
 * Page-number data supplied with a scan, as claims to compare. Two shapes: the
 * Internet Archive's page-number file (`pages[]` with `leafNum`, counted from 1,
 * and `pageNumber`), or a list of `{"page_index", "label"}`.
 */
export function parsePageNumbers(bytes: Uint8Array): Map<number, string> {
  let value: Json;
  try {
    value = parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).value;
  } catch (error) {
    throw new InvalidInput(`The page-number data is not usable UTF-8 JSON${error instanceof JsonUnreadable ? ` (${error.problem})` : ""}.`);
  }
  const archive = isObject(value) && Array.isArray(value.pages);
  const entries = archive ? (value as { pages: Json[] }).pages : value;
  const out = new Map<number, string>();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!isObject(entry)) continue;
    const index = archive ? Number(entry.leafNum) - 1 : entry.page_index;
    const label = archive ? entry.pageNumber : entry.label;
    if (typeof index === "number" && Number.isSafeInteger(index) && index >= 0 && typeof label === "string" && label !== "") out.set(index, label);
  }
  if (out.size === 0) {
    throw new InvalidInput('The page-number data labels no page. It must be an Internet Archive page-number file, or a JSON list of {"page_index": 0, "label": "1"}.');
  }
  return out;
}
