// source.changed (CONTRACT-002 C; SD-002 BR-212): a note, claim, passage or
// citation rests on a source file or source that has since been retired, on a
// passage whose pages have changed, or on one selected before the source's
// details changed. It is computed from the records each time and stores nothing.
// Damaged source files are source.pages' finding.
import { citationKeys, type Corpus, digest, idOf, isObject, isRetired, type JsonObject, type LoadedFile, SOURCE_BINDING_FIELDS } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { SourceTexts } from "../matching/texts.ts";
import { textAt } from "../passages.ts";
import { active } from "./bibliography.ts";
import { cited, liveRecord, type Use } from "./cited.ts";
import { grouped, once } from "../corpus-index.ts";
import { itemOf, subjectOf } from "./records.ts";

/** `SourceBinding.record_sha256` (CONTRACT-001 E). */
export const sourceBinding = (source: JsonObject): string =>
  digest(Object.fromEntries(SOURCE_BINDING_FIELDS.flatMap((f) => (source[f] === undefined ? [] : [[f, source[f]]]))));

/** The source with one logged addition undone. */
function without(source: JsonObject, field: string, value: string): JsonObject {
  const key = field.startsWith("bib.") ? "bib" : field === "authors" ? "contributions" : field;
  const out: JsonObject = { ...source };
  const keep = field === "identifiers" ? (e: JsonObject) => `${String(e.scheme)}:${String(e.value)}` !== value
    : field === "authors" ? (e: JsonObject) => e.role !== "author"
    : field.startsWith("bib.") ? (e: JsonObject) => `bib.${String(e.name)}` !== field : undefined;
  const left = keep && Array.isArray(out[key]) ? (out[key] as JsonObject[]).filter(keep) : [];
  if (left.length > 0) out[key] = left;
  else delete out[key];
  return out;
}

/**
 * Whether details have only been added since a binding was made, by the changes
 * the record logs (FR-94). A detail added contradicts nothing that was selected
 * before; a detail changed or removed, or an edit the log does not show, may.
 */
export function onlyAdded(source: JsonObject, bound: string): boolean {
  let state = source;
  for (const change of (Array.isArray(source.changes) ? source.changes.filter(isObject) : []).reverse()) {
    const field = String(change.field);
    if (!field.startsWith("bib.") && field !== "authors" && !(SOURCE_BINDING_FIELDS as readonly string[]).includes(field)) continue;
    if (change.action !== "added") return false;
    state = without(state, field, String(change.value));
    if (sourceBinding(state) === bound) return true;
  }
  return false;
}

interface Change { reason: "depends_on_retired" | "text_changed" | "source_details_changed"; record: LoadedFile; what: string; through: string[] }

interface Walk { changes: Change[]; reached: number; unread: boolean }

const list = (value: unknown): string[] => (value === undefined ? [] : [value].flat().map(String));

function walker(corpus: Corpus, texts: SourceTexts) {
  const links = grouped<unknown, LoadedFile>(active(corpus, "attestation"), (l) => [l.data!.claim]);
  // Each source's digest is made once however many passages name it.
  const bindings = new Map<LoadedFile, string>();
  const bindingNow = (file: LoadedFile) => bindings.get(file) ?? bindings.set(file, sourceBinding(file.data!)).get(file)!;
  const unreadable = new Set(corpus.records.filter((f) => f.state !== "ok").map((f) => f.path.replace(/^.*\//, "").replace(/\.json$/, "")));

  /** Follows one record's dependencies. A dependency that cannot be read keeps the result open. */
  return function follow(id: string, walk: Walk, through: string[], seen: Set<string>): void {
    if (seen.has(id)) return;
    seen.add(id);
    const file = corpus.byId.get(id);
    if (!file) {
      // A reference to no record at all is record.valid's finding.
      if (unreadable.has(id)) walk.unread = true;
      return;
    }
    const data = file.data!;
    const kind = String(data.kind);
    if (["source_text", "source"].includes(kind)) {
      walk.reached++;
      if (isRetired(data)) walk.changes.push({ reason: "depends_on_retired", record: file, what: `retired ${kind}`, through });
    }
    const next = (ids: string[]) => ids.forEach((to) => follow(to, walk, through.length === 0 || through.at(-1) !== id ? [...through, id] : through, seen));
    if (kind === "source_text") next(list(data.source));
    if (kind === "passage") {
      const now = textAt(texts, data);
      if (now.state === "changed") {
        walk.changes.push({ reason: "text_changed", record: file, what: `the text at index ${now.index} changed after passage ${id} was captured`, through: [...through, id] });
      } else if (now.state === "unavailable") walk.unread = true;
      next([...list(data.text), ...list(data.source)]);
      const source = corpus.byId.get(String(data.source));
      if (source?.data?.kind === "source" && typeof data.source_record_sha256 === "string" && data.source_record_sha256 !== bindingNow(source)
        && !onlyAdded(source.data, data.source_record_sha256)) {
        walk.changes.push({ reason: "source_details_changed", record: source, what: `source details changed since passage ${id} was anchored`, through: [...through, id] });
      }
    }
    if (kind === "note") next([...list(data.passages), ...list(data.source)]);
    if (kind === "claim") next((links.get(id) ?? []).map((l) => String(l.data!.evidence)));
  };
}

export interface Dependant {
  /** The record, or for a citation in a chapter file the citation. */
  subject: string;
  /** The record's file, or the chapter file. */
  path: string;
  file?: LoadedFile;
  use?: Use;
  walk: Walk;
  source?: string;
  /** A source file of the source was retired, and nothing says when this citation was written. */
  unfollowed?: LoadedFile[];
}

/** Every passage, note, claim and citation that rests on a source, with what has changed under it. */
export function dependants(corpus: Corpus, texts = new SourceTexts(corpus)): Dependant[] {
  const follow = walker(corpus, texts);
  const readable = (kind: string) => corpus.records.filter((f) => f.state === "ok" && f.data?.kind === kind);
  const retiredSources = once(corpus, "retired sources", () => readable("source").filter((f) => isRetired(f.data!)));
  const retiredByKey = grouped<unknown, LoadedFile>(retiredSources, (f) => citationKeys(f.data!));
  const retiredById = grouped<unknown, LoadedFile>(retiredSources, (f) => [idOf(f)]);
  const filesBySource = once(corpus, "source files by source", () => grouped<unknown, LoadedFile>(readable("source_text"), (f) => [f.data!.source]));
  const out: Dependant[] = [];
  for (const kind of ["passage", "note", "claim"]) {
    for (const file of active(corpus, kind)) {
      const walk: Walk = { changes: [], reached: 0, unread: false };
      follow(idOf(file)!, walk, [], new Set());
      if (walk.reached > 0 || walk.unread) out.push({ subject: subjectOf(file), path: file.path, file, walk });
    }
  }
  for (const use of cited(corpus).uses) {
    const walk: Walk = { changes: [], reached: 0, unread: false };
    const seen = new Set<string>();
    // A record names its source by key or ID; a chapter file names it by key.
    const record = liveRecord(use);
    let sources = use.matches;
    if (sources.length === 0) {
      sources = (use.key !== undefined ? (use.key === "?" ? [] : retiredByKey.get(use.key)) : retiredById.get(use.record!.data!.source)) ?? [];
    }
    for (const claim of use.claims) follow(claim, walk, [], seen);
    // In a chapter file, a record's passage counts only while the key still names its source.
    let passage = record?.passage === undefined ? undefined : String(record.passage);
    if (passage !== undefined && use.written) {
      const from = corpus.byId.get(passage)?.data?.source;
      if (!sources.some((s) => idOf(s) === from)) passage = undefined;
    }
    if (passage !== undefined) follow(passage, walk, [], seen);
    const source = sources.length === 1 ? idOf(sources[0]!) : undefined;
    let unfollowed: LoadedFile[] = [];
    if (source) {
      follow(source, walk, [], seen);
      // A citation with no passage names no source file. It is taken to rest on those its
      // source had while the citation existed: the ones retired after it was recorded.
      if (passage === undefined) {
        const since = record ? String(isObject(record.created) ? record.created.at : "") : undefined;
        for (const file of filesBySource.get(source) ?? []) {
          const retired = file.data!.retired;
          if (since === undefined) {
            walk.reached++;
            if (isObject(retired)) unfollowed.push(file);
            continue;
          }
          walk.reached++;
          if (!isObject(retired) || !isObject(retired.stamp) || Date.parse(String(retired.stamp.at)) < Date.parse(since)) continue;
          if (!walk.changes.some((c) => c.record === file)) {
            walk.changes.push({ reason: "depends_on_retired", record: file, what: "retired source file", through: [source] });
          }
        }
      }
    }
    if (walk.reached > 0 || walk.unread) {
      out.push({
        subject: use.subject, path: use.path, use, walk, ...(use.written ? {} : { file: use.record! }),
        ...(source ? { source } : {}), ...(unfollowed.length > 0 ? { unfollowed } : {}),
      });
    }
  }
  return out;
}

export function changedResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const check = "source.changed";
  return dependants(corpus, texts).map(({ subject, file, use, walk, source, unfollowed }) => {
    const data = file?.data;
    const evidence: Evidence[] = data ? [{ name: `${String(data.kind)}_file`, class: "location", value: file!.path }] : [...use!.where];
    for (const change of walk.changes) {
      const retired = change.record.data!.retired;
      evidence.push({ name: "changed_record", class: "location", value: change.record.path });
      evidence.push({
        name: "change", class: "metadata",
        value: change.reason === "depends_on_retired" && isObject(retired) && isObject(retired.stamp)
          ? `${change.what} on ${String(retired.stamp.at)}: ${String(retired.reason)}${typeof retired.replaced_by === "string" ? ` (replaced by ${retired.replaced_by})` : ""}`
          : change.what,
      });
      const path = change.through.filter((id) => id !== (file ? idOf(file) : subject));
      if (path.length > 0) evidence.push({ name: "reached_through", class: "location", value: path.join(", ") });
    }
    const sentence = use ? use.sentence : isObject(data!.sentence) && typeof data!.sentence.text === "string" && typeof data!.sentence.sha256 === "string"
      ? { text: data!.sentence.text, sha256: data!.sentence.sha256 } : undefined;
    const item = use ? use.item : itemOf(file!);
    const reason = (["depends_on_retired", "text_changed", "source_details_changed"] as const).find((r) => walk.changes.some((c) => c.reason === r))
      ?? (walk.unread ? "record_unreadable" : unfollowed ? "retired_text_not_followed" : undefined);
    // Not following a retired source file shows nothing wrong: it says what was not covered.
    const coverage = reason === "retired_text_not_followed";
    if (coverage) {
      evidence.push(...unfollowed!.map((f): Evidence => ({ name: "retired_source_file", class: "location", value: f.path })),
        { name: "coverage", class: "metadata", value: "citations with no record were not compared with source files retired before or after they were written" });
    }
    return result({
      check, outcome: walk.changes.length > 0 ? "fail" : walk.unread || coverage ? "unverifiable" : "pass", ...(reason ? { reason } : {}),
      subject, locus: use ? use.locus : idOf(file!) ?? file!.path, evidence, ...(item ? { item } : {}), coverage,
      ...(source ? { source } : {}), ...(sentence ? { sentence } : {}),
    });
  });
}
