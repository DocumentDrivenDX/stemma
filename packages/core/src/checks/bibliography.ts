// cite.key and bib.uncited over what the project cites: its manuscript files
// when it has them, and otherwise its citation records (CONTRACT-002 C).
import { citationKeys, type Corpus, idOf, type JsonObject, type LoadedFile } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { sourceBinding } from "./changed.ts";
import { activeRecords, grouped, once } from "../corpus-index.ts";
import { cited, manuscriptOf } from "./cited.ts";
import { subjectOf } from "./records.ts";

export const hasManuscript = (corpus: Corpus): boolean => corpus.manuscript.some((f) => f.path.endsWith(".md"));

/** Records of a kind that can be read and are not retired. */
export const active = activeRecords;

const unreadableIn = (corpus: Corpus, directory: string): boolean => once(corpus, `unreadable in ${directory}`, () =>
  corpus.records.some((f) => (f.state === "unreadable" || f.state === "version_unsupported") && f.path.startsWith(`records/${directory}/`)));

interface Resolution { citation: LoadedFile; key?: string; matches: LoadedFile[] }

/** The sources in effect that hold each key, aliases included. */
export const sourcesByKey = (corpus: Corpus): Map<string, LoadedFile[]> =>
  once(corpus, "sources by key", () => grouped(active(corpus, "source"), (s) => citationKeys(s.data!)));

/** Each citation with the sources in effect that it names. The list is made once and shared. */
export const resolveCitations = (corpus: Corpus): Resolution[] => once(corpus, "resolved citations", () => {
  const byKey = sourcesByKey(corpus);
  const byId = grouped<unknown, LoadedFile>(active(corpus, "source"), (s) => [idOf(s)]);
  return active(corpus, "citation").map((citation) => {
    const { key, source } = citation.data as JsonObject;
    if (typeof key === "string") return { citation, key, matches: byKey.get(key) ?? [] };
    return { citation, matches: byId.get(source) ?? [] };
  });
});

export function listedSources(corpus: Corpus): LoadedFile[] {
  const list = corpus.settings.data?.bibliography_include;
  if (!Array.isArray(list)) return [];
  // A listed ID that is not a source is record.valid's finding, not this one's.
  return [...new Set(list)].flatMap((id) => {
    const file = typeof id === "string" ? corpus.byId.get(id) : undefined;
    return file?.data?.kind === "source" ? [file] : [];
  });
}

export function citeKeyResults(corpus: Corpus): Result[] {
  const allSources = corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "source");
  return cited(corpus).uses.map((use) => {
    const { key, matches, sentence } = use;
    // What a record says of itself. A chapter file's citation says it in its place there.
    const data: JsonObject = use.written ? {} : use.record!.data!;
    const evidence: Evidence[] = [...use.where];
    if (key !== undefined) evidence.push({ name: "key", class: "manuscript", value: key });
    for (const [name, field] of [["chapter", "chapter"], ["document_position", "document_position"]] as const) {
      if (typeof data[field] === "string") evidence.push({ name, class: "location", value: data[field] });
    }
    if (use.locator) {
      evidence.push({ name: "locator", class: "manuscript", value: `${String(use.locator.label)} ${String(use.locator.value)}` });
    }
    const only = matches.length === 1 ? idOf(matches[0]!) : undefined;
    if (sentence && !use.written) evidence.push({ name: "sentence", class: "manuscript", value: sentence.text });
    const common = {
      check: "cite.key", subject: use.subject, locus: use.locus, evidence,
      ...(use.item ? { item: use.item } : {}), ...(sentence ? { sentence } : {}), ...(only ? { source: only } : {}),
    };
    if (only) return result({ ...common, outcome: "pass" });
    // `?` is a reference takeover could not tie to a source (CONTRACT-006 C).
    if (use.written && key === "?") {
      const found = use.record?.data?.as_found;
      if (typeof found === "string") evidence.push({ name: "as_found", class: "manuscript", value: found });
      return result({ ...common, outcome: "fail", reason: "key_unbound" });
    }
    if (matches.length > 1) {
      for (const match of matches) evidence.push({ name: "held_by", class: "location", value: match.path });
      return result({ ...common, outcome: "fail", reason: "key_ambiguous" });
    }
    if (key === undefined && data.source === undefined) return result({ ...common, outcome: "fail", reason: "key_missing" });
    if (unreadableIn(corpus, "sources")) return result({ ...common, outcome: "unverifiable", reason: "source_unreadable" });
    if (key !== undefined) {
      for (const source of allSources) {
        for (const held of citationKeys(source.data!)) {
          if (held === key) evidence.push({ name: "held_by_retired_source", class: "location", value: source.path });
          else if (held.toLowerCase() === key.toLowerCase()) {
            evidence.push({ name: "similar_key_differs_in_letter_case", class: "metadata", value: held });
          }
        }
      }
    }
    return result({ ...common, outcome: "fail", reason: "key_unknown" });
  });
}

export function uncitedResults(corpus: Corpus): Result[] {
  const written = hasManuscript(corpus);
  const named = new Set(cited(corpus).uses.flatMap((u) => (u.matches.length === 1 ? [idOf(u.matches[0]!)] : [])));
  return listedSources(corpus).map((source) => {
    const id = idOf(source)!;
    const key = source.data!.citation_key;
    const evidence: Evidence[] = [{ name: "source_file", class: "location", value: source.path }];
    if (typeof key === "string") evidence.push({ name: "key", class: "metadata", value: key });
    const binding = sourceBinding(source.data!);
    const common = {
      check: "bib.uncited", subject: subjectOf(source), source: id, locus: "bibliography_include", evidence,
      item: { record: id, content_sha256: binding },
    };
    const cannot = named.has(id) ? undefined
      : written ? (manuscriptOf(corpus).problems.length > 0 ? "manuscript_unreadable" : undefined)
      : unreadableIn(corpus, "citations") ? "citation_unreadable"
      : active(corpus, "citation").length === 0 ? "no_manuscript" : undefined;
    if (cannot) return result({ ...common, outcome: "unverifiable", reason: cannot });
    return named.has(id) ? result({ ...common, outcome: "pass" }) : result({ ...common, outcome: "fail", reason: "not_cited" });
  });
}
