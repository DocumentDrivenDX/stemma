// coordinate.stray: the written coordinate forms listed in CONTRACT-002 C. It
// reads file text only, and a finding gives the position, never the value.
import { compareCodePoints, type Corpus, type SourceFile } from "@stemma/records";
import { result } from "../findings.ts";
import type { Result } from "../report.ts";

const DECIMAL = String.raw`[-+−]?\d{1,3}\.\d{3,}`;
const HEMI = (letters: string) => String.raw`\d{1,3}(?:\.\d+)?\s*°\s*(?:\d{1,2}(?:\.\d+)?\s*(?:′|’|')\s*)?(?:\d{1,2}(?:\.\d+)?\s*(?:″|”|\\"|")\s*)?[${letters}](?![A-Za-z])`;

export const COORDINATE_FORMS: RegExp[] = [
  // geo: URI
  /\bgeo:[-+]?\d+(?:\.\d+)?,[-+]?\d+(?:\.\d+)?/gi,
  // Degrees with hemisphere letters: latitude then longitude.
  new RegExp(`${HEMI("NSns")}[\\s,;/]*${HEMI("EWew")}`, "g"),
  // Two decimal degrees, three or more decimal places each, comma between.
  new RegExp(`(?<![\\d.])(${DECIMAL})°?\\s*,\\s*(${DECIMAL})(?![\\d]|\\.\\d)`, "g"),
];

/** Offsets of recognized coordinates in one line, without overlaps. */
export function findCoordinates(line: string): number[] {
  const spans: [number, number][] = [];
  for (const form of COORDINATE_FORMS) {
    for (const match of line.matchAll(form)) {
      if (match[1] !== undefined) {
        const [a, b] = [match[1], match[2]!].map((v) => Math.abs(Number(v.replace("−", "-")))) as [number, number];
        if (Math.max(a, b) > 180 || Math.min(a, b) > 90) continue;
      }
      const span: [number, number] = [match.index, match.index + match[0].length];
      if (!spans.some(([s, e]) => span[0] < e && s < span[1])) spans.push(span);
    }
  }
  return spans.map(([start]) => start).sort((a, b) => a - b);
}

export function scannedFiles(corpus: Corpus): SourceFile[] {
  const files: SourceFile[] = [corpus.settings, ...corpus.records, ...(corpus.rules ? [corpus.rules] : []), ...corpus.manuscript];
  return files.sort((a, b) => compareCodePoints(a.path, b.path));
}

export function coordinateResults(corpus: Corpus): Result[] {
  const check = "coordinate.stray";
  return scannedFiles(corpus).flatMap((file) => {
    const evidence = [{ name: "file", class: "location" as const, value: file.path }];
    let text: string;
    try {
      if (!file.bytes) throw new Error("unreadable");
      text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
    } catch {
      return [result({ check, outcome: "unverifiable", reason: "file_unreadable", subject: file.path, locus: file.path, evidence })];
    }
    const found = text.split("\n").flatMap((line, i) => findCoordinates(line).map((column) => ({ line: i + 1, column: column + 1 })));
    if (found.length === 0) return [result({ check, outcome: "pass", subject: file.path, locus: file.path, evidence })];
    return found.map((at, ordinal) =>
      result({
        check, outcome: "fail", reason: "coordinate_text", subject: file.path, locus: `${file.path}#${ordinal}`,
        evidence: [...evidence, { name: "position", class: "location", value: `line ${at.line}, column ${at.column}` }],
      }));
  });
}
