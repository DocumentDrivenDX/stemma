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
import { active, hasManuscript, resolveCitations } from "./bibliography.ts";
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

export interface Dependant { file: LoadedFile; walk: Walk; source?: string }

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
      if (walk.reached > 0 || walk.unread) out.push({ file, walk });
    }
  }
  // While manuscript files cannot be read, citation records do not say what is cited now.
  if (hasManuscript(corpus)) return out;
  for (const { citation, key, matches } of resolveCitations(corpus)) {
    const walk: Walk = { changes: [], reached: 0, unread: false };
    const seen = new Set<string>();
    let sources = matches;
    if (sources.length === 0) {
      sources = (key !== undefined ? retiredByKey.get(key) : retiredById.get(citation.data!.source)) ?? [];
    }
    for (const claim of list(citation.data!.claims)) follow(claim, walk, [], seen);
    for (const passage of list(citation.data!.passage)) follow(passage, walk, [], seen);
    const source = sources.length === 1 ? idOf(sources[0]!) : undefined;
    if (source) {
      follow(source, walk, [], seen);
      // A citation with no passage names no source file. It is taken to rest on those its
      // source had while the citation existed: the ones retired after it was recorded.
      if (citation.data!.passage === undefined) {
        const since = String(isObject(citation.data!.created) ? citation.data!.created.at : "");
        for (const record of filesBySource.get(source) ?? []) {
          walk.reached++;
          const retired = record.data!.retired;
          if (!isObject(retired) || !isObject(retired.stamp) || Date.parse(String(retired.stamp.at)) < Date.parse(since)) continue;
          if (!walk.changes.some((c) => c.record === record)) {
            walk.changes.push({ reason: "depends_on_retired", record, what: "retired source file", through: [source] });
          }
        }
      }
    }
    if (walk.reached > 0 || walk.unread) out.push({ file: citation, walk, ...(source ? { source } : {}) });
  }
  return out;
}

export function changedResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const check = "source.changed";
  return dependants(corpus, texts).map(({ file, walk, source }) => {
    const data = file.data!;
    const evidence: Evidence[] = [{ name: `${String(data.kind)}_file`, class: "location", value: file.path }];
    for (const change of walk.changes) {
      const retired = change.record.data!.retired;
      evidence.push({ name: "changed_record", class: "location", value: change.record.path });
      evidence.push({
        name: "change", class: "metadata",
        value: change.reason === "depends_on_retired" && isObject(retired) && isObject(retired.stamp)
          ? `${change.what} on ${String(retired.stamp.at)}: ${String(retired.reason)}${typeof retired.replaced_by === "string" ? ` (replaced by ${retired.replaced_by})` : ""}`
          : change.what,
      });
      const path = change.through.filter((id) => id !== idOf(file));
      if (path.length > 0) evidence.push({ name: "reached_through", class: "location", value: path.join(", ") });
    }
    const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
      ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;
    const reason = (["depends_on_retired", "text_changed", "source_details_changed"] as const).find((r) => walk.changes.some((c) => c.reason === r))
      ?? (walk.unread ? "record_unreadable" : undefined);
    return result({
      check, outcome: walk.changes.length > 0 ? "fail" : walk.unread ? "unverifiable" : "pass", ...(reason ? { reason } : {}),
      subject: subjectOf(file), locus: idOf(file) ?? file.path, evidence, item: itemOf(file),
      ...(source ? { source } : {}), ...(sentence ? { sentence } : {}),
    });
  });
}
