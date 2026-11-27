// PDF structure, assigned only by the rules of CONTRACT-007 I. Each role records
// the rule it rests on; everything else stays "undetermined", with its lines as
// found. Nothing is invented, and the same input gives the same output.
import { type Block, encodeText, inline } from "@stemma/records";
import type { PdfLine, PdfText } from "./index.ts";
import { block, cleanText, type Converted, type ConvertedPart, converterTool, type Label, Unconvertible } from "./model.ts";

export const PDF_RULES = {
  edge_lines: 2, recurring_pages: 3, head_letters: 4, column_lines: 5, heading_ratio: 1.2, heading_characters: 120,
  note_ratio: 0.92, marker_ratio: 0.8,
};

const lettersOf = (text: string) => text.normalize("NFKD").replace(/[^\p{L}]/gu, "").toLowerCase();
const bare = (text: string) => text.trim().replace(/^[[(—–\s.-]+|[\])—–\s.-]+$/g, "");

const edgesOf = (lines: PdfLine[]): number[] => {
  const n = PDF_RULES.edge_lines;
  return lines.map((_, i) => i).filter((i) => i < n || i >= lines.length - n);
};

/** Letters-only forms of edge lines that recur on at least three pages: running heads and feet. */
export function recurringHeads(pages: PdfLine[][]): Set<string> {
  const seen = new Map<string, number>();
  for (const lines of pages) {
    for (const key of new Set(edgesOf(lines).map((i) => lettersOf(lines[i]!.text)))) {
      if (key.length >= PDF_RULES.head_letters) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return new Set([...seen].filter(([, n]) => n >= PDF_RULES.recurring_pages).map(([key]) => key));
}

/** The size that most characters are set in. */
export function bodySize(pages: PdfLine[][]): number {
  const weight = new Map<number, number>();
  for (const lines of pages) {
    for (const item of lines.flatMap((l) => l.items)) {
      const size = Math.round(item.size * 10) / 10;
      weight.set(size, (weight.get(size) ?? 0) + item.text.length);
    }
  }
  return [...weight].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

const lineSize = (line: PdfLine): number => {
  const longest = [...line.items].sort((a, b) => b.text.length - a.text.length)[0];
  return longest?.size ?? 0;
};

const MARKER = /^(\d{1,3}|[*†‡§])$/;

/** A small, raised marker inside a line of larger text. */
function raisedMarkers(line: PdfLine): { at: number; label: string }[] {
  const size = lineSize(line);
  const main = line.items.find((i) => i.size === size);
  if (!main) return [];
  return line.items.flatMap((item, at) =>
    item.size <= size * PDF_RULES.marker_ratio && item.y > main.y + size * 0.15 && MARKER.test(item.text.trim()) && at > 0
      ? [{ at, label: item.text.trim() }] : []);
}

type Tagged = { line: PdfLine; role: string; basis?: string; label?: string; column?: string; markers?: { at: number; label: string }[] };

/** Footnotes are assigned only where a raised marker and a small line at the foot begin with the same marker. */
function pairNotes(body: Tagged[], size: number): void {
  const candidates = body.flatMap((t) => raisedMarkers(t.line).map((m) => ({ ...m, tagged: t })));
  if (candidates.length === 0) return;
  let first = body.length;
  while (first > 0 && lineSize(body[first - 1]!.line) <= size * PDF_RULES.note_ratio) first--;
  const foot = body.slice(first);
  const paired = new Set<string>();
  let current: string | undefined;
  for (const tagged of foot) {
    const text = tagged.line.text.trimStart();
    const found = candidates.find((c) => !paired.has(c.label) && !foot.includes(c.tagged) && text.startsWith(c.label));
    if (found) {
      current = found.label;
      paired.add(current);
    }
    if (current) Object.assign(tagged, { role: "footnote", basis: "font-size", label: current });
  }
  for (const c of candidates) {
    if (paired.has(c.label) && c.tagged.role !== "footnote") (c.tagged.markers ??= []).push({ at: c.at, label: c.label });
  }
}

const inked = (line: PdfLine) => line.items.filter((i) => i.text.trim() !== "");

/** Two columns only when no line crosses the gutter and each side holds enough lines. */
function columnsOf(body: Tagged[], width: number): "1" | "2" | "undetermined" {
  const span = (line: PdfLine) => ({
    left: Math.min(...inked(line).map((i) => i.x)), right: Math.max(...inked(line).map((i) => i.x + i.width)),
  });
  let left = 0;
  let right = 0;
  let crossing = 0;
  for (const { line } of body) {
    const { left: from, right: to } = span(line);
    if (to <= width * 0.52) left++;
    else if (from >= width * 0.48) right++;
    else crossing++;
  }
  if (crossing === 0 && left >= PDF_RULES.column_lines && right >= PDF_RULES.column_lines) return "2";
  // Lines with a wide gap at the middle may be two columns the file wrote side by side: no claim is made.
  // The reader fills a gap with a wide space of its own, so only pieces with ink are measured.
  const gapped = body.filter(({ line }) => line.items.filter((i) => i.text.trim() !== "").sort((a, b) => a.x - b.x).some((item, i, all) => {
    const next = all[i + 1];
    return next !== undefined && next.x - (item.x + item.width) > width * 0.04 && item.x + item.width < width * 0.52 && next.x > width * 0.48;
  })).length;
  if (gapped >= PDF_RULES.column_lines) return "undetermined";
  return body.length >= PDF_RULES.column_lines && crossing >= body.length * 0.8 ? "1" : "undetermined";
}

const lineText = (tagged: Tagged): string => {
  if (!tagged.markers) return encodeText(cleanText(tagged.line.text).replace(/\n/g, " "));
  let out = "";
  let at = 0;
  const text = tagged.line.text;
  tagged.line.items.forEach((item, i) => {
    const found = text.indexOf(item.text, at);
    if (found < 0) return;
    out += encodeText(cleanText(text.slice(at, found)));
    const marker = tagged.markers!.find((m) => m.at === i);
    out += marker ? inline("fnref", { label: marker.label }, encodeText(item.text)) : encodeText(cleanText(item.text));
    at = found + item.text.length;
  });
  return out + encodeText(cleanText(text.slice(at)));
};

/** Consecutive lines with the same role become one block, line breaks kept. */
function blocksOf(lines: Tagged[]): Block[] {
  const blocks: (Block & { key: string })[] = [];
  for (const tagged of lines) {
    const key = [tagged.role, tagged.label, tagged.column, tagged.basis].join("|");
    const last = blocks.at(-1);
    if (last?.key === key && tagged.role !== "heading" && tagged.role !== "running-head") last.content += `\n${lineText(tagged)}`;
    else {
      blocks.push({
        key, role: tagged.role, content: lineText(tagged), ...(tagged.label ? { label: tagged.label } : {}),
        ...(tagged.column ? { column: tagged.column } : {}), ...(tagged.basis ? { basis: tagged.basis } : {}),
      });
    }
  }
  return blocks.map(({ key: _, ...b }) => b);
}

export interface PdfStructureOptions {
  /** True when the text layer was made by character recognition: font sizes then say nothing reliable. */
  recognized: boolean;
  labels: Map<number, Label>;
}

export function structurePdf(read: PdfText, options: PdfStructureOptions): ConvertedPart[] {
  const heads = recurringHeads(read.lines);
  const size = bodySize(read.lines);
  return read.lines.map((lines, index) => {
    const label = options.labels.get(index) ?? { status: "undetermined" as const };
    const edges = new Set(edgesOf(lines));
    const tagged: Tagged[] = lines.map((line, i) => {
      if (edges.has(i)) {
        if (label.label !== undefined && bare(line.text) === label.label) return { line, role: "folio", basis: "printed-label" };
        if (heads.has(lettersOf(line.text))) return { line, role: "running-head", basis: "repeated-line" };
      }
      return { line, role: "undetermined" };
    });
    const body = tagged.filter((t) => t.role === "undetermined");
    const columns = columnsOf(body, read.widths[index]!);
    if (!options.recognized && size > 0) {
      pairNotes(body, size);
      for (const t of body) {
        if (t.role === "undetermined" && lineSize(t.line) >= size * PDF_RULES.heading_ratio && t.line.text.trim().length <= PDF_RULES.heading_characters) {
          Object.assign(t, { role: "heading", basis: "font-size" });
        }
      }
    }
    let ordered = tagged;
    if (columns === "2") {
      const side = (t: Tagged) => (Math.min(...t.line.items.map((i) => i.x)) < read.widths[index]! * 0.48 ? "1" : "2");
      for (const t of body) if (t.role !== "footnote") t.column = side(t);
      // Left column, then right; heads stay where they were found, notes go last.
      const before = tagged.filter((t, i) => !body.includes(t) && i < lines.length / 2);
      const after = tagged.filter((t) => !body.includes(t) && !before.includes(t));
      ordered = [...before, ...body.filter((t) => t.column === "1"), ...body.filter((t) => t.column === "2"), ...body.filter((t) => !t.column), ...after];
    }
    const blocks = blocksOf(ordered);
    const undetermined = [
      "paragraphs", "block-quotes", "tables", "captions", "figures",
      ...(blocks.some((b) => b.role === "heading") ? [] : ["headings"]),
      ...(blocks.some((b) => b.role === "footnote") ? [] : ["footnotes"]),
      ...(lines.length > 0 && label.label === undefined ? ["folio"] : []),
      ...(lines.length > 0 && columns === "undetermined" ? ["reading-order"] : []),
    ];
    return { index, label, columns, undetermined: lines.length > 0 ? undetermined : [], blocks, ...(lines.length === 0 ? { note: "The file's text layer holds no text on this page." } : {}) };
  });
}

export function convertPdf(read: PdfText, options: PdfStructureOptions): Converted {
  if (!read.pages.some((p) => /\S/u.test(p))) {
    throw new Unconvertible("There is no machine-readable text: no page of this PDF has a text layer, as with a scan that was never put through character recognition. Its text has to come from a recognition tool you run, or be typed, as a transcription.");
  }
  const empty = read.lines.filter((l) => l.length === 0).length;
  const produced = [read.info.producer && `producer ${read.info.producer}`, read.info.creator && `creator ${read.info.creator}`].filter(Boolean).join("; ");
  return {
    paged: true, coverage: "all", page_count: read.pages.length, parts: structurePdf(read, options),
    identity: {
      ...(read.info.title ? { title: read.info.title } : {}), ...(read.info.author ? { contributors: [read.info.author] } : {}),
      ...(read.info.title || read.info.author ? { basis: "the PDF's document information" } : {}),
    },
    method: options.recognized ? "ocr" : "text_layer",
    tools: [read.tool, converterTool],
    ...(options.recognized ? { recognition: `Character recognition that made the PDF's text layer; engine not stated by the file${produced ? ` (${produced})` : ""}` } : {}),
    notes: [
      "Text is read from the PDF's text layer and was not compared with the page images by this conversion.",
      ...(empty > 0 ? [`${empty} of ${read.pages.length} pages have no text in the text layer.`] : []),
      ...(produced && !options.recognized ? [`The PDF names its ${produced}.`] : []),
    ],
  };
}

export { block };
