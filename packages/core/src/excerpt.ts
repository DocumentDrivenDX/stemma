// `excerpt` (CONTRACT-002 G; SD-002 BR-209): a bounded piece of stored text,
// marked as quoted data. It bounds only what it prints: a process with file
// access can read the store, and no source is held back.
import { type Corpus, idOf, isObject, isRetired, sha256 } from "@stemma/records";
import { labelOf, type StoredText, StoredTexts } from "./matching/stored.ts";
import { InvalidInput } from "./operations.ts";
import { citedPages, locatorParts, numberOf } from "./checks/locators.ts";
import type { BlobReader } from "./store.ts";

/** Design assumptions: what counts as an excerpt rather than a source. */
export const EXCERPT_LIMITS = { pages: 5, characters: 30_000, context: 300 };

export interface ExcerptPart { page_index?: number; printed_label?: string; heading: string; text: string }

export interface Excerpt {
  source: string;
  extraction: string;
  capture: string;
  requested: string;
  method: string;
  quality: string;
  quality_note?: string;
  other_extractions: string[];
  parts: ExcerptPart[];
  /** A token that appears nowhere in the quoted text, to mark where it starts and ends. */
  boundary: string;
}

function finish(corpus: Corpus, stored: StoredText, others: string[], requested: string, parts: ExcerptPart[]): Excerpt {
  const size = parts.reduce((sum, p) => sum + p.text.length, 0);
  if (size > EXCERPT_LIMITS.characters) {
    throw new InvalidInput(`That is ${size} characters, more than the excerpt limit of ${EXCERPT_LIMITS.characters}. Ask for fewer pages.`);
  }
  const quality = isObject(stored.extraction.data!.quality) ? stored.extraction.data!.quality : {};
  let boundary = sha256(parts.map((p) => p.text).join("\f")).slice(0, 16);
  while (parts.some((p) => p.text.includes(boundary))) boundary = sha256(boundary).slice(0, 16);
  return {
    source: String(corpus.byId.get(String(stored.capture.data!.source))?.data?.id ?? stored.capture.data!.source),
    extraction: idOf(stored.extraction)!, capture: idOf(stored.capture)!, requested,
    method: stored.method, quality: stored.level,
    ...(typeof quality.note === "string" ? { quality_note: quality.note } : {}),
    other_extractions: others, parts, boundary,
  };
}

/** The printed pages a range such as `89`, `88-90` or `ix, 3` names. */
function wanted(range: string): string[] {
  const parts = locatorParts(range, undefined);
  for (const part of parts) {
    const [a, b] = [numberOf(part.first), numberOf(part.last)];
    if (part.first !== part.last && a && b && b.value - a.value >= EXCERPT_LIMITS.pages) {
      throw new InvalidInput(`An excerpt is at most ${EXCERPT_LIMITS.pages} pages. A longer range is not an excerpt.`);
    }
  }
  const labels = citedPages({ label: "page", value: range });
  if (!labels) throw new InvalidInput(`${range} is not a printed page or page range such as 89, 88-90 or ix.`);
  if (labels.length > EXCERPT_LIMITS.pages) {
    throw new InvalidInput(`An excerpt is at most ${EXCERPT_LIMITS.pages} pages. A longer range is not an excerpt.`);
  }
  return labels;
}

export function excerptPages(corpus: Corpus, blobs: BlobReader, source: string, range: string): Excerpt {
  if (corpus.byId.get(source)?.data?.kind !== "source") throw new InvalidInput(`No readable source record has the ID ${source}.`);
  const labels = wanted(range);
  const texts = new StoredTexts(corpus, blobs);
  const all = texts.extractionsOf(source);
  if (all.length === 0) throw new InvalidInput(`The source ${source} has no stored copy with text. Add a copy and attach its text first.`);
  const usable = all.map((e) => texts.of(e)).filter((t): t is StoredText => typeof t !== "string");
  if (usable.length === 0) throw new InvalidInput("The stored copy or text of this source is missing or does not match its digest. Run `store verify`.");
  const pagesFor = (stored: StoredText, label: string) => [...stored.labels].filter(([, l]) => l === label).map(([page]) => page);
  // The newest text that maps every requested page.
  const complete = usable.filter((t) => labels.every((l) => pagesFor(t, l).length > 0))
    .sort((a, b) => String((b.extraction.data!.created as { at?: string })?.at).localeCompare(String((a.extraction.data!.created as { at?: string })?.at)));
  const stored = complete[0];
  if (!stored) {
    const missing = labels.filter((l) => !usable.some((t) => pagesFor(t, l).length > 0));
    throw new InvalidInput(missing.length > 0
      ? `No stored text maps printed page ${missing.join(", ")}. A page has a printed label only through the page map; see \`source pages\`.`
      : "No single stored text maps all the requested pages. Ask for them one at a time.");
  }
  const parts: ExcerptPart[] = [];
  for (const label of labels) {
    const pages = pagesFor(stored, label);
    // Two file pages with one label: both are shown, and the heading says which is which.
    for (const page_index of pages) {
      const span = stored.spans.find((s) => s.page_index === page_index)!;
      parts.push({
        page_index, printed_label: label, heading: labelOf(stored, page_index),
        text: stored.text.slice(stored.unit(span.start), stored.unit(span.end)),
      });
    }
  }
  return finish(corpus, stored, complete.slice(1).map((t) => idOf(t.extraction)!), `printed pages ${range}`, parts);
}

export function excerptPassage(corpus: Corpus, blobs: BlobReader, passage: string): Excerpt {
  const data = corpus.byId.get(passage)?.data;
  if (data?.kind !== "passage") throw new InvalidInput(`No readable passage record has the ID ${passage}.`);
  if (isRetired(data)) throw new InvalidInput(`The passage ${passage} is retired.`);
  const extraction = corpus.byId.get(String(data.extraction));
  const stored = extraction?.data?.kind === "extraction" ? new StoredTexts(corpus, blobs).of(extraction) : "text_unusable";
  if (typeof stored === "string" || data.text_sha256 !== stored.extraction.data!.text_sha256) {
    throw new InvalidInput("The stored text this passage was anchored in is missing, altered or not the one it names.");
  }
  const position = isObject(data.position) ? data.position : undefined;
  const exact = isObject(data.quote) ? String(data.quote.exact) : "";
  let start = position ? stored.unit(Number(position.start)) : stored.text.indexOf(exact);
  const end = position ? stored.unit(Number(position.end)) : start + exact.length;
  if (start < 0 || end <= start || end > stored.text.length) {
    throw new InvalidInput("The passage's place in the stored text cannot be found. `check` explains why.");
  }
  const before = stored.text.slice(Math.max(0, start - EXCERPT_LIMITS.context), start);
  const after = stored.text.slice(end, end + EXCERPT_LIMITS.context);
  const pages = stored.pagesOf(start, end);
  return finish(corpus, stored, [], `passage ${passage}`, [
    { heading: "context before", text: before },
    { heading: `the passage (${pages.map((p) => labelOf(stored, p)).join("; ") || "no pages"})`, text: stored.text.slice(start, end) },
    { heading: "context after", text: after },
  ]);
}
