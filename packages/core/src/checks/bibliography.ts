// cite.key and bib.uncited over citation records. When manuscript files exist
// they are authoritative and this version cannot read them (CONTRACT-002 C).
import { citationKeys, type Corpus, idOf, isObject, isRetired, type JsonObject, type LoadedFile } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { sourceBinding } from "./changed.ts";
import { itemOf, subjectOf } from "./records.ts";

export const hasManuscript = (corpus: Corpus): boolean => corpus.manuscript.some((f) => f.path.endsWith(".md"));

/** Records of a kind that can be read and are not retired. */
export function active(corpus: Corpus, kind: string): LoadedFile[] {
  return corpus.records.filter((f) => f.state === "ok" && f.data?.kind === kind && !isRetired(f.data));
}

const unreadableIn = (corpus: Corpus, directory: string): boolean =>
  corpus.records.some((f) => (f.state === "unreadable" || f.state === "version_unsupported") && f.path.startsWith(`records/${directory}/`));

interface Resolution { citation: LoadedFile; key?: string; matches: LoadedFile[] }

export function resolveCitations(corpus: Corpus): Resolution[] {
  const sources = active(corpus, "source");
  return active(corpus, "citation").map((citation) => {
    const { key, source } = citation.data as JsonObject;
    if (typeof key === "string") {
      return { citation, key, matches: sources.filter((s) => citationKeys(s.data!).includes(key)) };
    }
    return { citation, matches: sources.filter((s) => idOf(s) === source) };
  });
}

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
  if (hasManuscript(corpus)) return [];
  const allSources = corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "source");
  return resolveCitations(corpus).map(({ citation, key, matches }) => {
    const data = citation.data!;
    const subject = subjectOf(citation);
    const evidence: Evidence[] = [{ name: "citation_file", class: "location", value: citation.path }];
    if (key !== undefined) evidence.push({ name: "key", class: "manuscript", value: key });
    for (const [name, field] of [["chapter", "chapter"], ["document_position", "document_position"]] as const) {
      if (typeof data[field] === "string") evidence.push({ name, class: "location", value: data[field] });
    }
    if (isObject(data.locator)) {
      evidence.push({ name: "locator", class: "manuscript", value: `${String(data.locator.label)} ${String(data.locator.value)}` });
    }
    const only = matches.length === 1 ? idOf(matches[0]!) : undefined;
    const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
      ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;
    if (sentence) evidence.push({ name: "sentence", class: "manuscript", value: sentence.text });
    const common = {
      check: "cite.key", subject, locus: idOf(citation) ?? citation.path, evidence, item: itemOf(citation),
      ...(sentence ? { sentence } : {}), ...(only ? { source: only } : {}),
    };
    if (only) return result({ ...common, outcome: "pass" });
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
  const cited = new Set(resolveCitations(corpus).flatMap((r) => (r.matches.length === 1 ? [idOf(r.matches[0]!)] : [])));
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
    const cannot = hasManuscript(corpus) ? "manuscript_not_read"
      : cited.has(id) ? undefined
      : unreadableIn(corpus, "citations") ? "citation_unreadable"
      : active(corpus, "citation").length === 0 ? "no_manuscript" : undefined;
    if (cannot) return result({ ...common, outcome: "unverifiable", reason: cannot });
    return cited.has(id) ? result({ ...common, outcome: "pass" }) : result({ ...common, outcome: "fail", reason: "not_cited" });
  });
}
