// The "same information" comparison of CONTRACT-003 C, written apart from the
// exporter. The CSL-JSON one shares no code with the codec either. The BibLaTeX
// and RIS ones read with the codec's parser, so tests also state expected values.
import { parseLibrary } from "../packages/intake/src/legacy-import.ts";
import type { LegacyFormat, ParsedBlock } from "../packages/intake/src/legacy.ts";

/** A JSON text as one string with object members sorted and number text as written. */
export function jsonInformation(text: string): string {
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\]:,]/g)!;
  let at = 0;
  const value = (): string => {
    const token = tokens[at++]!;
    if (token === "[") {
      const list: string[] = [];
      while (tokens[at] !== "]") {
        list.push(value());
        if (tokens[at] === ",") at++;
      }
      at++;
      return `[${list.join(",")}]`;
    }
    if (token === "{") {
      const members: string[] = [];
      while (tokens[at] !== "}") {
        const name = JSON.stringify(JSON.parse(tokens[at++]!));
        at++;
        members.push(`${name}:${value()}`);
        if (tokens[at] === ",") at++;
      }
      at++;
      return `{${members.sort().join(",")}}`;
    }
    return token.startsWith('"') ? JSON.stringify(JSON.parse(token)) : token;
  };
  return value();
}

function taggedInformation(format: LegacyFormat, text: string) {
  const read = parseLibrary(format, text);
  if (read.faults.length > 0) throw new Error(`unreadable: ${read.faults[0]!.code} at line ${read.faults[0]!.line}`);
  const fold = (s: string) => (format === "biblatex" ? s.toLowerCase() : s);
  const entries = read.entries.map((e) => {
    // Field order is free; the order of one name's values is not.
    const fields = new Map<string, string[]>();
    for (const f of e.fields) fields.set(fold(f.name), [...(fields.get(fold(f.name)) ?? []), `${f.encoding}:${f.value}`]);
    return JSON.stringify([e.key ?? null, fold(e.type ?? ""), [...fields].sort(([a], [b]) => (a < b ? -1 : 1))]);
  });
  const joins = (b: ParsedBlock) => b.kind === "comment" || b.kind === "header" || b.kind === "other";
  const lines = read.blocks.filter(joins).flatMap((b) => b.text.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean).sort();
  const others = read.blocks.filter((b) => !joins(b)).map((b) => `${b.kind}:${b.text}`).sort();
  return { entries: entries.sort(), lines, others };
}

export function information(format: LegacyFormat, text: string): unknown {
  return format === "csl_json" ? jsonInformation(text) : taggedInformation(format, text);
}
