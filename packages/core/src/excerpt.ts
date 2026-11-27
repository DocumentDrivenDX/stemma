// `excerpt` (CONTRACT-002 G; SD-002 BR-209): a bounded piece of source text,
// marked as quoted data. It bounds only what it prints: a process with file
// access can read the source files, and no source is held back.
import { type Corpus, sha256 } from "@stemma/records";
import { placeOf, SourceTexts, type TextView } from "./matching/texts.ts";
import { InvalidInput } from "./operations.ts";
import { citedPages, locatorParts, numberOf } from "./checks/locators.ts";
import { type SourceView, type SourceViewRequest, SourceViews } from "./source-view.ts";

/** Design assumptions: what counts as an excerpt rather than a source. */
export const EXCERPT_LIMITS = { pages: 5, characters: 30_000, context: 300 };

export interface ExcerptPart { page_index?: number; printed_label?: string; heading: string; text: string; quoted?: true }

export interface Excerpt {
  source: string;
  source_text: string;
  requested: string;
  method: string;
  quality: string;
  other_source_texts: string[];
  parts: ExcerptPart[];
  /** A token that appears nowhere in the quoted text, to mark where it starts and ends. */
  boundary: string;
}

/** A token that appears nowhere in the data, so that nothing in the data can mark where it starts or ends. */
function boundaryFor(data: string): string {
  let boundary = sha256(data).slice(0, 16);
  while (data.includes(boundary)) boundary = sha256(boundary).slice(0, 16);
  return boundary;
}

function finish(view: TextView, others: string[], requested: string, parts: ExcerptPart[]): Excerpt {
  const size = parts.reduce((sum, p) => sum + p.text.length, 0);
  if (size > EXCERPT_LIMITS.characters) {
    throw new InvalidInput(`That is ${size} characters, more than the excerpt limit of ${EXCERPT_LIMITS.characters}. Ask for fewer pages.`);
  }
  // A marked quotation is printed run together with its context, so that reading is searched too.
  const together = parts.some((p) => p.quoted) ? `\f${parts.map((p) => p.text).join("")}` : "";
  const boundary = boundaryFor(parts.map((p) => p.text).join("\f") + together);
  return { source: view.source, source_text: view.id, requested, method: view.method, quality: view.level, other_source_texts: others, parts, boundary };
}

/** The printed pages a range such as `89`, `88-90` or `ix, 3` names. */
function wanted(range: string): string[] {
  for (const part of locatorParts(range, undefined)) {
    const [a, b] = [numberOf(part.first), numberOf(part.last)];
    if (part.first !== part.last && a && b && b.value - a.value >= EXCERPT_LIMITS.pages) {
      throw new InvalidInput(`An excerpt is at most ${EXCERPT_LIMITS.pages} pages. A longer range is not an excerpt.`);
    }
  }
  const labels = citedPages({ label: "page", value: range });
  if (!labels) throw new InvalidInput(`${range} is not a printed page or page range such as 89, 88-90 or ix.`);
  if (labels.length > EXCERPT_LIMITS.pages) throw new InvalidInput(`An excerpt is at most ${EXCERPT_LIMITS.pages} pages. A longer range is not an excerpt.`);
  return labels;
}

export function excerptPages(corpus: Corpus, source: string, range: string): Excerpt {
  if (corpus.byId.get(source)?.data?.kind !== "source") throw new InvalidInput(`No readable source record has the ID ${source}.`);
  const labels = wanted(range);
  const texts = new SourceTexts(corpus);
  if (texts.idsOf(source).length === 0) throw new InvalidInput(`The source ${source} has no source file. Capture its text first.`);
  const { views } = texts.of(source);
  if (views.length === 0) throw new InvalidInput("The source file of this source is damaged. `check` explains why.");
  const pagesFor = (view: TextView, label: string) => view.parts.filter((p) => p.label === label);
  // The newest source file that labels every requested page.
  const created = (v: TextView) => String((v.loaded.manifest.data!.created as { at?: string }).at);
  const complete = views.filter((v) => labels.every((l) => pagesFor(v, l).length > 0)).sort((a, b) => created(b).localeCompare(created(a)));
  const view = complete[0];
  if (!view) {
    const missing = labels.filter((l) => !views.some((v) => pagesFor(v, l).length > 0));
    throw new InvalidInput(missing.length > 0
      ? `No source file labels printed page ${missing.join(", ")}. A page has a printed label only where one was established; a source with no pages is read by passage.`
      : "No single source file labels all the requested pages. Ask for them one at a time.");
  }
  // Two pages with one label: both are shown, and the heading says which is which.
  const parts = labels.flatMap((label) => pagesFor(view, label).flatMap((p) => [
    { page_index: p.index, printed_label: label, heading: placeOf(view, p.index), text: p.streams.main },
    ...(p.streams.notes ? [{ page_index: p.index, printed_label: label, heading: `notes on ${placeOf(view, p.index)}`, text: p.streams.notes }] : []),
  ]));
  return finish(view, complete.slice(1).map((v) => v.id), `printed pages ${range}`, parts);
}

/** A passage with a little context. The rules for marking it are those of the source view (CONTRACT-005 K). */
export function excerptPassage(corpus: Corpus, passage: string): Excerpt {
  const context = { paged: EXCERPT_LIMITS.context, unpaged: EXCERPT_LIMITS.context };
  const views = new SourceViews(corpus, { context });
  const made = views.passage(passage);
  if (made.state !== "highlighted") throw new InvalidInput(`The passage ${passage} cannot be shown (${made.state}). ${made.why}`);
  const view = new SourceTexts(corpus).view(made.source_text!.id)!;
  const [first, last] = [made.segments[0]!, made.segments.at(-1)!];
  return finish(view, [], `passage ${passage}`, [
    { heading: "context before", text: first.before },
    { heading: `the passage (${made.segments.map((s) => placeOf(view, s.index)).join("; ")})`, text: made.segments.map((s) => s.quoted).join("\n"), quoted: true },
    { heading: "context after", text: last.after },
  ]);
}

/** A citation or report quotation shown in its source, within the excerpt limits. */
export interface ViewExcerpt {
  view: SourceView;
  /** The passage views, in order; none unless the view is `highlighted`. */
  passages: SourceView[];
  boundary: string;
}

export function excerptView(corpus: Corpus, request: SourceViewRequest, quotations: unknown[] = []): ViewExcerpt {
  // The cited pages whole; a source with no pages only a little around the quotation.
  const views = new SourceViews(corpus, { quotations, context: { paged: Number.POSITIVE_INFINITY, unpaged: EXCERPT_LIMITS.context } });
  const view = views.view(request);
  const passages = view.state === "highlighted" ? view.passages.map((p) => views.passage(p.passage)) : [];
  const segments = passages.flatMap((p) => p.segments.map((s) => ({ text: p.source_text!.id, segment: s })));
  const pages = new Set(segments.map((s) => `${s.text}/${s.segment.index}`)).size;
  if (pages > EXCERPT_LIMITS.pages) {
    throw new InvalidInput(`That quotation lies on ${pages} pages. An excerpt is at most ${EXCERPT_LIMITS.pages} pages. Ask for one passage at a time with --passage.`);
  }
  const size = segments.reduce((sum, { segment: s }) => sum + s.before.length + s.quoted.length + s.after.length, 0);
  if (size > EXCERPT_LIMITS.characters) {
    throw new InvalidInput(`That is ${size} characters of source text, more than the excerpt limit of ${EXCERPT_LIMITS.characters}. Ask for one passage at a time with --passage.`);
  }
  const data = [view, ...passages];
  const run = passages.flatMap((p) => p.segments.map((s) => s.before + s.quoted + s.after)).join("\f");
  return { view, passages, boundary: boundaryFor(`${JSON.stringify(data)}\f${run}`) };
}
