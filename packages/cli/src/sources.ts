// The source commands (CONTRACT-002 B): capture and convert, labels, sealing a
// person's edits, comparisons, reviews, coverage, passages, and lookups.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyPageMap, asConverted, capturePassage, coverageOf, currentReview, findPassages, InvalidInput, LIMITS, lookupAddress,
  type OriginalTie, parsePageMap, planComparison, planLabel, planResolution, planReview, planSeal, planSourceText, printable,
  PROPOSAL, type Proposal, readLookup, renderCoverage, type Resolver, RESOLVERS, resolverFor, type ReviewRequest, normalizeText, SourceTexts,
} from "@stemma/core";
import { PDFJS_VERSION, CONVERTER_VERSION, parseTranscription, removeStamps, Unconvertible, withoutStamps } from "@stemma/extract";
import { canonical, type Corpus, idOf, isObject, isRetired, type JsonObject, parseJson } from "@stemma/records";
import {
  FetchRefused, fetchBytes, IMAGE_TYPES, type Original, randomToken, readOriginal, writeProjectFile, writeSourceDirectory,
} from "@stemma/workspace";
import { emit, namedFile, openCorpus, type Options, reportRecords, requireActor, requireProject, tools, usageError, USER_AGENT, written } from "./context.ts";
import { convertOriginal, proposalFor, readPdfCopy, suppliedPages } from "./conversion.ts";

export const MODEL_NOTICE = "Stemma holds back no source: any source in this project may be sent to a hosted model.";
const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/;

const only = <T extends string>(value: string | undefined, allowed: readonly T[], flag: string): T | undefined => {
  if (value !== undefined && !(allowed as readonly string[]).includes(value)) throw usageError(`--${flag} is one of ${allowed.join(", ")}.`);
  return value as T | undefined;
};

const readJson = (bytes: Uint8Array, what: string): JsonObject => {
  try {
    const { value } = parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (isObject(value)) return value;
  } catch {
    // Reported below.
  }
  throw new InvalidInput(`${what} is not one readable JSON object.`);
};

const shortRanges = (indexes: number[]): string => {
  const out: string[] = [];
  for (let i = 0, j = 0; i < indexes.length; i = j + 1) {
    for (j = i; indexes[j + 1] === indexes[j]! + 1; j++);
    out.push(i === j ? `${indexes[i]}` : `${indexes[i]}-${indexes[j]}`);
  }
  const all = out.join(", ") || "none";
  return all.length > 200 ? `${all.slice(0, all.lastIndexOf(",", 200))}, and more (see --format json)` : all;
};

function proposalText(proposal: Proposal): string[] {
  const lines = [
    `Proposed page map, for review. Nothing in the project was changed. The file has ${proposal.page_count} pages.`,
    `A run is proposed where at least ${PROPOSAL.least_seen} pages, and at least ${PROPOSAL.least_share * 100}% of the run, show the expected number in the first or last ${PROPOSAL.edge_lines} lines of their text. No label comes from a page's position alone.`,
    proposal.runs.length === 0 ? "No run of printed numbers was found, so no page is labelled." : "",
  ].filter(Boolean);
  for (const run of proposal.runs) {
    const { first_index, last_index, first_label, style } = run.segment;
    lines.push(`  file indexes ${first_index}-${last_index}: printed ${first_label} onwards (${style}). Number seen on ${run.seen} of ${run.pages} pages.`,
      ...(run.unseen.length > 0 ? [`    not seen in the text at indexes ${shortRanges(run.unseen)}`] : []));
  }
  lines.push(`  left without a label: ${shortRanges(proposal.unmapped)}`);
  if (proposal.repeated_labels.length > 0) {
    lines.push(`WARNING: ${proposal.repeated_labels.length} label(s) would name more than one page, from ${proposal.repeated_labels[0]} on. One file can hold a second numbering, such as a publisher's list bound at the back. Look at the pages, and keep only the runs that number the work you cite.`);
  }
  for (const c of proposal.comparisons) {
    lines.push(`Compared with ${c.from}: the same label on ${c.agree} proposed page(s), another on ${c.differ.length}${c.differ.length > 0 ? ` (indexes ${shortRanges(c.differ)})` : ""}.`,
      ...(c.only_there.length > 0 ? [`  It also labels ${c.only_there.length} page(s) outside the proposed runs (indexes ${shortRanges(c.only_there.map((o) => o.page_index))}). These are not proposed, because the text does not bear them out.`] : []));
  }
  return lines;
}

export async function sourcePages(options: Options, file: string | undefined): Promise<number> {
  if (!file) throw usageError("source pages needs an original file.");
  const base = options.project ? resolve(options.project) : process.cwd();
  const original = readOriginal(resolve(base, file), LIMITS.input_bytes);
  const layer = namedFile(base, options["text-layer"], LIMITS.text_bytes);
  let pages: string[];
  let embedded: string[] | undefined;
  if (layer || original.media_type !== "application/pdf") {
    const text = normalizeText(new TextDecoder().decode(layer ?? original.bytes));
    pages = text.split("\f");
  } else {
    const read = await readPdfCopy(original.bytes);
    [pages, embedded] = [read.pages, read.embeddedLabels];
  }
  const proposal = proposalFor(pages, embedded, namedFile(base, options["page-numbers"], LIMITS.page_map_bytes));
  let out = "";
  if (options.out) {
    out = resolve(base, options.out);
    try {
      writeFileSync(out, canonical(proposal.runs.map((r) => r.segment)), { flag: "wx" });
    } catch {
      throw new InvalidInput(`${options.out} could not be written; an existing file is never overwritten.`);
    }
  }
  emit(options, { proposal, ...(out ? { written: out } : {}) }, `${[
    ...proposalText(proposal),
    "Look at the page images at the ends of each run and at any page that differs. A person may edit the file; a label that rests on a person's word has the evidence author_statement.",
    out ? `Wrote the proposed map to ${out}. Use it with --page-map in source convert, or with source label.` : "Add --out <file> to save the proposed map.",
  ].join("\n")}\n`);
  return 0;
}

export interface ConvertRequest {
  root: string;
  corpus: Corpus;
  originals: Original[];
  options: Options;
  actor: { kind: "person" | "model" | "software"; name: string };
  identity?: JsonObject;
}

/** Converts and writes one source file. Shared by `source convert` and `ingest`. */
export async function convertAndWrite(request: ConvertRequest) {
  const { root, corpus, originals, options, actor } = request;
  const base = root;
  const transcription = namedFile(base, options.transcription, LIMITS.text_bytes);
  const layer = namedFile(base, options["text-layer"], LIMITS.text_bytes);
  if (transcription && layer) throw usageError("Give --transcription or --text-layer, not both.");
  const supplied = transcription ?? layer;
  const images = originals.filter((o) => IMAGE_TYPES.includes(o.media_type));
  if (images.length > 0 && images.length !== originals.length) throw new InvalidInput("Page images are captured on their own, without another file.");
  const form = originals.length === 0 ? "physical" : images.length > 0 ? "page_images" : "file";
  if (form !== "file" && !supplied) {
    throw new InvalidInput(`${form === "physical" ? "A paper or other physical original" : "A page image"} has no text Stemma can read: supply a transcription made by a recognition tool you ran, or typed (--transcription or --text-layer).`);
  }
  if (form === "physical" && (!options.description || !options["held-at"])) throw usageError("A physical original needs --description and --held-at.");
  const method = only(options.method, ["born_text", "text_layer", "markup", "ocr", "manual"] as const, "method");
  if ((options.tool === undefined) !== (options["tool-version"] === undefined)) throw usageError("Give --tool and --tool-version together.");
  const tool = options.tool ? { name: options.tool, version: options["tool-version"]! } : undefined;
  const pageMap = namedFile(base, options["page-map"], LIMITS.page_map_bytes);
  const segments = pageMap ? parsePageMap(pageMap) : undefined;

  let converted;
  let notes: string[] = [];
  const original = originals[0];
  if (supplied) {
    if (method !== "ocr" && method !== "manual") throw usageError("A supplied text needs --method ocr (a recognition tool made it) or --method manual (a person typed it).");
    if (method === "ocr" && !tool) throw usageError("Name the recognition tool that made the text: --tool and --tool-version.");
    try {
      converted = transcription ? withoutStamps(parseTranscription(new TextDecoder().decode(transcription), method)) : suppliedPages(layer!, method, tool);
    } catch (error) {
      if (error instanceof Unconvertible) throw new InvalidInput(`${error.message} No source file was written.`);
      throw error;
    }
    if (tool) converted.tools = [tool, ...converted.tools.filter((t) => t.name !== "unknown" && t.name !== tool.name)];
    if (method === "ocr") converted.recognition = options.recognition ?? `${tool!.name} ${tool!.version}`;
    // Whether the supplied pages are all of the original's pages is known only where they can be counted.
    const count = original?.media_type === "application/pdf" ? (await readPdfCopy(original.bytes)).pages.length : undefined;
    if (count !== undefined && converted.parts.length === count && !transcription) converted.page_count = count;
    else {
      delete converted.page_count;
      converted.coverage = "partial";
    }
    if (segments) {
      converted.parts = applyPageMap(converted.parts, segments) as typeof converted.parts;
    } else if (options["auto-pages"]) throw usageError("--auto-pages reads a file's own text; give a page map for a supplied text.");
  } else {
    if (method === "manual") throw usageError("--method manual describes a supplied text.");
    const done = await convertOriginal(original!, {
      recognized: method === "ocr", ...(segments ? { pageMap: segments } : {}), ...(options["auto-pages"] ? { autoPages: true } : {}),
      ...(options["page-numbers"] ? { pageNumbers: namedFile(base, options["page-numbers"], LIMITS.page_map_bytes)! } : {}),
    });
    converted = done.converted;
    notes = done.notes;
    if (options.recognition) converted.recognition = options.recognition;
  }
  const identityFile = namedFile(base, options.identity, 1 << 20);
  const identity = request.identity ?? (identityFile ? readJson(identityFile, "The identity file") : undefined);
  const tie: OriginalTie = {
    form,
    files: originals.map((o, index) => ({ sha256: o.sha256, size: o.size, media_type: o.media_type, ...(form === "page_images" ? { index } : {}) })),
    ...(options.description ? { description: options.description } : {}),
    ...(options["held-at"] ? { held_at: options["held-at"] } : {}),
    ...(options.origin ? { obtained_from: options.origin } : {}),
    acquired_at: options["acquired-at"]!,
    ...(options["source-version"] ? { version: options["source-version"] } : {}),
  };
  const plan = planSourceText(corpus, {
    converted, original: tie, actor, now: new Date(), token: randomToken,
    ...(options.source !== undefined ? { source: options.source } : {}), ...(identity ? { identity } : {}),
    ...(options["coverage-note"] ? { coverage_note: options["coverage-note"] } : {}),
    ...(options.note ? { note: options.note } : {}), ...(options.name ? { name: options.name } : {}),
  });
  for (const record of plan.records) writeProjectFile(root, record.path, record.text);
  writeSourceDirectory(root, plan.directory, plan.files);
  const labelled = converted.parts.filter((p) => p.label.status === "labelled").length;
  return { plan, converted, notes, labelled };
}

export async function sourceConvert(options: Options, files: string[]): Promise<number> {
  const actor = requireActor(options, "source convert records who captured the original");
  if (!options["acquired-at"] || !TIME.test(options["acquired-at"])) {
    throw usageError("source convert records when you got the original and does not guess it: give --acquired-at, for example 2026-01-05T09:58:00Z.");
  }
  if (files.some((f) => /^[a-z][a-z0-9+.-]+:\/\//i.test(f))) throw usageError("source convert reads files. To fetch from a web address, list it in an ingest plan.");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const originals = [...files, ...(options.image ?? [])].map((f) => readOriginal(resolve(root, f), LIMITS.input_bytes));
  const { plan, converted, labelled } = await convertAndWrite({ root, corpus, originals, options, actor });
  const unit = plan.paged ? "page" : "section";
  const head = [
    `Wrote the source file ${plan.text} to ${plan.directory}/`,
    `  source: ${plan.source}${plan.new_source ? " (new, a candidate; it has no citation key yet)" : ""}`,
    ...originals.map((o) => `  original: sha256 ${o.sha256} (${o.size} bytes, ${o.media_type}); it is not kept in the project`),
    ...(originals.length === 0 ? ["  original: physical, described in the manifest"] : []),
    `  ${plan.parts} ${unit} file(s); method ${converted.method}, quality unassessed`,
    ...(plan.paged ? [`  pages with a printed label: ${labelled} of ${plan.parts}`] : ["  this text has no pages; cite it by chapter or paragraph. No page number is given to it."]),
    ...converted.notes.map((n) => `  note: ${printable(n)}`),
    "The text was not compared with the original beyond this conversion.",
    MODEL_NOTICE,
  ].join("\n");
  return reportRecords(options, written(root, [`${plan.directory}/source.md`, ...plan.records.map((r) => r.path)]), `${head}\n`, {
    source: plan.source, text: plan.text, directory: plan.directory, parts: plan.parts, paged: plan.paged, labelled, method: converted.method,
  });
}

export function sourceLabel(options: Options, text: string | undefined): number {
  if (!text || !options["page-map"]) throw usageError("source label needs a source file ID and --page-map <file>.");
  const actor = requireActor(options, "source label records who set the labels");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const plan = planLabel(corpus, text, parsePageMap(namedFile(root, options["page-map"], LIMITS.page_map_bytes)!), actor, new Date());
  for (const file of plan.files) writeProjectFile(root, file.path, file.text);
  emit(options, { text, changed: plan.changed }, `Changed the page labels of ${plan.changed} page file(s). The words are unchanged.\n`);
  return 0;
}

export function sourceSeal(options: Options, text: string | undefined): number {
  if (!text) throw usageError("source seal needs a source file ID.");
  const actor = requireActor(options, "source seal records who made the edit");
  const root = requireProject(options);
  const plan = planSeal(openCorpus(root), text, actor, new Date(), tools(), options.note);
  for (const file of plan.files) writeProjectFile(root, file.path, file.text);
  const list = (what: string, ids: string[]) => (ids.length > 0 ? [`${what}: ${ids.join(", ")}`] : []);
  emit(options, plan, `${plan.edited.length === 0 ? "No part differs from the manifest, so nothing was sealed." : [
    `Sealed the edits to the parts at index ${shortRanges(plan.edited)}.`,
    ...list("Reviews now stale", plan.stale_reviews), ...list("Comparisons now stale", plan.stale_runs),
    ...list("Passages on a changed page, listed by `check`", plan.changed_passages),
  ].join("\n")}\n`);
  return 0;
}

/** Converts an original again with a source file's recorded settings and compares each part. */
export async function reconvert(
  root: string, corpus: Corpus, id: string, original: Original, actor: ConvertRequest["actor"],
  /** A current comparison, when one exists: a result that repeats it is not recorded again. */
  standing?: JsonObject,
) {
  const text = corpus.texts.get(id);
  if (!text) throw new InvalidInput(`No readable source file has the ID ${id}.`);
  const data = text.manifest.data!;
  const tie = data.original as JsonObject;
  const files = (Array.isArray(tie.files) ? tie.files : []).filter(isObject);
  if (!files.some((f) => f.sha256 === original.sha256)) {
    throw new InvalidInput(`That file's digest, ${original.sha256}, is not the original this source file was converted from.`);
  }
  const conversion = data.conversion as JsonObject;
  const used = (conversion.tools as JsonObject[]).map((t) => String(t.name));
  const reconvertible = original.media_type === "application/pdf" ? used.includes("pdfjs-dist")
    : !IMAGE_TYPES.includes(original.media_type) && ["born_text", "markup"].includes(String(conversion.method));
  if (!reconvertible) return { reconvertible: false as const };
  const labels = new Map(text.parts.map((p) => [p.index, {
    status: String(p.front.label_status) as "labelled", ...(typeof p.front.label === "string" ? { label: p.front.label } : {}),
  }]));
  const { converted } = await convertOriginal(original, { recognized: conversion.method === "ocr", labels });
  const other = new Map(converted.parts.map((p) => [p.index, asConverted(p.blocks)]));
  const plan = planComparison(corpus, {
    text: id, method: "reconversion", other, independent: false, original_sha256: original.sha256,
    against: "a fresh conversion of the original with the recorded settings",
    tools: [{ name: "stemma-convert", version: CONVERTER_VERSION }, ...(original.media_type === "application/pdf" ? [{ name: "pdfjs-dist", version: PDFJS_VERSION }] : [])],
    actor, now: new Date(), token: randomToken,
  });
  const repeats = standing !== undefined && canonical((parseJson(plan.record.text).value as JsonObject).pages!) === canonical(standing.pages!);
  if (!repeats) writeProjectFile(root, plan.record.path, plan.record.text);
  return {
    reconvertible: true as const, run: repeats ? String(standing.id) : plan.record.id, recorded: !repeats,
    parts: plan.parts, differing: plan.differing,
  };
}

export async function sourceVerify(options: Options, id: string | undefined): Promise<number> {
  if (!id || !options.original) throw usageError("source verify needs a source file ID and --original <file>.");
  const actor = requireActor(options, "source verify records who ran the comparison");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const original = readOriginal(resolve(root, options.original), LIMITS.input_bytes);
  const done = await reconvert(root, corpus, id, original, actor);
  if (!done.reconvertible) {
    emit(options, { text: id, original_matches: true, ...done }, "The file is the recorded original: its digest matches. Its text was supplied by a tool or typed, so Stemma cannot make it again; compare it with `source compare` or record a review.\n");
    return 0;
  }
  const lines = [
    "The file is the recorded original: its digest matches.",
    `Converted it again and recorded ${done.run}: ${done.parts - done.differing.length} of ${done.parts} parts agree.`,
    ...done.differing.slice(0, 10).flatMap((p) => [`  index ${p.index}: ${p.differing_words} word(s) differ`,
      ...p.differences.slice(0, 3).map((d) => `    committed "${printable(d.reading)}" / fresh "${printable(d.other)}"`)]),
  ];
  emit(options, { text: id, original_matches: true, ...done }, `${lines.join("\n")}\n`);
  return done.differing.length > 0 ? 1 : 0;
}

export function sourceCompare(options: Options, id: string | undefined): number {
  if (!id || !options.with || !options.against) throw usageError("source compare needs a source file ID, --with <text file>, and --against <what that text is>.");
  const actor = requireActor(options, "source compare records who ran the comparison");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const bytes = namedFile(root, options.with, LIMITS.text_bytes)!;
  // A comparison records differing words, so a download stamp goes first.
  const pages = normalizeText(new TextDecoder().decode(bytes)).split("\f").map((page) => removeStamps(page).text);
  if (pages.length > 1 && !/\S/u.test(pages.at(-1)!)) pages.pop();
  const text = corpus.texts.get(id);
  if (!text) throw new InvalidInput(`No readable source file has the ID ${id}.`);
  if (pages.length > text.parts.length) throw new InvalidInput(`The other text has ${pages.length} pages and the source file ${text.parts.length} parts. Separate pages with form feeds, in the same order.`);
  const other = new Map(pages.map((page, i) => [text.parts[i]!.index, page]));
  const plan = planComparison(corpus, {
    text: id, method: "supplied_text", other, against: options.against, independent: options.independent === true,
    other_sha256: createHash("sha256").update(bytes).digest("hex"), tools: [{ name: "stemma-convert", version: CONVERTER_VERSION }],
    actor, now: new Date(), token: randomToken,
  });
  writeProjectFile(root, plan.record.path, plan.record.text);
  const lines = [
    `Recorded ${plan.record.id}: ${plan.parts - plan.differing.length} of ${plan.parts} compared parts agree word for word (main text only).`,
    ...plan.differing.slice(0, 10).flatMap((p) => [`  index ${p.index}: ${p.differing_words} word(s) differ`,
      ...p.differences.slice(0, 5).map((d) => `    here "${printable(d.reading)}" / there "${printable(d.other)}"`)]),
    "Disagreement is not a finding: it shows where to look.",
  ];
  emit(options, { text: id, run: plan.record.id, parts: plan.parts, differing: plan.differing }, `${lines.join("\n")}\n`);
  return 0;
}

export function reviewAdd(options: Options, id: string | undefined): number {
  if (!id || !options.scope || !options.against || !options.outcome) throw usageError("review add needs a source file ID, --scope, --against, and --outcome.");
  const actor = requireActor(options, "review add records who reviewed");
  const scope = only(options.scope, ["whole_page", "passage", "quotations", "page_number", "source_details"] as const, "scope")!;
  const outcome = only(options.outcome, ["agrees", "corrected", "disagrees", "flagged"] as const, "outcome")!;
  const flags = (options.flag ?? []).map((flag) => {
    const [index, reading, suggested, note] = flag.split("|");
    if (!/^\d+$/.test(index ?? "") || !reading) throw usageError('--flag is "<index>|<reading>|<suggestion>|<note>"; the last two may be left out.');
    return { index: Number(index), reading, ...(suggested ? { suggested } : {}), ...(note ? { note } : {}) };
  });
  const indexes = (options.pages ?? "").split(",").filter(Boolean).map((p) => {
    const range = /^(\d+)(?:-(\d+))?$/.exec(p.trim());
    if (!range) throw usageError("--pages is a list of page or section indexes such as 105,106 or 8-12.");
    return range;
  }).flatMap(([, a, b]) => Array.from({ length: Number(b ?? a) - Number(a) + 1 }, (_, i) => Number(a) + i));
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const record = planReview(corpus, {
    text: id, scope: scope as ReviewRequest["scope"], pages: indexes.length > 0 ? indexes : flags.map((f) => f.index), fields: (options.fields ?? "").split(",").filter(Boolean),
    against: options.against, outcome, flags, actor, now: new Date(), token: randomToken,
    ...(options.passage ? { passage: options.passage } : {}), ...(options.note ? { note: options.note } : {}),
    ...(options["original-sha256"] ? { original_sha256: options["original-sha256"] } : {}),
  });
  writeProjectFile(root, record.path, record.text);
  const kind = actor.kind === "person" ? "a person's review" : `a flag from a ${actor.kind}, not a person's review`;
  return reportRecords(options, written(root, [record.path]), `Recorded ${record.id}: ${kind}. It stays current while what it covered is unchanged, and records what was said; it is not proof.\n`, { review: record.id });
}

function reviewsOf(corpus: Corpus, only_?: string) {
  return corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "text_review" && !isRetired(f.data) && (!only_ || f.data.text === only_)).map((f) => {
    const data = f.data!;
    const text = corpus.texts.get(String(data.text));
    const reviewed = data.reviewed as JsonObject;
    const by = reviewed.by as JsonObject;
    return {
      review: idOf(f)!, text: String(data.text), scope: String(data.scope), outcome: String(data.outcome),
      pages: (data.pages as JsonObject[]).map((p) => Number(p.index)), by: `${String(by.kind)} ${String(by.name)}`,
      at: String(reviewed.at), against: String(data.against), current: text !== undefined && currentReview(data, text),
    };
  });
}

export function reviewList(options: Options, id: string | undefined): number {
  const root = requireProject(options);
  const reviews = reviewsOf(openCorpus(root), id);
  const lines = reviews.length === 0 ? ["No reviews are recorded."] : reviews.map((r) =>
    `${r.review} ${r.current ? "current" : "STALE (what it covered has changed)"}: ${r.scope} of ${r.text} at index ${shortRanges(r.pages)}, ${r.outcome}, by ${r.by} on ${r.at}, against ${printable(r.against)}`);
  emit(options, { reviews }, `${lines.join("\n")}\n`);
  return 0;
}

export function coverage(options: Options, id: string | undefined): number {
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const texts = [...corpus.texts].filter(([t, v]) => (!id || t === id) && !isRetired(v.manifest.data!));
  if (id && texts.length === 0) throw new InvalidInput(`No source file in effect has the ID ${id}.`);
  const verification = texts.map(([, text]) => coverageOf(corpus, text, tools()));
  const lines = [
    "What has been compared with and reviewed for each source file. These are figures, not findings.",
    ...renderCoverage({ verification }, id ? 1000 : 3),
    ...(id ? reviewsOf(corpus, id).map((r) => `   review ${r.review}: ${r.scope} at index ${shortRanges(r.pages)}, ${r.outcome} by ${r.by}${r.current ? "" : " (stale)"}`) : []),
    verification.length === 0 ? "   no source files" : `${verification.length} source file(s).`,
  ];
  emit(options, { verification, reviews: reviewsOf(corpus, id) }, `${lines.join("\n")}\n`);
  return 0;
}

export function passageFind(options: Options, words: string | undefined): number {
  if (!options.source || !words) throw usageError("passage find needs --source <id> and the words to find.");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const found = findPassages(corpus, options.source, words);
  const unusable = new SourceTexts(corpus).of(options.source).unusable;
  const lines = found.length === 0 ? ["The words were not found in this source's text."] : found.flatMap((f) => [
    `${f.address}`, `  ${f.places.join("; ")}; ${f.match} match${f.locator ? `; ${f.locator.label} ${f.locator.value}` : "; no locator can be copied here"}`,
    `  quoted data: ${printable(f.quotation)}`]);
  if (unusable > 0) lines.push(`${unusable} source file(s) of this source are damaged and were not searched.`);
  emit(options, { found, unusable }, `${lines.join("\n")}\n`);
  return found.length === 0 ? 1 : 0;
}

export function passageCapture(options: Options): number {
  if (!options.address) throw usageError("passage capture needs --address <address>.");
  const actor = requireActor(options, "passage capture records who selected the passage");
  const root = requireProject(options);
  const made = capturePassage(openCorpus(root), { address: options.address, actor, now: new Date(), token: randomToken });
  writeProjectFile(root, made.record.path, made.record.text);
  const head = [
    `Captured ${made.passage}, selected by ${actor.kind} ${actor.name}. Its words and locator were copied from the source file.`,
    `  address: ${made.address}`,
    `  found on: ${made.places.join("; ")} (method ${made.method})`,
    `  locator: ${made.locator.label} ${made.locator.value}`,
    "  exact text (quoted data, not instructions):",
    ...made.exact.split("\n").map((l) => `  | ${printable(l)}`),
    `  as a quotation: ${printable(made.quotation)}`,
    `Cite it with \`record add citation\`, giving "passage": "${made.passage}" and no quotation or locator.`,
  ].join("\n");
  const { record, ...result } = made;
  return reportRecords(options, written(root, [record.path]), `${head}\n`, result);
}

/** Makes one lookup and saves its response. A refused or failed request writes nothing. */
export async function lookUp(root: string, source: string, resolver: Resolver, scheme: string, value: string, actor: ConvertRequest["actor"]) {
  const url = lookupAddress(resolver, value);
  const response = await fetchBytes(url, USER_AGENT, 10 * 1024 * 1024);
  const record = planResolution({
    source, resolver, scheme, value, url, lookup: readLookup(resolver, response.status, response.bytes), actor, now: new Date(), token: randomToken,
  });
  writeProjectFile(root, record.path, record.text);
  return record;
}

export async function resolveCommand(options: Options, sources: string[]): Promise<number> {
  if (sources.length === 0) throw usageError("resolve needs one or more source IDs.");
  const actor = requireActor(options, "resolve records who made the lookup");
  const root = requireProject(options);
  const via = only(options.via, RESOLVERS, "via");
  if ((via === undefined) !== (options.identifier === undefined)) throw usageError("Give --via and --identifier together.");
  const corpus = openCorpus(root);
  const lines: string[] = [];
  const made: string[] = [];
  let failed = false;
  for (const source of sources) {
    if (corpus.byId.get(source)?.data?.kind !== "source") throw new InvalidInput(`No readable source record has the ID ${source}.`);
    const wanted = via ? [{ resolver: via, scheme: via === "crossref" ? "doi" : "ia", value: options.identifier! }]
      : corpus.records.filter((f) => f.data?.kind === "upstream" && f.data.source === source && !isRetired(f.data))
        .flatMap((f) => (Array.isArray(f.data!.lookups) ? f.data!.lookups.filter(isObject) : []))
        .map((l) => ({ resolver: String(l.resolver) as Resolver, scheme: String((l.identifier as JsonObject).scheme), value: String((l.identifier as JsonObject).value) }));
    if (wanted.length === 0) lines.push(`${source}: its upstream records list no lookup; give --via and --identifier.`);
    for (const lookup of wanted) {
      if (!RESOLVERS.includes(lookup.resolver) || resolverFor(lookup.scheme) !== lookup.resolver) {
        lines.push(`${source}: this version does not look up ${lookup.scheme} at ${lookup.resolver}.`);
        failed = true;
        continue;
      }
      try {
        const record = await lookUp(root, source, lookup.resolver, lookup.scheme, lookup.value, actor);
        made.push(record.path);
        lines.push(`${source}: saved ${record.id} (${lookup.resolver} ${lookup.value})`);
      } catch (error) {
        if (!(error instanceof FetchRefused)) throw error;
        failed = true;
        lines.push(`${source}: ${error.message} No record was written.`);
      }
    }
  }
  emit(options, { written: made }, `${lines.join("\n")}\n`);
  return failed ? 1 : 0;
}
