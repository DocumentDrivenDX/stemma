// Fixed explanation templates (CONTRACT-002 C and E). They are filled only with
// structured values such as field names, never with source or manuscript text.
import { compareCodePoints, digest, type Problem, type ProblemCode } from "@stemma/records";
import type { Evidence, Outcome, Result } from "./report.ts";

export interface Explanation { message: string; why: string; suggestions: string[]; fixes: string[] }

function explain(message: string, why: string, suggestions: string[], fixes: string[] = []): Explanation {
  return { message, why, suggestions, fixes };
}

const RECORD_WHY = "Every other check reads these files. A broken record can hide a citation problem or create a false one.";
const HELD_WHY = "Without the source's text in the project, nobody can compare this citation with the source, so it is unchecked.";
const STRUCTURE_WHY = "Every quotation and page check reads these files. A missing, reordered or changed part can hide or invent what the source says, so this source file is not used until it is sound.";
const LABEL_WHY = "Citations name printed pages. A wrong page label makes a wrong page reference pass, or a right one fail.";
const NOTE_WHY = "A marker without its note, or a note without its marker, suggests text was lost or put in the wrong stream in conversion.";
const ORIGINAL_WHY = "The chain from the original to your citation rests on the source file being what the original gives.";
const META_WHY = "A reference with the wrong author, title or year points readers to the wrong work, and is a common sign of an invented or confused citation.";
const ID_WHY = "An identifier that resolves nowhere, or to another work, sends a reader to the wrong thing.";
const NUMBER_WHY = "A figure attributed to a source that does not hold it misreports the source.";
const CHAPTER_WHY = "The citations, quotations and figures in that file are unchecked, so a mistake in any of them would go unnoticed.";
const KEY_WHY = "A reader or a build cannot tell which source this citation means, so it cannot be checked or put in the bibliography.";
const CLAIM_WHY = "Without all three, nobody can see later what the claim rests on, how sure its writer was, or why the sources support it.";
const CHANGED_WHY = "What you read, quoted or relied on may differ in what replaced it, so it needs looking at again.";
const QUOTE_WHY = "Readers take quoted words to be the source's own. Words the source does not hold misreport it.";
const UNCOMPARED_WHY = "Until the quotation can be compared with the source's text, it is unchecked.";
const PAGE_WHY = "A reader who turns to the cited place and does not find the words cannot check them.";
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
    "A file under records/ or sources/ does not belong there: a name or directory that does not match, or a file such as a binary that a project does not hold.",
    "References and tools find records by ID, directory and file name.",
    ["Rename or move the file as the evidence shows, or move a file that does not belong out of the project. Originals are not kept in the repository."]),
  "record.valid:manuscript_unsupported": explain(
    "A chapter file uses something the manuscript format does not have, so no check read anything in that file.", CHAPTER_WHY,
    ["Change what the evidence names, at its line and column, to a supported form, then run `check` again. Writing can carry on meanwhile."]),
  "record.valid:manuscript_syntax": explain(
    "A chapter file has a marker that cannot be read, so no check read anything in that file.", CHAPTER_WHY,
    ["Correct the marker at the line and column in the evidence, then run `check` again."]),
  "record.valid:manuscript_duplicate_id": explain(
    "A chapter file uses a citation ID that is already in use, so no check read anything in that file.", CHAPTER_WHY,
    ["Each citation ID belongs to one place. Remove one of the two, or give the copied citation its own record."]),
  "record.valid:manuscript_file_unread": explain(
    "A file under manuscript/ is not a chapter file, so nothing in it was read.",
    "A citation or quotation written only in that file is not checked.",
    ["Nothing needs doing if it is not part of the manuscript. A chapter is a file named manuscript/<chapter ID>.md."]),
  "record.valid:reference_dangling": explain(
    "A record or a chapter file names a record that is missing or is of the wrong kind.",
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
  "project.binary:binary_file": explain(
    "A binary file is in the repository, or would be added to it. A project holds text; originals and other binary files stay outside.",
    "git cannot show what changed in a binary, keeps every version for good, and nothing in it can be searched, checked or cited.",
    ["Keep the file where the author holds it, outside the repository. To read or cite it, convert it with `source convert`: the Markdown in sources/ is tied to the original by its hash. For a format Stemma does not convert, note what it is, its hash and where it is held.",
      "Moving the file out is the author's decision. A file already committed stays in git history until the history is rewritten."]),
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
  "cite.key:key_unbound": explain(
    "A citation in the manuscript is not tied to any source: its key is `?`.", KEY_WHY,
    ["Add or choose the source it means and write that source's key in place of `?`, or remove the citation."],
    ["repoint", "add_source", "remove_citation"]),
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
  "bib.uncited:manuscript_unreadable": explain(
    "Whether a listed source is cited could not be checked: no readable chapter cites it, and at least one chapter file cannot be read.",
    "The unreadable file may be where this source is cited.",
    ["Repair the chapter file named in the record.valid finding, then run `check` again."]),
  "bib.uncited:citation_unreadable": explain(
    "Whether a listed source is cited could not be checked: at least one citation record cannot be read.",
    "The unreadable file may be the citation of this source.",
    ["Repair the unreadable citation record first (see the record.valid finding), then run `check` again."]),
  "bib.uncited:check_error": explain(
    "The check itself failed while running, so this was not checked.", "This is a defect in Stemma, not a pass.",
    ["Report the defect together with the Stemma version."]),
  "source.held:no_source_file": explain(
    "A cited source has no source file in the project, so this citation is unchecked.", HELD_WHY,
    ["Capture the source: `ingest`, or `source convert <original> --source <id>`. For a book held only on paper, supply a transcription made by a recognition tool or typed. Writing can carry on meanwhile."], ["capture_source", "remove_citation"]),
  "source.held:no_text": explain(
    "A cited source's files hold no text, so this citation is unchecked.", HELD_WHY,
    ["Capture a copy of the source whose text can be read, or supply a transcription."], ["capture_source"]),
  "source.held:record_unreadable": explain(
    "Whether this cited source's text is here could not be checked: a source file's manifest cannot be read.", HELD_WHY,
    ["Repair the unreadable file first (see the record.valid finding), then run `check` again."]),
  "source.held:source_damaged": explain(
    "A cited source has a source file that is damaged, so it is not used and this citation is unchecked.", HELD_WHY,
    ["See the source.pages and record.valid findings on that source file. Restore it from git, or record your own edit with `source seal`."], ["restore_source"]),
  "source.held:check_error": CHECK_FAILED,
  "source.pages:part_missing": explain(
    "A page or section file that the manifest lists is missing.", STRUCTURE_WHY,
    ["Restore the file from git."], ["restore_source"]),
  "source.pages:part_edited": explain(
    "A page or section file differs from the digest its manifest records.", STRUCTURE_WHY,
    ["If you meant to edit it, record the edit with `source seal <text id> --actor person:<name>`. Otherwise restore it from git."], ["restore_source"]),
  "source.pages:part_unlisted": explain(
    "A page or section file is in the source directory but not in its manifest.", STRUCTURE_WHY,
    ["Remove the file, or convert the source again."], ["restore_source"]),
  "source.pages:part_unreadable": explain(
    "A page or section file cannot be read.", STRUCTURE_WHY,
    ["Restore the file from git."], ["restore_source"]),
  "source.pages:part_index": explain(
    "A page or section file's place does not agree with its name or its manifest.", STRUCTURE_WHY,
    ["Restore the files from git; their order is part of what is checked."], ["restore_source"]),
  "source.pages:part_sequence": explain(
    "The manifest does not list the pages or sections in sequence.", STRUCTURE_WHY,
    ["Restore the manifest from git."], ["restore_source"]),
  "source.pages:page_count": explain(
    "The pages of the source file do not match the number of pages in the original.", STRUCTURE_WHY,
    ["Restore the missing pages from git, or convert the original again. A source file that holds only some pages must say so."], ["restore_source"]),
  "source.pages:part_invalid": explain(
    "A source file's manifest or a part breaks the source file format, so its completeness could not be checked.", STRUCTURE_WHY,
    ["See the record.valid finding and correct it."], ["restore_source"]),
  "source.pages:check_error": CHECK_FAILED,
  "source.labels:label_repeated": explain(
    "Two pages in sequence carry the same printed label.", LABEL_WHY,
    ["Look at the page images. Correct the page map (`source label`), or leave a page without a label if its number is not established."], ["relabel"]),
  "source.labels:label_backwards": explain(
    "Printed page labels go backwards.", LABEL_WHY,
    ["Look at the page images. A second numbering bound into one file can do this: label only the pages of the work you cite."], ["relabel"]),
  "source.labels:label_jump": explain(
    "Printed page numbers advance by more than the pages do, as when pages are missing from the original or a label is wrong.", LABEL_WHY,
    ["Nothing in the text shows that the pages run on. If leaves are missing from your copy, capture a complete one; if a label is wrong, correct the page map (`source label`)."], ["relabel", "capture_source"]),
  "source.labels:folio_differs": explain(
    "A page number printed on a page differs from the label recorded for that page.", LABEL_WHY,
    ["Look at the page image and correct whichever is wrong."], ["relabel"]),
  "source.labels:check_error": CHECK_FAILED,
  "source.footnotes:marker_without_note": explain(
    "A note marker in the text has no note on its page or section.", NOTE_WHY,
    ["Compare the page with the original. The note may continue from or onto another page, or the conversion may have lost it."]),
  "source.footnotes:note_without_marker": explain(
    "A note has no marker in the text of its page or section.", NOTE_WHY,
    ["Compare the page with the original. If the note continues from an earlier page, mark its block continued."]),
  "source.footnotes:check_error": CHECK_FAILED,
  "source.original:original_not_upstream": explain(
    "A source file was converted from an original that none of the source's upstream records names.", ORIGINAL_WHY,
    ["Check which original is right. Record its upstream (`ingest --plan`), or retire this source file."]),
  "source.original:conversion_differs": explain(
    "A fresh conversion of the original does not give the committed text, after a person's corrections are undone.", ORIGINAL_WHY,
    ["Look at the differing readings. If a person edited the words, mark the change as a correction; otherwise restore the file, or convert the original again and retire this one."]),
  "source.original:comparison_stale": explain(
    "The text or the tools changed after the last fresh conversion was compared, so it no longer says anything.", ORIGINAL_WHY,
    ["Run `source verify <text id> --original <file>`, or `ingest` with the originals."], ["verify_original"]),
  "source.original:check_error": CHECK_FAILED,
  "claim.complete:claim_incomplete": explain(
    "A claim in the ledger is incomplete: the evidence names what is missing of a note behind it, a confidence level and a reason.", CLAIM_WHY,
    ["For a missing note, record a note on the source passage and link it to the claim with an attestation; a passage linked directly is not a note, and a retired note or attestation no longer counts, nor does one that breaks a rule (see the record.valid findings). For a missing confidence level (low, medium or high) or reason, add them to the claim. Stemma has no command that edits a record: change the claim's file and run `fmt` on it. If you no longer hold the claim, retire it. Writing can carry on meanwhile, and a claim that is rightly left as it is, such as your own thesis, can be explained or dismissed."]),
  "claim.complete:record_unreadable": explain(
    "Whether a note lies behind this claim could not be checked: a record that could link it to one cannot be read. Any other missing part is named in the evidence.", CLAIM_WHY,
    ["Repair the files named in the evidence (see the record.valid findings), then run `check` again. Add whatever else the evidence names as missing."]),
  "claim.complete:check_error": CHECK_FAILED,
  "source.changed:depends_on_retired": explain(
    "This rests on a source file or source that has since been replaced or retired.", CHANGED_WHY,
    ["Compare what you took from it with what replaced it, then correct or retire this item if it no longer holds. Stemma cannot yet record that you have looked, so the finding stays listed."]),
  "source.changed:text_changed": explain(
    "The text of a page or section changed after a passage this rests on was captured from it.", CHANGED_WHY,
    ["Look at the page, capture the passage again, and retire the old passage and anything copied from it that no longer holds."]),
  "source.changed:source_details_changed": explain(
    "The source's details changed after a passage this rests on was captured.", CHANGED_WHY,
    ["Check that the passage still belongs to the source as it is now recorded, and capture it again if it does."]),
  "source.changed:record_unreadable": explain(
    "Whether what this rests on has changed could not be checked: something it depends on cannot be read.", CHANGED_WHY,
    ["Repair the unreadable file first (see the record.valid and source.pages findings), then run `check` again."]),
  "source.changed:retired_text_not_followed": explain(
    "A source file of this source was retired, and a citation with no record does not say whether it was written before or after.",
    CHANGED_WHY,
    ["Nothing needs doing: this is a limit of what was covered. Quotations, pages and locators are compared with the current text. What the sentence says in your own words is not."]),
  "source.changed:check_error": CHECK_FAILED,
  "quote.present:near_match": explain(
    "A quotation is not in the source's text as written. A passage close to it is; both are shown.", QUOTE_WHY,
    ["Compare the two texts, and look at the page itself, since converted or recognized text can be wrong. If your quotation is wrong, capture the passage by its address so the words are copied. An omission, an added word, a change of capitals or punctuation, an ellipsis or a bracketed edit all count as differences."], ["capture_passage"]),
  "quote.present:absent": explain(
    "A quotation was not found in the source's text.", QUOTE_WHY,
    ["Find the words (`passage find`) and capture them, or remove the quotation marks if these are your words or a paraphrase. If the page does hold these words, the source text is wrong there, or it is a different edition: record that, or capture the copy you quoted."], ["capture_passage", "capture_source"]),
  "quote.present:passage_differs": explain(
    "A passage record no longer matches the words at its address.", QUOTE_WHY,
    ["Do not edit the record's words. Capture the passage again from the source text and retire this one."], ["capture_passage"]),
  "quote.present:citation_differs": explain(
    "A citation made from a passage no longer says what the passage says: its quotation or locator was changed.", QUOTE_WHY,
    ["Add the citation again from the passage, so that both are copied, and retire this one."], ["capture_passage"]),
  "quote.present:text_unavailable": explain(
    "A quotation could not be compared: the text of its source cannot be used here.", UNCOMPARED_WHY,
    ["See the source.held and source.pages findings, then capture or repair the source's text."], ["capture_source"]),
  "quote.present:poor_quality": explain(
    "A quotation was not found, but the only text is marked poor, so this does not show that the source lacks it.", UNCOMPARED_WHY,
    ["Look at the page itself, or capture a better text."], ["capture_source"]),
  "quote.present:anchor_not_found": explain(
    "A note extract could not be compared: none of the passages it is anchored to can be found in the source text.", UNCOMPARED_WHY,
    ["See the findings on its passages, and anchor the note to a passage that is in the text."]),
  "quote.present:unattributed_quotation": explain(
    "Words in quotation marks, or in a block quotation, could not be tied to one citation, so they were not compared with any source.", UNCOMPARED_WHY,
    ["Cite the source in the same sentence. Where the sentence has more than one citation, name the one quoted, as in [the words]{.quote cite=\"2\"}. If the words are not a quotation from a source, mark them [the words]{.not-quote}."],
    ["add_citation"]),
  "quote.present:unpaired_quote_mark": explain(
    "A double quotation mark has no partner, so the words it was meant to enclose were not read as a quotation.", UNCOMPARED_WHY,
    ["Add the missing mark in the same paragraph. For a sign that is not a quotation mark, such as inches, use the prime sign \u2033."]),
  "quote.present:check_error": CHECK_FAILED,
  "quote.page:wrong_page": explain(
    "The quoted words are in the source, but not where the citation says.", PAGE_WHY,
    ["Look at the place found, and correct the citation's locator, ideally by citing a captured passage so that the locator is copied."], ["repoint", "capture_passage"]),
  "quote.page:partly_on_page": explain(
    "The quotation runs beyond what the citation names, for example over a page break.", PAGE_WHY,
    ["Cite every page the words lie on, as a captured passage does."], ["repoint", "capture_passage"]),
  "quote.page:place_unknown": explain(
    "Where the quoted words lie could not be compared with the locator: that part of the text has no such page label, chapter or paragraph.", PAGE_WHY,
    ["Establish the page labels (`source pages`, `source label`) from what shows them, or cite a locator the source's text has."], ["relabel"]),
  "quote.page:check_error": CHECK_FAILED,
  "locator.extent:outside_extent": explain(
    "A citation's locator is outside the extent recorded for the work.", LOCATOR_WHY,
    ["Check the locator against the work and correct it. If the recorded extent is wrong, correct the source record."], ["repoint"]),
  "locator.extent:outside_page_map": explain(
    "A cited page, chapter or paragraph is outside those in your source files.", LOCATOR_WHY,
    ["Check the number against the source and correct it. If it is right, your source file holds only part of the work or leaves that page without a label."], ["repoint", "capture_source"]),
  "locator.extent:page_not_mapped": explain(
    "A cited page falls between labelled pages, on a page with no established label, so it could not be checked.", UNLOCATED_WHY,
    ["Look at the page. If its number can be established, add it to the page map and run `source label`."], ["relabel"]),
  "locator.extent:no_extent": explain(
    "A locator could not be checked: no extent is recorded for it, and no source file has its numbering.", UNLOCATED_WHY,
    ["For pages, label your source file's pages; a source with no pages cannot check a page number. For another kind of locator, record the work's extent on the source, taken from the work itself."], ["relabel"]),
  "locator.extent:unparsable_locator": explain(
    "A locator is not written in a form that can be compared with the work's pages or extent.", UNLOCATED_WHY,
    ["Write it as the printed label, or as a range with both ends in full, such as 41-43. Otherwise check it by hand."]),
  "locator.extent:record_unreadable": explain(
    "A locator could not be checked: a source file of this source cannot be read or is damaged.", UNLOCATED_WHY,
    ["See the record.valid and source.pages findings, repair the source file, then run `check` again."]),
  "locator.extent:check_error": CHECK_FAILED,
  "meta.source:mismatch": explain(
    "The source record disagrees with what the captured copy states about itself.", META_WHY,
    ["Compare both values with the title page of the work. Correct the record if it is wrong; if the copy is a different edition or a misdescribed file, capture the right one."], ["correct_record", "capture_source"]),
  "meta.source:source_damaged": explain(
    "The source's details could not be compared with a copy: its source file is damaged.", META_WHY,
    ["See the source.pages finding and repair the source file."], ["restore_source"]),
  "meta.source:not_found_in_copy": explain(
    "Some of the source's details are shown neither by the copy's title page text nor by a saved catalogue record, and nothing contradicts them.", META_WHY,
    ["Nothing needs doing: this is a limit of what was covered. A saved lookup or a copy with a clearer text would corroborate more. The author may also record what the title page shows (`review add --scope source_details`)."]),
  "meta.source:nothing_to_compare": explain(
    "The source record has no title yet, so its details could not be compared with the copy.", META_WHY,
    ["Nothing needs doing. Once a title is recorded, it is compared."]),
  "meta.source:check_error": CHECK_FAILED,
  "meta.resolver:mismatch": explain(
    "The source record disagrees with a saved catalogue lookup.", META_WHY,
    ["Compare both with the work itself. Correct the record if it is wrong. A catalogue can be wrong or describe another edition: if so, keep the record and the finding shows the difference."], ["correct_record"]),
  "meta.resolver:no_lookup": explain(
    "The source's details have not been compared with any catalogue: no lookup that found the work is saved.", META_WHY,
    ["Nothing needs doing. `resolve` compares the source once an identifier is known; some works are in no catalogue it reads."], ["resolve"]),
  "meta.resolver:lookup_silent": explain(
    "A saved lookup states no title, so no title could be compared with it.", META_WHY,
    ["Nothing needs doing. A lookup by another identifier may state one."], ["resolve"]),
  "meta.resolver:set_date": explain(
    "A saved lookup is for one volume of a set and gives the set's date, and nothing else here shows the volume's year or contradicts it.", META_WHY,
    ["Nothing needs doing. A catalogue record that dates the volume, or a copy with a clearer title page text, would corroborate the year."]),
  "meta.resolver:check_error": CHECK_FAILED,
  "id.resolves:no_lookup": explain(
    "An identifier on the source record has not been looked up.", ID_WHY,
    ["Nothing needs doing. `resolve` looks up DOIs at Crossref and Internet Archive items; other identifiers cannot yet be looked up."], ["resolve"]),
  "id.resolves:not_found": explain(
    "A catalogue did not find the work this identifier should name.", ID_WHY,
    ["Check the identifier against the work and correct or remove it."], ["correct_record"]),
  "id.resolves:other_work": explain(
    "An identifier resolves to a work with a different title.", ID_WHY,
    ["Check which is wrong: the identifier or the record's title."], ["correct_record"]),
  "id.resolves:lookup_silent": explain(
    "The saved lookup states no title, or the record has none, so the identifier could not be compared.", ID_WHY,
    ["Nothing needs doing. It is compared once both state a title."]),
  "id.resolves:lookup_error": explain(
    "The saved lookup is a response that could not be read.", ID_WHY,
    ["Nothing needs doing. Running `resolve` again replaces it."], ["resolve"]),
  "id.resolves:check_error": CHECK_FAILED,
  "number.present:figure_absent": explain(
    "A figure in a sentence that cites this source was not found in the source's text.", NUMBER_WHY,
    ["Find the figure in the source and correct the sentence, or move the figure to a sentence that does not attribute it to this source. A converted or recognized text can also be wrong: look at the page."]),
  "number.present:several_citations": explain(
    "A sentence with a figure cites more than one source, so which one holds the figure could not be judged.", NUMBER_WHY,
    ["Nothing needs doing. A sentence that cites one source has its figures looked for there."]),
  "number.present:text_unavailable": explain(
    "A figure could not be compared: the source has no usable text.", NUMBER_WHY,
    ["Capture or repair the source's text."], ["capture_source"]),
  "number.present:check_error": CHECK_FAILED,
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
  text_digest_mismatch: "the text digest does not match the text",
  sentence_not_normalized: "the sentence text has extra or unusual white space",
  unknown_field: "the field is not part of the record format",
  wrong_location: "the file name or directory does not match the record",
  stray_file: "the file is not a .json record, a source manifest, or one of its page or section files",
  reference_missing: "no record has this ID",
  reference_wrong_kind: "the record with this ID is of a kind that is not allowed here",
  null_value: "null is not allowed; leave the field out",
  number_not_integer: "numbers must be whole and within the safe range; write others as strings",
  bad_size: "a size cannot be below zero",
  bad_page_range: "a page-map segment has an impossible or overlapping range of pages",
  bad_page_labels: "a page-map segment's labels do not fit its numbering style or its number of pages",
  label_evidence_missing: "a page-map segment gives printed labels without saying what evidence they come from",
  bad_original: "a digital original is tied by digest and size, and a physical one by a description and where it is held",
  bad_page_label: "a page's label, its status, and how it was determined do not agree",
  bad_part: "the part is not in the source file format",
  model_verification: "a model's review can only flag; it is never a person's verification",
  response_digest_mismatch: "the saved response does not match its digest",
  bad_address: "a passage address needs, for each part, a start before its end",
  bad_binding: "an annotation binds a sentence and its source, or one record, never both",
  note_without_passage: "an extract or paraphrase note names no passage, so nothing shows where in its source it comes from; capture the passage (`passage capture`) and name it in `passages`, or make the note a comment if it is a remark of your own",
  front_matter_missing: "the file does not begin with a front matter block",
  front_matter_unreadable: "the front matter is not one readable JSON object",
  text_outside_block: "there is text before the first block line",
  unknown_annotation: "an annotation is not one the source file format defines, or is not closed",
  unknown_role: "a block's role is not one the source file format defines",
  raw_angle: "a < in source text must be written as an entity, so that source text cannot form an annotation",
  correction_not_by_person: "a correction names a person; source text is not corrected by a model or script",
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
  /** Nothing shows anything wrong: the result says only what was not covered. */
  coverage?: boolean;
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
    ...(parts.coverage && outcome === "unverifiable" ? { coverage_only: true } : {}),
    open: outcome === "fail" || (outcome === "unverifiable" && !parts.coverage),
  };
}

export function sortResults(results: Result[]): Result[] {
  return results.sort((a, b) =>
    compareCodePoints(a.check, b.check) || compareCodePoints(a.subject, b.subject) || compareCodePoints(a.finding_key, b.finding_key));
}
