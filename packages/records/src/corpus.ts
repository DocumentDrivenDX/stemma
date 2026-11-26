// Loading a whole project from file bytes, and the rules that span records.
import { canonical, compareCodePoints, decodeUtf8, digest, type Json, type JsonObject, JsonUnreadable, parseJson, sha256 } from "./json.ts";
import { PROJECT_FORMAT, PROJECT_SCHEMA, RECORD_SCHEMA } from "./kinds.ts";
import { isObject, type Problem, type Reference, validateProject, validateRecord } from "./validate.ts";

export interface SourceFile {
  /** Project-relative, with `/` separators. */
  path: string;
  /** Absent when the file could not be read, for example a symbolic link. */
  bytes?: Uint8Array;
}

export interface LoadedFile {
  path: string;
  bytes?: Uint8Array;
  /** `ok` files take part in checks, including files that break a rule. */
  state: "ok" | "unreadable" | "version_unsupported" | "stray";
  unreadable?: JsonUnreadable["problem"] | "cannot_open";
  data?: JsonObject;
  canonical?: boolean;
  /** False when rewriting the file in canonical form would change a value. */
  formattable: boolean;
  problems: Problem[];
  references: Reference[];
}

function newerVersion(schema: unknown, prefix: string): boolean {
  if (typeof schema !== "string" || !schema.startsWith(`${prefix}/`)) return false;
  return Number(schema.slice(prefix.length + 1)) > PROJECT_FORMAT;
}

export function loadFile(file: SourceFile, type: "record" | "project"): LoadedFile {
  const base: LoadedFile = { path: file.path, state: "unreadable", formattable: false, problems: [], references: [] };
  if (file.bytes) base.bytes = file.bytes;
  if (type === "record" && !/^records\/.*\.json$/.test(file.path)) {
    return { ...base, state: "stray", problems: [{ reason: "record_misplaced", code: "stray_file", field: "" }] };
  }
  if (!file.bytes) return { ...base, unreadable: "cannot_open" };
  let text: string;
  let value: Json;
  let forbidden: ReturnType<typeof parseJson>["forbidden"];
  try {
    text = decodeUtf8(file.bytes);
    ({ value, forbidden } = parseJson(text));
  } catch (error) {
    if (error instanceof JsonUnreadable) return { ...base, unreadable: error.problem };
    throw error;
  }
  const prefix = (type === "record" ? RECORD_SCHEMA : PROJECT_SCHEMA).split("/")[0]!;
  if (isObject(value) && (newerVersion(value.schema, prefix) || (type === "project" && Number(value.format) > PROJECT_FORMAT))) {
    return { ...base, state: "version_unsupported" };
  }
  const validation = type === "record" ? validateRecord(value, file.path) : validateProject(value);
  const loaded: LoadedFile = {
    ...base,
    state: "ok",
    // CRLF from a checkout does not make a record non-canonical (US-085-AC6).
    canonical: text.replace(/\r\n/g, "\n") === canonical(value),
    formattable: forbidden.length === 0,
    problems: [
      ...forbidden.map((f): Problem => ({ reason: "record_invalid", code: f.problem, field: f.field })),
      ...validation.problems,
    ],
    references: validation.references,
  };
  if (isObject(value)) loaded.data = value;
  return loaded;
}

export interface ProjectContent {
  settings: SourceFile;
  records: SourceFile[];
  rules?: SourceFile;
  manuscript: SourceFile[];
}

export interface Corpus {
  settings: LoadedFile;
  records: LoadedFile[];
  /** Readable records by ID. */
  byId: Map<string, LoadedFile>;
  rules?: SourceFile;
  manuscript: SourceFile[];
}

export const idOf = (file: LoadedFile): string | undefined =>
  typeof file.data?.id === "string" ? file.data.id : undefined;

export const isRetired = (data: JsonObject): boolean => data.retired !== undefined;

export function citationKeys(source: JsonObject): string[] {
  const aliases = Array.isArray(source.key_aliases) ? source.key_aliases : [];
  return [source.citation_key, ...aliases].filter((k): k is string => typeof k === "string");
}

function checkKeys(sources: LoadedFile[]): void {
  const holders = new Map<string, { file: LoadedFile; field: string }[]>();
  for (const file of sources) {
    const data = file.data!;
    const fields: [Json | undefined, string][] = [[data.citation_key, "/citation_key"]];
    if (Array.isArray(data.key_aliases)) data.key_aliases.forEach((k, i) => fields.push([k, `/key_aliases/${i}`]));
    for (const [key, field] of fields) {
      if (typeof key !== "string") continue;
      const folded = key.replace(/[A-Z]/g, (c) => c.toLowerCase());
      holders.set(folded, [...(holders.get(folded) ?? []), { file, field }]);
    }
  }
  // CONTRACT-001 C: the replacement of a retired source MAY hold its keys as aliases.
  const handedOver = (old: LoadedFile, other: { file: LoadedFile; field: string }) => {
    const retired = old.data!.retired;
    return isObject(retired) && retired.replaced_by === idOf(other.file) && other.field.startsWith("/key_aliases/");
  };
  for (const list of holders.values()) {
    for (const entry of list) {
      const clash = list.find((o) => o !== entry && !handedOver(entry.file, o) && !handedOver(o.file, entry));
      if (!clash) continue;
      entry.file.problems.push({ reason: "record_invalid", code: "duplicate_citation_key", field: entry.field, target: clash.file.path });
    }
  }
}

function checkReferences(file: LoadedFile, byId: Map<string, LoadedFile>, unreadableIds: Set<string>): void {
  for (const reference of file.references) {
    const target = byId.get(reference.id);
    // An unreadable target is already reported as such.
    if (!target && unreadableIds.has(reference.id)) continue;
    const code = !target ? "reference_missing"
      : !reference.allowed.includes(String(target.data!.kind)) ? "reference_wrong_kind" : undefined;
    if (code) file.problems.push({ reason: "reference_dangling", code, field: reference.field, target: reference.id });
  }
}

export function loadCorpus(content: ProjectContent): Corpus {
  const settings = loadFile(content.settings, "project");
  const records = [...content.records]
    .sort((a, b) => compareCodePoints(a.path, b.path))
    .map((file) => loadFile(file, "record"));
  const byId = new Map<string, LoadedFile>();
  const unreadableIds = new Set<string>();
  for (const file of records) {
    if (file.state !== "ok") {
      unreadableIds.add(file.path.replace(/^.*\//, "").replace(/\.json$/, ""));
      continue;
    }
    const id = idOf(file);
    if (id === undefined) continue;
    const first = byId.get(id);
    if (first) file.problems.push({ reason: "record_invalid", code: "duplicate_id", field: "/id", target: first.path });
    else byId.set(id, file);
  }
  checkKeys(records.filter((f) => f.state === "ok" && f.data?.kind === "source"));
  for (const file of [settings, ...records]) checkReferences(file, byId, unreadableIds);
  const corpus: Corpus = { settings, records, byId, manuscript: content.manuscript };
  if (content.rules) corpus.rules = content.rules;
  return corpus;
}

/** CONTRACT-001 E. An unreadable file has no canonical form, so its bytes are digested. */
export function corpusDigest(corpus: Corpus): string {
  const lines: [string, string][] = [corpus.settings, ...corpus.records].map((file) => [
    file.path,
    file.data ? digest(file.data) : file.bytes ? sha256(file.bytes) : "unreadable",
  ]);
  if (corpus.rules) {
    const text = corpus.rules.bytes ? new TextDecoder().decode(corpus.rules.bytes).replace(/\r\n?/g, "\n") : "unreadable";
    lines.push([corpus.rules.path, sha256(text)]);
  }
  return sha256(lines.sort((a, b) => compareCodePoints(a[0], b[0])).map(([p, d]) => `${p}\t${d}\n`).join(""));
}
