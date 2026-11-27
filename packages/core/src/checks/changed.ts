// source.changed (CONTRACT-002 C; SD-002 BR-212): a note, claim or citation
// rests on a copy, text or source that has since been replaced or retired, or
// on a passage anchored before the source's details changed. It is computed from
// the records each time and stores nothing. Damaged or missing stored files are
// source.held's finding.
import { citationKeys, type Corpus, digest, idOf, isObject, isRetired, type JsonObject, type LoadedFile, SOURCE_BINDING_FIELDS } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { active, hasManuscript, resolveCitations } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

/** `SourceBinding.record_sha256` (CONTRACT-001 E). */
export const sourceBinding = (source: JsonObject): string =>
  digest(Object.fromEntries(SOURCE_BINDING_FIELDS.flatMap((f) => (source[f] === undefined ? [] : [[f, source[f]]]))));

interface Change { reason: "depends_on_retired" | "source_details_changed"; record: LoadedFile; what: string; through: string[] }

interface Walk { changes: Change[]; reached: number; unread: boolean }

const list = (value: unknown): string[] => (value === undefined ? [] : [value].flat().map(String));

function walker(corpus: Corpus) {
  const links = active(corpus, "attestation");
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
    if (["capture", "extraction", "source"].includes(kind)) {
      walk.reached++;
      if (isRetired(data)) walk.changes.push({ reason: "depends_on_retired", record: file, what: `retired ${kind}`, through });
    }
    const next = (ids: string[]) => ids.forEach((to) => follow(to, walk, through.length === 0 || through.at(-1) !== id ? [...through, id] : through, seen));
    if (kind === "extraction") next(list(data.capture));
    if (kind === "capture") next(list(data.source));
    if (kind === "passage") {
      next([...list(data.extraction), ...list(data.capture), ...list(data.source)]);
      const source = corpus.byId.get(String(data.source));
      if (source?.data?.kind === "source" && typeof data.source_record_sha256 === "string" && data.source_record_sha256 !== sourceBinding(source.data)) {
        walk.changes.push({ reason: "source_details_changed", record: source, what: `source details changed since passage ${id} was anchored`, through: [...through, id] });
      }
    }
    if (kind === "note") next([...list(data.passages), ...list(data.source)]);
    if (kind === "claim") next(links.filter((l) => l.data!.claim === id).map((l) => String(l.data!.evidence)));
  };
}

export interface Dependant { file: LoadedFile; walk: Walk; source?: string }

/** Every note, claim and citation that rests on a source, with what has changed under it. */
export function dependants(corpus: Corpus): Dependant[] {
  const follow = walker(corpus);
  const out: Dependant[] = [];
  for (const kind of ["note", "claim"]) {
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
      sources = corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "source" && isRetired(f.data)
        && (key !== undefined ? citationKeys(f.data).includes(key) : idOf(f) === citation.data!.source));
    }
    for (const claim of list(citation.data!.claims)) follow(claim, walk, [], seen);
    const source = sources.length === 1 ? idOf(sources[0]!) : undefined;
    if (source) {
      follow(source, walk, [], seen);
      // A citation names no copy. It is taken to rest on the copies and texts its source
      // had while the citation existed: those retired after the citation was recorded.
      const since = String(isObject(citation.data!.created) ? citation.data!.created.at : "");
      const captures = corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "capture" && f.data.source === source);
      const texts = corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "extraction" && captures.some((c) => idOf(c) === f.data!.capture));
      for (const record of [...captures, ...texts]) {
        walk.reached++;
        const retired = record.data!.retired;
        if (!isObject(retired) || !isObject(retired.stamp) || Date.parse(String(retired.stamp.at)) < Date.parse(since)) continue;
        if (!walk.changes.some((c) => c.record === record)) {
          walk.changes.push({ reason: "depends_on_retired", record, what: `retired ${String(record.data!.kind)}`, through: [source] });
        }
      }
    }
    if (walk.reached > 0 || walk.unread) out.push({ file: citation, walk, ...(source ? { source } : {}) });
  }
  return out;
}

export function changedResults(corpus: Corpus): Result[] {
  const check = "source.changed";
  return dependants(corpus).map(({ file, walk, source }) => {
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
    const reason = walk.changes.some((c) => c.reason === "depends_on_retired") ? "depends_on_retired"
      : walk.changes.length > 0 ? "source_details_changed" : walk.unread ? "record_unreadable" : undefined;
    return result({
      check, outcome: walk.changes.length > 0 ? "fail" : walk.unread ? "unverifiable" : "pass", ...(reason ? { reason } : {}),
      subject: subjectOf(file), locus: idOf(file) ?? file.path, evidence, item: itemOf(file),
      ...(source ? { source } : {}), ...(sentence ? { sentence } : {}),
    });
  });
}
