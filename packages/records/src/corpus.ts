// Loading a whole project from file bytes, and the rules that span records.
import { canonical, compareCodePoints, decodeUtf8, digest, type Json, type JsonObject, JsonUnreadable, parseJson, sha256 } from "./json.ts";
import { PROJECT_FORMAT, PROJECT_SCHEMA, RECORD_SCHEMA } from "./kinds.ts";
import {
  type Block, fileDigest, parseBlocks, partFile, serializeManifest, serializePart, SOURCE_DIRECTORY_NAME, splitFrontMatter,
} from "./sourcefile.ts";
import { isObject, type Problem, type Reference, validatePart, validateProject, validateRecord } from "./validate.ts";

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
  /** Every file under sources/. */
  sources: SourceFile[];
  rules?: SourceFile;
  manuscript: SourceFile[];
  /** Every file under research/: the author's and the assistant's research notes. */
  research: SourceFile[];
  /** Paths of the binary files that the project's repository holds or would take in. Finding them reads every file, so only a check asks. */
  binaries?: () => string[];
}

/** One part of a source file: a page, or a section of a source with no pages. */
export interface LoadedPart {
  index: number;
  path: string;
  front: JsonObject;
  blocks: Block[];
}

/** Why a source file's parts cannot be relied on (CONTRACT-007 H; `source.pages`). */
export interface Damage {
  code: "part_missing" | "part_edited" | "part_unlisted" | "part_unreadable" | "part_index" | "part_sequence" | "page_count";
  path: string;
  detail?: string;
}

export interface LoadedText {
  /** The manifest, which is also in `records`. */
  manifest: LoadedFile;
  /** `sources/<name>`. */
  directory: string;
  parts: LoadedPart[];
  damage: Damage[];
  /** Intact, with nothing wrong in its manifest's or parts' form: checks may use the text. */
  usable: boolean;
}

export interface Corpus {
  settings: LoadedFile;
  records: LoadedFile[];
  /** Part files, for record.valid. */
  partFiles: LoadedFile[];
  /** Source files by the ID of their manifest. */
  texts: Map<string, LoadedText>;
  sources: SourceFile[];
  /** Readable records by ID. */
  byId: Map<string, LoadedFile>;
  rules?: SourceFile;
  manuscript: SourceFile[];
  /** Notes, not records or evidence: outside the corpus digest. */
  research: SourceFile[];
  /** Binary files in the repository, by path. A project holds none. */
  binaries: () => string[];
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

const blocking = (problems: Problem[]): boolean => problems.some((p) => p.reason === "record_invalid");

const textOf = (file: SourceFile): string | undefined => {
  if (!file.bytes) return undefined;
  try {
    return decodeUtf8(file.bytes);
  } catch {
    return undefined;
  }
};

function loadManifest(file: SourceFile): { loaded: LoadedFile } {
  const base: LoadedFile = { path: file.path, state: "unreadable", formattable: false, problems: [], references: [] };
  if (file.bytes) base.bytes = file.bytes;
  const text = textOf(file);
  if (text === undefined) return { loaded: { ...base, unreadable: file.bytes ? "not_utf8" : "cannot_open" } };
  const split = splitFrontMatter(text);
  if ("problem" in split) return { loaded: { ...base, unreadable: "syntax" } };
  if (newerVersion(split.front.schema, RECORD_SCHEMA.split("/")[0]!)) return { loaded: { ...base, state: "version_unsupported" } };
  const validation = validateRecord(split.front, file.path);
  return {
    loaded: {
      ...base, state: "ok", data: split.front, formattable: true,
      canonical: text.replace(/\r\n/g, "\n") === serializeManifest(split.front, split.body),
      problems: validation.problems, references: validation.references,
    },
  };
}

function loadPart(file: SourceFile, paged: boolean): { loaded: LoadedFile; part?: LoadedPart } {
  const base: LoadedFile = { path: file.path, state: "unreadable", formattable: false, problems: [], references: [] };
  if (file.bytes) base.bytes = file.bytes;
  const text = textOf(file);
  if (text === undefined) return { loaded: { ...base, unreadable: file.bytes ? "not_utf8" : "cannot_open" } };
  const split = splitFrontMatter(text);
  if ("problem" in split) return { loaded: { ...base, unreadable: "syntax" } };
  const { blocks, problems: grammar } = parseBlocks(split.body, split.bodyLine);
  const problems: Problem[] = [
    ...validatePart(split.front, paged),
    ...grammar.map((g): Problem => ({ reason: "record_invalid", code: g.code, field: `line ${g.line}` })),
  ];
  const loaded: LoadedFile = {
    ...base, state: "ok", formattable: grammar.length === 0, problems,
    canonical: grammar.length > 0 || text.replace(/\r\n/g, "\n") === serializePart(split.front, blocks),
  };
  return { loaded, part: { index: Number(split.front.index), path: file.path, front: split.front, blocks } };
}

function loadText(directory: string, files: Map<string, SourceFile>, manifest: LoadedFile): { text: LoadedText; partFiles: LoadedFile[]; strays: SourceFile[] } {
  const data = manifest.data ?? {};
  const paged = data.paged === true;
  const damage: Damage[] = [];
  const parts: LoadedPart[] = [];
  const partFiles: LoadedFile[] = [];
  const listed = new Set<string>();
  const entries = (Array.isArray(data.pages) ? data.pages : []).filter(isObject);
  let previous = -1;
  for (const entry of entries) {
    const index = Number(entry.index);
    const path = `${directory}/${String(entry.file)}`;
    if (index <= previous || (!paged && index !== previous + 1)) damage.push({ code: "part_sequence", path, detail: `index ${index} after ${previous}` });
    previous = index;
    if (String(entry.file) !== partFile(paged, index)) damage.push({ code: "part_index", path, detail: `listed as index ${index}` });
    const file = files.get(path);
    listed.add(path);
    if (!file) {
      damage.push({ code: "part_missing", path, detail: `index ${index}` });
      continue;
    }
    const { loaded, part } = loadPart(file, paged);
    partFiles.push(loaded);
    const text = textOf(file);
    if (text === undefined || fileDigest(text) !== entry.sha256) damage.push({ code: "part_edited", path, detail: `index ${index}` });
    if (!part) damage.push({ code: "part_unreadable", path });
    else {
      if (part.index !== index) damage.push({ code: "part_index", path, detail: `the part says index ${part.index}` });
      parts.push({ ...part, index });
    }
  }
  const original = isObject(data.original) ? data.original : {};
  if (paged && data.coverage === "all" && typeof original.page_count === "number") {
    const have = new Set(entries.map((e) => Number(e.index)));
    const missing = Array.from({ length: Math.min(original.page_count, 100_000) }, (_, i) => i).filter((i) => !have.has(i));
    if (missing.length > 0 || have.size !== original.page_count) {
      damage.push({
        code: "page_count", path: manifest.path,
        detail: `the original has ${original.page_count} pages and ${have.size} are listed${missing.length > 0 ? `; missing index ${missing.slice(0, 20).join(", ")}` : ""}`,
      });
    }
  }
  const strays: SourceFile[] = [];
  for (const [path, file] of files) {
    if (listed.has(path) || path === manifest.path) continue;
    if (/^(pages\/p|sections\/s)\d{4,}\.md$/.test(path.slice(directory.length + 1))) {
      damage.push({ code: "part_unlisted", path });
      partFiles.push(loadPart(file, paged).loaded);
    } else strays.push(file);
  }
  const usable = manifest.state === "ok" && !blocking(manifest.problems) && damage.length === 0 && partFiles.every((f) => f.state === "ok" && !blocking(f.problems));
  return { text: { manifest, directory, parts, damage, usable }, partFiles, strays };
}

/** Source directories, their manifests and parts, and files that do not belong. */
function loadSources(sources: SourceFile[]) {
  const directories = new Map<string, Map<string, SourceFile>>();
  const strays: SourceFile[] = [];
  for (const file of sources) {
    const [, name, ...rest] = file.path.split("/");
    if (rest.length === 0 || !SOURCE_DIRECTORY_NAME.test(name!)) strays.push(file);
    else {
      const directory = `sources/${name}`;
      directories.set(directory, (directories.get(directory) ?? new Map()).set(file.path, file));
    }
  }
  const manifests: LoadedFile[] = [];
  const texts: LoadedText[] = [];
  const partFiles: LoadedFile[] = [];
  for (const [directory, files] of [...directories].sort(([a], [b]) => compareCodePoints(a, b))) {
    const source = files.get(`${directory}/source.md`);
    if (!source) {
      strays.push(...files.values());
      continue;
    }
    const { loaded } = loadManifest(source);
    manifests.push(loaded);
    if (loaded.state !== "ok") continue;
    const made = loadText(directory, files, loaded);
    texts.push(made.text);
    partFiles.push(...made.partFiles);
    strays.push(...made.strays);
  }
  const stray = strays.map((file): LoadedFile => ({
    path: file.path, state: "stray", formattable: false, references: [],
    problems: [{ reason: "record_misplaced", code: "stray_file", field: "" }], ...(file.bytes ? { bytes: file.bytes } : {}),
  }));
  return { manifests, texts, partFiles, stray };
}

export function loadCorpus(content: ProjectContent): Corpus {
  const settings = loadFile(content.settings, "project");
  const found = loadSources(content.sources);
  const records = [
    ...content.records.map((file) => loadFile(file, "record")),
    ...found.manifests, ...found.stray,
  ].sort((a, b) => compareCodePoints(a.path, b.path));
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
  const texts = new Map(found.texts.flatMap((t) => (idOf(t.manifest) ? [[idOf(t.manifest)!, t] as const] : [])));
  const corpus: Corpus = { settings, records, partFiles: found.partFiles, texts, sources: content.sources, byId, manuscript: content.manuscript, research: content.research, binaries: content.binaries ?? (() => []) };
  if (content.rules) corpus.rules = content.rules;
  return corpus;
}

/** CONTRACT-001 E. An unreadable file has no canonical form, so its bytes are digested. */
export function corpusDigest(corpus: Corpus): string {
  const lines: [string, string][] = [corpus.settings, ...corpus.records.filter((f) => !f.path.startsWith("sources/"))].map((file) => [
    file.path,
    file.data ? digest(file.data) : file.bytes ? sha256(file.bytes) : "unreadable",
  ]);
  for (const file of corpus.sources) {
    lines.push([file.path, file.bytes ? fileDigest(new TextDecoder().decode(file.bytes)) : "unreadable"]);
  }
  if (corpus.rules) {
    const text = corpus.rules.bytes ? new TextDecoder().decode(corpus.rules.bytes).replace(/\r\n?/g, "\n") : "unreadable";
    lines.push([corpus.rules.path, sha256(text)]);
  }
  return sha256(lines.sort((a, b) => compareCodePoints(a[0], b[0])).map(([p, d]) => `${p}\t${d}\n`).join(""));
}
