// The import coordinator and graph builder for a Word chapter (CONTRACT-003 F
// and H, CONTRACT-006 F; SD-015 BR-1501 to BR-1526). It is pure: given the
// project's files and one original's bytes, it returns every file to write, or
// says why nothing is. The graph it returns has been read back as one, so a
// plan is written whole or not at all.
import { type Actor, manuscriptFileResults, openTakeover, type OpenTakeover, stampTime, validateFiles } from "@stemma/core";
import { type Chapter, readManuscript, verifyChapter, writeChapter, type CitationItem as Marked } from "@stemma/manuscript";
import {
  canonical, citationKeys, type Corpus, idOf, isRetired, type JsonObject, KINDS, loadCorpus, normalizeSentence,
  type ProjectContent, RECORD_SCHEMA, recordPath,
} from "@stemma/records";
import type { Entry, ReferenceList } from "./lists.ts";
import { readReferenceLists } from "./lists.ts";
import { type AuthorDateResult, type Bracket, type CitationItem, matchAuthorDate, type UnlinkedReason } from "./match.ts";
import { newRuns, REPEATED_SHARE, RUN_WORDS, shareIn, takenRuns } from "./repeated.ts";
import { forMatching, type Layout, layout, type Marking, planChapter } from "./takeover-chapter.ts";
import { fold } from "./text.ts";
import { readWord } from "./word.ts";
import type { WordItem, WordReading } from "./word-reading.ts";
import type { WordLimits } from "./word-zip.ts";

export const TAKEOVER_CODEC = "stemma takeover, Word";

export const TAKEOVER_COVERAGE = [
  "One Word file becomes one chapter. Chapter divisions inside a file are not detected.",
  "Italic, bold, links, lists, block quotations, captions, and other Word layout are not carried into the chapter.",
  "Footnotes and endnotes are read for author-date citations only. Full references, short forms, and ibid. typed in notes are not bound.",
  "Embedded reference-manager data is not decoded, and no reference library is read.",
  "Each reference-list entry becomes its own source holding its text, author family names, and year. Nothing is merged, and no title is read.",
  "Comments, tables, and reported content are not examined for citations.",
  "Only double quotation marks are read as quotations. A quotation with no marks, such as an indented block, is not read as one.",
];

export class RepeatedChapter extends Error {
  constructor(readonly earlier: string, readonly share: number) {
    super(`repeated_chapter: ${Math.round(share * 100)}% of its ${RUN_WORDS}-word runs occur in the chapters taken over from ${earlier}`);
  }
}

/** The project cannot be compared with or added to safely, so nothing is written. */
export class TakeoverRefused extends Error {
  constructor(message: string, readonly paths: string[]) {
    super(message);
  }
}

/** The plan failed its own check: a Stemma defect. Nothing is written. */
export class TakeoverDefect extends Error {}

export interface PlannedFile { path: string; text: string }

export interface TakeoverCounts {
  footnotes: number;
  endnotes: number;
  citations: number;
  bound: number;
  ambiguous: number;
  unclassified: number;
  sources: number;
  claims: number;
  intake_items: number;
  quotations: { attributed: number; unattributed: number };
}

export interface IntakeReport {
  schema: "stemma.intake-report/0";
  body: {
    batch: string;
    original: { name: string; sha256: string; size: number; support: "untested" };
    chapter: { id: string; path: string; title: string; division: string };
    counts: TakeoverCounts;
    author_date: AuthorDateResult["counts"] & { profile: string; unpaired_brackets: number };
    reference_lists: { title: string; paragraph: number; entries: number; read: number; unread: number }[];
    /** Linked citations to look at by hand. A link names a list entry and verifies nothing. */
    look_at: { with_working_marker: number; to_entries_with_a_bracketed_note: number; to_entries_with_a_long_surname_form: number };
    takeover: OpenTakeover;
    comments: number;
    tracked_changes: number;
    not_converted: string[];
    revision_view: string;
    coverage: string[];
  };
}

export type TakeoverPlan =
  | { status: "imported"; files: PlannedFile[]; report: IntakeReport }
  /** These bytes were taken over before: nothing is written. */
  | { status: "already"; batch: string; name: string }
  /** A changed file under an earlier name: one item, and nothing else. */
  | { status: "changed"; files: PlannedFile[]; batch: string; name: string; item: string }
  | { status: "change_already_reported"; batch: string; name: string; item: string };

export interface TakeoverRequest {
  content: ProjectContent;
  /** The original's base name, and its bytes. */
  file: { name: string; bytes: Uint8Array };
  separate?: boolean;
  actor: Actor;
  now: Date;
  token: () => string;
  version: string;
  limits?: WordLimits;
}

const active = (corpus: Corpus, kind: string) =>
  corpus.records.filter((f) => f.state === "ok" && f.data?.kind === kind && !isRetired(f.data));

const toFile = (record: JsonObject): PlannedFile => ({ path: recordPath(String(record.kind), String(record.id)), text: canonical(record) });

/** The project with planned files laid over it. */
function overlaid(content: ProjectContent, files: PlannedFile[]): Corpus {
  const planned = new Map(files.map((f) => [f.path, { path: f.path, bytes: new TextEncoder().encode(f.text) }]));
  const lay = (list: ProjectContent["records"], root: string) => [
    ...list.filter((f) => !planned.has(f.path)), ...[...planned.values()].filter((f) => f.path.startsWith(root)),
  ];
  return loadCorpus({
    ...content, settings: planned.get("stemma.json") ?? content.settings,
    records: lay(content.records, "records/"), manuscript: lay(content.manuscript, "manuscript/"),
  });
}

/** What stops a project being compared with a new file. */
function mustBeReadable(corpus: Corpus): void {
  const unread = corpus.records
    .filter((f) => f.state !== "ok" && /^records\/(?:imports|intake-items|chapters|sources|citations|round-choices)\//.test(f.path))
    .map((f) => f.path);
  const problems = readManuscript(corpus.manuscript).problems.map((p) => p.path);
  if (unread.length + problems.length > 0) {
    throw new TakeoverRefused("Some records or chapter files cannot be read, so this file cannot be compared with what was taken over. Run `check`, correct them, and run takeover again.", [...unread, ...problems]);
  }
}

const docxBatches = (corpus: Corpus) => active(corpus, "import_batch").filter((b) => b.data!.format === "docx")
  .sort((a, b) => String((a.data!.created as JsonObject).at).localeCompare(String((b.data!.created as JsonObject).at)));

const statedBytes = (sha: string, size: number) => `sha256 ${sha}, ${size} bytes`;

/** Where a paragraph is, in words the author can follow back to the file. */
function positions(reading: WordReading, found: Layout): (paragraph: number, start?: number, end?: number) => string {
  const note = new Map(found.notes.flatMap((n) => n.paragraphs.map((i) => [i, `${n.kind} ${n.number}, `] as const)));
  return (paragraph, start, end) => {
    const where = reading.document.paragraphs[paragraph]?.location === "table" ? "table, " : "";
    return `${note.get(paragraph) ?? where}paragraph ${paragraph + 1}${start === undefined ? "" : `, characters ${start}-${end}`}`;
  };
}

/** A key from the first family name and the year, made unique among every key the project holds. */
function keys(corpus: Corpus): (entry: Entry, n: number) => string {
  const taken = new Set(corpus.records.filter((f) => f.data?.kind === "source").flatMap((f) => citationKeys(f.data!)).map((k) => k.toLowerCase()));
  return (entry, n) => {
    const plain = (text: string) => fold(text).replace(/[^a-z0-9]/g, "");
    const stem = entry.status === "read"
      ? `${plain(entry.authors[0]!).slice(0, 40) || "ref"}${plain(entry.year)}${entry.suffix}`
      : `entry${n}`;
    let key = stem;
    for (let i = 2; taken.has(key.toLowerCase()); i++) key = `${stem}-${i}`;
    taken.add(key.toLowerCase());
    return key;
  };
}

function sourceFields(entry: Entry): JsonObject {
  if (entry.status !== "read") return {};
  return {
    contributions: entry.authors.map((author, i) => ({
      lid: `a${i + 1}`, role: "author", as_printed: entry.whole ? { literal: author } : { family: author },
    })),
    issued: /^\d{4}$/.test(entry.year)
      ? { edtf: entry.year, as_printed: `${entry.year}${entry.suffix}` }
      : { literal: `${entry.year}${entry.suffix}` },
  };
}

/** The brackets as typed, with any narrative names before them (CONTRACT-006 F). */
function asFound(text: string, bracket: Extract<Bracket, { items: CitationItem[] }>): string {
  const narrative = bracket.items.find((i) => i.narrative);
  if (!narrative) return bracket.text;
  const first = narrative.whole.split(/[\s,]+/)[0]!;
  const from = text.lastIndexOf(first, bracket.start - 1);
  return from < 0 || bracket.start - from > 400 ? bracket.text : text.slice(from, bracket.end);
}

/** Reported content that holds no text, or only the file's own properties: counted as a loss. */
const COUNTED_ONLY = new Set<WordItem["kind"]>(["metadata", "custom_data"]);

export function planTakeover(request: TakeoverRequest): TakeoverPlan {
  const { content, file, actor, token } = request;
  const corpus = loadCorpus(content);
  const reading = readWord(file.name, file.bytes, ...(request.limits ? [request.limits] as const : []));
  mustBeReadable(corpus);

  const batches = docxBatches(corpus);
  const name = (b: (typeof batches)[number]) => String(b.data!.original_name);
  const same = batches.find((b) => b.data!.original_sha256 === reading.sha256);
  if (same) return { status: "already", batch: idOf(same)!, name: name(same) };

  const found = layout(reading.document, readReferenceLists(reading.document));
  const document = forMatching(reading.document, found);
  const result = matchAuthorDate([document]);
  const fresh = newRuns(reading.document, result.lists);
  const earlier = takenRuns(corpus, readManuscript(corpus.manuscript));

  const now = stampTime(request.now);
  const newId = (kind: string) => `${KINDS[kind]!.prefix}${token()}`;
  const batchId = newId("import_batch");
  const stamp = (batch: string) => ({ at: now, by: { ...actor }, import: batch });
  const record = (kind: string, fields: JsonObject, id = newId(kind), batch = batchId): JsonObject =>
    ({ schema: RECORD_SCHEMA, kind, id, created: stamp(batch), ...fields });
  const item = (category: string, reason: string, fields: JsonObject, id?: string) =>
    record("intake_item", { import: batchId, category, reason, ...fields }, id);

  if (!request.separate) {
    const named = batches.filter((b) => name(b) === file.name);
    if (named.length > 0) {
      // Of several, the one whose chapters hold the most of this file's text, and of equals the latest.
      const closest = named.reduce((best, b) =>
        shareIn(fresh, earlier.get(idOf(b)!) ?? new Set()) >= shareIn(fresh, earlier.get(idOf(best)!) ?? new Set()) ? b : best);
      const stated = statedBytes(reading.sha256, reading.size);
      const told = active(corpus, "intake_item").find((f) => f.data!.category === "original_changed" && f.data!.as_found === stated);
      const batch = idOf(closest)!;
      if (told) return { status: "change_already_reported", batch, name: file.name, item: idOf(told)! };
      const changed = record("intake_item", { import: batch, category: "original_changed", reason: "original_changed", as_found: stated },
        newId("intake_item"), batch);
      return { status: "changed", files: [toFile(changed)], batch, name: file.name, item: String(changed.id) };
    }
    for (const b of batches) {
      const share = shareIn(fresh, earlier.get(idOf(b)!) ?? new Set());
      if (share >= REPEATED_SHARE) throw new RepeatedChapter(name(b), share);
    }
  }

  const records: JsonObject[] = [];
  const at = positions(reading, found);
  const paragraphs = reading.document.paragraphs;

  // The whole reference list, carried forward (CONTRACT-003 F11).
  const key = keys(corpus);
  const sources = new Map<string, { id: string; key: string }>();
  const entryRef = (list: ReferenceList, paragraph: number) => `${list.start}:${paragraph}`;
  const byParagraph = new Map<number, string>();
  let entries = 0;
  for (const list of result.lists) {
    for (const entry of list.entries) {
      const made = { id: newId("source"), key: key(entry, ++entries) };
      sources.set(entryRef(list, entry.paragraph), made);
      byParagraph.set(entry.paragraph, made.id);
      records.push(record("source", {
        citation_key: made.key, ...sourceFields(entry), as_found: entry.asFound,
        intake: entry.status === "read" ? "parsed" : "raw", admission: "candidate",
      }, made.id));
      records.push(item("ambiguous_reference", entry.status === "read" ? "list_entry" : "list_entry_unread",
        { as_found: entry.asFound, document_position: at(entry.paragraph), candidates: [made.id] }));
    }
  }
  const sourceAt = (paragraph: number) => {
    const list = result.lists.find((l) => paragraph >= l.start && paragraph < l.end);
    return list ? sources.get(entryRef(list, paragraph)) : undefined;
  };

  // Citation markers, and the record behind each.
  const marked = new Map<number, Marking[]>();
  const citations: { id: string; position: string; as_found: string; source?: string; unresolved?: { reason: string; candidates: string[] } }[] = [];
  for (const bracket of result.brackets) {
    const position = at(bracket.paragraph, bracket.start, bracket.end);
    if (bracket.state === "unlinked") {
      records.push(item("year_parenthesis", bracket.reason satisfies UnlinkedReason, { as_found: bracket.text, document_position: position }));
      continue;
    }
    const typed = asFound(paragraphs[bracket.paragraph]!.text, bracket);
    const items: Marked[] = bracket.items.map((cited, n) => {
      const id = newId("citation");
      const source = cited.state === "linked" ? sourceAt(cited.entry.paragraph) : undefined;
      if (cited.state === "linked" && !source) throw new TakeoverDefect("a linked entry has no source");
      citations.push({
        id, position, as_found: typed,
        ...(source ? { source: source.id } : {}),
        ...(cited.state === "unresolved"
          ? { unresolved: { reason: cited.reason, candidates: [...new Set(cited.candidates.flatMap((c) => byParagraph.get(c.paragraph) ?? []))] } } : {}),
      });
      // A lead-in belongs to its part: of several years in one part, the first carries it.
      const prefixed = cited.prefix !== undefined && bracket.items[n - 1]?.part !== cited.part;
      return {
        key: source?.key ?? "?", id,
        ...(cited.locator !== undefined ? { locator: { label: "page", value: cited.locator } } : {}),
        ...(prefixed ? { prefix: cited.prefix! } : {}),
        ...(cited.marker !== undefined ? { suffix: cited.marker } : {}),
        ...(cited.narrative ? { mode: "suppress-author" as const } : {}),
      };
    });
    marked.set(bracket.paragraph, [...marked.get(bracket.paragraph) ?? [], { bracket, items }]);
  }

  // The Stemma copy, read back by the reader the checks use.
  const chapterId = newId("chapter");
  const path = `manuscript/${chapterId}.md`;
  const planned = planChapter(reading.document, found, marked, () => newId("intake_item"));
  const written = writeChapter(planned.chapter, () => newId("claim"));
  const parsed = readManuscript([{ path, bytes: new TextEncoder().encode(written.text) }]);
  const read: Chapter | undefined = parsed.chapters[0];
  if (!read) throw new TakeoverDefect(`the chapter written does not read: ${parsed.problems.map((p) => `${p.code} at line ${p.line}: ${p.detail}`).join("; ")}`);
  const differences = verifyChapter(read, written);
  if (differences.length > 0) throw new TakeoverDefect(`the chapter written does not read back as meant: ${differences.join("; ")}`);

  for (const kept of planned.unconverted) {
    records.push(item("unread_content", kept.reason, { as_found: kept.text, document_position: at(kept.paragraph) }, kept.id));
  }

  // One claim for each sentence that carries a citation, unreviewed and in effect (BR-1512).
  const spans = new Map(read.claims.flatMap((span) => span.ids.map((id) => [id, span] as const)));
  const cited = new Map(citations.map((c) => [c.id, c]));
  const claimsOf = new Map<string, string[]>();
  for (const claim of written.claims) {
    const text = normalizeSentence(spans.get(claim.id)!.text);
    const position = cited.get(claim.items[0] ?? "")?.position ?? "";
    for (const id of claim.items) claimsOf.set(id, [...claimsOf.get(id) ?? [], claim.id]);
    records.push(record("claim", {
      text, role: "claim", chapters: [chapterId], review: { state: "unreviewed" },
      origins: [{ import: batchId, document_position: position.replace(/, characters \d+-\d+$/, ""), text }],
    }, claim.id));
  }

  const occurrences = new Map(read.citations.map((c) => [c.id!, c]));
  const quoted = new Map<string, string>();
  for (const quotation of read.quotations) {
    const id = quotation.citation?.id;
    if (id !== undefined && !quoted.has(id)) quoted.set(id, quotation.text);
  }
  for (const citation of citations) {
    const occurrence = occurrences.get(citation.id)!;
    const sentence = read.sentences[occurrence.sentence]!;
    records.push(record("citation", {
      chapter: chapterId, key: occurrence.key,
      ...(citation.source ? { source: citation.source } : {}),
      ...(occurrence.locator ? { locator: { ...occurrence.locator } } : {}),
      ...(quoted.has(citation.id) ? { quotation: quoted.get(citation.id)! } : {}),
      sentence: { text: sentence.text, sha256: sentence.sha256 },
      ...(claimsOf.has(citation.id) ? { claims: claimsOf.get(citation.id)! } : {}),
      as_found: citation.as_found, document_position: citation.position, intake: "parsed",
    }, citation.id));
    if (citation.unresolved) {
      records.push(item("ambiguous_reference", `citation_${citation.unresolved.reason}`, {
        citation: citation.id, as_found: citation.as_found, document_position: citation.position,
        ...(citation.unresolved.candidates.length > 0 ? { candidates: citation.unresolved.candidates } : {}),
      }));
    }
  }

  // A note with no author-date citation in it is not classified (CONTRACT-003 F6). A bracketed year left as text is no citation.
  const citing = new Set(result.brackets.filter((b) => b.state !== "unlinked").map((b) => b.paragraph));
  let unclassified = 0;
  for (const note of found.notes.filter((n) => !found.detached.has(n))) {
    if (note.paragraphs.some((i) => citing.has(i))) continue;
    unclassified++;
    records.push(item("unclassified_note", "note_without_author_date", {
      as_found: note.paragraphs.map((i) => paragraphs[i]!.text.trim()).join("\n"), document_position: at(note.paragraphs[0]!),
    }));
  }

  // Comments, undecoded reference fields, and reported content (INT-06, INT-10).
  const placeOf = (place: { part: string; path: string; paragraph?: number; start?: number; end?: number; after?: number }) =>
    place.paragraph !== undefined ? at(place.paragraph, place.start, place.end)
      : place.after !== undefined && place.part === "word/document.xml" ? `after paragraph ${place.after}`
      : `${place.part} ${place.path}`;
  for (const comment of reading.comments) {
    records.push(item("unread_content", "comment", {
      as_found: [comment.author ? `${comment.author}: ` : "", comment.text, comment.anchoredText ? `\n(on: ${comment.anchoredText})` : ""].join(""),
      document_position: comment.from ? placeOf(comment.from) : "no place in the text",
    }));
  }
  for (const field of reading.fields.filter((f) => f.kind !== "other")) {
    records.push(item("unread_content", "reference_field", {
      as_found: `${field.kind.replaceAll("_", " ")} ${field.form.replaceAll("_", " ")}`, document_position: placeOf(field.from),
    }));
  }
  const counted = new Map<string, number>();
  for (const reported of reading.items) {
    if (!/\S/.test(reported.text) || COUNTED_ONLY.has(reported.kind)) {
      counted.set(reported.kind, (counted.get(reported.kind) ?? 0) + 1);
      continue;
    }
    records.push(item("unread_content", reported.kind, { as_found: reported.text, document_position: placeOf(reported.place) }));
  }

  const notConverted = [
    "character formatting such as italic and bold",
    ...[...counted].sort().map(([kind, n]) => `${kind.replaceAll("_", " ")}: ${n}, not copied`),
    ...reading.parts.filter((p) => p.disposition === "not_read").map((p) => `part not read: ${p.name}`),
    ...(paragraphs.some((p) => p.location === "caption") ? ["caption styling; captions are ordinary paragraphs"] : []),
    ...(paragraphs.some((p) => (p.headingLevel ?? 0) > 4) ? ["heading levels below 4, written as level 4"] : []),
    ...(found.empty > 0 ? [`notes with no text, whose markers are dropped: ${found.empty}`] : []),
  ];

  const title = paragraphs.find((p) => p.note === undefined && p.location === "body" && p.headingLevel === 1)?.text.replace(/\s+/g, " ").trim()
    || file.name.replace(/\.docx$/i, "");
  const order = Math.max(0, ...active(corpus, "chapter").map((c) => Number(c.data!.order) || 0)) + 1;
  records.push(record("chapter", { title, order, matter: "body", manuscript_path: path }, chapterId));
  records.push(record("import_batch", {
    format: "docx", codec: { name: TAKEOVER_CODEC, version: request.version },
    original_name: file.name, original_sha256: reading.sha256, size: reading.size, entry_count: entries,
    losses: notConverted.map((note, i) => ({ path: `docx/${i + 1}`, class: "unrepresented", note })),
    ...(request.separate ? { separate: true } : {}),
  }, batchId));

  const settings: JsonObject = { ...corpus.settings.data! };
  if (sources.size > 0) {
    const listed = Array.isArray(settings.bibliography_include) ? settings.bibliography_include : [];
    settings.bibliography_include = [...listed, ...[...sources.values()].map((s) => s.id)];
  }
  const files: PlannedFile[] = [
    ...records.map(toFile), { path, text: written.text },
    ...(sources.size > 0 ? [{ path: "stemma.json", text: canonical(settings) }] : []),
  ];

  // The staged graph, checked as one (BR-1501). Problems the project already had are not this import's.
  const staged = overlaid(content, files);
  const added = new Set(files.map((f) => f.path));
  const had = new Set(validateFiles(corpus, new Set(["stemma.json"])).map((r) => r.finding_key));
  const broken = [
    ...validateFiles(staged, added),
    ...manuscriptFileResults(staged).filter((r) => r.subject === path),
  ].filter((r) => r.open && !had.has(r.finding_key));
  if (broken.length > 0) {
    throw new TakeoverDefect(`the records to be written break a rule: ${[...new Set(broken.map((r) => `${r.check} ${r.reason_code ?? ""} ${r.evidence.map((e) => `${e.name}=${e.name === "file" || e.name === "problem" || e.name === "field" ? e.value : "…"}`).join(" ")}`))].slice(0, 5).join("; ")}`);
  }

  const noteKinds = (kind: string) => found.notes.filter((n) => n.kind === kind).length;
  const linkedTo = (flag: string) => {
    const flagged = new Set(result.lists.flatMap((l) => l.entries.filter((e) => (e.flags as string[]).includes(flag)).map((e) => e.paragraph)));
    return result.brackets.flatMap((b) => (b.state === "unlinked" ? [] : b.items)).filter((i) => i.state === "linked" && flagged.has(i.entry.paragraph)).length;
  };
  return {
    status: "imported",
    files,
    report: {
      schema: "stemma.intake-report/0",
      body: {
        batch: batchId,
        original: { name: file.name, sha256: reading.sha256, size: reading.size, support: reading.support },
        chapter: { id: chapterId, path, title, division: "one Word file is one chapter" },
        counts: {
          footnotes: noteKinds("footnote"), endnotes: noteKinds("endnote"),
          citations: citations.length, bound: citations.filter((c) => c.source).length, ambiguous: citations.filter((c) => c.unresolved).length,
          unclassified, sources: sources.size, claims: written.claims.length,
          intake_items: records.filter((r) => r.kind === "intake_item").length,
          quotations: { attributed: read.quotations.filter((q) => q.citation).length, unattributed: read.quotations.filter((q) => !q.citation).length },
        },
        author_date: { ...result.counts, profile: result.profile, unpaired_brackets: result.unpaired.length },
        reference_lists: result.lists.map((l) => ({
          title: l.title, paragraph: l.start + 1, entries: l.entries.length,
          read: l.entries.filter((e) => e.status === "read").length, unread: l.entries.filter((e) => e.status === "unread").length,
        })),
        look_at: {
          with_working_marker: result.brackets.flatMap((b) => (b.state === "unlinked" ? [] : b.items)).filter((i) => i.state === "linked" && i.marker !== undefined).length,
          to_entries_with_a_bracketed_note: linkedTo("bracketed_note"),
          to_entries_with_a_long_surname_form: linkedTo("long_surname_form"),
        },
        takeover: openTakeover(staged, batchId),
        comments: reading.comments.length,
        tracked_changes: reading.revisions.length,
        not_converted: notConverted,
        revision_view: reading.revisionView,
        coverage: [...reading.coverage, ...TAKEOVER_COVERAGE],
      },
    },
  };
}
