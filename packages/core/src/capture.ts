// Planning source files and what happens to them (CONTRACT-002 B; SD-002 BR-201
// to BR-212): a new source file from a converted original, new page labels,
// sealing a person's edits, comparison runs, and reviews. Nothing here touches a
// file; the caller writes what these functions return.
import {
  type Block, canonical, type Corpus, fileDigest, idOf, isObject, isRecordId, isRetired, type Json, type JsonObject, JsonUnreadable,
  KINDS, checkPageSegments, pageLabels, type PageSegment, parseJson, partFile, RECORD_SCHEMA, recordPath, serializeManifest,
  serializePart, slugOf, splitFrontMatter, textDigest, checkShape, type Problem,
} from "@stemma/records";
import { type Actor, InvalidInput } from "./operations.ts";
import { viewOf } from "./matching/texts.ts";
import { asConverted, comparedDigest, diffWords, reviewDigest, currentReview, currentRun } from "./verification.ts";
import { sourceBinding } from "./checks/changed.ts";
import { textAt } from "./passages.ts";
import { SourceTexts } from "./matching/texts.ts";

export interface FileWrite { path: string; text: string }
export interface RecordWrite extends FileWrite { id: string }

/** Hostile-input caps (SD-002, "Hostile input limits"); design assumptions. */
export const LIMITS = {
  input_bytes: 500 * 1024 * 1024, parts: 5000, text_bytes: 100 * 1024 * 1024, page_map_bytes: 5 * 1024 * 1024,
  conversion_seconds: 300,
};

const time = (now: Date) => now.toISOString().replace(/\.\d+Z$/, "Z");
const stamp = (actor: Actor, now: Date) => ({ at: time(now), by: { ...actor } });
const fresh = (kind: string, token: () => string, actor: Actor, now: Date) =>
  ({ schema: RECORD_SCHEMA, id: `${KINDS[kind]!.prefix}${token()}`, kind, created: stamp(actor, now) });

const record = (kind: string, value: Record<string, unknown>): RecordWrite =>
  ({ id: String(value.id), path: recordPath(kind, String(value.id)), text: canonical(value) });

/** A command never writes a record that its own options made invalid. */
export function assertValid(type: string, kind: string, text: string): void {
  const problems: Problem[] = [];
  checkShape(type, parseJson(text).value, "", kind, problems, []);
  if (problems.length > 0) {
    throw new InvalidInput(`These values do not make a valid ${kind} record (${problems.map((p) => `${p.code} at ${p.field}`).join(", ")}).`);
  }
}

export function sourceRecord(corpus: Corpus, id: string): JsonObject {
  const file = corpus.byId.get(id);
  if (!isRecordId("source", id) || file?.data?.kind !== "source") throw new InvalidInput(`No readable source record has the ID ${id}.`);
  if (isRetired(file.data)) throw new InvalidInput(`The source ${id} is retired.`);
  if (!file.formattable) throw new InvalidInput(`${file.path} holds values that rewriting would change. Correct it first.`);
  return file.data;
}

/** What a converter returns (`@stemma/extract`), as this module reads it. */
export interface ConvertedInput {
  paged: boolean;
  coverage: "all" | "partial";
  page_count?: number;
  parts: {
    index: number; label: { status: string; label?: string; basis?: string }; section?: string; chapter?: string;
    columns: string; undetermined: string[]; blocks: Block[]; note?: string;
    removed?: { kind: string; rule: string; rules_version: string }[];
  }[];
  identity: object;
  method: string;
  tools: { name: string; version: string }[];
  recognition?: string;
  version?: string;
  notes: string[];
}

/** Sets each page's label from a page map; a page the map does not cover is undetermined. */
export function applyPageMap<T extends { index: number; label: { status: string; label?: string; basis?: string } }>(parts: T[], segments: PageSegment[]): T[] {
  const labels = pageLabels(segments);
  return parts.map((part) => {
    const segment = segments.find((s) => part.index >= s.first_index && part.index <= s.last_index);
    const label = labels.get(part.index);
    return {
      ...part,
      label: label !== undefined ? { status: "labelled", label, basis: segment!.evidence! }
        : segment?.style === "unnumbered" && segment.evidence ? { status: "none", basis: segment.evidence } : { status: "undetermined" },
    };
  });
}

export function parsePageMap(bytes: Uint8Array): PageSegment[] {
  if (bytes.length > LIMITS.page_map_bytes) throw new InvalidInput("The page map is larger than the limit of 5 MiB.");
  let value: Json;
  try {
    value = parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).value;
  } catch (error) {
    throw new InvalidInput(`The page map is not usable UTF-8 JSON${error instanceof JsonUnreadable ? ` (${error.problem})` : ""}.`);
  }
  if (!Array.isArray(value)) throw new InvalidInput("The page map must be a JSON list of page segments.");
  const problems: Problem[] = [];
  value.forEach((segment, i) => checkShape("PageSegment", segment, `/${i}`, "page_map", problems, []));
  const codes = [...problems.map((p) => `${p.code} at ${p.field}`), ...checkPageSegments(value).map((p) => `${p.code} at /${p.index}`)];
  if (codes.length > 0) throw new InvalidInput(`The page map cannot be used: ${codes.join("; ")}.`);
  return value as unknown as PageSegment[];
}

export interface OriginalTie {
  form: "file" | "page_images" | "physical";
  files: { sha256: string; size: number; media_type: string; index?: number }[];
  description?: string;
  held_at?: string;
  obtained_from?: string;
  acquired_at: string;
  version?: string;
}

export interface NewSourceText {
  converted: ConvertedInput;
  /** The source the author names; absent means a new candidate source. */
  source?: string;
  original: OriginalTie;
  identity?: object;
  coverage_note?: string;
  note?: string;
  name?: string;
  actor: Actor;
  now: Date;
  token: () => string;
}

export class DuplicateOriginal extends Error {
  constructor(readonly holders: { source: string; text: string }[]) {
    super("duplicate original");
  }
}

export interface SourceTextPlan {
  source: string;
  new_source: boolean;
  text: string;
  directory: string;
  /** Part files and the manifest, to be written as one new directory. */
  files: FileWrite[];
  records: RecordWrite[];
  parts: number;
  paged: boolean;
}

const partFront = (part: ConvertedInput["parts"][number], paged: boolean, method: string) => ({
  index: part.index, label_status: part.label.status,
  ...(part.label.label !== undefined ? { label: part.label.label } : {}),
  ...(part.label.basis !== undefined ? { label_basis: part.label.basis } : {}),
  ...(part.section !== undefined && !paged ? { section: part.section.slice(0, 200) } : {}),
  ...(part.chapter !== undefined && !paged ? { chapter: part.chapter } : {}),
  method, level: "unassessed", columns: part.columns,
  undetermined: part.undetermined,
  ...(part.note !== undefined ? { note: part.note } : {}),
  ...(part.removed !== undefined ? { removed: part.removed } : {}),
});

function directoryFor(corpus: Corpus, wanted: string | undefined, key: unknown, id: string): string {
  const taken = new Set(corpus.sources.map((f) => f.path.split("/")[1]));
  if (wanted !== undefined) {
    if (slugOf(wanted) !== wanted) throw new InvalidInput("--name takes lowercase letters, digits and hyphens, at most 80.");
    if (taken.has(wanted)) throw new InvalidInput(`sources/${wanted} already exists. Nothing is overwritten.`);
    return `sources/${wanted}`;
  }
  const base = typeof key === "string" ? slugOf(key) : undefined;
  for (let n = 1; base && n < 100; n++) {
    const name = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(name)) return `sources/${name}`;
  }
  return `sources/${id}`;
}

export function planSourceText(corpus: Corpus, request: NewSourceText): SourceTextPlan {
  const { actor, now, token, converted, original } = request;
  if (actor.kind === "model" && converted.method === "manual") {
    throw new InvalidInput("A typed transcription is a person's work: a language model does not produce source text.");
  }
  if (converted.parts.length > LIMITS.parts) throw new InvalidInput(`The original has more than the limit of ${LIMITS.parts} pages or sections.`);
  const named = request.source === undefined ? undefined : sourceRecord(corpus, request.source);
  const holders = [...corpus.texts].flatMap(([id, text]) => {
    const data = text.manifest.data!;
    const files = isObject(data.original) && Array.isArray(data.original.files) ? data.original.files.filter(isObject) : [];
    return !isRetired(data) && files.some((f) => original.files.some((o) => o.sha256 === f.sha256)) ? [{ source: String(data.source), text: id }] : [];
  });
  // Nothing is merged, and no second source takes an original without the author naming it (BR-202).
  if (!named && holders.length > 0) throw new DuplicateOriginal(holders);

  const records: RecordWrite[] = [];
  const source = request.source ?? `${KINDS.source!.prefix}${token()}`;
  if (!named) records.push(record("source", { schema: RECORD_SCHEMA, id: source, kind: "source", created: stamp(actor, now), admission: "candidate", intake: "raw" }));

  const id = `${KINDS.source_text!.prefix}${token()}`;
  const directory = directoryFor(corpus, request.name, named?.citation_key, id);
  const files: FileWrite[] = [];
  let size = 0;
  const entries = converted.parts.map((part) => {
    const front = partFront(part, converted.paged, converted.method);
    assertValid("SourcePage", "source_page", canonical(front));
    const text = serializePart(front, part.blocks);
    size += Buffer.byteLength(text);
    const file = partFile(converted.paged, part.index);
    files.push({ path: `${directory}/${file}`, text });
    return { index: part.index, file, sha256: fileDigest(text) };
  });
  if (size > LIMITS.text_bytes) throw new InvalidInput("The converted text is larger than the limit of 100 MiB.");
  const identity = { ...converted.identity, ...request.identity };
  const note = [request.note, ...converted.notes].filter(Boolean).join(" ");
  const front = {
    schema: RECORD_SCHEMA, id, kind: "source_text", created: stamp(actor, now), source,
    ...(Object.keys(identity).length > 0 ? { identity } : {}),
    original: {
      form: original.form, files: original.files,
      ...(converted.paged && converted.page_count !== undefined ? { page_count: converted.page_count } : {}),
      ...(original.description !== undefined ? { description: original.description } : {}),
      ...(original.held_at !== undefined ? { held_at: original.held_at } : {}),
      obtained_from: original.obtained_from ?? "unknown", acquired_at: original.acquired_at,
      ...(original.version ?? converted.version ? { version: original.version ?? converted.version } : {}),
    },
    conversion: {
      method: converted.method, tools: converted.tools, level: "unassessed",
      ...(converted.recognition ? { recognition: converted.recognition } : {}), ...(note ? { note } : {}),
    },
    paged: converted.paged,
    coverage: request.coverage_note !== undefined ? "partial" : converted.coverage,
    ...(request.coverage_note !== undefined ? { coverage_note: request.coverage_note }
      : converted.coverage === "partial" ? { coverage_note: "Only the pages supplied are included." } : {}),
    pages: entries,
  };
  assertValid("SourceText", "source_text", canonical(front));
  files.push({ path: `${directory}/source.md`, text: serializeManifest(front) });
  return { source, new_source: !named, text: id, directory, files, records, parts: entries.length, paged: converted.paged };
}

function loadedText(corpus: Corpus, id: string) {
  const text = corpus.texts.get(id);
  if (!text) throw new InvalidInput(`No readable source file has the ID ${id}.`);
  if (isRetired(text.manifest.data!)) throw new InvalidInput(`The source file ${id} is retired.`);
  return text;
}

const manifestBody = (bytes: Uint8Array): string => {
  const split = splitFrontMatter(new TextDecoder().decode(bytes));
  return "problem" in split ? "" : split.body;
};

const fileText = (corpus: Corpus, path: string): string | undefined => {
  const bytes = corpus.sources.find((f) => f.path === path)?.bytes;
  return bytes && new TextDecoder().decode(bytes);
};

/** `source label`: new page labels from a page map. The words are unchanged. */
export function planLabel(corpus: Corpus, id: string, segments: PageSegment[], actor: Actor, now: Date): { files: FileWrite[]; changed: number } {
  const text = loadedText(corpus, id);
  if (!text.usable) throw new InvalidInput("That source file is damaged. `check` explains why; repair it or seal your edit first.");
  if (text.manifest.data!.paged !== true) throw new InvalidInput("This source has no pages, so there are no pages to label.");
  const wanted = new Map(applyPageMap(text.parts.map((p) => ({ index: p.index, label: { status: "undetermined" } })), segments).map((p) => [p.index, p.label as { status: string; label?: string; basis?: string }]));
  const digests = new Map<number, string>();
  const files: FileWrite[] = [];
  for (const part of text.parts) {
    const label = wanted.get(part.index)!;
    const { label: _l, label_basis: _b, label_status: _s, ...rest } = part.front;
    const front = { ...rest, label_status: label.status, ...(label.label !== undefined ? { label: label.label } : {}), ...(label.basis !== undefined ? { label_basis: label.basis } : {}) };
    if (canonical(front) === canonical(part.front)) continue;
    const written = serializePart(front, part.blocks);
    files.push({ path: part.path, text: written });
    digests.set(part.index, fileDigest(written));
  }
  if (files.length === 0) return { files, changed: 0 };
  const data = text.manifest.data!;
  const pages = (data.pages as JsonObject[]).map((e) => (digests.has(Number(e.index)) ? { ...e, sha256: digests.get(Number(e.index))! } : e));
  files.push({ path: text.manifest.path, text: serializeManifest({ ...data, pages, changed: stamp(actor, now) }, manifestBody(text.manifest.bytes!)) });
  return { files, changed: files.length - 1 };
}

export interface Seal {
  files: FileWrite[];
  edited: number[];
  stale_reviews: string[];
  stale_runs: string[];
  changed_passages: string[];
}

/** `source seal`: records a person's edits to part files. */
export function planSeal(corpus: Corpus, id: string, actor: Actor, now: Date, tools: Record<string, string>, note?: string): Seal {
  if (actor.kind !== "person") {
    throw new InvalidInput("Edits to source text are sealed by the person who made them: a language model or script does not correct source text. Record a suspected error with `review add --outcome flagged`.");
  }
  const text = loadedText(corpus, id);
  const blocking = text.damage.filter((d) => d.code !== "part_edited");
  if (blocking.length > 0) throw new InvalidInput(`Sealing records edits only. Repair these first: ${blocking.map((d) => `${d.code} at ${d.path}`).join(", ")}.`);
  const bad = corpus.partFiles.filter((f) => f.path.startsWith(`${text.directory}/`) && (f.state !== "ok" || f.problems.some((p) => p.reason === "record_invalid")));
  if (bad.length > 0) throw new InvalidInput(`These parts are not in the source file format, so nothing was sealed: ${bad.map((f) => f.path).join(", ")}.`);
  const edited = text.damage.map((d) => Number(/index (\d+)/.exec(d.detail ?? "")?.[1]));
  if (edited.length === 0) return { files: [], edited, stale_reviews: [], stale_runs: [], changed_passages: [] };
  const data = text.manifest.data!;
  const pages = (data.pages as JsonObject[]).map((e) => ({ ...e, sha256: fileDigest(fileText(corpus, `${text.directory}/${String(e.file)}`)!) }));
  const conversion = data.conversion as JsonObject;
  const added = `Edited by ${actor.name} on ${time(now).slice(0, 10)}${note ? `: ${note}` : "."}`;
  const manifest = { ...data, pages, changed: stamp(actor, now), conversion: { ...conversion, note: [conversion.note, added].filter(Boolean).join(" ") } };
  const sealed = { ...text, damage: [], usable: true };
  const of = (kind: string) => corpus.records.filter((f) => f.state === "ok" && f.data?.kind === kind && !isRetired(f.data));
  const texts = new SourceTexts({ ...corpus, texts: new Map(corpus.texts).set(id, sealed) });
  return {
    files: [{ path: text.manifest.path, text: serializeManifest(manifest, manifestBody(text.manifest.bytes!)) }],
    edited,
    stale_reviews: of("text_review").filter((r) => r.data!.text === id && !currentReview(r.data!, sealed)).map((r) => idOf(r)!),
    stale_runs: of("comparison_run").filter((r) => r.data!.text === id && !currentRun(r.data!, sealed, tools)).map((r) => idOf(r)!),
    changed_passages: of("passage").filter((p) => p.data!.text === id && textAt(texts, p.data!).state === "changed").map((p) => idOf(p)!),
  };
}

export interface ComparisonRequest {
  text: string;
  method: "reconversion" | "supplied_text";
  /** For each part index, the other reading, with all its streams joined as `asConverted` joins them. */
  other: Map<number, string>;
  /** For supplied text only the main stream is compared. */
  against: string;
  independent: boolean;
  tools: { name: string; version: string }[];
  original_sha256?: string;
  other_sha256?: string;
  actor: Actor;
  now: Date;
  token: () => string;
}

export function planComparison(corpus: Corpus, request: ComparisonRequest) {
  const text = loadedText(corpus, request.text);
  if (!text.usable) throw new InvalidInput("That source file is damaged. `check` explains why; repair it or seal your edit first.");
  const view = viewOf(text);
  const wanted = view.parts.filter((p) => request.method === "reconversion" || request.other.has(p.index));
  if (wanted.length === 0) throw new InvalidInput("The other text has no part in common with this source file.");
  const pages = wanted.map((part) => {
    const reading = request.method === "reconversion" ? asConverted(part.part.blocks) : part.streams.main;
    const diff = diffWords(reading, request.other.get(part.index) ?? "");
    return {
      index: part.index, sha256: comparedDigest(request.method, part.part.blocks),
      agreement_permille: diff.words === 0 ? 1000 : Math.max(0, Math.floor((1000 * (diff.words - diff.differing)) / diff.words)),
      words: diff.words, differing_words: diff.differing, differences: diff.differences,
    };
  });
  const value = {
    ...fresh("comparison_run", request.token, request.actor, request.now),
    source: String(text.manifest.data!.source), text: request.text, method: request.method, independent: request.independent,
    tools: request.tools, against: request.against,
    ...(request.other_sha256 ? { other_sha256: request.other_sha256 } : {}),
    ...(request.original_sha256 ? { original_sha256: request.original_sha256 } : {}),
    // Runs keep the full time, so that the newest of several is never a guess.
    run: { at: request.now.toISOString(), by: { ...request.actor } }, pages,
  };
  const written = record("comparison_run", value);
  assertValid("ComparisonRun", "comparison_run", written.text);
  const differing = pages.filter((p) => p.differing_words > 0);
  return { record: written, parts: pages.length, differing: differing.map((p) => ({ index: p.index, differences: p.differences, differing_words: p.differing_words })) };
}

export interface ReviewRequest {
  text: string;
  scope: "whole_page" | "passage" | "quotations" | "page_number" | "source_details";
  pages: number[];
  passage?: string;
  fields: string[];
  against: string;
  original_sha256?: string;
  outcome: "agrees" | "corrected" | "disagrees" | "flagged";
  flags: { index: number; reading: string; suggested?: string; note?: string }[];
  note?: string;
  actor: Actor;
  now: Date;
  token: () => string;
}

export function planReview(corpus: Corpus, request: ReviewRequest): RecordWrite {
  const text = loadedText(corpus, request.text);
  if (!text.usable) throw new InvalidInput("That source file is damaged. `check` explains why; repair it or seal your edit first.");
  if (request.actor.kind !== "person" && request.outcome !== "flagged") {
    throw new InvalidInput("Only a person's review can say that text agrees, disagrees, or was corrected. A model or script records what it noticed with --outcome flagged.");
  }
  const source = String(text.manifest.data!.source);
  let indexes = request.pages;
  if (request.passage !== undefined) {
    const passage = corpus.byId.get(request.passage)?.data;
    if (passage?.kind !== "passage" || passage.text !== request.text) throw new InvalidInput(`${request.passage} is not a passage of this source file.`);
    indexes = (passage.anchor as JsonObject[]).map((a) => Number(a.index));
  }
  if (request.scope === "passage" && request.passage === undefined) throw new InvalidInput("A passage review names its passage with --passage.");
  if (indexes.length === 0) throw new InvalidInput("Say which pages or sections were reviewed with --pages <indexes>.");
  // A flag on a page the review does not cover would bind to nothing it describes.
  const outside = request.flags.find((f) => !indexes.includes(f.index));
  if (outside) throw new InvalidInput(`A flag names index ${outside.index}, which is not among the reviewed pages (--pages).`);
  const pages = indexes.map((index) => {
    const sha = reviewDigest(text, request.scope, index);
    if (!sha) throw new InvalidInput(`The source file has no part with index ${index}.`);
    return { index, sha256: sha };
  });
  const value = {
    ...fresh("text_review", request.token, request.actor, request.now),
    source, text: request.text, scope: request.scope, pages,
    ...(request.passage !== undefined ? { passage: request.passage } : {}),
    ...(request.fields.length > 0 ? { fields: request.fields } : {}),
    against: request.against, ...(request.original_sha256 ? { original_sha256: request.original_sha256 } : {}),
    reviewed: stamp(request.actor, request.now), outcome: request.outcome,
    ...(request.flags.length > 0 ? { flags: request.flags } : {}),
    ...(request.note !== undefined ? { note: request.note } : {}),
    ...(request.scope === "source_details" ? { source_record_sha256: sourceBinding(sourceRecord(corpus, source)) } : {}),
  };
  const written = record("text_review", value);
  assertValid("TextReview", "text_review", written.text);
  return written;
}

export const textDigestOf = textDigest;
export type { Block };
