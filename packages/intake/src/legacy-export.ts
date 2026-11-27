// Replay of an unedited batch into its own format, from the preserved data
// (CONTRACT-003 C, D; SD-003). It cannot yet write an edited value, so it writes
// nothing when a record no longer matches what was preserved.
import { digest, isObject, isRetired, type JsonObject } from "@stemma/records";
import { parseLibrary } from "./legacy-import.ts";
import { mapEntry, mappedValue } from "./legacy-map.ts";
import { CODEC_VERSION, type LegacyFormat, type ParsedBlock, type ParsedEntry, type ParsedField } from "./legacy.ts";

export interface LossReport {
  schema: "stemma.loss-report/0";
  target: LegacyFormat;
  records: { record: string; items: { path: string; class: "unrepresented" | "approximated" | "representation_change"; note?: string }[] }[];
}

export type ReplayResult =
  /** `loss` covers the records' own fields, not records linked to them. */
  | { status: "written"; text: string; loss: LossReport }
  | { status: "export_unsupported"; edited: { record: string; paths: string[] }[] }
  | { status: "codec_incompatible"; version: string }
  /** The written text did not read back as the preserved data, so it is withheld. */
  | { status: "replay_mismatch" };

interface Kept { record: string; entry: ParsedEntry }

const items = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);

/** Every `mapped_to` path a record holds a value at. */
function pathsOf(record: JsonObject): string[] {
  return [
    ...(record.title === undefined ? [] : ["title"]),
    ...(record.issued === undefined ? [] : ["issued"]),
    ...items(record.contributions).map((c) => `contributions/${c.role}`),
    ...items(record.dates).map((d) => `dates/${d.variable}`),
    ...items(record.bib).map((b) => `bib/${b.name}`),
    ...items(record.identifiers).map((i) => `identifiers/${i.scheme}`),
  ];
}

/** Where a record no longer holds what the codec maps from its preserved fields. */
function editedPaths(format: LegacyFormat, record: JsonObject, entry: ParsedEntry): string[] {
  const then = mapEntry(format, entry.type, entry.fields).record;
  const differs = (path: string) => {
    const [a, b] = [mappedValue(record, path), mappedValue(then, path)];
    return a === undefined || b === undefined ? a !== b : digest(a) !== digest(b);
  };
  const paths = [...new Set([...pathsOf(record), ...pathsOf(then)])].filter(differs);
  if (record.type !== then.type) paths.push("type");
  const aliases = Array.isArray(record.key_aliases) ? record.key_aliases : [];
  const key = entry.key?.toLowerCase();
  if (key !== undefined && aliases.some((a) => String(a).toLowerCase() === key)) paths.push("citation_key");
  return paths;
}

/** Record fields that no legacy format holds. */
const OWN_FIELDS = ["subtype", "key_aliases", "tags", "changes", "relations", "extents", "rights", "locator_label", "sort_key", "bibliography_group", "as_found", "x"];

function biblatex(blocks: ParsedBlock[], kept: Kept[]): string {
  const of = (kind: ParsedBlock["kind"]) => blocks.filter((b) => b.kind === kind).map((b) => b.text);
  const unknown = new Set(kept.flatMap(({ entry }) => entry.fields.filter((f) => f.encoding === "raw")
    .flatMap((f) => f.value.split(" # ")).map((part) => part.toLowerCase())));
  const strings = of("string_definition");
  // A definition of a name that some value must keep unexpanded goes after the entries.
  const late = strings.some((s) => unknown.has(/^@\s*string\s*[{(]\s*([^\s=]+)/i.exec(s)?.[1]?.toLowerCase() ?? ""));
  const entries = kept.map(({ entry }) => {
    const fields = entry.fields.map((f) => `  ${f.name} = ${f.encoding === "raw" ? f.value : `{${f.value}}`},\n`);
    return `@${entry.type}{${entry.key},\n${fields.join("")}}`;
  });
  return [...of("comment"), ...of("preamble"), ...(late ? [] : strings), ...entries, ...(late ? strings : [])]
    .map((part) => `${part}\n`).join("\n");
}

function ris(blocks: ParsedBlock[], kept: Kept[]): string {
  const records = kept.map(({ entry }) => {
    const end = entry.fields.find((f) => f.name === "ER");
    return [
      `TY  - ${entry.type}`,
      ...entry.fields.filter((f) => f !== end).map((f) => `${f.name}  - ${f.value}`),
      `ER  - ${end?.value ?? ""}`,
    ].join("\n");
  });
  const of = (kind: ParsedBlock["kind"]) => blocks.filter((b) => b.kind === kind).map((b) => b.text);
  return [...of("header"), ...records, ...of("other")].map((part) => `${part}\n`).join("\n");
}

function cslJson(kept: Kept[]): string {
  const objects = kept.map(({ entry }) => `  {${entry.fields.map((f) => `\n    ${JSON.stringify(f.name)}: ${f.value}`).join(",")}\n  }`);
  return objects.length === 0 ? "[]\n" : `[\n${objects.join(",\n")}\n]\n`;
}

/** Whether `text` reads back as exactly the entries and file content that were to be written. */
function readsBack(format: LegacyFormat, text: string, blocks: ParsedBlock[], kept: Kept[]): boolean {
  let again;
  try {
    again = parseLibrary(format, text, { fileBytes: Infinity, entries: Infinity, depth: Infinity, fieldBytes: Infinity, expandedUnits: Infinity, faults: 1 });
  } catch {
    return false;
  }
  // A CSL-JSON key and type are read from its members. The saved copies of them have LF line endings.
  const entry = (e: ParsedEntry) => JSON.stringify([format === "csl_json" ? null : [e.type, e.key], e.fields.map((f) => [f.name, f.value, f.encoding])]);
  // Comments and text between records may join when written together, so their lines are compared.
  const loose = new Set(["comment", "header", "other"]);
  const lines = (list: ParsedBlock[]) => list.filter((b) => loose.has(b.kind))
    .flatMap((b) => b.text.split(/\r\n|\r|\n/)).map((l) => l.trim()).filter(Boolean).sort();
  const exact = (list: ParsedBlock[]) => list.filter((b) => !loose.has(b.kind)).map((b) => `${b.kind}\n${b.text}`).sort();
  return again.faults.length === 0
    && JSON.stringify(again.entries.map(entry)) === JSON.stringify(kept.map((k) => entry(k.entry)))
    && JSON.stringify(lines(again.blocks)) === JSON.stringify(lines(blocks))
    && JSON.stringify(exact(again.blocks)) === JSON.stringify(exact(blocks));
}

/** `sources` is the project's source records; those the batch did not make are ignored. */
export function replayBatch(batch: JsonObject, sources: Iterable<JsonObject>): ReplayResult {
  const format = batch.format as LegacyFormat;
  const version = String(isObject(batch.codec) ? batch.codec.version : "");
  if (version !== CODEC_VERSION) return { status: "codec_incompatible", version };

  const loss: LossReport = { schema: "stemma.loss-report/0", target: format, records: [] };
  const edited: { record: string; paths: string[] }[] = [];
  const kept: Kept[] = [];
  for (const source of sources) {
    const legacy = items(source.legacy);
    const mine = legacy.find((e) => e.import === batch.id);
    if (!mine) continue;
    const record = String(source.id);
    if (isRetired(source)) {
      loss.records.push({ record, items: [{ path: "", class: "unrepresented", note: "A retired source is not exported." }] });
      continue;
    }
    const fields = items(mine.fields).map((f): ParsedField => ({
      name: String(f.native_path), value: String(f.value ?? ""), encoding: f.encoding as ParsedField["encoding"], line: 0,
    }));
    const entry: ParsedEntry = {
      ordinal: Number(mine.ordinal), line: 0, text: "", fields,
      ...(typeof mine.native_key === "string" ? { key: mine.native_key } : {}),
      ...(typeof mine.native_type === "string" ? { type: mine.native_type } : {}),
    };
    const paths = editedPaths(format, source, entry);
    if (paths.length > 0) edited.push({ record, paths });
    kept.push({ record, entry });
    const own: LossReport["records"][number]["items"] = OWN_FIELDS.filter((f) => source[f] !== undefined)
      .map((path) => ({ path, class: "unrepresented" as const }));
    if (legacy.length > 1) own.push({ path: "legacy", class: "unrepresented", note: "Data preserved from other imports." });
    if (own.length > 0) loss.records.push({ record, items: own });
  }
  if (edited.length > 0) return { status: "export_unsupported", edited };
  kept.sort((a, b) => a.entry.ordinal - b.entry.ordinal);

  const blocks = items(batch.blocks).sort((a, b) => Number(a.ordinal) - Number(b.ordinal))
    .map((b): ParsedBlock => ({ kind: b.kind as ParsedBlock["kind"], text: String(b.text ?? "") }));
  const text = format === "biblatex" ? biblatex(blocks, kept) : format === "ris" ? ris(blocks, kept) : cslJson(kept);
  return readsBack(format, text, blocks, kept) ? { status: "written", text, loss } : { status: "replay_mismatch" };
}
