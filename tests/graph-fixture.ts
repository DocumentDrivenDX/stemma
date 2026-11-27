// A synthetic project built from the record schema itself: every record kind,
// every field, and every pair of types that a reference field allows. It exists
// to exercise the projection and the arras limits. Its values mean nothing.
import {
  canonical, type FieldSpec, KIND_TYPES, KINDS, normalizeSentence, type ProjectContent, recordPath, REFERENCES, serializeManifest,
  sha256, type SourceFile, TYPES,
} from "@stemma/records";

type Value = Record<string, unknown>;
const AT = "2026-01-05T09:00:00Z";
const file = (path: string, text: string): SourceFile => ({ path, bytes: new TextEncoder().encode(text) });
export const recordFile = (record: Value): SourceFile => file(recordPath(String(record.kind), String(record.id)), canonical(record));

/** The reference paths below a record kind, with the kinds each may name. */
const referencesOf = (kind: string) => Object.entries(REFERENCES).filter(([path]) => path.startsWith(`${kind}.`));

/** How many records of a kind it takes for every reference field to name each kind it allows. */
const copies = (kind: string) => Math.max(1, ...referencesOf(kind).filter(([p]) => !p.endsWith(".replaced_by")).map(([, allowed]) => allowed.length));

export const fixtureId = (kind: string, n = 0): string => `${KINDS[kind]!.prefix}fixture${String(n).padStart(4, "0")}`;

function scalar(spec: FieldSpec, name: string, path: string): unknown {
  if (spec.values) return spec.values[0];
  if (spec.type === "boolean") return true;
  if (spec.type === "integer") return 1;
  if (spec.type === "date-time") return AT;
  if (/sha256$/.test(name)) return sha256(path);
  return `${path.replaceAll("_", " ")} value`;
}

/** `number` picks which of the allowed kinds each reference of this record names. */
function build(typeName: string, refPath: string, number: number, skip: Set<string>): Value {
  const out: Value = {};
  for (const [name, spec] of Object.entries(TYPES[typeName]!)) {
    const path = `${refPath}.${name}`;
    if (skip.has(name)) continue;
    const allowed = REFERENCES[path];
    if (allowed) {
      if (name === "replaced_by") continue;
      const kinds = allowed.filter((k) => k !== "project");
      const ids = spec.many ? kinds.map((k) => fixtureId(k)) : [fixtureId(kinds[number % kinds.length]!)];
      out[name] = spec.many ? ids : ids[0];
    } else if (typeof spec.type === "object") {
      const one = build(spec.type.value, path, number, new Set());
      out[name] = spec.many ? [one] : one;
    } else out[name] = spec.many ? [scalar(spec, name, path)] : scalar(spec, name, path);
  }
  return out;
}

/** Every kind of other form, so that each property of multilingual text is made. */
function variants(value: unknown): void {
  if (Array.isArray(value)) value.forEach(variants);
  else if (typeof value === "object" && value !== null) {
    const out = value as Value;
    if (Array.isArray(out.variants) && out.value !== undefined) {
      out.variants = TYPES.TextVariant!.kind!.values!.map((kind) => ({ kind, value: `${kind} form`, lang: "en" }));
    }
    Object.values(out).forEach(variants);
  }
}

function fix(record: Value, n: number): Value {
  variants(record);
  const kind = String(record.kind);
  if (record.lid) delete record.lid;
  for (const list of ["contributions", "relations"]) {
    for (const [i, entry] of ((record[list] ?? []) as Value[]).entries()) entry.lid = `e${i}`;
  }
  if (kind === "source") {
    record.citation_key = `fixture${n}`;
    record.key_aliases = [`alias${n}`];
  }
  if (kind === "citation") {
    const text = normalizeSentence(`Fixture sentence ${n}.`);
    record.sentence = { text, sha256: sha256(text) };
  }
  if (kind === "authorship_mark") record.text_sha256 = sha256(normalizeSentence(String(record.text)));
  if (kind === "resolution") record.response_sha256 = sha256(String(record.response));
  if (kind === "passage") record.anchor = [{ index: 0, page_sha256: sha256("page"), stream: (TYPES.PageAnchor!.stream!.values ?? ["main"])[0], start: 0, end: 4 }];
  if (kind === "text_review") (record.reviewed as Value).by = { kind: "person", name: "A Person" };
  if (kind === "source_text") record.original = { ...(record.original as Value), form: "file" };
  if (kind === "annotation") {
    // A note binds one record or one sentence, never both.
    if (n % 2 === 0) { delete record.sentence; delete record.source; } else delete record.item;
  }
  return record;
}

export interface FixtureOptions {
  /** Changes made to a record before it is written. */
  change?: (record: Value) => void;
  /** More records, written as given. */
  extra?: Value[];
}

export function everyShape(options: FixtureOptions = {}): ProjectContent {
  const records: SourceFile[] = [];
  const sources: SourceFile[] = [];
  for (const kind of Object.keys(KIND_TYPES)) {
    // Annotations come in pairs: only one of the two bindings is held by each.
    const count = kind === "annotation" ? copies(kind) * 2 : copies(kind);
    for (let n = 0; n < count; n++) {
      const pick = kind === "annotation" ? Math.floor(n / 2) : n;
      const record = build(KIND_TYPES[kind]!, kind, pick, new Set(["retired", "x"]));
      Object.assign(record, { schema: "stemma.record/0", id: fixtureId(kind, n), kind });
      fix(record, n);
      options.change?.(record);
      if (kind === "source_text") sources.push(file(`sources/fixture-${n}/source.md`, serializeManifest({ ...record, pages: [] } as never, "")));
      else records.push(recordFile(record));
    }
  }
  records.push(...(options.extra ?? []).map(recordFile));
  return {
    settings: file("stemma.json", canonical({ schema: "stemma.project/0", project_id: "fixtureshapes", format: 0 })),
    records, sources, manuscript: [], research: [],
  };
}
