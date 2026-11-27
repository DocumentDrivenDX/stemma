// number.present (CONTRACT-002 C; SD-007 BR-719): a figure written in digits in
// a cited sentence, outside its quotation and locator, is in the cited source's
// text. A pass shows presence only, not what the figure counts.
import { type Corpus, idOf, isObject } from "@stemma/records";
import { result } from "../findings.ts";
import { SourceTexts } from "../matching/texts.ts";
import type { Evidence, Result } from "../report.ts";
import { hasManuscript, resolveCitations } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

const FIGURE = /(?<![\p{L}\p{N}.,])\d+(?:[.,]\d+)*(?:\s?%)?/gu;

/** Digit-written figures; four-digit years, dates and ordinals are not figures (assumption). */
export function figuresIn(sentence: string, quotation?: string, locator?: string): string[] {
  let text = sentence.replace(/“[^”]*”|"[^"]*"/g, " ");
  if (quotation) text = text.split(quotation).join(" ");
  if (locator) text = text.replace(new RegExp(`\\b(?:pp?\\.|pages?|chapters?|ch\\.|paragraphs?)\\s*${locator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), " ");
  const found = [...text.matchAll(FIGURE)].flatMap((m) => {
    const after = text.slice(m.index + m[0].length);
    const figure = m[0].replace(/\s/g, "");
    if (/^(st|nd|rd|th)\b/i.test(after) || /^(1[5-9]|20)\d\d$/.test(figure)) return [];
    // A date written with its day, month or range of years is not a figure.
    if (/^\s?(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(after)) return [];
    return [figure];
  });
  return [...new Set(found)];
}

const present = (text: string, figure: string): boolean => {
  const bare = figure.replace(/%$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const percent = figure.endsWith("%") ? "\\s?(?:%|per\\s?cent)" : "";
  return new RegExp(`(?<![\\d]|\\d[.,])${bare}(?![\\d]|[.,]\\d)${percent}`, "iu").test(text);
};

export const figureCitations = (corpus: Corpus) => (hasManuscript(corpus) ? [] : resolveCitations(corpus)).flatMap((r) => {
  const data = r.citation.data!;
  const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" ? data.sentence.text : undefined;
  const figures = sentence
    ? figuresIn(sentence, typeof data.quotation === "string" ? data.quotation : undefined, isObject(data.locator) ? String(data.locator.value) : undefined) : [];
  return figures.length > 0 ? [{ ...r, figures, sentence: data.sentence as { text: string; sha256: string } }] : [];
});

export function numberResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const all = hasManuscript(corpus) ? [] : resolveCitations(corpus);
  return figureCitations(corpus).flatMap(({ citation, key, matches, figures, sentence }) => {
    if (matches.length !== 1) return [];
    const source = idOf(matches[0]!)!;
    const several = all.filter((r) => isObject(r.citation.data!.sentence) && r.citation.data!.sentence.sha256 === sentence.sha256).length > 1;
    const { views, unusable } = texts.of(source);
    const missing = figures.filter((f) => !views.some((v) => present(v.streams.main.text, f) || present(v.streams.notes.text, f)));
    const outcome = several || views.length === 0 || (missing.length > 0 && unusable > 0) ? "unverifiable" : missing.length > 0 ? "fail" : "pass";
    const reason = several ? "several_citations" : outcome === "unverifiable" ? "text_unavailable" : outcome === "fail" ? "figure_absent" : undefined;
    const evidence: Evidence[] = [
      { name: "citation_file", class: "location", value: citation.path },
      { name: "key", class: "metadata", value: key ?? String(matches[0]!.data!.citation_key ?? source) },
      { name: "figures", class: "manuscript", value: figures.join(", ") },
      ...(outcome === "fail" ? [{ name: "not_found", class: "manuscript" as const, value: missing.join(", ") }] : []),
      ...views.map((v): Evidence => ({ name: "source_text", class: "location", value: v.loaded.manifest.path })),
    ];
    return [result({ check: "number.present", outcome, ...(reason ? { reason } : {}), subject: subjectOf(citation), locus: `${idOf(citation)}#figures`, source, evidence, item: itemOf(citation), sentence })];
  });
}
