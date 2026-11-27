// number.present (CONTRACT-002 C; SD-007 BR-719): a figure written in digits in
// a cited sentence, outside its quotation and locator, is in the cited source's
// text. A pass shows presence only, not what the figure counts.
import { type Corpus, idOf } from "@stemma/records";
import { result } from "../findings.ts";
import { SourceTexts } from "../matching/texts.ts";
import type { Evidence, Result } from "../report.ts";
import { cited, type CitingSentence, type Use } from "./cited.ts";

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

/** The sentence's figures, leaving out its quotations and each locator written out in it. */
function figuresOf({ text, quotation, locators }: CitingSentence): string[] {
  return locators.reduce((left, locator) => {
    const without = new Set(figuresIn(text, quotation, locator));
    return left.filter((f) => without.has(f));
  }, figuresIn(text, quotation));
}

interface Cite { use: Use; figures: string[]; several: boolean }

/** Each source a sentence with figures cites, once: citations of one source are one. */
function figureCitations(corpus: Corpus): Cite[] {
  return cited(corpus).sentences.flatMap((sentence) => {
    const figures = figuresOf(sentence);
    if (figures.length === 0) return [];
    const seen = new Set<unknown>();
    return sentence.uses.flatMap((use) => {
      if (use.matches.length !== 1) return [];
      if (seen.has(idOf(use.matches[0]!))) return [];
      seen.add(idOf(use.matches[0]!));
      return [{ use, figures, several: sentence.several }];
    });
  });
}

export function numberResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  return figureCitations(corpus).map(({ use, figures, several }) => {
    const source = idOf(use.matches[0]!)!;
    const { views, unusable } = texts.of(source);
    const missing = figures.filter((f) => !views.some((v) => present(v.streams.main.text, f) || present(v.streams.notes.text, f)));
    const outcome = several || views.length === 0 || (missing.length > 0 && unusable > 0) ? "unverifiable" : missing.length > 0 ? "fail" : "pass";
    const reason = several ? "several_citations" : outcome === "unverifiable" ? "text_unavailable" : outcome === "fail" ? "figure_absent" : undefined;
    const evidence: Evidence[] = [
      ...use.where,
      { name: "key", class: "metadata", value: use.key ?? String(use.matches[0]!.data!.citation_key ?? source) },
      { name: "figures", class: "manuscript", value: figures.join(", ") },
      ...(outcome === "fail" ? [{ name: "not_found", class: "manuscript" as const, value: missing.join(", ") }] : []),
      ...views.map((v): Evidence => ({ name: "source_text", class: "location", value: v.loaded.manifest.path })),
    ];
    // A sentence with several citations shows nothing wrong: which holds the figure is simply not told.
    if (several) evidence.push({ name: "coverage", class: "metadata", value: "figures in sentences that cite more than one source were not attributed to one" });
    return result({
      check: "number.present", outcome, ...(reason ? { reason } : {}), subject: use.subject, locus: `${use.locus}#figures`, source, evidence,
      ...(use.item ? { item: use.item } : {}), ...(use.sentence ? { sentence: use.sentence } : {}), coverage: several,
    });
  });
}
