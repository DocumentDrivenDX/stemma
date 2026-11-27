// The project operations behind the commands. A user interface calls these same
// functions; neither it nor the command line adds rules of its own.
import {
  canonical, type Corpus, isObject, isRecordId, JsonUnreadable, KINDS, normalizeSentence, parseJson, RECORD_SCHEMA,
  recordPath, sha256, serializeManifest, serializePart, splitFrontMatter, parseBlocks,
} from "@stemma/records";
import { PROBLEMS } from "./findings.ts";
import { citationFromPassage } from "./passages.ts";
import type { Result } from "./report.ts";
import { recordResults } from "./run.ts";

/** A request that is not valid as given (exit 5), as opposed to a finding. */
export class InvalidInput extends Error {}
/** The caller has to say who is adding the record. */
export class ActorNeeded extends Error {}

export interface Actor { kind: "person" | "model" | "software"; name: string }

export interface NewRecord { kind: string; input: string; actor?: Actor; now: Date; token: () => string; corpus?: Corpus }

/** Kinds a command makes itself, so that their contents are copied or computed rather than typed. */
const MADE_BY_COMMAND: Record<string, string> = {
  source_text: "source convert", passage: "passage capture", comparison_run: "source verify or source compare",
  text_review: "review add", resolution: "resolve", annotation: "annotate",
};

/** Turns a record's fields into the file `record add` writes (CONTRACT-002 B). */
export function prepareRecord(request: NewRecord): { id: string; path: string; text: string } {
  const { kind } = request;
  if (MADE_BY_COMMAND[kind]) throw new InvalidInput(`A ${kind} record is made by \`${MADE_BY_COMMAND[kind]}\`, which copies or computes what it holds.`);
  let parsed;
  try {
    parsed = parseJson(request.input);
  } catch (error) {
    if (error instanceof JsonUnreadable) throw new InvalidInput(`The input is not usable JSON (${error.problem}).`);
    throw error;
  }
  const record = parsed.value;
  if (!isObject(record)) throw new InvalidInput("The input must be one JSON object.");
  if (parsed.forbidden.some((f) => f.problem === "number_not_integer")) {
    throw new InvalidInput(`Writing it would change a value: ${PROBLEMS.number_not_integer}.`);
  }
  if (record.kind !== undefined && record.kind !== kind) throw new InvalidInput(`The input's kind is not ${kind}.`);
  const id = record.id ?? `${KINDS[kind]!.prefix}${request.token()}`;
  if (typeof id !== "string" || !isRecordId(kind, id)) {
    throw new InvalidInput(`The id must be ${KINDS[kind]!.prefix} followed by 8 to 40 lowercase letters or digits.`);
  }
  record.schema ??= RECORD_SCHEMA;
  record.kind = kind;
  record.id = id;
  if (record.created === undefined) {
    if (!request.actor) throw new ActorNeeded();
    record.created = { at: request.now.toISOString().replace(/\.\d+Z$/, "Z"), by: { ...request.actor } };
  }
  if (kind === "citation" && record.passage !== undefined) {
    if (!request.corpus) throw new InvalidInput("A citation made from a passage needs the project to copy from.");
    citationFromPassage(request.corpus, record);
  }
  if (kind === "source") record.admission ??= "candidate";
  if (kind === "source" || kind === "citation") record.intake ??= "parsed";
  const sentence = record.sentence;
  if (kind === "citation" && isObject(sentence) && typeof sentence.text === "string" && sentence.sha256 === undefined) {
    sentence.text = normalizeSentence(sentence.text);
    sentence.sha256 = sha256(sentence.text as string);
  }
  return { id, path: recordPath(kind, id), text: canonical(record) };
}

/** Files that `fmt` would rewrite. A rewrite never changes a value. */
export function formatPlan(corpus: Corpus, wanted: Set<string>): { path: string; text: string }[] {
  const parts = corpus.partFiles.flatMap((file) => {
    if (!wanted.has(file.path) || file.state !== "ok" || !file.formattable || !file.bytes) return [];
    // Layout only: the front matter's form, line endings, and blank lines at block and file edges.
    const before = new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.bytes);
    const split = splitFrontMatter(before);
    if ("problem" in split) return [];
    const text = serializePart(split.front, parseBlocks(split.body).blocks);
    return text === before ? [] : [{ path: file.path, text }];
  });
  return parts.concat([corpus.settings, ...corpus.records].flatMap((file) => {
    if (!wanted.has(file.path) || file.state !== "ok" || !file.formattable || !file.data) return [];
    const before = new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.bytes);
    const split = file.path.startsWith("sources/") ? splitFrontMatter(before) : undefined;
    const text = split && !("problem" in split) ? serializeManifest(file.data, split.body) : canonical(file.data);
    return before === text ? [] : [{ path: file.path, text }];
  }));
}

export const fileOf = (result: Result): string => result.evidence.find((e) => e.name === "file")?.value ?? result.subject;

/** record.valid results for the chosen project files. */
export function validateFiles(corpus: Corpus, wanted: Set<string>): Result[] {
  return recordResults(corpus).filter((r) => wanted.has(fileOf(r)));
}
