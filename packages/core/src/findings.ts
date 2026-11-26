// Fixed explanation templates (CONTRACT-002 C and E). They are filled only with
// structured values such as field names, never with source or manuscript text.
import { compareCodePoints, digest, type Problem, type ProblemCode } from "@stemma/records";
import type { Evidence, Outcome, Result } from "./report.ts";

export interface Explanation { message: string; why: string; suggestions: string[]; fixes: string[] }

const RECORD_WHY = "Every other check reads these files. A broken record can hide a citation problem or create a false one.";
const KEY_WHY = "A reader or a build cannot tell which source this citation means, so it cannot be checked or put in the bibliography.";
const COORDINATE_WHY = "This output can disclose a restricted site's position. The scan cannot tell whether a site is restricted, so it warns about every coordinate it recognizes.";

const explain = (message: string, why: string, suggestions: string[], fixes: string[] = []): Explanation =>
  ({ message, why, suggestions, fixes });

export const TEMPLATES = {
  "record.valid:record_unreadable": explain(
    "A file cannot be read as a record, so nothing in it was checked.", RECORD_WHY,
    ["Open the named file and repair it (look for merge-conflict markers, a repeated key or a missing bracket), or restore it from git. Stemma does not guess its content."]),
  "record.valid:version_unsupported": explain(
    "A file was written in a newer record format than this version reads, so it was not checked.", RECORD_WHY,
    ["Update Stemma before changing this file. This version will not rewrite it."]),
  "record.valid:record_noncanonical": explain(
    "A file is not written in the canonical form (key order, indentation or line endings differ).",
    "Digests, review marks and diffs depend on one exact form. No value is wrong because of this alone.",
    ["Run `fmt` on the file. It rewrites the layout and changes no value."], ["format"]),
  "record.valid:record_invalid": explain(
    "A record breaks a rule of the record format.", RECORD_WHY,
    ["Correct the field named in the evidence, then run `check` again."]),
  "record.valid:record_misplaced": explain(
    "A file under records/ is not where its record belongs (file name or directory does not match).",
    "References and tools find records by ID, directory and file name.",
    ["Rename or move the file as the evidence shows, or move a file that is not a record out of records/."]),
  "record.valid:reference_dangling": explain(
    "A record points at a record that is missing or is of the wrong kind.",
    "The link between your evidence and its source is broken, so anything relying on it cannot be traced.",
    ["Point the reference at the right record, or remove it."], ["repoint"]),
  "record.valid:unknown_field": explain(
    "A record has a field the record format does not define. The field is kept as it is.",
    "A misspelled field name means the value you meant to record is not read.",
    ["Check the spelling. Put a field of your own under `x` with a namespaced name such as `myname.note`."]),
  "record.valid:rule_heading_invalid": explain(
    "A heading in rules.md is not a rule heading.",
    "Reports and records cite standing rules by ID, so a rule without one cannot be cited.",
    ["Write each rule heading as `## RULE-001 Title`."]),
  "record.valid:rule_id_duplicate": explain(
    "A rule ID in rules.md is used twice.",
    "A report or record citing this ID could mean either rule.",
    ["Give the later rule a number that has never been used."]),
  "record.valid:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
  "cite.key:key_unknown": explain(
    "A citation uses a key that no source record holds.", KEY_WHY,
    ["Correct the key in the citation, or add a source record with that key (or add it to the right source's key_aliases)."],
    ["repoint", "add_source", "remove_citation"]),
  "cite.key:key_ambiguous": explain(
    "A citation uses a key that more than one source record holds.", KEY_WHY,
    ["Give each source its own key."], ["rename_key"]),
  "cite.key:key_missing": explain(
    "A citation record names no citation key and no source.", KEY_WHY,
    ["Add the key of the source being cited, or remove the citation."], ["repoint", "remove_citation"]),
  "cite.key:source_unreadable": explain(
    "A citation's key could not be looked up because at least one source record cannot be read.",
    "The unreadable file may or may not be the source this citation means.",
    ["Repair the unreadable source record first (see the record.valid finding), then run `check` again."]),
  "cite.key:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
  "bib.uncited:not_cited": explain(
    "A source is listed for the built bibliography but cited nowhere.",
    "The bibliography would list a work the book never cites, or a citation you meant to make is missing.",
    ["Cite it, remove it from bibliography_include in stemma.json, or keep it on purpose and record why."],
    ["add_citation", "remove_from_bibliography"]),
  "bib.uncited:no_manuscript": explain(
    "Whether a listed source is cited could not be checked: there is no manuscript and there are no citation records.",
    "An unused bibliography entry would go unnoticed.",
    ["Add citation records for the citations in your manuscript, or run this again once the manuscript is in the project."]),
  "bib.uncited:manuscript_not_read": explain(
    "Whether a listed source is cited could not be checked: this version cannot yet read the files in manuscript/.",
    "The manuscript, not the citation records, says what is cited now, so a guess could be wrong either way.",
    ["Nothing to fix in your files. Check this entry by hand until Stemma reads manuscripts."]),
  "bib.uncited:citation_unreadable": explain(
    "Whether a listed source is cited could not be checked: at least one citation record cannot be read.",
    "The unreadable file may be the citation of this source.",
    ["Repair the unreadable citation record first (see the record.valid finding), then run `check` again."]),
  "bib.uncited:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
  "coordinate.stray:coordinate_text": explain(
    "Text in a project file looks like a map coordinate. The value is not repeated here.", COORDINATE_WHY,
    ["Look at the position in the evidence. If it is a sensitive site, remove the value from the file (git history may still hold it). If it is public or not a coordinate, you need do nothing."]),
  "coordinate.stray:file_unreadable": explain(
    "A project file could not be read, so it was not scanned for coordinates.", COORDINATE_WHY,
    ["Make the file a readable UTF-8 file inside the project, then run `check` again."]),
  "coordinate.stray:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
} satisfies Record<string, Explanation>;

export type TemplateId = keyof typeof TEMPLATES;

/** One sentence per rule, added to the evidence of a record.valid finding. */
export const PROBLEMS: Record<ProblemCode, string> = {
  not_an_object: "expected a JSON object",
  missing_field: "a required field is missing",
  wrong_type: "the value has the wrong type",
  not_a_list: "expected a list",
  value_not_allowed: "the value is not one of the allowed values",
  bad_time: "expected a time with an offset, such as 2026-01-05T09:58:00Z",
  bad_digest: "expected 64 lowercase hexadecimal characters",
  bad_id: "the ID does not have this kind's prefix followed by 8 to 40 lowercase letters or digits",
  unknown_kind: "the kind is missing or unknown",
  bad_citation_key: "the citation key uses characters or an ending that keys may not have",
  duplicate_citation_key: "another source holds the same citation key (keys differ by more than letter case)",
  duplicate_id: "another record has the same ID",
  bad_link_id: "expected 1 to 32 lowercase letters or digits",
  duplicate_name: "the same name appears twice in this list",
  sentence_digest_mismatch: "the sentence digest does not match the sentence text",
  sentence_not_normalized: "the sentence text has extra or unusual white space",
  unknown_field: "the field is not part of the record format",
  wrong_location: "the file name or directory does not match the record",
  stray_file: "the file is not a .json record",
  reference_missing: "no record has this ID",
  reference_wrong_kind: "the record with this ID is of a kind that is not allowed here",
  null_value: "null is not allowed; leave the field out",
  number_not_integer: "numbers must be whole and within the safe range; write others as strings",
};

export const problemTemplate = (problem: Problem): TemplateId => `record.valid:${problem.reason}`;

interface FindingParts {
  check: string;
  outcome: Outcome;
  reason?: string;
  subject: string;
  locus: string;
  source?: string;
  sentence?: Result["sentence"];
  item?: Result["item"];
  evidence?: Evidence[];
}

export function result(parts: FindingParts): Result {
  const { check, outcome, reason, subject, locus, source, sentence, item } = parts;
  const explanation = outcome === "pass" ? undefined : TEMPLATES[`${check}:${reason}` as TemplateId];
  if (outcome !== "pass" && !explanation) throw new Error(`no explanation for ${check}:${reason}`);
  return {
    finding_key: digest({ check, subject, source, locus }),
    check,
    outcome,
    ...(reason ? { reason_code: reason } : {}),
    subject,
    ...(sentence ? { sentence } : {}),
    ...(source ? { source } : {}),
    ...(item ? { item } : {}),
    evidence: parts.evidence ?? [],
    fixes: [...(explanation?.fixes ?? [])],
    rules: [],
    message: explanation?.message ?? "Nothing was found by this check here.",
    why: explanation?.why ?? "",
    suggestions: [...(explanation?.suggestions ?? [])],
    annotations: [],
    open: outcome !== "pass",
  };
}

export function sortResults(results: Result[]): Result[] {
  return results.sort((a, b) =>
    compareCodePoints(a.check, b.check) || compareCodePoints(a.subject, b.subject) || compareCodePoints(a.finding_key, b.finding_key));
}
