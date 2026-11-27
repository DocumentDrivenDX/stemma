// CONTRACT-001 shape and the rules this version enforces. Problems carry codes
// and field paths only, never record values.
import { type Json, type JsonObject, normalizeSentence, sha256 } from "./json.ts";
import { isRecordId, KINDS, recordPath } from "./kinds.ts";
import { badLocations, hasCredentials } from "./locations.ts";
import type { PageProblem } from "./pages.ts";
import type { FormatProblem } from "./sourcefile.ts";
import { type FieldSpec, KIND_TYPES, REFERENCES, TYPES } from "./schema.generated.ts";

export type ProblemCode =
  | "not_an_object" | "missing_field" | "wrong_type" | "not_a_list" | "value_not_allowed" | "bad_time"
  | "bad_digest" | "bad_id" | "unknown_kind" | "bad_citation_key" | "duplicate_citation_key" | "duplicate_id"
  | "bad_link_id" | "duplicate_name" | "sentence_digest_mismatch" | "text_digest_mismatch" | "sentence_not_normalized" | "unknown_field"
  | "wrong_location" | "stray_file" | "reference_missing" | "reference_wrong_kind" | "null_value"
  | "number_not_integer" | "bad_size" | "bad_original" | "bad_page_label" | "bad_part" | "model_verification"
  | "response_digest_mismatch" | "bad_address" | "bad_binding" | "bad_location" | "note_without_passage" | FormatProblem | PageProblem;

export interface Problem {
  reason: "record_invalid" | "record_misplaced" | "reference_dangling" | "unknown_field";
  code: ProblemCode;
  field: string;
  /** A record ID or file path the problem points at. */
  target?: string;
}

export interface Reference { field: string; id: string; allowed: string[] }

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalid = (code: ProblemCode, field: string): Problem => ({ reason: "record_invalid", code, field });

const TIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:([0-5]\d|60)(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

function checkScalar(value: Json, spec: FieldSpec, name: string, field: string, problems: Problem[]): void {
  const type = spec.type as string;
  const ok =
    type === "boolean" ? typeof value === "boolean"
    : type === "integer" ? Number.isSafeInteger(value)
    : typeof value === "string";
  if (!ok) problems.push(invalid("wrong_type", field));
  else if (type === "date-time" && !TIME.test(value as string)) problems.push(invalid("bad_time", field));
  else if (spec.values && !spec.values.includes(value as string)) problems.push(invalid("value_not_allowed", field));
  else if (/sha256$/.test(name) && !/^[0-9a-f]{64}$/.test(value as string)) problems.push(invalid("bad_digest", field));
}

/**
 * Check one object against a schema type and collect its references.
 * `refPath` is the CONTRACT-001 relationship name, `<kind>.<field path>`.
 */
export function checkShape(
  typeName: string, value: Json, field: string, refPath: string,
  problems: Problem[], references: Reference[],
): void {
  if (!isObject(value)) {
    problems.push(invalid("not_an_object", field));
    return;
  }
  const fields = TYPES[typeName]!;
  for (const [name, spec] of Object.entries(fields)) {
    if (spec.required && !Object.hasOwn(value, name)) problems.push(invalid("missing_field", `${field}/${name}`));
  }
  for (const [name, item] of Object.entries(value)) {
    const at = `${field}/${name}`;
    const spec = Object.hasOwn(fields, name) ? fields[name]! : undefined;
    if (!spec) {
      if (name !== "x") problems.push({ reason: "unknown_field", code: "unknown_field", field: at });
      continue;
    }
    if (item === null) continue; // reported by the parser
    if (spec.many && !Array.isArray(item)) {
      problems.push(invalid("not_a_list", at));
      continue;
    }
    const path = `${refPath}.${name}`;
    const items = spec.many ? (item as Json[]).map((v, i) => [v, `${at}/${i}`] as const) : [[item, at] as const];
    for (const [one, where] of items) {
      if (typeof spec.type === "object") {
        checkShape(spec.type.value, one, where, path, problems, references);
        continue;
      }
      checkScalar(one, spec, name, where, problems);
      const allowed = Object.hasOwn(REFERENCES, path) ? REFERENCES[path] : undefined;
      if (allowed && typeof one === "string") references.push({ field: where, id: one, allowed });
    }
  }
}

const CITATION_KEY = /^[A-Za-z0-9_]([A-Za-z0-9_:.-]{0,126}[A-Za-z0-9_])?$/;

function duplicates(list: Json | undefined, property: string, field: string, problems: Problem[]): void {
  if (!Array.isArray(list)) return;
  const seen = new Set<string>();
  list.forEach((item, i) => {
    const name = isObject(item) ? item[property] : undefined;
    if (typeof name !== "string") return;
    if (seen.has(name)) problems.push(invalid("duplicate_name", `${field}/${i}/${property}`));
    seen.add(name);
  });
}

/** Rules the schema cannot express, for the kinds this version covers. */
function checkRules(record: JsonObject, problems: Problem[]): void {
  if (record.kind === "source") {
    if (typeof record.citation_key === "string" && !CITATION_KEY.test(record.citation_key)) {
      problems.push(invalid("bad_citation_key", "/citation_key"));
    }
    if (Array.isArray(record.key_aliases)) {
      record.key_aliases.forEach((key, i) => {
        if (typeof key === "string" && !CITATION_KEY.test(key)) problems.push(invalid("bad_citation_key", `/key_aliases/${i}`));
      });
    }
    duplicates(record.bib, "name", "/bib", problems);
    duplicates(record.dates, "variable", "/dates", problems);
    for (const list of ["contributions", "relations"] as const) {
      const entries = record[list];
      duplicates(entries, "lid", `/${list}`, problems);
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry, i) => {
        if (isObject(entry) && typeof entry.lid === "string" && !/^[0-9a-z]{1,32}$/.test(entry.lid)) {
          problems.push(invalid("bad_link_id", `/${list}/${i}/lid`));
        }
      });
    }
  }
  const size = (value: Json | undefined, field: string) => {
    if (typeof value === "number" && value < 0) problems.push(invalid("bad_size", field));
  };
  if (record.kind === "upstream") {
    size(record.size, "/size");
    if (Array.isArray(record.locations)) for (const i of badLocations(record.locations)) problems.push(invalid("bad_location", `/locations/${i}`));
    // The retrieval address and an auxiliary file's address are asked like a location, so they hold no user name or password either.
    if (typeof record.url === "string" && hasCredentials(record.url)) problems.push(invalid("bad_location", "/url"));
    if (Array.isArray(record.auxiliary)) {
      record.auxiliary.forEach((aux, i) => {
        if (isObject(aux) && typeof aux.url === "string" && hasCredentials(aux.url)) problems.push(invalid("bad_location", `/auxiliary/${i}/url`));
      });
    }
  }
  if (record.kind === "source_text" && isObject(record.original)) {
    const { form, files, description, held_at: held } = record.original;
    const list = Array.isArray(files) ? files : [];
    list.forEach((f, i) => size(isObject(f) ? f.size : undefined, `/original/files/${i}/size`));
    // A digital original is tied by its digest; a physical one by what it is and where it is held.
    if (form === "physical" ? list.length > 0 || typeof description !== "string" || typeof held !== "string" : list.length === 0) {
      problems.push(invalid("bad_original", "/original"));
    }
  }
  if (record.kind === "text_review") {
    const reviewed = isObject(record.reviewed) && isObject(record.reviewed.by) ? record.reviewed.by.kind : undefined;
    // A model's review is a flag, never a person's verification.
    if (reviewed === "model" && record.outcome !== "flagged") problems.push(invalid("model_verification", "/outcome"));
  }
  // A note binds a sentence and its source, or one record, never both.
  if (record.kind === "annotation" && (record.item !== undefined ? record.sentence !== undefined || record.source !== undefined : record.source !== undefined && record.sentence === undefined)) {
    problems.push(invalid("bad_binding", "/item"));
  }
  if (record.kind === "resolution" && typeof record.response === "string" && typeof record.response_sha256 === "string"
    && sha256(record.response) !== record.response_sha256) {
    problems.push(invalid("response_digest_mismatch", "/response_sha256"));
  }
  if (record.kind === "passage") {
    const anchor = Array.isArray(record.anchor) ? record.anchor : [];
    if (anchor.length === 0 || anchor.some((a) => !isObject(a) || !(Number(a.end) > Number(a.start)) || Number(a.start) < 0)) {
      problems.push(invalid("bad_address", "/anchor"));
    }
  }
  if (record.kind === "authorship_mark" && typeof record.text === "string" && typeof record.text_sha256 === "string"
    && record.text_sha256 !== sha256(normalizeSentence(record.text))) {
    problems.push(invalid("text_digest_mismatch", "/text_sha256"));
  }
  // CONTRACT-001 G. A comment is a remark of its writer's own and needs no passage.
  if (record.kind === "note" && (record.type === "extract" || record.type === "paraphrase")
    && (record.passages === undefined || (Array.isArray(record.passages) && record.passages.length === 0))) {
    problems.push(invalid("note_without_passage", "/passages"));
  }
  if (record.kind === "citation" && isObject(record.sentence)) {
    const { text, sha256: stated } = record.sentence;
    if (typeof text !== "string") return;
    if (normalizeSentence(text) !== text) problems.push(invalid("sentence_not_normalized", "/sentence/text"));
    else if (typeof stated === "string" && stated !== sha256(text)) {
      problems.push(invalid("sentence_digest_mismatch", "/sentence/sha256"));
    }
  }
}

export interface Validation { problems: Problem[]; references: Reference[] }

export function validateRecord(record: Json, path: string): Validation {
  const problems: Problem[] = [];
  const references: Reference[] = [];
  if (!isObject(record)) return { problems: [invalid("not_an_object", "")], references };
  const kind = typeof record.kind === "string" ? record.kind : "";
  const manifest = path.startsWith("sources/");
  if (!Object.hasOwn(KINDS, kind) || manifest !== (kind === "source_text")) {
    return { problems: [invalid("unknown_kind", "/kind")], references };
  }
  checkShape(KIND_TYPES[kind]!, record, "", kind, problems, references);
  if (typeof record.id === "string") {
    if (!isRecordId(kind, record.id)) problems.push(invalid("bad_id", "/id"));
    const expected = manifest ? path : recordPath(kind, record.id);
    if (path !== expected) {
      const problem: Problem = { reason: "record_misplaced", code: "wrong_location", field: "/id" };
      if (isRecordId(kind, record.id)) problem.target = expected;
      problems.push(problem);
    }
  }
  checkRules(record, problems);
  return { problems, references };
}

/** A part's front matter (CONTRACT-007 D). `paged` comes from its manifest. */
export function validatePart(front: Json, paged: boolean): Problem[] {
  const problems: Problem[] = [];
  checkShape("SourcePage", front, "", "source_page", problems, []);
  if (!isObject(front)) return problems;
  const { label_status: status, label, label_basis: basis } = front;
  const bad = (field: string) => problems.push(invalid("bad_page_label", field));
  if ((status === "labelled") !== (typeof label === "string" && label !== "")) bad("/label");
  if ((status === "unpaged") === paged) bad("/label_status");
  if ((status === "labelled" || status === "none" || status === "unreadable") !== (basis !== undefined)) bad("/label_basis");
  return problems;
}

export function validateProject(settings: Json): Validation {
  const problems: Problem[] = [];
  const references: Reference[] = [];
  checkShape("Project", settings, "", "project", problems, references);
  return { problems, references };
}

/** `rules.md` headings (CONTRACT-001 J). */
export function checkRuleHeadings(text: string): { code: "rule_heading_invalid" | "rule_id_duplicate"; line: number; rule?: string }[] {
  const problems: ReturnType<typeof checkRuleHeadings> = [];
  const seen = new Set<string>();
  let fence = false;
  text.split(/\r?\n/).forEach((content, i) => {
    if (/^(```|~~~)/.test(content)) fence = !fence;
    if (fence || !/^## /.test(content)) return;
    const rule = /^## (RULE-\d{3,}) \S/.exec(content)?.[1];
    if (!rule) problems.push({ code: "rule_heading_invalid", line: i + 1 });
    else if (seen.has(rule)) problems.push({ code: "rule_id_duplicate", line: i + 1, rule });
    else seen.add(rule);
  });
  return problems;
}
