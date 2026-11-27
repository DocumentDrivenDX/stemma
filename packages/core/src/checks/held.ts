// source.held (CONTRACT-002 C; SD-002 BR-205 and BR-206): a cited source has an
// intact source file with text. It says nothing about whether the text is a
// faithful reading of the original, or whether the source supports the sentence
// that cites it.
import { type Corpus, idOf, isObject } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { SourceTexts } from "../matching/texts.ts";
import { coverageOf, coverageWords } from "../verification.ts";
import { hasManuscript, resolveCitations } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

type Reason = "no_source_file" | "no_text" | "record_unreadable" | "source_damaged";

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });
const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });

export const manifestsUnread = (corpus: Corpus): boolean =>
  corpus.records.some((f) => f.state !== "ok" && f.state !== "stray" && f.path.startsWith("sources/"));

/** The state of one source's source files. */
export function holding(texts: SourceTexts, source: string): { outcome: "pass" | "fail" | "unverifiable"; reason?: Reason; evidence: Evidence[] } {
  const corpus = texts.corpus;
  const ids = texts.idsOf(source);
  if (ids.length === 0) {
    return manifestsUnread(corpus) ? { outcome: "unverifiable", reason: "record_unreadable", evidence: [] } : { outcome: "fail", reason: "no_source_file", evidence: [] };
  }
  // Every source file is looked at: a good one does not hide a damaged one.
  const damaged = ids.filter((id) => !texts.view(id));
  if (damaged.length > 0) {
    return { outcome: "unverifiable", reason: "source_damaged", evidence: damaged.map((id) => at("source_text", corpus.texts.get(id)!.manifest.path)) };
  }
  const evidence: Evidence[] = [];
  let held = false;
  for (const id of ids) {
    const view = texts.view(id)!;
    if (view.streams.main.text === "" && view.streams.notes.text === "") continue;
    held = true;
    evidence.push(
      at("source_text", view.loaded.manifest.path),
      meta("text_method", `${view.method}, quality ${view.level}`),
      meta("verification", coverageWords(coverageOf(corpus, view.loaded))));
  }
  return held ? { outcome: "pass", evidence } : { outcome: "fail", reason: "no_text", evidence: ids.map((id) => at("source_text", corpus.texts.get(id)!.manifest.path)) };
}

/** One result for each citation record that names exactly one source (a key that names none is cite.key's finding). */
export function heldResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  // While manuscript files cannot be read, citation records do not say what is cited now.
  if (hasManuscript(corpus)) return [];
  return resolveCitations(corpus).flatMap(({ citation, key, matches }) => {
    if (matches.length !== 1) return [];
    const source = idOf(matches[0]!)!;
    const held = holding(texts, source);
    const data = citation.data!;
    const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
      ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;
    return [result({
      check: "source.held", outcome: held.outcome, ...(held.reason ? { reason: held.reason } : {}),
      subject: subjectOf(citation), locus: idOf(citation) ?? citation.path, source,
      evidence: [at("citation_file", citation.path), meta("key", key ?? String(matches[0]!.data!.citation_key ?? source)), at("source_file", matches[0]!.path), ...held.evidence],
      item: itemOf(citation), ...(sentence ? { sentence } : {}),
    })];
  });
}
