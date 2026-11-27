// The projection of records into graph entities and links (CONTRACT-005 E, for
// the author audience, and F). Types, fields and reference fields come from the
// record schema; only the rules the schema cannot express are listed here.
// Nothing is dropped without being counted.
import {
  citationKeys, compareCodePoints, type Corpus, type FieldSpec, idOf, isObject, isRetired, type Json, type JsonObject, KIND_TYPES,
  type LoadedFile, REFERENCES, searchFold, TYPES,
} from "@stemma/records";
import type { RecordStates } from "@stemma/core";

export class ExportMappingError extends Error {}

/**
 * Fields that hold a file path or file name. Stemma's own path fields are
 * project-relative, but a file name can still say where something is kept.
 */
export const PATH_FIELDS = new Set([
  "LegacyField.native_path", "ImportBatch.original_name", "LossItem.path", "Image.file_path",
  "Chapter.manuscript_path", "GoverningRecord.path", "PageEntry.file",
]);
/** Preserved legacy content, which every export leaves out. */
const LEGACY_FIELDS = new Set(["ImportBatch.blocks"]);
/** The list of a source file's parts. The parts and their text are not in the graph. */
const PART_LISTS = new Set(["SourceText.pages"]);
/** A value that is a path on someone's machine, in whatever field it was put. */
const LOCAL_PATH = /^\s*(file:|~[\\/]|[A-Za-z]:[\\/]|\\\\|\/(Users|home|private|tmp|var|Volumes|mnt|media|opt|root|etc|srv)\/)/i;

/** Types the explorer searches. arras searches at most 20 types in one query, taken in declaration order. */
export const SEARCHED_TYPES = [
  "Source", "Claim", "Passage", "Note", "Citation", "Agent", "Chapter", "Construct", "Method", "SupportRecord",
  "Attestation", "Inference", "Annotation", "SourceText", "Place", "PlaceName", "PlaceLocation", "PlaceAssertion", "Search", "Plan",
];

/** Value types that are links with data of their own: a link ID and a reference (CONTRACT-005 F). */
export const ENTRY_TYPES = Object.keys(TYPES).filter((name) =>
  TYPES[name]!.lid !== undefined && Object.keys(REFERENCES).some((path) => {
    const owner = ownersOf(name)[0];
    return owner !== undefined && path.startsWith(`${owner}.`) && Object.hasOwn(TYPES[name]!, path.slice(owner.length + 1));
  }));

/** The `<kind>.<field>` paths that hold a value type directly on a record. */
function ownersOf(valueType: string): string[] {
  return Object.entries(KIND_TYPES).flatMap(([kind, type]) => Object.entries(TYPES[type]!)
    .filter(([, spec]) => typeof spec.type === "object" && spec.type.value === valueType)
    .map(([field]) => `${kind}.${field}`));
}

/** Declaration order: searched types first, then the schema's order, then owned link entries. */
export const TYPE_ORDER: string[] = [
  ...SEARCHED_TYPES,
  ...Object.values(KIND_TYPES).filter((t) => !SEARCHED_TYPES.includes(t)),
  ...ENTRY_TYPES,
];

/** Value types whose strings are bookkeeping, not words an author searches for. */
const NOT_SEARCHED = new Set([
  "Stamp", "Actor", "Review", "Retirement", "SourceChange", "Geometry", "Position", "Region", "PageAnchor", "PageEntry",
  "PageAgreement", "RecheckResult", "ToolRef", "ItemBinding", "SourceBinding", "InputDigest",
]);

/** Names arras keeps for itself, lower case. */
const RESERVED = new Set(("query mutation subscription entity page ref freshness revision module status json datetime bigint decimal base64 string int float boolean id " +
  "key type version references consistency createdby createdat updatedby updatedat").split(" "));
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const KEY = /^[A-Za-z0-9._:-]{1,128}$/;

const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const camel = (parts: string[]) => lower(parts.flatMap((p) => p.split("_")).map(upper).join(""));

/** A property name from the field path: `kind`, `type` and `version` are renamed (CONTRACT-005 F), and so is a reserved name. */
export function propertyName(path: string[]): string {
  const [first] = path;
  const name = path.length === 1 && ["kind", "type", "version"].includes(first!) ? `record${upper(first!)}` : camel(path);
  return RESERVED.has(name.toLowerCase()) ? `record${upper(name)}` : name;
}

export const relationshipName = (source: string, path: string[], target: string): string => `${lower(source)}${upper(camel(path))}${target}`;

export function checkName(name: string): string {
  if (!NAME.test(name) || RESERVED.has(name.toLowerCase())) throw new ExportMappingError(`arras does not accept the name ${name}.`);
  return name;
}

export interface Property { type: "string" | "integer" | "boolean"; many: boolean; order: number[] }

export interface Entity {
  type: string;
  key: string;
  properties: Record<string, Json>;
}

export interface Link {
  relationship: string;
  source: string;
  target: string;
}

export interface Relationship { name: string; sourceType: string; targetType: string; path: string[] }

export interface Count { type: string; reason: string; count: number }
export interface DroppedLink { relationship: string; reason: string; count: number }

export interface Warning { code: "restricted_in_project" | "large_graph"; message: string; records: string[] }

export interface Projection {
  /** Entities in declaration order of their type, then key by code point. */
  entities: Entity[];
  /** Links in declaration order of their relationship, then source and target. */
  links: Link[];
  types: string[];
  relationships: Relationship[];
  properties: Map<string, Map<string, Property>>;
  omissions: Count[];
  dropped: DroppedLink[];
  warnings: Warning[];
}

interface PendingLink { sourceType: string; source: string; path: string[]; targetId: string }

class Tally {
  private readonly counts = new Map<string, number>();
  add(a: string, b: string, count = 1): void {
    const key = `${a}\0${b}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + count);
  }
  list(): [string, string, number][] {
    return [...this.counts].sort(([a], [b]) => compareCodePoints(a, b)).map(([key, n]) => [...(key.split("\0") as [string, string]), n]);
  }
}

class Walker {
  readonly omitted = new Tally();
  readonly entries: { entity: Entity; searched: string[] }[] = [];
  readonly links: PendingLink[] = [];
  readonly properties = new Map<string, Map<string, Property>>();

  declare(type: string, name: string, spec: Omit<Property, "order">, order: number[]): void {
    const of = this.properties.get(type) ?? new Map<string, Property>();
    this.properties.set(type, of);
    const known = of.get(name);
    if (!known) {
      checkName(name);
      const clash = [...of.keys()].find((n) => n.toLowerCase() === name.toLowerCase());
      if (clash) throw new ExportMappingError(`${type}.${name} and ${type}.${clash} differ only in letter case.`);
      of.set(name, { ...spec, order });
    } else if (known.type !== spec.type || known.many !== spec.many || (known.order.join(".") !== order.join(".") && spec.type !== "string")) {
      throw new ExportMappingError(`Two fields give the property ${type}.${name} with different shapes.`);
    } else if (compareOrder(order, known.order) < 0) known.order = order;
  }

  set(entity: Entity, name: string, value: Json, spec: Omit<Property, "order">, order: number[]): void {
    if (Object.hasOwn(entity.properties, name)) throw new ExportMappingError(`Two fields give the property ${entity.type}.${name}.`);
    this.declare(entity.type, name, spec, order);
    entity.properties[name] = value;
  }

  /** A scalar as it goes into the graph, or undefined when it is left out. */
  private scalar(value: Json, counted: string): Json | undefined {
    if (typeof value === "string" && LOCAL_PATH.test(value)) {
      this.omitted.add(counted, "local_path");
      return undefined;
    }
    return value === null || value === "" ? undefined : value;
  }

  /**
   * Flattens one object into `entity`. `path` names fields from the entity,
   * `refPath` is the schema's relationship name, and `searched` collects the words.
   */
  walk(entity: Entity, typeName: string, value: JsonObject, at: { path: string[]; refPath: string; order: number[]; searched: string[] | undefined; top: boolean }): void {
    const fields = TYPES[typeName]!;
    const names = Object.keys(fields);
    for (const key of Object.keys(value).sort(compareCodePoints)) {
      if (!Object.hasOwn(fields, key)) {
        this.omitted.add(entity.type, at.top && key === "x" ? "extension" : "unrecognized_field");
        continue;
      }
      const spec: FieldSpec = fields[key]!;
      const field = `${typeName}.${key}`;
      const reason = at.top && key === "legacy" ? "legacy" : LEGACY_FIELDS.has(field) ? "legacy" : PATH_FIELDS.has(field) ? "local_path" : PART_LISTS.has(field) ? "part_list" : undefined;
      if (reason) {
        this.omitted.add(entity.type, reason);
        continue;
      }
      // `id` becomes recordId; `schema` is the format's own marker.
      if (at.top && (key === "id" || key === "schema")) continue;
      const item = value[key]!;
      const path = [...at.path, key];
      const refPath = `${at.refPath}.${key}`;
      const order = [...at.order, names.indexOf(key)];
      const many = spec.many === true;
      const items = many ? (Array.isArray(item) ? item : []) : [item];

      if (Object.hasOwn(REFERENCES, refPath)) {
        for (const one of items) if (typeof one === "string") this.links.push({ sourceType: entity.type, source: entity.key, path, targetId: one });
        continue;
      }
      if (typeof spec.type === "object") {
        const valueType = spec.type.value;
        const searched = NOT_SEARCHED.has(valueType) ? undefined : at.searched;
        if (at.top && ENTRY_TYPES.includes(valueType)) {
          for (const one of items.filter(isObject)) this.entry(entity, valueType, one, path, refPath, searched);
        } else if (valueType === "Text" && !many) {
          if (isObject(item)) this.text(entity, item, path, order, searched);
        } else if (many) {
          // A repeated object becomes one line of text for each item; what refers elsewhere also becomes a link.
          const lines = items.filter(isObject).flatMap((one) => {
            const line: Entity = { type: entity.type, key: entity.key, properties: {} };
            const scratch = new Walker();
            scratch.walk(line, valueType, one, { path: [], refPath, order: [], searched, top: false });
            for (const [of, why, count] of scratch.omitted.list()) this.omitted.add(of, why, count);
            this.links.push(...scratch.links.map((l) => ({ ...l, path: [...path, ...l.path] })));
            const parts = Object.keys(TYPES[valueType]!).map((f) => propertyName([f]));
            const found = Object.entries(line.properties).sort(([a], [b]) => partRank(parts, a) - partRank(parts, b) || compareCodePoints(a, b));
            const words = found.map(([name, v]) => `${name}: ${[v].flat().join(", ")}`).join("; ");
            return words ? [words] : [];
          });
          if (lines.length > 0) this.set(entity, propertyName(path), lines, { type: "string", many: true }, order);
        } else if (isObject(item)) {
          this.walk(entity, valueType, item, { path, refPath, order, searched, top: false });
        }
        continue;
      }
      const type = spec.type === "integer" ? "integer" : spec.type === "boolean" ? "boolean" : "string";
      const kept = items.flatMap((one) => {
        const out = this.scalar(one, entity.type);
        return out === undefined ? [] : [out];
      });
      if (kept.length === 0) continue;
      // arras shows a list as tags, which hold text only.
      this.set(entity, propertyName(path), many ? kept.map(String) : kept[0]!, { type: many ? "string" : type, many }, order);
      if (at.searched && spec.type === "string" && !spec.values && !/(sha256|^lid$)/.test(key)) at.searched.push(...kept.map(String));
    }
  }

  /** Multilingual text: the value, with its other forms as their own properties. */
  private text(entity: Entity, text: JsonObject, path: string[], order: number[], searched: string[] | undefined): void {
    const put = (name: string, value: Json, many: boolean, rank: number) => {
      this.set(entity, name, value, { type: "string", many }, [...order, rank]);
      searched?.push(...[value].flat().map(String));
    };
    const base = propertyName(path);
    for (const key of Object.keys(text)) if (!Object.hasOwn(TYPES.Text!, key)) this.omitted.add(entity.type, "unrecognized_field");
    if (typeof text.value === "string" && this.scalar(text.value, entity.type) !== undefined) put(base, text.value, false, 0);
    if (typeof text.lang === "string") this.set(entity, `${base}Lang`, text.lang, { type: "string", many: false }, [...order, 1]);
    const variants = (Array.isArray(text.variants) ? text.variants : []).filter(isObject);
    for (const [kind, suffix, rank] of [["original", "Original", 2], ["transliteration", "Romanized", 3], ["translation", "Translated", 4]] as const) {
      const values = variants.filter((v) => v.kind === kind).flatMap((v) => (typeof v.value === "string" && this.scalar(v.value, entity.type) !== undefined ? [v.value] : []));
      if (values.length > 0) put(`${base}${suffix}`, values, true, rank);
    }
    for (const v of variants) if (v.lang !== undefined || v.scheme !== undefined) this.omitted.add(entity.type, "variant_language_or_scheme");
  }

  /** An owned link entry is an entity of its own, linked from its owner (CONTRACT-005 F). */
  private entry(owner: Entity, valueType: string, value: JsonObject, path: string[], refPath: string, searched: string[] | undefined): void {
    const key = `${owner.key}.${String(value.lid)}`;
    const entity: Entity = { type: valueType, key, properties: {} };
    const words: string[] = [];
    this.walk(entity, valueType, value, { path: [], refPath, order: [], searched: searched ? words : undefined, top: false });
    searched?.push(...words);
    this.links.push({ sourceType: owner.type, source: owner.key, path, targetId: `${valueType}\0${key}` });
    this.entries.push({ entity, searched: words });
  }
}

/** Where a flattened name stands among its value type's fields. */
const partRank = (parts: string[], name: string): number => {
  const at = parts.findIndex((p) => name === p || (name.startsWith(p) && /^[A-Z]/.test(name.slice(p.length))));
  return at < 0 ? parts.length : at;
};

export function compareOrder(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

/**
 * CONTRACT-001 H and CONTRACT-005 E: a restricted location shows only a broad
 * area its author released. A record that wrongly holds more is reported, and
 * the geometry never reaches the export, nor does a digest made from it.
 */
export function restrictedExcess(data: JsonObject): boolean {
  if (data.kind !== "place_location" || !isObject(data.sensitivity) || data.sensitivity.class !== "restricted" || data.geometry === undefined) return false;
  return !(data.sensitivity.release === "area" && isObject(data.geometry) && data.geometry.type === "Polygon");
}

/** The record as it may be exported, given which records hold restricted geometry. */
function releasable(data: JsonObject, excess: Set<string>, omit: (reason: string) => void): JsonObject {
  let out = data;
  const id = String(data.id);
  if (excess.has(id)) {
    const { geometry: _g, ...rest } = out;
    out = rest;
    omit("restricted_geometry");
    // A digest of the record's content is derived from the restricted value.
    if (isObject(out.review) && out.review.content_sha256 !== undefined) {
      const { content_sha256: _d, ...review } = out.review;
      out = { ...out, review };
      omit("restricted_digest");
    }
  }
  if (isObject(out.item) && excess.has(String(out.item.record)) && out.item.content_sha256 !== undefined) {
    const { content_sha256: _d, ...item } = out.item;
    out = { ...out, item };
    omit("restricted_digest");
  }
  return out;
}

const cut = (text: string, most = 160): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  const points = Array.from(flat);
  return points.length <= most ? flat : `${points.slice(0, most - 1).join("")}…`;
};

export const typeWords = (type: string): string => upper(type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/\bai\b/, "AI"));

const personName = (name: Json | undefined): string => {
  if (!isObject(name)) return "";
  if (typeof name.literal === "string") return name.literal;
  const family = [name.particle, name.family].filter((p) => typeof p === "string").join(" ");
  return [family, name.given, name.suffix].filter((p) => typeof p === "string" && p !== "").join(", ");
};

const HEADING_FIELDS = [
  "title", "label", "name", "text", "statement", "quoteExact", "body", "quotation", "sentenceText", "citationKey",
  "recordKey", "query", "summary", "identityTitle", "url", "caption", "check", "originalName",
];
const HEADING_KINDS = ["stance", "relation", "action", "outcome", "effect", "recordType", "verdict", "method", "role", "resolver", "scope", "checkpoint"];

/** What a record is called in lists and search results. */
function headingOf(entity: Entity, data: JsonObject): string {
  const p = entity.properties;
  if (entity.type === "SupportRecord") return cut(`Model judgment: ${String(p.verdict ?? "no verdict")} (${String(p.model ?? "model not named")})`);
  if (entity.type === "Agent" && personName(data.name)) return cut(personName(data.name));
  if (entity.type === "Contribution") {
    return cut([String(p.role ?? "contribution"), personName(data.as_printed)].filter(Boolean).join(": "));
  }
  const field = HEADING_FIELDS.find((f) => typeof p[f] === "string");
  if (field) return cut(String(p[field]));
  const kind = HEADING_KINDS.find((f) => typeof p[f] === "string");
  return cut(kind ? `${typeWords(entity.type)}: ${String(p[kind])}` : `${typeWords(entity.type)} ${entity.key}`);
}

export const SUPPORT_NOTICE = "A recorded model judgment, not verification. It says what a model answered, not that the source supports the claim.";

export function project(corpus: Corpus, states: RecordStates): Projection {
  const walker = new Walker();
  const droppedTally = new Tally();
  const readable = corpus.records.filter((f): f is LoadedFile & { data: JsonObject } => f.state === "ok" && f.data !== undefined && idOf(f) !== undefined);
  const excess = new Set(readable.filter((f) => restrictedExcess(f.data)).map((f) => idOf(f)!));
  const typeOf = new Map<string, string>();
  const exported: { entity: Entity; data: JsonObject; searched: string[] | undefined }[] = [];

  for (const file of readable) {
    const data = file.data;
    const type = KIND_TYPES[String(data.kind)];
    if (!type) throw new ExportMappingError(`No type is declared for the record kind ${String(data.kind)}.`);
    if (isRetired(data)) {
      walker.omitted.add(type, "retired");
      for (const reference of file.references.filter((r) => !r.field.startsWith("/legacy/"))) {
        droppedTally.add(`${String(data.kind)}${reference.field.replace(/\/\d+/g, "").replaceAll("/", ".")}`, "from_retired_record");
      }
      continue;
    }
    const key = idOf(file)!;
    if (!KEY.test(key)) throw new ExportMappingError(`arras does not accept the key of ${file.path}.`);
    typeOf.set(key, type);
    const entity: Entity = { type, key, properties: {} };
    const searched = SEARCHED_TYPES.includes(type) ? [] as string[] : undefined;
    walker.walk(entity, type, releasable(data, excess, (reason) => walker.omitted.add(type, reason)), {
      path: [], refPath: String(data.kind), order: [], searched, top: true,
    });
    if (searched && type === "Source") searched.push(...citationKeys(data), ...agentWords(corpus, data));
    exported.push({ entity, data, searched });
  }
  for (const { entity, searched } of walker.entries) exported.push({ entity, data: {}, searched });
  const entryData = new Map<string, JsonObject>();
  for (const file of readable.filter((f) => !isRetired(f.data))) {
    for (const [field, spec] of Object.entries(TYPES[KIND_TYPES[String(file.data.kind)]!]!)) {
      if (typeof spec.type !== "object" || !ENTRY_TYPES.includes(spec.type.value)) continue;
      for (const one of (Array.isArray(file.data[field]) ? file.data[field] : []).filter(isObject)) {
        entryData.set(`${spec.type.value}\0${idOf(file)}.${String(one.lid)}`, one);
      }
    }
  }

  for (const item of exported) {
    const { entity } = item;
    if (!KEY.test(entity.key)) throw new ExportMappingError(`arras does not accept the key ${entity.key}.`);
    const data = item.data.id === undefined ? entryData.get(`${entity.type}\0${entity.key}`) ?? {} : item.data;
    const add = (name: string, value: Json, order: number, many = false) => walker.set(entity, name, value, { type: "string", many }, [-1, order]);
    const heading = headingOf(entity, data);
    add("recordId", entity.key, 0);
    add("heading", heading, 1);
    if (entity.type === "SupportRecord") add("stemmaNotice", SUPPORT_NOTICE, 2);
    const own = states.records.get(entity.key);
    if (own && own.length > 0) add("stemmaStates", own, 3, true);
    if (item.searched) {
      const words = [...new Set([heading, ...item.searched])].join(" ");
      walker.set(entity, "searchText", searchFold(words), { type: "string", many: false }, [Number.MAX_SAFE_INTEGER]);
    }
  }

  const types = TYPE_ORDER.filter((type) => exported.some((e) => e.entity.type === type));
  const rank = new Map(types.map((type, i) => [type, i]));
  const entities = exported.map((e) => e.entity).sort((a, b) => rank.get(a.type)! - rank.get(b.type)! || compareCodePoints(a.key, b.key));
  const present = new Set(entities.map((e) => `${e.type}\0${e.key}`));

  const relationships = new Map<string, Relationship>();
  const found = new Map<string, Link>();
  for (const link of walker.links) {
    // An entry is named by its type and key; every other target by its record ID.
    const entry = link.targetId.includes("\0") ? link.targetId.split("\0") as [string, string] : undefined;
    const target = entry ? entry[1] : link.targetId;
    const targetType = entry ? entry[0] : typeOf.get(target);
    if (!targetType || !present.has(`${targetType}\0${target}`)) {
      const file = corpus.byId.get(target);
      const reason = file?.data && isRetired(file.data) ? "target_retired" : "target_not_exported";
      droppedTally.add(`${lower(link.sourceType)}.${link.path.join(".")}`, reason);
      continue;
    }
    // An entry's link to what it refers to is named from the entry, as `contributionAgentAgent`.
    const name = checkName(relationshipName(link.sourceType, link.path, targetType));
    relationships.set(name, { name, sourceType: link.sourceType, targetType, path: link.path });
    const triple = `${name}\0${link.source}\0${target}`;
    if (found.has(triple)) droppedTally.add(name, "duplicate");
    else found.set(triple, { relationship: name, source: link.source, target });
  }
  const declared = [...relationships.values()].sort((a, b) =>
    rank.get(a.sourceType)! - rank.get(b.sourceType)! || compareCodePoints(a.path.join("."), b.path.join(".")) || rank.get(a.targetType)! - rank.get(b.targetType)!);
  const order = new Map(declared.map((r, i) => [r.name, i]));
  const links = [...found.values()].sort((a, b) =>
    order.get(a.relationship)! - order.get(b.relationship)! || compareCodePoints(a.source, b.source) || compareCodePoints(a.target, b.target));

  for (const [reason, count] of [["page_text", corpus.partFiles.length]] as const) {
    if (count > 0) walker.omitted.add("SourceText", reason, count);
  }
  for (const [type, count] of [["Manuscript", corpus.manuscript.length], ["ResearchNote", corpus.research.length], ["StandingRules", corpus.rules ? 1 : 0]] as const) {
    if (count > 0) walker.omitted.add(type, "not_exported", count);
  }

  const warnings: Warning[] = [];
  if (excess.size > 0) {
    warnings.push({
      code: "restricted_in_project",
      message: "A restricted location holds more than its author released. The geometry was left out of this export. Move the exact value to the restricted store; git history may still hold it. The data identity and corpus digest are computed over every record file, these included.",
      records: [...excess].sort(compareCodePoints),
    });
  }
  return {
    entities, links, types, relationships: declared, properties: walker.properties,
    omissions: walker.omitted.list().map(([type, reason, count]) => ({ type, reason, count })),
    dropped: droppedTally.list().map(([relationship, reason, count]) => ({ relationship, reason, count })),
    warnings,
  };
}

/** The names a source's contributors are recorded under, so that a search for one finds the source. */
function agentWords(corpus: Corpus, source: JsonObject): string[] {
  return (Array.isArray(source.contributions) ? source.contributions : []).filter(isObject).flatMap((entry) => {
    const file = typeof entry.agent === "string" ? corpus.byId.get(entry.agent) : undefined;
    if (!file?.data || file.data.kind !== "agent" || isRetired(file.data)) return [];
    const variants = (Array.isArray(file.data.variants) ? file.data.variants : []).filter(isObject).map((v) => String(v.value));
    const name = isObject(file.data.name) ? Object.values(file.data.name).map(String) : [];
    return [...name, ...variants].filter((w) => !LOCAL_PATH.test(w));
  });
}
