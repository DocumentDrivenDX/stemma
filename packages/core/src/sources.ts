// `source add` and `source text` as record preparation (CONTRACT-002 B; SD-002
// BR-201 to BR-208 and BR-211). Nothing here touches a file: the caller stores
// the blob first and then writes the records these functions return.
import {
  canonical, checkPageSegments, type Corpus, idOf, isObject, isRecordId, isRetired, type Json, type JsonObject,
  JsonUnreadable, KINDS, pageLabels, type PageSegment, type PageSpan, parseJson, RECORD_SCHEMA, recordPath, sha256,
} from "@stemma/records";
import { checkShape, type Problem } from "@stemma/records";
import { type Actor, InvalidInput } from "./operations.ts";

export interface RecordWrite { id: string; path: string; text: string }

/** Hostile-input caps (SD-002, "Hostile input limits"); design assumptions. */
export const LIMITS = { input_bytes: 500 * 1024 * 1024, pages: 5000, text_bytes: 100 * 1024 * 1024, page_map_bytes: 5 * 1024 * 1024 };

export const TEXT_PROFILE = "utf8-lf/0";

const stamp = (actor: Actor, now: Date) => ({ at: now.toISOString().replace(/\.\d+Z$/, "Z"), by: { ...actor } });

const write = (kind: string, record: JsonObject | Record<string, unknown>): RecordWrite => {
  const id = record.id as string;
  return { id, path: recordPath(kind, id), text: canonical(record) };
};

const fresh = (kind: string, token: () => string, actor: Actor, now: Date) =>
  ({ schema: RECORD_SCHEMA, id: `${KINDS[kind]!.prefix}${token()}`, kind, created: stamp(actor, now) });

export interface Rights { unpublished?: boolean; community_restricted?: boolean; license?: string }

export interface AddSource {
  sha256: string;
  size: number;
  media_type: string;
  /** The source the author names; absent means a new candidate source. */
  source?: string;
  origin?: string;
  acquired_at: string;
  source_version?: string;
  rights: Rights;
  actor: Actor;
  now: Date;
  token: () => string;
}

export type AddPlan =
  | { state: "add"; source: string; new_source: boolean; capture: RecordWrite; records: RecordWrite[] }
  /** The named source already has this copy; only the blob may need restoring. */
  | { state: "already_held"; source: string; capture: string; records: RecordWrite[] };

export class DuplicateCopy extends Error {
  constructor(readonly holders: { source: string; capture: string }[]) {
    super("duplicate copy");
  }
}

function sourceRecord(corpus: Corpus, id: string): JsonObject {
  const file = corpus.byId.get(id);
  if (!isRecordId("source", id) || file?.data?.kind !== "source") throw new InvalidInput(`No readable source record has the ID ${id}.`);
  if (isRetired(file.data)) throw new InvalidInput(`The source ${id} is retired.`);
  if (!file.formattable) throw new InvalidInput(`${file.path} holds values that rewriting would change. Correct it first.`);
  return file.data;
}

export function planAddSource(corpus: Corpus, request: AddSource): AddPlan {
  const { actor, now, token } = request;
  const named = request.source === undefined ? undefined : sourceRecord(corpus, request.source);
  const holders = corpus.records
    .filter((f) => f.state === "ok" && f.data?.kind === "capture" && !isRetired(f.data) && f.data.sha256 === request.sha256)
    .map((f) => ({ source: String(f.data!.source), capture: idOf(f)! }));
  const own = holders.find((h) => h.source === request.source);
  const rights = Object.fromEntries(Object.entries(request.rights).filter(([, v]) => v !== undefined));
  const changesRights = Object.keys(rights).length > 0;
  // BR-202: never merge, and never write a second record without the author naming the source.
  if (!named && holders.length > 0) throw new DuplicateCopy(holders);

  const records: RecordWrite[] = [];
  const source = request.source ?? `${KINDS.source!.prefix}${token()}`;
  if (!named) {
    records.push(write("source", {
      schema: RECORD_SCHEMA, id: source, kind: "source", created: stamp(actor, now), admission: "candidate", intake: "raw",
      ...(changesRights ? { rights } : {}),
    }));
  } else if (changesRights) {
    const before = isObject(named.rights) ? named.rights : {};
    records.push(write("source", { ...named, rights: { ...before, ...rights }, changed: stamp(actor, now) }));
  }
  if (own) return { state: "already_held", source, capture: own.capture, records };

  const capture = write("capture", {
    ...fresh("capture", token, actor, now),
    source, sha256: request.sha256, size: request.size, media_type: request.media_type,
    origin: request.origin ?? "unknown", acquired_at: request.acquired_at,
    ...(request.source_version === undefined ? {} : { source_version: request.source_version }),
    admitted_by: { ...actor },
  });
  assertValid("Capture", "capture", capture);
  return { state: "add", source, new_source: !named, capture, records: [...records, capture] };
}

/** A command never writes a record that its own options made invalid. */
function assertValid(type: string, kind: string, record: RecordWrite): void {
  const problems: Problem[] = [];
  checkShape(type, parseJson(record.text).value, "", kind, problems, []);
  if (problems.length > 0) {
    throw new InvalidInput(`These values do not make a valid ${kind} record (${problems.map((p) => `${p.code} at ${p.field}`).join(", ")}).`);
  }
}

const decode = (bytes: Uint8Array, what: string): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new InvalidInput(`${what} is not valid UTF-8 text.`);
  }
};

/** Profile utf8-lf/0: drop a leading byte-order mark and turn CRLF and CR into LF. Nothing else changes. */
export const normalizeText = (text: string): string => text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

/**
 * Page boundaries are form feeds (U+000C). Each ends a page; text after the last
 * one is a further page only if it holds something. Offsets count code points.
 */
export function pageSpans(text: string): PageSpan[] {
  const pages = text.split("\f");
  if (pages.length > 1 && !/\S/u.test(pages.at(-1)!)) pages.pop();
  let start = 0;
  return pages.map((page, page_index) => {
    const length = [...page].length;
    const span = { page_index, start, end: start + length };
    start += length + 1;
    return span;
  });
}

export function parsePageMap(bytes: Uint8Array, pageCount: number): PageSegment[] {
  if (bytes.length > LIMITS.page_map_bytes) throw new InvalidInput("The page map is larger than the limit of 5 MiB.");
  let value: Json;
  try {
    value = parseJson(decode(bytes, "The page map")).value;
  } catch (error) {
    if (error instanceof JsonUnreadable) throw new InvalidInput(`The page map is not usable JSON (${error.problem}).`);
    throw error;
  }
  if (!Array.isArray(value)) throw new InvalidInput("The page map must be a JSON list of page segments.");
  const problems: Problem[] = [];
  value.forEach((segment, i) => checkShape("PageSegment", segment, `/${i}`, "extraction.pages", problems, []));
  const codes = [
    ...problems.map((p) => `${p.code} at ${p.field}`),
    ...checkPageSegments(value).map((p) => `${p.code} at /${p.index}`),
  ];
  const segments = value as unknown as PageSegment[];
  if (codes.length === 0 && segments.some((s) => s.last_index >= pageCount)) codes.push("a segment ends beyond the last page of the text");
  if (codes.length > 0) throw new InvalidInput(`The page map cannot be used: ${codes.join("; ")}.`);
  return segments;
}

export interface TextRequest {
  capture: string;
  /** The held copy's bytes, already verified against its digest. */
  copy: Uint8Array;
  /** A text layer the author supplies, for a copy this version cannot read itself. */
  layer?: Uint8Array;
  pageMap?: Uint8Array;
  method?: "text_layer" | "ocr" | "manual";
  tool?: { name: string; version: string };
  note?: string;
  stemma: string;
  actor: Actor;
  now: Date;
  token: () => string;
}

export class NoExtractor extends Error {}

export interface TextPlan {
  record: RecordWrite;
  text: Uint8Array;
  text_sha256: string;
  pages: number;
  /** File page indexes with no printed label. */
  unmapped: number[];
  method: string;
}

export function planSourceText(corpus: Corpus, request: TextRequest): TextPlan {
  const capture = corpus.byId.get(request.capture)?.data;
  if (capture?.kind !== "capture") throw new InvalidInput(`No readable capture record has the ID ${request.capture}.`);
  if (isRetired(capture)) throw new InvalidInput(`The capture ${request.capture} is retired.`);
  const plain = capture.media_type === "text/plain";
  if (plain && request.layer) throw new InvalidInput("This copy is plain text, so it is read as it is. Leave out --text-layer.");
  if (plain && (request.method || request.tool)) throw new InvalidInput("--method, --tool and --tool-version describe a supplied text layer.");
  if (!plain && !request.layer) throw new NoExtractor();

  const bytes = request.layer ?? request.copy;
  if (bytes.length > LIMITS.text_bytes) throw new InvalidInput("The text is larger than the limit of 100 MiB.");
  const text = normalizeText(decode(bytes, request.layer ? "The text layer" : "The copy"));
  if (text.includes("\0")) throw new InvalidInput("The text holds a NUL character, so it is not usable text.");
  if (!/\S/u.test(text)) {
    throw new InvalidInput("There is no machine-readable text: it is empty or only white space. No extraction was saved, and this copy does not count as checkable.");
  }
  // A plain text file with no form feed has no pages; a scan or PDF always has them.
  const spans = !plain || text.includes("\f") ? pageSpans(text) : undefined;
  if ((spans?.length ?? 0) > LIMITS.pages) throw new InvalidInput("The text has more than the limit of 5,000 pages.");
  if (request.pageMap && !spans) throw new InvalidInput("This text has no page breaks, so there are no pages to label.");
  const pages = request.pageMap ? parsePageMap(request.pageMap, spans!.length) : undefined;

  const encoded = new TextEncoder().encode(text);
  const method = plain ? "born_text" : request.method ?? "text_layer";
  const record = write("extraction", {
    ...fresh("extraction", request.token, request.actor, request.now),
    capture: request.capture,
    capture_sha256: capture.sha256,
    // For a supplied layer this is what the caller says made it; unstated stays "unknown".
    tool: plain ? { name: "stemma", version: request.stemma } : request.tool ?? { name: "unknown", version: "unknown" },
    normalization_profile: TEXT_PROFILE,
    text_sha256: sha256(encoded),
    text_size: encoded.length,
    ...(pages ? { pages } : {}),
    ...(spans ? { page_spans: spans } : {}),
    quality: { method, level: "unassessed", ...(request.note ? { note: request.note } : {}) },
  });
  assertValid("Extraction", "extraction", record);
  const labels = pageLabels(pages ?? []);
  return {
    record, text: encoded, text_sha256: sha256(encoded), method,
    pages: spans?.length ?? 0,
    unmapped: (spans ?? []).map((s) => s.page_index).filter((i) => !labels.has(i)),
  };
}

/** `0-3, 7` for a sorted list of indexes. */
export function ranges(indexes: number[]): string {
  const out: [number, number][] = [];
  for (const i of indexes) {
    const last = out.at(-1);
    if (last && i === last[1] + 1) last[1] = i;
    else out.push([i, i]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");
}
