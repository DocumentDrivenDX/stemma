// Import of one library file (CONTRACT-003 B, SD-003): one import batch and one
// candidate source for each entry, built in memory, or nothing. It writes no
// file; the caller saves the whole result as one staged write.
import { isObject, type JsonObject, KINDS, RECORD_SCHEMA, sha256 } from "@stemma/records";
import { parseBiblatex } from "./legacy-biblatex.ts";
import { parseCslJson } from "./legacy-csl.ts";
import { mapEntry, mappedDigest, type Mapped } from "./legacy-map.ts";
import { parseRis } from "./legacy-ris.ts";
import { CODEC_VERSION, decodeText, type Issue, LEGACY_LIMITS, type LegacyFormat, LimitExceeded, type Limits, looksLocal, type Parsed, type ParsedEntry } from "./legacy.ts";

export interface Actor { kind: "person" | "software" | "model"; name: string; version?: string }

export interface ImportOptions {
  format: LegacyFormat;
  /** The original's path or name. Only its file name is saved. */
  fileName: string;
  /** The time of the import, RFC 3339. */
  at: string;
  actor: Actor;
  activity?: string;
  /** A new record ID that starts with `prefix`. */
  newId: (prefix: string) => string;
  /** Every citation key and alias the project holds, retired sources' included. */
  keysInUse?: Iterable<string>;
  /** The project's earlier import batches. */
  earlier?: Iterable<{ id: string; original_sha256: string }>;
  /** Import bytes that were imported before. */
  again?: boolean;
  limits?: Limits;
}

export interface ImportReport {
  format: LegacyFormat;
  codec_version: string;
  variant?: string;
  entry_count: number;
  notes: Issue[];
  /** Native field names preserved with no record field, with how many entries hold each. */
  unmapped_fields: { name: string; count: number }[];
  /** Records whose native type has no CSL counterpart. */
  unrecognized_types: { record: string; type: string }[];
  without_key: string[];
  key_collisions: { key: string; records: string[]; in_use: boolean }[];
  possible_duplicates: { reason: "same_doi" | "same_title_author_year"; records: string[] }[];
  /** Preserved values that look like a local absolute path. The values are not repeated. */
  local_paths: { record: string; native_path: string }[];
  /** Records whose entry names `crossref` or `xdata`. Nothing is inherited into them. */
  inherits: string[];
  /** Records made from `@xdata` or `@set` entries. */
  not_single_works: string[];
}

export type ImportResult =
  | { status: "imported"; batch: JsonObject; sources: JsonObject[]; report: ImportReport }
  | { status: "already_imported"; sha256: string; batches: string[] }
  | {
    status: "failed";
    code: "import_parse_error" | "input_limit";
    faults: Issue[];
    /** Entries accounted for, or absent where reading stopped at a limit. */
    entries?: { read: number; unread: number };
    /** True when reading stopped at the cap on listed faults. */
    more: boolean;
  };

export function parseLibrary(format: LegacyFormat, text: string, limits: Limits = LEGACY_LIMITS): Parsed {
  if (format === "biblatex") return parseBiblatex(text, limits);
  if (format === "ris") return parseRis(text, limits);
  return parseCslJson(text, limits);
}

const CITATION_KEY = /^[A-Za-z0-9_]([A-Za-z0-9_:.-]{0,126}[A-Za-z0-9_])?$/;
const fold = (text: string): string => text.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function groups(pairs: [string, string][]): string[][] {
  const by = new Map<string, string[]>();
  for (const [key, id] of pairs) {
    const list = by.get(key);
    if (list) list.push(id);
    else by.set(key, [id]);
  }
  return [...by.values()].filter((g) => g.length > 1);
}

function duplicatesAmong(sources: JsonObject[]): ImportReport["possible_duplicates"] {
  const dois: [string, string][] = [];
  const works: [string, string][] = [];
  for (const s of sources) {
    const id = s.id as string;
    const doi = (Array.isArray(s.identifiers) ? s.identifiers.filter(isObject) : []).find((i) => i.scheme === "doi")?.value;
    if (typeof doi === "string") dois.push([doi.toLowerCase().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:)/, ""), id]);
    const title = isObject(s.title) ? fold(String(s.title.value)) : "";
    const author = (Array.isArray(s.contributions) ? s.contributions.filter(isObject) : []).find((c) => c.role === "author")?.as_printed;
    const family = isObject(author) ? fold(String(author.family ?? author.literal ?? "")) : "";
    const year = isObject(s.issued) ? /^\d{4}/.exec(String(s.issued.edtf ?? ""))?.[0] : undefined;
    if (title && family && year) works.push([`${title} ${family} ${year}`, id]);
  }
  return [
    ...groups(dois).map((records) => ({ reason: "same_doi" as const, records })),
    ...groups(works).map((records) => ({ reason: "same_title_author_year" as const, records })),
  ];
}

function legacyEntry(batch: string, format: LegacyFormat, entry: ParsedEntry, mapped: Mapped): JsonObject {
  const nameOf = (name: string) => (format === "biblatex" ? name.toLowerCase() : name);
  const total = new Map<string, number>();
  for (const f of entry.fields) total.set(nameOf(f.name), (total.get(nameOf(f.name)) ?? 0) + 1);
  const seen = new Map<string, number>();
  // Many fields can share a path, such as one for each author, so each digest is made once.
  const digests = new Map<string, string>();
  const fields = entry.fields.map((f, i) => {
    const field: JsonObject = { native_path: f.name, value: f.value, encoding: f.encoding };
    const name = nameOf(f.name);
    if (total.get(name)! > 1) {
      const nth = seen.get(name) ?? 0;
      field.ordinal = nth;
      seen.set(name, nth + 1);
    }
    const path = mapped.paths.get(i);
    if (path !== undefined) {
      field.mapped_to = path;
      const made = digests.get(path) ?? mappedDigest(mapped.record, path);
      digests.set(path, made);
      field.mapped_sha256 = made;
    }
    return field;
  });
  const out: JsonObject = { import: batch, ordinal: entry.ordinal, entry_text: entry.text, fields };
  if (entry.key !== undefined) out.native_key = entry.key;
  if (entry.type !== undefined) out.native_type = entry.type;
  return out;
}

export function importLibrary(bytes: Uint8Array, options: ImportOptions): ImportResult {
  const limits = options.limits ?? LEGACY_LIMITS;
  const { format } = options;
  const overLimit = (limit: keyof Limits, line: number): ImportResult => ({
    status: "failed", code: "input_limit", more: false,
    faults: [{ code: "input_limit", line, name: limit, detail: `The file is over the limit ${limit} (${limits[limit]}).` }],
  });
  if (bytes.length > limits.fileBytes) return overLimit("fileBytes", 1);
  const original = sha256(bytes);
  if (!options.again) {
    const batches = [...(options.earlier ?? [])].filter((b) => b.original_sha256 === original).map((b) => b.id);
    if (batches.length > 0) return { status: "already_imported", sha256: original, batches };
  }
  const decoded = decodeText(bytes);
  if ("badLine" in decoded) {
    return {
      status: "failed", code: "import_parse_error", more: false,
      faults: [{ code: "not_utf8", line: decoded.badLine, detail: "The file is not UTF-8. Save it as UTF-8 and import it again." }],
    };
  }
  let parsed: Parsed;
  try {
    parsed = parseLibrary(format, decoded.text, limits);
  } catch (error) {
    if (error instanceof LimitExceeded) return overLimit(error.limit, error.line);
    throw error;
  }
  if (parsed.faults.length > 0) {
    return {
      status: "failed", code: "import_parse_error", faults: parsed.faults,
      entries: { read: parsed.entries.length, unread: parsed.seen - parsed.entries.length },
      more: parsed.faults.length >= limits.faults,
    };
  }

  const batchId = options.newId(KINDS.import_batch!.prefix);
  const created: JsonObject = {
    at: options.at, by: options.actor as unknown as JsonObject, import: batchId,
    ...(options.activity === undefined ? {} : { activity: options.activity }),
  };
  const report: ImportReport = {
    format, codec_version: CODEC_VERSION, entry_count: parsed.entries.length, notes: parsed.notes,
    unmapped_fields: [], unrecognized_types: [], without_key: [], key_collisions: [], possible_duplicates: [],
    local_paths: [], inherits: [], not_single_works: [],
  };
  if (parsed.variant !== undefined) report.variant = parsed.variant;

  const losses: JsonObject[] = [];
  const unmapped = new Map<string, number>();
  /** Proposed keys, by their form without ASCII case. */
  const proposed = new Map<string, { key: string; sources: JsonObject[] }>();
  const sources = parsed.entries.map((entry) => {
    const mapped = mapEntry(format, entry.type, entry.fields);
    const id = options.newId(KINDS.source!.prefix);
    const source: JsonObject = {
      schema: RECORD_SCHEMA, id, kind: "source", created,
      intake: mapped.record.title !== undefined || mapped.record.contributions !== undefined ? "parsed" : "raw",
      admission: "candidate",
      ...mapped.record,
      legacy: [legacyEntry(batchId, format, entry, mapped)],
    };
    const type = (entry.type ?? "").toLowerCase();
    if (mapped.unrecognizedType) report.unrecognized_types.push({ record: id, type: entry.type! });
    if (format === "biblatex" && (type === "xdata" || type === "set")) report.not_single_works.push(id);
    if (format === "biblatex" && entry.fields.some((f) => /^(crossref|xdata)$/i.test(f.name))) report.inherits.push(id);
    const names = new Set<string>();
    entry.fields.forEach((f, i) => {
      const name = format === "biblatex" ? f.name.toLowerCase() : f.name;
      if (!mapped.paths.has(i) && !(format === "csl_json" && (name === "id" || name === "type"))) names.add(name);
      if (looksLocal(f.value)) report.local_paths.push({ record: id, native_path: f.name });
    });
    for (const name of names) unmapped.set(name, (unmapped.get(name) ?? 0) + 1);
    for (const loss of mapped.losses) {
      losses.push({ path: `entries[${entry.ordinal}]/${entry.fields[loss.index]!.name}`, class: loss.class, note: loss.note });
    }
    const key = entry.key;
    if (key !== undefined && CITATION_KEY.test(key) && !/^\d+$/.test(key)) {
      const held = proposed.get(key.toLowerCase());
      if (held) held.sources.push(source);
      else proposed.set(key.toLowerCase(), { key, sources: [source] });
    }
    return source;
  });

  const inUse = new Set([...(options.keysInUse ?? [])].map((k) => k.toLowerCase()));
  for (const [folded, { key, sources: claimants }] of proposed) {
    if (claimants.length === 1 && !inUse.has(folded)) claimants[0]!.citation_key = key;
    else report.key_collisions.push({ key, records: claimants.map((s) => s.id as string), in_use: inUse.has(folded) });
  }
  report.without_key = sources.filter((s) => s.citation_key === undefined).map((s) => s.id as string);
  report.possible_duplicates = duplicatesAmong(sources);
  report.unmapped_fields = [...unmapped].map(([name, count]) => ({ name, count })).sort((a, b) => (a.name < b.name ? -1 : 1));

  const batch: JsonObject = {
    schema: RECORD_SCHEMA, id: batchId, kind: "import_batch", created,
    format, codec: { name: `stemma-${format.replace("_", "-")}`, version: CODEC_VERSION },
    original_name: options.fileName.split(/[\\/]/).at(-1)!, original_sha256: original, size: bytes.length,
    entry_count: sources.length,
    blocks: parsed.blocks.map((b, ordinal) => ({ kind: b.kind, text: b.text, ordinal })),
    losses,
  };
  return { status: "imported", batch, sources, report };
}
