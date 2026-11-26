// The project operations behind the commands. A user interface calls these same
// functions; neither it nor the command line adds rules of its own.
import {
  canonical, type Corpus, isObject, isRecordId, JsonUnreadable, KINDS, normalizeSentence, parseJson, RECORD_SCHEMA,
  recordPath, sha256,
} from "@stemma/records";
import { PROBLEMS } from "./findings.ts";
import type { Result } from "./report.ts";
import { recordResults } from "./run.ts";

/** A request that is not valid as given (exit 5), as opposed to a finding. */
export class InvalidInput extends Error {}
/** The caller has to say who is adding the record. */
export class ActorNeeded extends Error {}

export interface Actor { kind: "person" | "model" | "software"; name: string }

export interface NewRecord { kind: string; input: string; actor?: Actor; now: Date; token: () => string }

/** Turns a record's fields into the file `record add` writes (CONTRACT-002 B). */
export function prepareRecord(request: NewRecord): { id: string; path: string; text: string } {
  const { kind } = request;
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
  return [corpus.settings, ...corpus.records].flatMap((file) => {
    if (!wanted.has(file.path) || file.state !== "ok" || !file.formattable || !file.data) return [];
    const text = canonical(file.data);
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.bytes) === text ? [] : [{ path: file.path, text }];
  });
}

export const fileOf = (result: Result): string => result.evidence.find((e) => e.name === "file")?.value ?? result.subject;

/** record.valid results for the chosen project files. */
export function validateFiles(corpus: Corpus, wanted: Set<string>): Result[] {
  return recordResults(corpus).filter((r) => wanted.has(fileOf(r)));
}
