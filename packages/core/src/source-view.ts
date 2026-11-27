// One citation, passage or report quotation shown in its source text
// (CONTRACT-005 K; FEAT-012 SRC-01 to SRC-04). The command line, the export and
// a later server all give what this makes, from the corpus alone.
//
// A highlight that could be wrong is the worst failure here: text is returned
// only for the state `highlighted`, and every doubt gives another state, with
// why, and no text.
import {
  canonical, citationKeys, compareCodePoints, type Corpus, idOf, isLocalPath, isObject, isRetired, type Json, type JsonObject,
  type LoadedFile,
} from "@stemma/records";
import { placeOf, SourceTexts, type StreamName, type TextView, codePoints } from "./matching/texts.ts";
import { renderQuotation } from "./matching/quote-fold.ts";
import { InvalidInput } from "./operations.ts";
import { anchorsOf, textAt } from "./passages.ts";
import { comparedDigest, currentReview } from "./verification.ts";

export const SOURCE_VIEW_SCHEMA = "stemma.sourceview/0";

/** Code points of one page's text kept on each side of the quoted piece (CONTRACT-005 K). */
export const SOURCE_VIEW_CONTEXT = { paged: 20_000, unpaged: 1_500 };

export type SourceViewState =
  | "highlighted" | "changed" | "no_source_file" | "damaged_file" | "invalid_anchor" | "no_passage" | "citation_differs"
  | "retired" | "not_exported";

export interface WorkName { id: string; key?: string; title?: string }
export interface ViewWork extends WorkName { part_of?: WorkName }

export interface ViewFlag { reading: string; suggested?: string; note?: string }

export type ViewReview =
  | { by: "person"; review: string; scope: string; outcome: string; against?: string; flags: ViewFlag[] }
  /** A model's or software's review is shown only as the flags it raised. */
  | { by: "model" | "software"; review: string; flags: ViewFlag[] };

export interface ViewComparison {
  run: string; method: string; against?: string; independent: boolean; agreement_permille: number; words: number; differing_words: number;
}

export interface PageSegment {
  index: number;
  place: string;
  stream: StreamName;
  printed_label?: string;
  label_status: string;
  label_basis?: string;
  before: string;
  quoted: string;
  after: string;
  trimmed_before?: true;
  trimmed_after?: true;
  quality: { method: string; level: string; note?: string };
  comparisons: ViewComparison[];
  reviews: ViewReview[];
}

export interface ViewOriginalFile {
  sha256: string; size: number; media_type: string; index?: number;
  upstreams: { record: string; url?: string; retrieved_at: string; version?: string }[];
}

export interface ViewOriginal {
  form: string;
  page_count?: number;
  description?: string;
  held_at?: string;
  obtained_from?: string;
  acquired_at?: string;
  version?: string;
  files: ViewOriginalFile[];
  /** Page images of pages the passage does not lie on. */
  other_page_files?: number;
}

export interface ViewSourceText {
  id: string; method: string; level: string; recognition?: string; note?: string; paged: boolean; coverage: string; coverage_note?: string;
}

export interface PassagePointer { passage: string; join?: string; join_note?: string }

export interface QuotationListing {
  cites: string;
  note?: boolean;
  corrections?: { was: string; now: string; by: string; basis: string }[];
  italic?: string[];
  keep_hyphens?: string[];
  checked?: string;
}

export interface SourceView {
  schema: typeof SOURCE_VIEW_SCHEMA;
  kind: "citation" | "passage" | "quotation";
  id: string;
  state: SourceViewState;
  why: string;
  work?: ViewWork;
  locator?: { label: string; value: string };
  citation?: { key?: string; source?: string; quotation?: string; sentence?: string };
  quotation?: QuotationListing;
  /** For a citation or a report quotation: the passages, each with a view of its own. */
  passages: PassagePointer[];
  source_text?: ViewSourceText;
  /** Empty unless the view is a passage's and its state is `highlighted`. */
  segments: PageSegment[];
  original?: ViewOriginal;
}

/** One quotation of an assembled report's `report.json` (CONTRACT-006 I). */
export interface ListedQuotation extends QuotationListing {
  id: string;
  passages: PassagePointer[];
}

export interface SourceViewOptions {
  /** The quotations of a report, for a request by quotation ID. */
  quotations?: unknown[];
  context?: { paged: number; unpaged: number };
}

export interface SourceViewRequest { kind: "citation" | "passage" | "quotation"; id: string }

const WHY: Record<Exclude<SourceViewState, "citation_differs" | "invalid_anchor" | "no_passage" | "retired">, string> = {
  highlighted: "The passage's address still gives exactly the words the passage copied from this source file.",
  changed: "The source text at the passage's address is no longer what the passage copied: the page changed after it was captured, or the record does. Nothing is highlighted. Run `check`, look at the change, and capture the passage again if the words still stand.",
  no_source_file: "The passage names no source file that this project holds in readable form, so there is no text to show. Nothing is highlighted. Run `check`.",
  damaged_file: "The source file is damaged or breaks a record rule, so none of its text is used. Nothing is highlighted. Run `check` for what is wrong with it.",
  not_exported: "This export left the text out to stay within its size limit. Use `excerpt` to see it.",
};

const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);
const invalid = (file: LoadedFile): boolean => file.problems.some((p) => p.reason === "record_invalid");
const words = (value: unknown): value is string => typeof value === "string" && value !== "";

/** A string from a record that may leave the project: nothing that is a path on a machine. */
function releasable(value: unknown, location = false): string | undefined {
  return words(value) && !isLocalPath(value, location) ? value : undefined;
}
const optional = <K extends string>(name: K, value: unknown): { [k in K]?: string } =>
  (value === undefined ? {} : { [name]: value }) as { [k in K]?: string };

type Failure = { state: Exclude<SourceViewState, "highlighted">; why: string };
const differs = (why: string): Failure => ({ state: "citation_differs", why });

/** Makes source views over one corpus, reading each source file and record list once. */
export class SourceViews {
  private readonly texts: SourceTexts;
  private readonly context: { paged: number; unpaged: number };
  private readonly quotations: unknown[];
  private readonly passages = new Map<string, SourceView>();
  /** Records in effect that break no rule, by kind and by what they are looked up by. */
  private readonly runs = new Map<string, JsonObject[]>();
  private readonly reviews = new Map<string, JsonObject[]>();
  private readonly upstreams = new Map<string, JsonObject[]>();
  /** Sources in effect by citation key and alias, invalid ones included, so that a shared key is seen. */
  private readonly keys = new Map<string, Set<string>>();

  constructor(private readonly corpus: Corpus, options: SourceViewOptions = {}) {
    this.texts = new SourceTexts(corpus);
    this.context = options.context ?? SOURCE_VIEW_CONTEXT;
    this.quotations = options.quotations ?? [];
    const add = (map: Map<string, JsonObject[]>, key: string, data: JsonObject) => map.set(key, [...(map.get(key) ?? []), data]);
    for (const file of [...corpus.records].sort((a, b) => compareCodePoints(idOf(a) ?? "", idOf(b) ?? ""))) {
      const data = file.data;
      if (file.state !== "ok" || !data || isRetired(data)) continue;
      if (data.kind === "source") {
        for (const key of citationKeys(data)) this.keys.set(key, (this.keys.get(key) ?? new Set()).add(String(data.id)));
      }
      if (invalid(file)) continue;
      if (data.kind === "comparison_run") add(this.runs, String(data.text), data);
      if (data.kind === "text_review") add(this.reviews, String(data.text), data);
      if (data.kind === "upstream") add(this.upstreams, String(data.sha256), data);
    }
  }

  view(request: SourceViewRequest): SourceView {
    if (request.kind === "passage") return this.passage(request.id);
    return request.kind === "citation" ? this.citation(request.id) : this.quotation(request.id);
  }

  private record(id: string, kind: string): LoadedFile | undefined {
    const file = this.corpus.byId.get(id);
    return file?.state === "ok" && file.data?.kind === kind ? file : undefined;
  }

  private name(id: string): WorkName {
    const file = this.record(id, "source");
    if (!file || invalid(file)) return { id };
    const data = file.data!;
    return {
      id,
      ...optional("key", releasable(data.citation_key)),
      ...optional("title", releasable(isObject(data.title) ? data.title.value : undefined)),
    };
  }

  /** The source in effect that a source is `part_of`. */
  private containerOf(id: string): string | undefined {
    const relation = list(this.record(id, "source")?.data!.relations).find((r) => r.type === "part_of");
    const target = relation ? this.record(String(relation.target), "source") : undefined;
    return target && !isRetired(target.data!) ? String(relation!.target) : undefined;
  }

  private work(id: string): ViewWork {
    const container = this.containerOf(id);
    return { ...this.name(id), ...(container ? { part_of: this.name(container) } : {}) };
  }

  /** The one source in effect that a key or a source ID names. */
  private named(name: string): { id: string } | { problem: string } {
    const direct = this.record(name, "source");
    if (direct && !isRetired(direct.data!)) return { id: name };
    const found = [...(this.keys.get(name) ?? [])];
    if (found.length === 1) return { id: found[0]! };
    return { problem: found.length === 0 ? "names no source in effect" : "names more than one source" };
  }

  /** Whether a passage of `source` may be cited as `cited`: that source, or a part of it. */
  private supports(cited: string, source: string): boolean {
    return cited === source || this.containerOf(cited) === source;
  }

  passage(id: string): SourceView {
    const known = this.passages.get(id);
    if (known) return known;
    const made = this.makePassage(id);
    this.passages.set(id, made);
    return made;
  }

  private makePassage(id: string): SourceView {
    const file = this.record(id, "passage");
    if (!file) throw new InvalidInput(`No readable passage record has the ID ${id}.`);
    const data = file.data!;
    const locator = isObject(data.locator) && words(data.locator.value) ? { label: String(data.locator.label), value: data.locator.value } : undefined;
    const source = String(data.source);
    const held = this.record(source, "source") ? this.work(source) : undefined;
    const base = {
      schema: SOURCE_VIEW_SCHEMA as typeof SOURCE_VIEW_SCHEMA, kind: "passage" as const, id,
      ...(held ? { work: held } : {}), ...(locator ? { locator } : {}), passages: [],
    };
    const fail = ({ state, why }: Failure): SourceView => ({ ...base, state, why, segments: [] });
    const retired = (what: string): Failure => ({ state: "retired", why: `${what} is retired, so nothing is highlighted.` });
    const badAnchor = (why: string): Failure => ({ state: "invalid_anchor", why: `${why} Nothing is highlighted. Run \`check\`, and capture the passage again.` });

    if (isRetired(data)) return fail(retired(`The passage ${id}`));
    if (invalid(file)) return fail(badAnchor("The passage record breaks a record rule."));
    if (!held) return fail(badAnchor("The passage names no readable source record."));
    if (isRetired(this.record(source, "source")!.data!)) return fail(retired(`The passage's source, ${source},`));
    const loaded = this.corpus.texts.get(String(data.text));
    if (!loaded) return fail({ state: "no_source_file", why: WHY.no_source_file });
    if (isRetired(loaded.manifest.data!)) return fail(retired(`The source file the passage was captured from, ${String(data.text)},`));
    if (loaded.manifest.data!.source !== source) return fail(badAnchor("The passage's address names a source file of another source."));
    const view = !invalid(loaded.manifest) ? this.texts.view(String(data.text)) : undefined;
    if (!view) return fail({ state: "damaged_file", why: WHY.damaged_file });

    const anchor = anchorsOf(data);
    const exact = isObject(data.quote) ? data.quote.exact : undefined;
    const whole = (n: unknown): boolean => typeof n === "number" && Number.isInteger(n) && n >= 0;
    const formed = Array.isArray(data.anchor) && anchor.length > 0 && anchor.length === data.anchor.length && words(exact)
      && anchor.every((a, i) => whole(a.index) && whole(a.start) && whole(a.end) && a.start < a.end && words(a.page_sha256)
        && (a.stream === "main" || a.stream === "notes") && a.stream === anchor[0]!.stream && (i === 0 || a.index > anchor[i - 1]!.index));
    if (!formed) return fail(badAnchor("The passage's address or quoted words are not well formed."));
    for (const a of anchor) {
      const part = view.part(a.index);
      if (!part || part.digest !== a.page_sha256) return fail({ state: "changed", why: WHY.changed });
      if (a.end > codePoints(part.streams[a.stream])) return fail(badAnchor("The passage's address runs past the end of a page's text."));
    }
    // More than one piece must be one stretch of the stream: to the end of each page and from the start of the next.
    const order = view.streams[anchor[0]!.stream].spans.map((s) => s.index);
    const continuous = anchor.every((a, i) => (i === 0 || (a.start === 0 && order.indexOf(a.index) === order.indexOf(anchor[i - 1]!.index) + 1))
      && (i === anchor.length - 1 || a.end === codePoints(view.part(a.index)!.streams[a.stream])));
    if (!continuous) return fail(badAnchor("The passage's address is not one continuous stretch of the text."));
    const now = textAt(this.texts, data);
    if (now.state !== "ok" || now.text !== exact) return fail({ state: "changed", why: WHY.changed });

    const segments = anchor.map((a) => this.segment(view, id, a.index, a.stream, a.start, a.end));
    return {
      ...base, state: "highlighted", why: WHY.highlighted, source_text: this.sourceText(view), segments,
      original: this.original(view, anchor.map((a) => a.index)),
    };
  }

  private segment(view: TextView, passage: string, index: number, stream: StreamName, start: number, end: number): PageSegment {
    const part = view.part(index)!;
    const front = part.part.front;
    const points = [...part.streams[stream]];
    const most = view.paged ? this.context.paged : this.context.unpaged;
    const from = Math.max(0, start - most);
    const to = Math.min(points.length, end + most);
    return {
      index, place: `${stream === "notes" ? "notes on " : ""}${placeOf(view, index)}`, stream,
      ...optional("printed_label", part.label), label_status: part.labelStatus, ...optional("label_basis", releasable(front.label_basis)),
      before: points.slice(from, start).join(""), quoted: points.slice(start, end).join(""), after: points.slice(end, to).join(""),
      ...(from > 0 ? { trimmed_before: true as const } : {}), ...(to < points.length ? { trimmed_after: true as const } : {}),
      quality: { method: String(front.method), level: String(front.level), ...optional("note", releasable(front.note)) },
      comparisons: this.comparisons(view, index),
      reviews: this.pageReviews(view, passage, index),
    };
  }

  private comparisons(view: TextView, index: number): ViewComparison[] {
    const blocks = view.part(index)!.part.blocks;
    return (this.runs.get(view.id) ?? []).flatMap((run) => list(run.pages)
      .filter((p) => Number(p.index) === index && p.sha256 === comparedDigest(String(run.method), blocks))
      .map((p) => ({
        run: String(run.id), method: String(run.method), ...optional("against", releasable(run.against)), independent: run.independent === true,
        agreement_permille: Number(p.agreement_permille), words: Number(p.words), differing_words: Number(p.differing_words),
      })));
  }

  private pageReviews(view: TextView, passage: string, index: number): ViewReview[] {
    return (this.reviews.get(view.id) ?? []).flatMap((review): ViewReview[] => {
      const scope = String(review.scope);
      if (!["whole_page", "page_number", "quotations", "passage"].includes(scope)) return [];
      if (scope === "passage" && review.passage !== passage) return [];
      if (!list(review.pages).some((p) => Number(p.index) === index) || !currentReview(review, view.loaded)) return [];
      const flags = list(review.flags).filter((f) => Number(f.index) === index).flatMap((f): ViewFlag[] => {
        const reading = releasable(f.reading);
        return reading === undefined ? [] : [{ reading, ...optional("suggested", releasable(f.suggested)), ...optional("note", releasable(f.note)) }];
      });
      const reviewed = isObject(review.reviewed) && isObject(review.reviewed.by) ? review.reviewed.by.kind : undefined;
      if (reviewed === "person") {
        return [{ by: "person", review: String(review.id), scope, outcome: String(review.outcome), ...optional("against", releasable(review.against)), flags }];
      }
      return flags.length > 0 ? [{ by: reviewed === "software" ? "software" : "model", review: String(review.id), flags }] : [];
    });
  }

  private sourceText(view: TextView): ViewSourceText {
    const data = view.loaded.manifest.data!;
    const conversion = isObject(data.conversion) ? data.conversion : {};
    return {
      id: view.id, method: view.method, level: view.level,
      ...optional("recognition", releasable(conversion.recognition)), ...optional("note", releasable(conversion.note)),
      paged: view.paged, coverage: String(data.coverage), ...optional("coverage_note", releasable(data.coverage_note)),
    };
  }

  /** The original as the source file records it (CONTRACT-007 C). Whether anyone holds it is not part of a view. */
  private original(view: TextView, pages: number[]): ViewOriginal {
    const data = view.loaded.manifest.data!;
    const original = isObject(data.original) ? data.original : {};
    const all = list(original.files);
    const kept = all.filter((f) => f.index === undefined || pages.includes(Number(f.index)));
    return {
      form: String(original.form),
      ...(typeof original.page_count === "number" ? { page_count: original.page_count } : {}),
      ...optional("description", releasable(original.description, true)),
      ...optional("held_at", releasable(original.held_at, true)),
      ...optional("obtained_from", releasable(original.obtained_from, true)),
      ...optional("acquired_at", releasable(original.acquired_at)),
      ...optional("version", releasable(original.version, true)),
      files: kept.map((f) => ({
        sha256: String(f.sha256), size: Number(f.size), media_type: String(f.media_type),
        ...(typeof f.index === "number" ? { index: f.index } : {}),
        // Only an upstream of these bytes names where they came from; its other addresses are not originals.
        upstreams: (this.upstreams.get(String(f.sha256)) ?? []).map((u) => ({
          record: String(u.id), ...optional("url", releasable(u.url, true)), retrieved_at: String(u.retrieved_at), ...optional("version", releasable(u.version, true)),
        })),
      })),
      ...(all.length > kept.length ? { other_page_files: all.length - kept.length } : {}),
    };
  }

  /** The state of a view of passages: the first passage that cannot be highlighted decides. */
  private passagesState(pointers: PassagePointer[]): Failure | undefined {
    for (const { passage } of pointers) {
      if (!this.record(passage, "passage")) return { state: "no_passage", why: `No readable passage record has the ID ${passage}, so nothing is highlighted.` };
      const made = this.passage(passage);
      if (made.state !== "highlighted") return { state: made.state as Failure["state"], why: pointers.length > 1 ? `Passage ${passage}: ${made.why}` : made.why };
    }
    return undefined;
  }

  citation(id: string): SourceView {
    const file = this.record(id, "citation");
    if (!file) throw new InvalidInput(`No readable citation record has the ID ${id}.`);
    const data = file.data!;
    if (invalid(file)) throw new InvalidInput(`The citation record ${id} breaks a record rule, so it is not read. \`check\` explains why.`);
    const locator = isObject(data.locator) && words(data.locator.value) ? { label: String(data.locator.label), value: data.locator.value } : undefined;
    const cites = [data.key, data.source].filter(words).map((name) => ({ name, found: this.named(name) }));
    const cited = cites.length > 0 && cites.every((c) => "id" in c.found && c.found.id === (cites[0]!.found as { id: string }).id)
      ? (cites[0]!.found as { id: string }).id : undefined;
    const pointer = words(data.passage) ? data.passage : undefined;
    const base = {
      schema: SOURCE_VIEW_SCHEMA as typeof SOURCE_VIEW_SCHEMA, kind: "citation" as const, id, segments: [],
      ...(cited ? { work: this.work(cited) } : {}), ...(locator ? { locator } : {}),
      citation: {
        ...optional("key", releasable(data.key)), ...optional("source", releasable(data.source)),
        ...optional("quotation", releasable(data.quotation)),
        ...optional("sentence", releasable(isObject(data.sentence) ? data.sentence.text : undefined)),
      },
      passages: pointer ? [{ passage: pointer }] : [],
    };
    const give = ({ state, why }: Failure | { state: "highlighted"; why: string }): SourceView => ({ ...base, state, why });
    if (isRetired(data)) return give({ state: "retired", why: `The citation ${id} is retired, so nothing is highlighted.` });
    if (!pointer) {
      return give({ state: "no_passage", why: "The citation records no passage, so no words of the source are tied to it and nothing is highlighted. Find the words and capture them as a passage." });
    }
    const failed = this.passagesState(base.passages);
    if (failed) return give(failed);
    const passage = this.record(pointer, "passage")!.data!;
    const found: string[] = [];
    if (data.quotation !== renderQuotation(String((passage.quote as JsonObject).exact))) {
      found.push(data.quotation === undefined ? "the citation records no quotation" : "its recorded quotation is not the passage's words");
    }
    if (data.locator === undefined || canonical(data.locator as Json) !== canonical(passage.locator as Json)) found.push("its cited place is not the passage's");
    if (cites.length === 0) found.push("it names no source");
    for (const c of cites) {
      if ("problem" in c.found) found.push(`${c.name} ${c.found.problem}`);
      else if (!this.supports(c.found.id, String(passage.source))) found.push(`${c.name} names neither the passage's source nor a part of it`);
    }
    if (found.length === 0 && !cited) found.push("its key and its source name different works");
    if (found.length > 0) return give(differs(`The citation disagrees with its passage: ${found.join("; ")}. Nothing is highlighted. Make the citation agree, or point it at the right passage.`));
    return give({ state: "highlighted", why: "The citation's quotation, cited place and work agree with its passage, whose address still gives exactly those words." });
  }

  quotation(id: string): SourceView {
    const listed = this.quotations.filter((q) => isObject(q as Json) && (q as JsonObject).id === id) as JsonObject[];
    if (listed.length !== 1) {
      throw new InvalidInput(listed.length === 0 ? `report/report.json lists no quotation ${id}.` : `report/report.json lists the quotation ${id} more than once.`);
    }
    const spec = listed[0]!;
    const entries = Array.isArray(spec.passages) ? spec.passages : [];
    if (!words(spec.cites) || entries.length === 0 || !entries.every((p) => isObject(p) && words(p.passage))) {
      throw new InvalidInput(`The quotation ${id} in report/report.json needs "cites" (a key) and "passages" (each with a passage ID).`);
    }
    const pointers: PassagePointer[] = (entries as JsonObject[]).map((p) => ({
      passage: String(p.passage), ...(typeof p.join === "string" ? { join: p.join } : {}), ...optional("join_note", releasable(p.join_note)),
    }));
    const strings = (value: unknown) => (Array.isArray(value) ? value.filter(words) : []);
    const corrections = list(spec.corrections).map((c) => ({ was: String(c.was), now: String(c.now), by: String(c.by), basis: String(c.basis) }));
    const cited = this.named(spec.cites);
    const base = {
      schema: SOURCE_VIEW_SCHEMA as typeof SOURCE_VIEW_SCHEMA, kind: "quotation" as const, id, segments: [], passages: pointers,
      ...("id" in cited ? { work: this.work(cited.id) } : {}),
      quotation: {
        cites: spec.cites,
        ...(spec.note === true ? { note: true } : {}),
        ...(corrections.length > 0 ? { corrections } : {}),
        ...(strings(spec.italic).length > 0 ? { italic: strings(spec.italic) } : {}),
        ...(strings(spec.keep_hyphens).length > 0 ? { keep_hyphens: strings(spec.keep_hyphens) } : {}),
        ...optional("checked", releasable(spec.checked)),
      },
    };
    const failed = this.passagesState(pointers);
    if (failed) return { ...base, ...failed };
    if ("problem" in cited) return { ...base, ...differs(`${spec.cites} ${cited.problem}. Nothing is highlighted.`) };
    const other = pointers.find((p) => !this.supports(cited.id, String(this.record(p.passage, "passage")!.data!.source)));
    if (other) return { ...base, ...differs(`${other.passage} is not a passage of the work ${spec.cites} names, or of the work it is part of. Nothing is highlighted.`) };
    return { ...base, state: "highlighted", why: "Each passage's address still gives exactly the words it copied, and each belongs to the cited work or the work it is part of." };
  }
}

/** One view. For many over one corpus, use `SourceViews`. */
export const sourceView = (corpus: Corpus, request: SourceViewRequest, options: SourceViewOptions = {}): SourceView =>
  new SourceViews(corpus, options).view(request);
