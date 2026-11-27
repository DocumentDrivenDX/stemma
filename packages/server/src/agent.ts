// What a snapshot gives for an agent's model (CONTRACT-005 N, "Results" and
// "What a result may hold"): IDs, labels, short excerpts and bounded source
// views, with text that holds a recognized coordinate form withheld. It is made
// in the snapshot's process, so that a form is looked for in whole texts, before
// anything is cut. All of it is quoted data; the caller marks it so.
import { findCoordinates } from "../../core/src/checks/coordinates.ts";
import type { PageSegment, SourceView, WorkName } from "../../core/src/source-view.ts";

/** Code points, but `pages`. */
export const AGENT_LIMITS = { hits: 20, defaultHits: 10, label: 200, context: 300, quoted: 2_000, pages: 5, passages: 20, sentence: 500, why: 600, value: 200 };

export const WITHHELD = "(withheld: it holds what looks like a coordinate; the explorer shows it to the author)";

/** Whether a recognized coordinate form is in the text, one broken over lines included. */
export const holdsCoordinate = (text: string): boolean =>
  text.split("\n").some((line) => findCoordinates(line).length > 0) || findCoordinates(text.replace(/\s+/gu, " ")).length > 0;

const cut = (text: string, most: number): string => {
  // Two UTF-16 units a code point at most, so a long text is not spread out whole.
  if (text.length <= most) return text;
  const points = Array.from(text.slice(0, most * 2 + 2));
  return points.length <= most ? text : `${points.slice(0, most - 1).join("")}…`;
};
const tail = (text: string, most: number): string => {
  if (text.length <= most) return text;
  const points = Array.from(text.slice(-(most * 2 + 2)));
  return points.length <= most && points.join("") === text ? text : `…${points.slice(-(most - 1)).join("")}`;
};

/** A value from a record, made fit to give: withheld whole, or cut and marked with `…`. */
export const given = (value: string, most: number): string => (holdsCoordinate(value) ? WITHHELD : cut(value, most));
const maybe = <K extends string>(name: K, value: string | undefined, most: number): { [k in K]?: string } =>
  (value === undefined ? {} : { [name]: given(value, most) }) as { [k in K]?: string };

interface Entry { type: string; key: string; label: string; text: string }

/** The entries of a snapshot, looked up by type and ID, or by ID alone. An ID is only compared, never read as anything else. */
export function agentRecordOf(entries: Entry[]) {
  const byKey = new Map<string, Entry>();
  const byBoth = new Map<string, Entry>();
  for (const entry of entries) {
    if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
    byBoth.set(`${entry.type}\0${entry.key}`, entry);
  }
  return {
    entry: (type: string, key: string): Entry | undefined => byBoth.get(`${type}\0${key}`),
    /** What `open` may go to, with its label as it may be given. */
    shown(key: string): { type: string; key: string; label: string } | null {
      const found = byKey.get(key);
      return found ? { type: found.type, key: found.key, label: given(found.label, AGENT_LIMITS.label) } : null;
    },
  };
}

interface Page {
  text: string; total: number; all: number; offset: number;
  counts: { type: string; label: string; count: number }[];
  hits: { rank: number; type: string; key: string; label: string; excerpt: { text: string }[] }[];
}

/** One page of a search as an agent gets it. `entry` gives a hit's whole search text. */
export function agentSearch(page: Page, entry: (type: string, key: string) => Entry | undefined) {
  return {
    total: page.total, all_types: page.all, offset: page.offset,
    counts: Object.fromEntries(page.counts.map((c) => [c.type, c.count])),
    hits: page.hits.map((hit) => {
      const whole = entry(hit.type, hit.key);
      const excerpt = hit.excerpt.map((p) => p.text).join("");
      const withheld = whole === undefined || holdsCoordinate(whole.text) || holdsCoordinate(whole.label);
      return {
        rank: hit.rank, type: hit.type, id: hit.key, label: given(hit.label, AGENT_LIMITS.label),
        ...(excerpt === "" ? {} : { excerpt_of_folded_text: withheld ? WITHHELD : excerpt }),
      };
    }),
  };
}

const work = (named: WorkName) => ({ id: given(named.id, AGENT_LIMITS.value), ...maybe("key", named.key, AGENT_LIMITS.value), ...maybe("title", named.title, AGENT_LIMITS.label) });

function head(view: SourceView) {
  return {
    id: view.id, kind: view.kind, state: view.state, why: given(view.why, AGENT_LIMITS.why),
    ...(view.work ? { work: { ...work(view.work), ...(view.work.part_of ? { part_of: work(view.work.part_of) } : {}) } } : {}),
    ...(view.locator ? { locator: { label: given(view.locator.label, AGENT_LIMITS.value), value: given(view.locator.value, AGENT_LIMITS.value) } } : {}),
  };
}

const textOf = (segment: PageSegment): string => segment.before + segment.quoted + segment.after;

function page(segment: PageSegment, withheld: boolean) {
  const before = tail(segment.before, AGENT_LIMITS.context);
  const after = cut(segment.after, AGENT_LIMITS.context);
  return {
    place: given(segment.place, AGENT_LIMITS.value),
    ...maybe("printed_label", segment.printed_label, AGENT_LIMITS.value),
    label_status: given(segment.label_status, AGENT_LIMITS.value),
    quality: { method: given(segment.quality.method, AGENT_LIMITS.value), level: given(segment.quality.level, AGENT_LIMITS.value) },
    flagged_in_reviews: segment.reviews.reduce((sum, r) => sum + r.flags.length, 0),
    ...(withheld ? { text: WITHHELD } : {
      before, quoted: segment.quoted, after,
      ...(segment.trimmed_before || before !== segment.before ? { before_is_cut: true } : {}),
      ...(segment.trimmed_after || after !== segment.after ? { after_is_cut: true } : {}),
    }),
  };
}

/**
 * A citation's or passage's source view, bounded. Page text is given only of a
 * passage view that is highlighted, and for a citation only when the citation
 * is too (CONTRACT-005 K). Quoted words are never cut: over a limit, no page
 * text is given.
 */
export function agentView(views: Record<string, SourceView>, id: string) {
  const view = Object.hasOwn(views, id) ? views[id]! : undefined;
  if (!view) return null;
  const passages = view.kind === "passage" ? [view]
    : view.passages.slice(0, AGENT_LIMITS.passages).flatMap((p) => (Object.hasOwn(views, p.passage) ? [views[p.passage]!] : []));
  const shown = view.state === "highlighted" ? passages.filter((p) => p.state === "highlighted") : [];
  const segments = shown.flatMap((p) => p.segments);
  const quoted = segments.reduce((sum, s) => sum + Array.from(s.quoted).length, 0);
  const over = segments.length > AGENT_LIMITS.pages || quoted > AGENT_LIMITS.quoted || view.passages.length > AGENT_LIMITS.passages;
  return {
    ...head(view),
    ...(view.citation ? { citation: { ...maybe("key", view.citation.key, AGENT_LIMITS.value), ...maybe("sentence", view.citation.sentence, AGENT_LIMITS.sentence), ...maybe("quotation", view.citation.quotation, AGENT_LIMITS.sentence) } } : {}),
    ...(over ? { page_text_not_given: `The quotation is ${quoted} characters on ${segments.length} page(s), more than one result gives (${AGENT_LIMITS.quoted} characters, ${AGENT_LIMITS.pages} pages). Show it to the author with open, or use excerpt for one passage.` } : {}),
    passages: passages.map((passage) => {
      const withheld = holdsCoordinate(passage.segments.map(textOf).join("\n\f\n")) || passage.segments.some((s) => holdsCoordinate(textOf(s)));
      const text = passage.source_text;
      return {
        ...head(passage),
        ...(text ? { source_text: { id: given(text.id, AGENT_LIMITS.value), method: given(text.method, AGENT_LIMITS.value), level: given(text.level, AGENT_LIMITS.value), ...maybe("recognition", text.recognition, AGENT_LIMITS.value) } } : {}),
        pages: !over && shown.includes(passage) ? passage.segments.map((s) => page(s, withheld)) : [],
      };
    }),
  };
}
