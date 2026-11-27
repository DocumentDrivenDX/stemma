// Iterative capture (FR-94): a source is usable at any stage and gains details
// later. Everything here changes one source record, additively, and says who
// made each change, when, and from where. No source file is ever written, so
// text, digests and passage addresses stay as they were. A recorded value is
// never replaced unless the author asks for it.
import { canonical, citationKeys, type Corpus, idOf, isObject, isRetired, type JsonObject, KINDS, type LoadedFile, RECORD_SCHEMA, recordPath } from "@stemma/records";
import { compareLookup, describe, foldName } from "./checks/metadata.ts";
import { assertValid } from "./capture.ts";
import { type Actor, InvalidInput } from "./operations.ts";

const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
const time = (now: Date) => now.toISOString().replace(/\.\d+Z$/, "Z");
const active = (corpus: Corpus, kind: string) => corpus.records.filter((f) => f.state === "ok" && f.data?.kind === kind && !isRetired(f.data));

/** A source named by its record ID or its citation key. */
export function findSource(corpus: Corpus, name: string): LoadedFile {
  const sources = corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "source");
  const byId = sources.find((f) => idOf(f) === name);
  const found = byId ? [byId] : sources.filter((f) => !isRetired(f.data!) && citationKeys(f.data!).includes(name));
  if (found.length !== 1) throw new InvalidInput(`${found.length === 0 ? "No readable source record has" : "More than one source record has"} the ID or citation key ${name}.`);
  return found[0]!;
}

function changeable(corpus: Corpus, name: string): LoadedFile {
  const file = findSource(corpus, name);
  if (isRetired(file.data!)) throw new InvalidInput(`The source ${name} is retired.`);
  return file;
}

export interface Change { at: string; by: Actor; action: "added" | "replaced" | "removed"; field: string; value: string; previous?: string; from?: string }
export interface Written { id: string; path: string; text: string }
type Pending = Omit<Change, "at" | "by">;

/** The record with its new changes logged, ready to write; nothing when there are none. */
function rewrite(file: LoadedFile, data: JsonObject, pending: Pending[], actor: Actor, now: Date): Written | undefined {
  if (pending.length === 0) return undefined;
  const at = time(now);
  const log = pending.map((c) => ({ at, by: { ...actor }, ...c }));
  const text = canonical({ ...data, changes: [...list(data.changes), ...log] as unknown as JsonObject[], changed: { at, by: { ...actor } } });
  assertValid("Source", "source", text);
  return { id: idOf(file)!, path: file.path, text };
}

// ---------- tags ----------

const TAG = /^(?:[\p{Ll}\p{Lo}\p{N}][\p{Ll}\p{Lo}\p{M}\p{N}._-]*:)?[\p{Ll}\p{Lo}\p{N}][\p{Ll}\p{Lo}\p{M}\p{N}._-]*$/u;

export function parseTag(tag: string): string {
  if (tag.length > 80 || !TAG.test(tag)) {
    throw new InvalidInput(`"${tag}" is not a tag. A tag is lowercase letters, digits, "-", "_" or ".", with an optional namespace before one colon, such as "boring" or "position:subsidence".`);
  }
  return tag;
}

/** A tag query: a whole tag, or `namespace:` or `namespace:*` for any tag in it. */
export const tagMatches = (tags: string[], wanted: string): boolean => {
  const space = /^(.+:)\*?$/.exec(wanted)?.[1];
  return space ? tags.some((t) => t.startsWith(space)) : tags.includes(wanted);
};

export function planTags(corpus: Corpus, request: { source: string; add: string[]; remove: string[]; from?: string; actor: Actor; now: Date }) {
  const file = changeable(corpus, request.source);
  const data = file.data!;
  const add = request.add.map(parseTag);
  const remove = request.remove.map(parseTag);
  const both = add.find((t) => remove.includes(t));
  if (both) throw new InvalidInput(`${both} is both added and removed.`);
  const had = strings(data.tags);
  const added = [...new Set(add)].filter((t) => !had.includes(t));
  const removed = [...new Set(remove)].filter((t) => had.includes(t));
  const tags = [...had.filter((t) => !removed.includes(t)), ...added].sort();
  const from = request.from ? { from: request.from } : {};
  const pending: Pending[] = [
    ...added.map((value) => ({ action: "added" as const, field: "tags", value, ...from })),
    ...removed.map((value) => ({ action: "removed" as const, field: "tags", value, ...from })),
  ];
  const { tags: _old, ...rest } = data;
  const record = rewrite(file, tags.length > 0 ? { ...rest, tags } : rest, pending, request.actor, request.now);
  return { source: idOf(file)!, tags, added, removed, record };
}

// ---------- library information ----------

const PLAIN_FIELDS = ["title", "type", "subtype", "issued", "citation_key", "locator_label"];
export const BIB_FIELDS = [
  "publisher", "publisher-place", "container-title", "collection-title", "collection-number", "volume", "number-of-volumes",
  "issue", "edition", "page", "number", "genre", "title-short", "language", "abstract", "URL",
];

export interface Detail { field: string; value: string }
export interface Name { family?: string; given?: string; literal?: string }
export interface DetailDisagreement { field: string; recorded: string; offered: string }

const nameText = (n: Name): string => n.literal ?? [n.family, n.given].filter(Boolean).join(", ");

/** "Family, Given" as typed; a name without a comma is kept whole. */
export function parseName(value: string): Name {
  const comma = value.indexOf(",");
  const [family, given] = comma < 0 ? ["", ""] : [value.slice(0, comma).trim(), value.slice(comma + 1).trim()];
  if (family && given) return { family, given };
  if (!value.trim()) throw new InvalidInput("An author name is empty.");
  return { literal: value.trim() };
}

const authorsOf = (data: JsonObject): Name[] => list(data.contributions).filter((c) => c.role === "author")
  .map((c) => (isObject(c.as_printed) ? (c.as_printed as Name) : {}));
const authorsText = (names: Name[]): string => names.map(nameText).join("; ");

export function recordedValue(data: JsonObject, field: string): string | undefined {
  if (field === "title") return isObject(data.title) ? str(data.title.value) : undefined;
  if (field === "issued") return isObject(data.issued) ? str(data.issued.edtf) ?? str(data.issued.literal) ?? str(data.issued.as_printed) : undefined;
  if (PLAIN_FIELDS.includes(field)) return str(data[field]);
  const found = list(data.bib).find((b) => `bib.${String(b.name)}` === field || b.name === field);
  return found && isObject(found.value) ? str(found.value.value) : undefined;
}

function put(data: JsonObject, field: string, value: string): JsonObject {
  if (field === "title") return { ...data, title: { ...(isObject(data.title) ? data.title : {}), value } };
  if (field === "issued") return { ...data, issued: { edtf: value } };
  if (PLAIN_FIELDS.includes(field)) return { ...data, [field]: value };
  const bib = list(data.bib);
  const at = bib.findIndex((b) => b.name === field);
  const entry = { name: field, value: { value } };
  return { ...data, bib: at < 0 ? [...bib, entry] : bib.map((b, i) => (i === at ? entry : b)) };
}

function putAuthors(data: JsonObject, names: Name[]): JsonObject {
  const others = list(data.contributions).filter((c) => c.role !== "author");
  const used = new Set(others.map((c) => String(c.lid)));
  let n = 0;
  const lid = () => {
    do n++; while (used.has(`a${n}`));
    return `a${n}`;
  };
  return { ...data, contributions: [...names.map((name) => ({ lid: lid(), role: "author", as_printed: { ...name } as JsonObject })), ...others] };
}

const logName = (field: string) => (PLAIN_FIELDS.includes(field) || field === "authors" ? field : `bib.${field}`);

export interface EnrichRequest {
  source: string;
  identifiers: Detail[];
  details: Detail[];
  authors: string[];
  /** A saved lookup to take values from. It only fills what is not recorded. */
  lookup?: string;
  replace: boolean;
  from?: string;
  actor: Actor;
  now: Date;
}

/** The names a saved catalogue response gives for the authors. */
function lookupNames(resolution: JsonObject): Name[] {
  let response: unknown;
  try {
    response = JSON.parse(String(resolution.response ?? ""));
  } catch {
    return [];
  }
  if (!isObject(response)) return [];
  if (resolution.resolver === "crossref") {
    return list(response.author).flatMap((p): Name[] => {
      const [family, given, name] = [str(p.family), str(p.given), str(p.name)];
      return family ? [{ family, ...(given ? { given } : {}) }] : name ? [{ literal: name }] : [];
    });
  }
  return [response.creator].flat().flatMap((c): Name[] => {
    if (typeof c !== "string" || !c.trim()) return [];
    // A library heading may end with the person's dates, which are not part of the name.
    const [family, given, ...rest] = c.replace(/,\s*\d{3,4}\??-(\d{3,4}\??)?\.?$/, "").split(",").map((s) => s.trim());
    return family && given && rest.length === 0 ? [{ family, given }] : [{ literal: c.trim() }];
  });
}

export function planEnrich(corpus: Corpus, request: EnrichRequest) {
  const file = changeable(corpus, request.source);
  const source = idOf(file)!;
  const added: Detail[] = [];
  const replaced: (Detail & { previous: string })[] = [];
  const same: string[] = [];
  const disagreements: DetailDisagreement[] = [];
  const notes: string[] = [];
  const pending: Pending[] = [];
  let data = file.data!;
  let from = request.from;

  const resolution = request.lookup === undefined ? undefined : active(corpus, "resolution").find((r) => idOf(r) === request.lookup)?.data;
  if (request.lookup !== undefined) {
    if (!resolution || resolution.source !== source) throw new InvalidInput(`${request.lookup} is not a saved lookup of this source.`);
    if (resolution.outcome !== "found" || !isObject(resolution.found)) throw new InvalidInput(`The lookup ${request.lookup} did not find the work, so it gives no values.`);
    if (request.replace || request.identifiers.length + request.details.length + request.authors.length > 0) {
      throw new InvalidInput("A lookup only fills what is not recorded. To take one of its values in place of a recorded one, give that value with --set or --author, and --replace.");
    }
    const identifier = isObject(resolution.identifier) ? resolution.identifier : {};
    from ??= `${request.lookup} (${String(resolution.resolver)} record of ${String(identifier.scheme)}:${String(identifier.value)}, looked up ${String(resolution.queried_at).slice(0, 10)})`;
  } else if (!from) throw new InvalidInput("Say where these details come from with --from, such as \"title page\", \"library catalogue\" or \"the author\".");

  const take = (field: string, value: string, apply: () => JsonObject, previous: string | undefined, agrees: boolean) => {
    if (previous === undefined) {
      data = apply();
      added.push({ field, value });
      pending.push({ action: "added", field: logName(field), value, from: from! });
    } else if (agrees) same.push(field);
    else if (request.replace) {
      data = apply();
      replaced.push({ field, value, previous });
      pending.push({ action: "replaced", field: logName(field), value, previous, from: from! });
    } else disagreements.push({ field, recorded: previous, offered: value });
  };
  const detail = (field: string, value: string) => {
    const previous = recordedValue(data, field);
    take(field, value, () => put(data, field, value), previous, previous === value);
  };
  const authors = (names: Name[], agrees?: boolean) => {
    const before = authorsOf(data);
    const previous = before.length > 0 ? authorsText(before) : undefined;
    take("authors", authorsText(names), () => putAuthors(data, names), previous, agrees ?? (previous !== undefined && foldName(previous) === foldName(authorsText(names))));
  };

  for (const { field, value } of request.identifiers) {
    const scheme = field.toLowerCase();
    const held = list(data.identifiers).filter((i) => String(i.scheme).toLowerCase() === scheme);
    const shown = `${scheme}:${value}`;
    if (held.some((i) => String(i.value).toLowerCase() === value.toLowerCase())) same.push(shown);
    else if (held.length > 0 && (scheme === "doi" || scheme === "ia") && !request.replace) {
      // One work has one DOI and a record names one library item: two are a disagreement to settle.
      disagreements.push({ field: `identifier ${scheme}`, recorded: held.map((i) => String(i.value)).join(", "), offered: value });
    } else {
      const swap = request.replace && (scheme === "doi" || scheme === "ia") && held.length > 0;
      const previous = held.map((i) => `${scheme}:${String(i.value)}`).join(", ");
      data = { ...data, identifiers: [...list(data.identifiers).filter((i) => !swap || !held.includes(i)), { scheme, value }] };
      if (swap) replaced.push({ field: "identifiers", value: shown, previous });
      else added.push({ field: "identifiers", value: shown });
      pending.push({ action: swap ? "replaced" : "added", field: "identifiers", value: shown, ...(swap ? { previous } : {}), from: from! });
    }
  }

  for (const { field, value } of request.details) {
    if (!PLAIN_FIELDS.includes(field) && !BIB_FIELDS.includes(field)) {
      throw new InvalidInput(`${field} is not a detail this command sets. Use one of ${[...PLAIN_FIELDS, ...BIB_FIELDS].join(", ")}, or --author.`);
    }
    if (!value.trim()) throw new InvalidInput(`${field} has no value.`);
    if (field === "citation_key" && corpus.records.some((f) => f !== file && f.data?.kind === "source" && !isRetired(f.data) && citationKeys(f.data).includes(value))) {
      throw new InvalidInput(`Another source already has the citation key ${value}.`);
    }
    detail(field, value);
  }
  if (request.authors.length > 0) authors(request.authors.map(parseName));

  if (resolution) {
    const found = resolution.found as JsonObject;
    const record = describe(data);
    const said = compareLookup(record, resolution);
    const verdict = (field: string) => said.find((s) => s.field === field);
    const compared = (field: string, name: string, offered: string | undefined) => {
      const judged = verdict(name);
      if (offered === undefined) return;
      if (recordedValue(data, field) === undefined) detail(field, offered);
      else if (judged?.verdict === "differs") disagreements.push({ field, recorded: recordedValue(data, field)!, offered: judged.theirs });
      else if (judged?.verdict === "agrees") same.push(field);
      else notes.push(`${field}: recorded as ${recordedValue(data, field)}; the lookup (${offered}) was not enough to compare it`);
    };
    compared("title", "title", str(found.title));
    const names = lookupNames(resolution);
    if (names.length > 0) {
      const judged = verdict("authors");
      if (authorsOf(data).length === 0) authors(names);
      else authors(names, judged?.verdict === "agrees");
    }
    const issued = str(found.issued)?.match(/^\d{4}(-\d\d(-\d\d)?)?/)?.[0];
    // A catalogue may give one volume of a set the date of the whole set, so such a date is not taken.
    const volume = typeof resolution.response === "string" && /"volume"\s*:/.test(resolution.response) && resolution.resolver === "internet_archive";
    if (issued && recordedValue(data, "issued") === undefined && volume) {
      notes.push(`issued: not taken. The lookup is of one volume of a set and gives ${issued}, which may date the set. Give the year with --set issued=<year> from the copy.`);
    } else compared("issued", "year", issued);
    for (const [field, key] of [["publisher", "publisher"], ["container-title", "venue"]] as const) {
      const offered = str(found[key]);
      const previous = recordedValue(data, field);
      if (offered !== undefined) take(field, offered, () => put(data, field, offered), previous, previous !== undefined && foldName(previous) === foldName(offered));
    }
  }

  return { source, added, replaced, same, disagreements, notes, from: from!, record: rewrite(file, data, pending, request.actor, request.now) };
}

// ---------- capture ----------

export interface OriginalRequest {
  original: { sha256: string; size: number; media_type: string };
  source?: string;
  retrieved_at: string;
  origin?: string;
  version?: string;
  actor: Actor;
  now: Date;
  token: () => string;
}

/** The sources that already hold an original: by an upstream record or a source file. */
export function holdersOf(corpus: Corpus, sha256: string): string[] {
  const upstreams = active(corpus, "upstream").filter((u) => u.data!.sha256 === sha256).map((u) => String(u.data!.source));
  const texts = [...corpus.texts.values()].map((t) => t.manifest.data!)
    .filter((d) => !isRetired(d) && isObject(d.original) && list(d.original.files).some((f) => f.sha256 === sha256)).map((d) => String(d.source));
  return [...new Set([...upstreams, ...texts])].sort();
}

/** The upstream record of one source's original. */
export const upstreamOf = (corpus: Corpus, source: string, sha256: string): JsonObject | undefined =>
  active(corpus, "upstream").find((u) => u.data!.source === source && u.data!.sha256 === sha256)?.data;

/** Records an original for a source, new or named, without converting it. Run again, it writes nothing. */
export function planCapture(corpus: Corpus, request: OriginalRequest): { source: string; new_source: boolean; upstream?: string; records: Written[] } {
  const named = request.source === undefined ? undefined : idOf(changeable(corpus, request.source))!;
  const { sha256, size, media_type } = request.original;
  const holders = holdersOf(corpus, sha256);
  const existing = named !== undefined ? (upstreamOf(corpus, named, sha256) ? named : undefined) : holders[0];
  if (existing !== undefined) return { source: existing, new_source: false, records: [] };
  const created = { at: time(request.now), by: { ...request.actor } };
  const source = named ?? `${KINDS.source!.prefix}${request.token()}`;
  const records: Written[] = [];
  const make = (kind: "source" | "upstream", schema: string, data: JsonObject) => {
    const text = canonical(data);
    assertValid(schema, kind, text);
    records.push({ id: String(data.id), path: recordPath(kind, String(data.id)), text });
  };
  if (!named) make("source", "Source", { schema: RECORD_SCHEMA, id: source, kind: "source", created, admission: "candidate", intake: "raw" });
  const upstream = `${KINDS.upstream!.prefix}${request.token()}`;
  const url = request.origin && /^https?:\/\//.test(request.origin) ? request.origin : undefined;
  make("upstream", "Upstream", {
    schema: RECORD_SCHEMA, id: upstream, kind: "upstream", created, source, retrieved_at: request.retrieved_at, retrieved_by: { ...request.actor },
    sha256, size, media_type, ...(url ? { url } : {}), ...(request.origin && !url ? { note: `Obtained from: ${request.origin}` } : {}),
    ...(request.version ? { version: request.version } : {}),
  });
  return { source, new_source: !named, upstream, records };
}

// ---------- stages, listing and history ----------

/** How far a source has come: a record, an original, text. Each is a fine place to be. */
export const STAGES = ["record", "captured", "text"] as const;
export type Stage = (typeof STAGES)[number];
export const HAS = ["identifiers", "lookup", "tags"] as const;
export type Has = (typeof HAS)[number];

export interface Listed { source: string; citation_key?: string; title?: string; stage: Stage; has: Has[]; tags: string[] }

export function listSources(corpus: Corpus, query: { tags?: string[]; stage?: Stage; has?: Has[] } = {}): Listed[] {
  const texts = new Set([...corpus.texts.values()].map((t) => t.manifest.data!).filter((d) => !isRetired(d)).map((d) => String(d.source)));
  const captured = new Set(active(corpus, "upstream").map((u) => String(u.data!.source)));
  const looked = new Set(active(corpus, "resolution").filter((r) => r.data!.outcome === "found").map((r) => String(r.data!.source)));
  return active(corpus, "source").map((file): Listed => {
    const data = file.data!;
    const source = idOf(file)!;
    const tags = strings(data.tags);
    const has: Has[] = [
      ...(list(data.identifiers).length > 0 ? ["identifiers" as const] : []), ...(looked.has(source) ? ["lookup" as const] : []),
      ...(tags.length > 0 ? ["tags" as const] : []),
    ];
    const key = str(data.citation_key);
    const title = recordedValue(data, "title");
    return { source, ...(key ? { citation_key: key } : {}), ...(title ? { title } : {}), stage: texts.has(source) ? "text" : captured.has(source) ? "captured" : "record", has, tags };
  }).filter((s) => (query.tags ?? []).every((t) => tagMatches(s.tags, t)) && (!query.stage || s.stage === query.stage) && (query.has ?? []).every((h) => s.has.includes(h)))
    .sort((a, b) => ((a.citation_key ?? a.source) < (b.citation_key ?? b.source) ? -1 : 1));
}

export interface Event { at: string; by: string; record: string; what: string; from?: string }

const who = (actor: unknown): string => (isObject(actor) ? `${String(actor.kind)} ${String(actor.name)}` : "unknown");

/** What the project's records say happened to one source, oldest first. */
export function sourceHistory(corpus: Corpus, name: string): { source: string; events: Event[] } {
  const file = findSource(corpus, name);
  const source = idOf(file)!;
  const events: Event[] = [];
  const add = (stamp: unknown, record: string, what: string, from?: string) => {
    if (isObject(stamp)) events.push({ at: String(stamp.at), by: who(stamp.by), record, what, ...(from ? { from } : {}) });
  };
  add(file.data!.created, source, "source record created");
  const mine = corpus.records.filter((f) => f.state === "ok" && f.data && f.data.source === source);
  const textIds = new Set(mine.filter((f) => f.data!.kind === "source_text").map((f) => idOf(f)));
  for (const record of corpus.records.filter((f) => f.state === "ok" && f.data && (f.data.source === source || textIds.has(String(f.data.text))))) {
    const data = record.data!;
    const id = idOf(record)!;
    const kind = String(data.kind);
    if (kind === "upstream") {
      add(data.created, id, `original captured: sha256 ${String(data.sha256).slice(0, 12)}, ${String(data.size)} bytes, ${String(data.media_type)}, got ${String(data.retrieved_at)}`, str(data.url) ?? str(data.note));
    } else if (kind === "source_text") {
      const original = isObject(data.original) ? data.original : {};
      const conversion = isObject(data.conversion) ? data.conversion : {};
      add(data.created, id, `mapped to text: ${list(data.pages).length} ${data.paged === true ? "page" : "section"} file(s), method ${String(conversion.method)}`, original.obtained_from === "unknown" ? undefined : str(original.obtained_from));
      add(data.changed, id, "text labels set or a person's edits sealed (latest)");
    } else if (kind === "resolution") {
      const identifier = isObject(data.identifier) ? data.identifier : {};
      add(data.created, id, `catalogue lookup saved: ${String(data.resolver)} ${String(identifier.scheme)}:${String(identifier.value)}, ${String(data.outcome)}`, str(data.url));
    } else if (kind === "passage") add(data.created, id, "passage captured");
    else if (kind === "comparison_run") add(data.created, id, "source text compared", str(data.against));
    else if (kind === "text_review") add(data.created, id, `review or flag: ${String(data.scope)}, ${String(data.outcome)}`, str(data.against));
    if (isObject(data.retired)) add(data.retired.stamp, id, `retired this ${kind}: ${String(data.retired.reason)}`);
  }
  // After the records, so that within one second the steps a change rests on come first.
  for (const change of list(file.data!.changes)) {
    const value = change.action === "replaced" ? `${String(change.previous)} -> ${String(change.value)}` : String(change.value);
    add(change, source, `${String(change.action)} ${String(change.field)}: ${value}`, str(change.from));
  }
  if (isObject(file.data!.retired)) add(file.data!.retired.stamp, source, `retired this source: ${String(file.data!.retired.reason)}`);
  return { source, events: events.map((e, i) => ({ e, i })).sort((a, b) => Date.parse(a.e.at) - Date.parse(b.e.at) || a.i - b.i).map((x) => x.e) };
}
