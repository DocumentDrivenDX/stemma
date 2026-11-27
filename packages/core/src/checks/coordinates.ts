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

/** Files scanned as one unit each. A source file's parts are reported together. */
export function scannedGroups(corpus: Corpus): { subject: string; files: SourceFile[] }[] {
  const single: SourceFile[] = [corpus.settings, ...corpus.records.filter((f) => !f.path.startsWith("sources/")), ...(corpus.rules ? [corpus.rules] : []), ...corpus.manuscript];
  const grouped = new Map<string, SourceFile[]>(single.map((f) => [f.path, [f]]));
  for (const file of corpus.sources) {
    const [, name, ...rest] = file.path.split("/");
    const subject = rest.length > 0 ? `sources/${name}` : file.path;
    grouped.set(subject, [...(grouped.get(subject) ?? []), file]);
  }
  return [...grouped].sort(([a], [b]) => compareCodePoints(a, b))
    .map(([subject, files]) => ({ subject, files: files.sort((a, b) => compareCodePoints(a.path, b.path)) }));
}

export function coordinateResults(corpus: Corpus): Result[] {
  const check = "coordinate.stray";
  return scannedGroups(corpus).flatMap(({ subject, files }): Result[] => {
    const grouped = files.length > 1 || files[0]!.path !== subject;
    const unreadable: string[] = [];
    const found = files.flatMap((file) => {
      let text: string;
      try {
        if (!file.bytes) throw new Error("unreadable");
        text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
      } catch {
        unreadable.push(file.path);
        return [];
      }
      return text.split("\n").flatMap((line, i) => findCoordinates(line).map((column) => ({ file: file.path, line: i + 1, column: column + 1 })));
    });
    const evidence = [{ name: "file", class: "location" as const, value: subject }];
    const out: Result[] = unreadable.map((path) => result({ check, outcome: "unverifiable", reason: "file_unreadable", subject: path, locus: path, evidence: [{ name: "file", class: "location", value: path }] }));
    if (found.length === 0) return out.length > 0 ? out : [result({ check, outcome: "pass", subject, locus: subject, evidence })];
    if (grouped) {
      // One result for a source file, with every position, so that one cause is one finding.
      return [...out, result({
        check, outcome: "fail", reason: "coordinate_text", subject, locus: subject,
        evidence: [...evidence, { name: "count", class: "metadata", value: `${found.length} position(s)` },
          { name: "positions", class: "location", value: found.map((at) => `${at.file.slice(subject.length + 1)} line ${at.line}, column ${at.column}`).join("; ") }],
      })];
    }
    return [...out, ...found.map((at, ordinal) => result({
      check, outcome: "fail", reason: "coordinate_text", subject, locus: `${subject}#${ordinal}`,
      evidence: [...evidence, { name: "position", class: "location", value: `line ${at.line}, column ${at.column}` }],
    }))];
  });
}
