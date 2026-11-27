// Fixed explanation templates (CONTRACT-002 C and E). They are filled only with
// structured values such as field names, never with source or manuscript text.
import { compareCodePoints, digest, type Problem, type ProblemCode } from "@stemma/records";
import type { Evidence, Outcome, Result } from "./report.ts";

export interface Explanation { message: string; why: string; suggestions: string[]; fixes: string[] }

function explain(message: string, why: string, suggestions: string[], fixes: string[] = []): Explanation {
  return { message, why, suggestions, fixes };
}

const RECORD_WHY = "Every other check reads these files. A broken record can hide a citation problem or create a false one.";
const HELD_WHY = "Without a stored copy and its text, nobody can compare this citation with the source, so it is unchecked.";
const INTEGRITY_WHY = "The records describe one exact file. A missing or changed file cannot stand for it, so nothing that depends on it can be checked.";
const KEY_WHY = "A reader or a build cannot tell which source this citation means, so it cannot be checked or put in the bibliography.";
const CHANGED_WHY = "What you read, quoted or relied on may differ in what replaced it, so it needs looking at again.";
const QUOTE_WHY = "Readers take quoted words to be the source's own. Words the source does not hold misreport it.";
const UNCOMPARED_WHY = "Until the quotation can be compared with your copy's text, it is unchecked.";
const LOCATOR_WHY = "A page or other locator that is not in the work sends a reader nowhere, and is a common sign of an invented or mistyped citation.";
const UNLOCATED_WHY = "Until the locator can be compared with the work's pages or extent, a wrong one would go unnoticed.";
const CHECK_FAILED = explain("The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
  ["Report the defect together with the Stemma version."]);
const COORDINATE_WHY = "This output can disclose a restricted site's position. The scan cannot tell whether a site is restricted, so it warns about every coordinate it recognizes.";


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
    "Whether a listed source is cited could not be checked: this version does not read the files in manuscript/.",
    "The manuscript, not the citation records, says what is cited now, so a guess could be wrong either way.",
    ["Nothing to fix in your files. Check this entry by hand."]),
  "bib.uncited:citation_unreadable": explain(
    "Whether a listed source is cited could not be checked: at least one citation record cannot be read.",
    "The unreadable file may be the citation of this source.",
    ["Repair the unreadable citation record first (see the record.valid finding), then run `check` again."]),
  "bib.uncited:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
  "source.held:no_copy": explain(
    "A cited source has no stored copy, so this citation is unchecked.", HELD_WHY,
    ["Add your copy (`source add <file> --source <id>`). For a book you hold only on paper, add a scan and attach its text. Writing can carry on meanwhile."],
    ["add_copy", "remove_citation"]),
  "source.held:no_text": explain(
    "A cited source has a stored copy but no extracted text, so this citation is unchecked.", HELD_WHY,
    ["Attach the text (`source text <capture id>`). A plain UTF-8 text copy is read as it is, and a PDF's own text layer is read page by page. For a scan with no text in it, supply recognized text with a form feed after each page (`--text-layer <file>`); Stemma recognizes no characters in page images."],
    ["add_text"]),
  "source.held:record_unreadable": explain(
    "Whether you hold this cited source could not be checked: at least one capture or extraction record cannot be read.",
    "The unreadable file may be the record of the stored copy or of its text.",
    ["Repair the unreadable record first (see the record.valid finding), then run `check` again."]),
  "source.held:copy_missing": explain(
    "A stored copy could not be checked: its file is not in the content store used here.", INTEGRITY_WHY,
    ["The content store is private and is not part of the repository. Point `--store-dir` at it, restore the file from your backup, or add the same file again. `store verify` lists every missing digest."],
    ["restore_copy"]),
  "source.held:copy_altered": explain(
    "A stored copy no longer matches its recorded digest, so it is not treated as the copy that was added.", INTEGRITY_WHY,
    ["Restore the file from your backup, or add the original file again. If the source itself changed, add it as a new copy."],
    ["restore_copy"]),
  "source.held:text_missing": explain(
    "The extracted text of a stored copy could not be checked: it is not in the content store used here.", INTEGRITY_WHY,
    ["Point `--store-dir` at the store that holds it, or restore it from your backup. `store verify` lists every missing digest."],
    ["restore_text"]),
  "source.held:text_altered": explain(
    "The stored text of a copy no longer matches its recorded digest, so it is not used.", INTEGRITY_WHY,
    ["Restore the text from your backup, or attach the text again as a new extraction."], ["restore_text"]),
  "source.held:text_inconsistent": explain(
    "An extraction record does not fit its stored text (its size or page spans disagree with it), so it is not used.", INTEGRITY_WHY,
    ["Retire this extraction and attach the text again as a new one. An extraction is never edited."], ["add_text"]),
  "source.held:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
  "source.changed:depends_on_retired": explain(
    "This rests on a copy, text or source that has since been replaced or retired.", CHANGED_WHY,
    ["Compare what you took from it with what replaced it, then correct or retire this item if it no longer holds. Stemma cannot yet record that you have looked, so the finding stays listed."]),
  "source.changed:source_details_changed": explain(
    "The source's details changed after a passage this rests on was anchored.", CHANGED_WHY,
    ["Check that the passage still belongs to the source as it is now recorded. Anchor it again as a new passage if it does."]),
  "source.changed:record_unreadable": explain(
    "Whether what this rests on has changed could not be checked: a record it depends on cannot be read.", CHANGED_WHY,
    ["Repair the unreadable record first (see the record.valid finding), then run `check` again."]),
  "source.changed:check_error": CHECK_FAILED,
  "quote.present:near_match": explain(
    "A quotation is not in your stored copy's text as written. A passage close to it is; both are shown.", QUOTE_WHY,
    ["Compare the two texts, and look at the page itself, since extracted or recognized text can be wrong. If your quotation is wrong, correct it to match the page. An omission, an added word, a change of capitals or punctuation, an ellipsis or a bracketed edit all count as differences."],
    ["correct_quotation"]),
  "quote.present:absent": explain(
    "A quotation was not found in your stored copy's text.", QUOTE_WHY,
    ["Find the words on the page and correct the quotation, or remove the quotation marks if these are your words or a paraphrase. If the page does hold these words, the stored text is wrong there, or it is a different edition: attach a better text or add the copy you quoted. Words that run across a page break can also be missed, because running heads come between them."],
    ["correct_quotation", "add_copy"]),
  "quote.present:text_unavailable": explain(
    "A quotation could not be compared: the stored text of its source cannot be used here.", UNCOMPARED_WHY,
    ["See the source.held finding. Add a copy and attach its text, point `--store-dir` at the store that holds it, or restore it from your backup."],
    ["add_copy", "add_text"]),
  "quote.present:poor_quality": explain(
    "A quotation was not found, but the only stored text is marked poor, so this does not show that the source lacks it.", UNCOMPARED_WHY,
    ["Look at the page itself, or attach a better text."], ["add_text"]),
  "quote.present:anchor_not_found": explain(
    "A note extract could not be compared: none of the passages it is anchored to can be found in stored text.", UNCOMPARED_WHY,
    ["See the findings on its passages, and anchor the note to a passage that is in the stored text."]),
  "quote.present:check_error": CHECK_FAILED,
  "locator.extent:outside_extent": explain(
    "A citation's locator is outside the extent recorded for the work.", LOCATOR_WHY,
    ["Check the locator against the work and correct it. If the recorded extent is wrong, correct the source record."],
    ["repoint"]),
  "locator.extent:outside_page_map": explain(
    "A cited page is outside the printed pages mapped in your stored copy.", LOCATOR_WHY,
    ["Check the page number against the source and correct it. If the page is right, your copy is partial or its page map leaves that page without a label: look at the page map (`source pages` proposes one)."],
    ["repoint", "add_copy"]),
  "locator.extent:page_not_mapped": explain(
    "A cited page falls between mapped pages, on a page the page map gives no label, so it could not be checked.", UNLOCATED_WHY,
    ["Look at the page in your copy. If its number can be established, attach the text again with a page map that includes it and says what shows the label."],
    ["add_text"]),
  "locator.extent:no_extent": explain(
    "A locator could not be checked: no extent is recorded for it, and no page map covers its numbering.", UNLOCATED_WHY,
    ["For pages, attach your copy's text with a page map (`source pages` proposes one from the printed numbers). For another kind of locator, record the work's extent on the source, taken from the work itself."],
    ["add_text"]),
  "locator.extent:unparsable_locator": explain(
    "A locator is not written in a form that can be compared with the work's pages or extent.", UNLOCATED_WHY,
    ["Write it as the printed label, or as a range with both ends in full, such as 41-43. Otherwise check it by hand."]),
  "locator.extent:record_unreadable": explain(
    "A locator could not be checked: at least one capture or extraction record cannot be read.", UNLOCATED_WHY,
    ["Repair the unreadable record first (see the record.valid finding), then run `check` again."]),
  "locator.extent:check_error": CHECK_FAILED,
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
  bad_size: "a size cannot be below zero",
  bad_page_range: "a page-map segment has an impossible or overlapping range of file pages",
  bad_page_labels: "a page-map segment's labels do not fit its numbering style or its number of pages",
  label_evidence_missing: "a page-map segment gives printed labels without saying what evidence they come from",
  bad_page_spans: "page spans must be in page order, must not overlap, and must not end before they start",
  missing_page_spans: "an extraction of a PDF must say where each page's text starts and ends",
  capture_digest_mismatch: "the extraction names other bytes than the copy its capture holds",
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
