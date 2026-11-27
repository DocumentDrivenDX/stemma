// The manuscript view (CONTRACT-005 L): the report as an export read it, made
// from the same assembly that `build report` writes `report.md` from. Where the
// build would stop, this collects why and goes on, so that one broken quotation
// leaves the rest readable.
//
// Every link here comes from the builder's own data: the quotation IDs of the
// template, the citations the notes are formatted from, and the source IDs the
// formatter gives for each bibliography entry. Nothing is found by matching
// text. A link or a highlight that could be wrong is the worst failure, so every
// doubt takes the text, the highlight or the link away.
import { containerOf, cslItem, formatCitations, sourceByKey } from "@stemma/cite";
import {
  emptyManuscript, MANUSCRIPT_SCHEMA, type ManuscriptBlock, type ManuscriptCitation, type ManuscriptEntry, type ManuscriptPart,
  type ManuscriptQuotation, type ManuscriptView, SOURCE_VIEW_SCHEMA, type SourceView, type SourceViewState, SourceTexts, SourceViews, InvalidInput,
} from "@stemma/core";
import { type Corpus, decodeUtf8, isLocalPath, isObject, type JsonObject, parseJson } from "@stemma/records";
import {
  assemble, changesOf, clustersOf, type QuotationSpec, render, type Rendered, ReportError, type ReportSpec, type Segment,
} from "./report.ts";

/** Whether the export holds the record: nothing in the view may rest on one it leaves out. */
export type Exported = (type: "Source" | "Passage", id: string) => boolean;

const WITHHELD_PATH = "Withheld: it holds what looks like a path on someone's machine.";
const LEFT_OUT = "It rests on a record that this export leaves out, being retired or breaking a record rule. `check` says more, and `excerpt` with the quotation's ID shows it in its source where it can.";

/** Bibliography fields that name a file; the formatter prints none of them (CONTRACT-005 E). */
const FILE_FIELDS = new Set(["file", "local-url", "localfile", "pdf", "path"]);

const words = (value: unknown): value is string => typeof value === "string" && value !== "";
const releasable = (value: string): string | undefined => (isLocalPath(value) ? undefined : value);

/** Whether any string in a value is a local path. A field named as a web address is held to the rule for places. */
function holdsPath(value: unknown, field = ""): boolean {
  if (typeof value === "string") return isLocalPath(value, field.toLowerCase() === "url");
  if (Array.isArray(value)) return value.some((one) => holdsPath(one, field));
  return isObject(value) && Object.entries(value).some(([name, one]) => !FILE_FIELDS.has(name) && holdsPath(one, name));
}

/** The entry of the report's list, when it has the shape the builder reads. */
function wellFormed(entry: JsonObject): boolean {
  const strings = (value: unknown) => value === undefined || (Array.isArray(value) && value.every((v) => typeof v === "string"));
  const optional = (value: unknown) => value === undefined || typeof value === "string";
  return words(entry.cites) && Array.isArray(entry.passages)
    && entry.passages.every((p) => isObject(p) && words(p.passage) && optional(p.join) && optional(p.join_note))
    && (entry.corrections === undefined || (Array.isArray(entry.corrections)
      && entry.corrections.every((c) => isObject(c) && words(c.was) && typeof c.now === "string" && words(c.by) && words(c.basis))))
    && strings(entry.italic) && (entry.italic as string[] | undefined ?? []).every((word) => word !== "")
    && strings(entry.keep_hyphens) && optional(entry.checked);
}

interface Found {
  /** The cited source, when the key names one. */
  cited?: string;
  cites?: string;
  built?: Rendered;
  shown: ManuscriptQuotation;
}

/** Reads the report the corpus holds, as `build report` would, and says what each part rests on. */
export function manuscriptView(corpus: Corpus, include: string[], exported: Exported): ManuscriptView {
  const report = corpus.report;
  if (!report) return emptyManuscript("none");
  const unavailable = (why: string) => emptyManuscript("unavailable", why);
  if (report.problem !== undefined) return unavailable(report.problem);
  if (!report.spec.bytes) return unavailable(`${report.spec.path} cannot be read: it is not a plain file.`);
  let spec: unknown;
  try {
    spec = parseJson(decodeUtf8(report.spec.bytes)).value;
  } catch {
    return unavailable(`${report.spec.path} cannot be read as JSON.`);
  }
  if (!isObject(spec) || !words(spec.manuscript) || !Array.isArray(spec.quotations)) {
    return unavailable(`${report.spec.path} needs "manuscript" (a file name) and "quotations" (a list).`);
  }
  if (!report.template?.bytes) return unavailable("The template that report.json names cannot be read: it is missing or is not a plain file.");
  let template: string;
  try {
    template = decodeUtf8(report.template.bytes);
  } catch {
    return unavailable("The report's template is not UTF-8 text.");
  }
  const inputs = { directory: "report", template: report.template.path };
  return { ...read(corpus, spec as unknown as ReportSpec, template, include, exported), inputs };
}

function read(corpus: Corpus, spec: ReportSpec, template: string, include: string[], exported: Exported): ManuscriptView {
  const listing = (spec.quotations as unknown[]).filter((q): q is JsonObject => isObject(q) && words(q.id));
  const texts = new SourceTexts(corpus);
  const views = new SourceViews(corpus, { quotations: listing });
  const works: ManuscriptView["works"] = {};
  /** A source that can be linked to: it and the work it is part of are in the export. */
  const sourceExported = (id: string): boolean => {
    const record = corpus.byId.get(id)?.data;
    if (!record || !exported("Source", id)) return false;
    const container = containerOf(corpus, record);
    return !container || exported("Source", String(container.id));
  };
  const link = (id: string): string => {
    works[id] ??= views.work(id);
    return id;
  };

  const found = new Map<string, Found>();
  const quotation = (id: string): Found => {
    let known = found.get(id);
    if (!known) found.set(id, known = makeQuotation(id));
    return known;
  };

  function makeQuotation(id: string): Found {
    const blank = (state: SourceViewState, why: string, cited?: string): SourceView => ({
      schema: SOURCE_VIEW_SCHEMA, kind: "quotation", id, state, why, passages: [], segments: [],
      ...(cited !== undefined && sourceExported(cited) ? { work: views.work(cited) } : {}),
    });
    const listed = listing.filter((q) => q.id === id);
    const entry = listed[0];
    if (!entry) return { shown: { changes: [], view: blank("no_passage", `report.json lists no quotation ${id}.`) } };
    const cites = listed.every((q) => q.cites === entry.cites) && words(entry.cites) ? entry.cites : undefined;
    const source = cites === undefined ? undefined : sourceByKey(corpus, cites);
    const cited = source ? String(source.id) : undefined;
    const base: Found = {
      ...(cites === undefined ? {} : { cites }), ...(cited === undefined ? {} : { cited }),
      shown: { changes: [], view: blank("citation_differs", "") },
    };
    const broken = (state: SourceViewState, why: string): Found => ({ ...base, shown: { changes: [], view: blank(state, why, cited) } });
    const secret = holdsPath(listed);
    const say = (why: string) => (secret || isLocalPath(why) ? WITHHELD_PATH : why);

    // Nothing may rest on a record the export leaves out, its reason and details included.
    const named = listed.flatMap((q) => (Array.isArray(q.passages) ? q.passages.filter(isObject) : []))
      .map((p) => String(p.passage)).filter((passage) => corpus.byId.get(passage)?.data?.kind === "passage");
    if (named.some((passage) => !exported("Passage", passage)) || (cited !== undefined && !sourceExported(cited))) return broken("not_exported", LEFT_OUT);

    if (listed.length > 1) return broken("citation_differs", `report.json lists the quotation ${say(id)} more than once, so build report refuses it.`);
    if (Array.isArray(entry.passages) && entry.passages.length === 0 && words(entry.cites)) {
      return broken("no_passage", "report.json lists no passage for this quotation, so no words of the source are tied to it and nothing is highlighted. Capture the words as a passage and list it.");
    }
    if (!wellFormed(entry)) return broken("citation_differs", "The entry for this quotation in report.json is not well formed, so build report cannot build it.");

    let built: Rendered | undefined;
    let refused: string | undefined;
    try {
      built = render(corpus, texts, entry as unknown as QuotationSpec);
    } catch (error) {
      // Any other error is a defect, and still must not take the rest of the report with it.
      refused = error instanceof ReportError ? error.message : "it could not be built, which may be a Stemma defect";
    }
    let view: SourceView;
    try {
      view = views.view({ kind: "quotation", id });
    } catch (error) {
      if (!(error instanceof InvalidInput)) throw error;
      return broken("citation_differs", say(error.message));
    }
    if (view.state === "retired") return broken("not_exported", LEFT_OUT);
    // The panel shows the report's text and the source's: they must be of one cited work.
    let state: SourceViewState = view.state;
    let why = view.why;
    if (state === "highlighted" && refused !== undefined) [state, why] = ["citation_differs", `build report refuses this quotation: ${refused}. Nothing is highlighted.`];
    if (state === "highlighted" && (cited === undefined || view.work?.id !== cited)) {
      [state, why] = ["citation_differs", "The report's key and the source view do not name one work. Nothing is highlighted."];
    }

    const listedQuotation = view.quotation!;
    const corrections = (listedQuotation.corrections ?? []).filter((c) => !holdsPath(c));
    const italics = (listedQuotation.italic ?? []).filter((word) => !isLocalPath(word));
    const hyphens = (listedQuotation.keep_hyphens ?? []).filter((word) => !isLocalPath(word));
    // The work named is the builder's cited source, or none.
    const { work: _named, ...rest } = view;
    const cleaned: SourceView = {
      // The reason a highlight is right names nothing from the records.
      ...rest, state, why: state === "highlighted" ? why : say(why),
      ...(cited === undefined ? {} : { work: views.work(cited) }),
      quotation: {
        cites: releasable(listedQuotation.cites) ?? "a withheld value",
        ...(listedQuotation.note ? { note: true } : {}),
        ...(corrections.length > 0 ? { corrections } : {}),
        ...(italics.length > 0 ? { italic: italics } : {}),
        ...(hyphens.length > 0 ? { keep_hyphens: hyphens } : {}),
        ...(listedQuotation.checked === undefined ? {} : { checked: listedQuotation.checked }),
      },
      passages: view.passages.map((p) => ({
        passage: releasable(p.passage) ?? "a withheld value",
        ...(p.join === undefined || isLocalPath(p.join) ? {} : { join: p.join }),
        ...(p.join_note === undefined ? {} : { join_note: p.join_note }),
      })),
    };
    const shown: ManuscriptQuotation = { changes: [], view: cleaned };
    if (state === "highlighted" && built) {
      // What the report's list puts into the words must pass as a value does, as must the words themselves.
      const inserted = [
        built.text, ...(entry.passages as JsonObject[]).map((p) => p.join), ...((entry.corrections ?? []) as JsonObject[]).map((c) => c.now),
        ...((entry.italic ?? []) as string[]),
      ];
      if (holdsPath(inserted)) shown.view = { ...cleaned, state: "not_exported", why: WITHHELD_PATH, passages: [] };
      else {
        shown.text = built.text;
        if (italics.length > 0) shown.italic = italics;
        // A change is a sentence made of the list's values, so one path among them withholds them all.
        shown.changes = secret ? [WITHHELD_PATH] : changesOf(built).map((change) => (isLocalPath(change) ? WITHHELD_PATH : change));
      }
    }
    // The note's citation takes the quotation's words and page only when the view shows them.
    return { ...base, ...(built && shown.text !== undefined ? { built } : {}), shown };
  }

  const assembly = assemble(template, (id) => {
    const one = quotation(id);
    // A broken quotation gives its citation no page: its locator may not be that of the cited work.
    return {
      ...(one.cites === undefined ? {} : { cites: one.cites }),
      ...(one.built ? { locator: one.built.locator, label: one.built.label, text: one.built.text } : {}),
    };
  });
  const clusters = clustersOf(assembly.notes);
  const formatted = formatCitations(corpus, clusters, include);

  /** Why text formatted from these records may not be shown, if it may not. */
  const withheld = (ids: string[]): string | undefined => {
    for (const id of ids) {
      if (!sourceExported(id)) return "Withheld: its source record is left out of this export.";
      const record = corpus.byId.get(id)!.data!;
      const container = containerOf(corpus, record);
      if (holdsPath(cslItem(corpus, record)) || (container && holdsPath(cslItem(corpus, container)))) return WITHHELD_PATH;
    }
    return undefined;
  };
  /** The source a source is listed under in the bibliography, as the formatter lists it. */
  const listedUnder = (id: string): string => {
    const record = corpus.byId.get(id)!.data!;
    const container = record.type === "personal_communication" ? containerOf(corpus, record) : undefined;
    return String((container ?? record).id);
  };

  let at = 0;
  const notes = assembly.notes.map((note) => ({
    number: note.number,
    citations: note.citations.map((citation): ManuscriptCitation => {
      if (!citation.cluster) return { quotations: citation.quotations, withheld: "No citation can be formed: the report's list names no work for this quotation." };
      const index = at++;
      const named = formatted.cited[index]![0];
      const before = citation.cluster.items[0]!.before ?? "";
      // The citation is shown apart from its quotations only when the formatter put nothing in front of them.
      const separate = formatted.citations[index] === `${before}${formatted.bare[index]}`;
      const text = separate ? formatted.bare[index]! : undefined;
      if (!named) {
        return {
          quotations: citation.quotations,
          ...(text === undefined || isLocalPath(text) || isLocalPath(citation.cluster.items[0]!.key) ? { withheld: WITHHELD_PATH } : { text }),
        };
      }
      const why = withheld([...new Set([named.source, named.listed])]);
      if (why !== undefined) return { quotations: citation.quotations, withheld: why };
      return {
        quotations: citation.quotations,
        ...(text === undefined ? { withheld: "This citation could not be separated from its quotation, which is a Stemma defect." } : { text }),
        source: link(named.source), entry: link(named.listed),
      };
    }),
    ...(note.comment ? { comment: note.comment.map(part) } : {}),
  }));

  function part(segment: Segment): ManuscriptPart {
    return segment.kind === "text" && isLocalPath(segment.text) ? { kind: "withheld" } : segment;
  }

  const blocks = assembly.paragraphs.flatMap((paragraph): ManuscriptBlock[] => {
    if (paragraph.kind === "bibliography") return [{ kind: "bibliography" }];
    if (paragraph.segments.length === 0) return [];
    let segments = paragraph.segments;
    let level: 1 | 2 | 3 | undefined;
    const first = segments[0]!;
    const heading = first.kind === "text" ? /^(#{1,3}) /.exec(first.text) : null;
    if (first.kind === "text" && heading) {
      level = heading[1]!.length as 1 | 2 | 3;
      segments = [{ kind: "text", text: first.text.slice(heading[0].length) }, ...segments.slice(1)];
    }
    return [{ kind: "text", ...(level ? { level } : {}), parts: segments.map(part) }];
  });
  // A template with no place for the bibliography gets none, as in report.md.

  const places = new Map<string, ManuscriptEntry["places"]>();
  const listedQuotations = new Set<string>();
  for (const note of notes) {
    note.citations.forEach((citation, index) => {
      for (const id of citation.quotations) listedQuotations.add(id);
      if (citation.entry !== undefined) places.set(citation.entry, [...(places.get(citation.entry) ?? []), { note: note.number, citation: index }]);
    });
  }
  /** Quotations given in the text or a comment that no citation lists, by the entry of the work they are cited to. */
  const loose = new Map<string, ManuscriptEntry["quoted"]>();
  const note = (id: string, where: { note?: number; block?: number }) => {
    const one = found.get(id)!;
    if (listedQuotations.has(id) || one.cited === undefined || !sourceExported(one.cited)) return;
    const entry = listedUnder(one.cited);
    loose.set(entry, [...(loose.get(entry) ?? []), { quotation: id, ...where }]);
  };
  blocks.forEach((block, index) => {
    if (block.kind === "text") for (const p of block.parts) if (p.kind === "quotation") note(p.id, { block: index });
  });
  for (const one of assembly.notes) for (const s of one.comment ?? []) if (s.kind === "quotation") note(s.id, { note: one.number });

  const bibliography = formatted.bibliography.map((text, index): ManuscriptEntry => {
    const ids = formatted.bibliographyIds[index] ?? [];
    const source = ids.length === 1 ? ids[0]! : undefined;
    const why = source === undefined ? "Withheld: the formatter did not name one source for this entry." : withheld([source]);
    if (why !== undefined) return { withheld: why, places: [], quoted: [] };
    return {
      source: link(source!), ...(isLocalPath(text) ? { withheld: WITHHELD_PATH } : { text }),
      places: places.get(source!) ?? [], quoted: loose.get(source!) ?? [],
    };
  });

  const quotations = Object.fromEntries([...found].map(([id, one]) => [id, one.shown]));
  for (const one of Object.values(quotations)) if (one.view.work) works[one.view.work.id] ??= one.view.work;
  const problems = formatted.problems.map((p) => {
    const key = releasable(p.key) ?? "a withheld value";
    const where = p.note === 0 ? "bibliography_include" : `note ${p.note}`;
    return p.problem === "no_source" ? `${where}: no source has the key ${key}` : `${where}: the record of ${key} holds characters the formatter reserves`;
  });
  return { schema: MANUSCRIPT_SCHEMA, state: "read", blocks, notes, quotations, bibliography, works, problems };
}
