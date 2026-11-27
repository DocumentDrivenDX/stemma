---
ddx:
  id: FEAT-015
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.feature-registry
---

# Feature Specification: FEAT-015 — Takeover of existing projects

**Feature ID**: FEAT-015
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 15. Takeover of existing projects
**Covered PRD Requirements**: FR-71, FR-72, FR-73, FR-82, FR-92, FR-93, FR-95
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Takeover brings an existing manuscript and its reference libraries into Stemma
without changing the originals (FR-71). A manuscript is a Word file or, for a
chapter with none, a born-digital PDF (FR-95). It builds what it finds into the
evidence graph as unverified (FR-72), links author-date citations to the
manuscript's reference lists by fixed rules (FR-92), keeps its first report
usable (FR-93), and lets the author resolve failing
references in rounds, writing fixes to a Stemma copy (FR-73). With the checks and
a basic PDF (FR-83, FEAT-008), it is the first pilot. In M2 it also suggests
constructs and methodology (FR-82).

## Ideal Future State

An author gives Stemma a half-referenced Word or PDF manuscript and their
libraries.
The originals stay as they were. The author sees what was found, what was not
read, and what is uncertain, all unverified. As they add sources, checks
run, and the author decides for each failing reference whether to remove,
repoint, or replace it. They can stop at any point and resume later without
losing a decision.

## Problem Statement

- **Current situation**: Authors have manuscripts with embedded
  reference-manager fields, typed footnotes, short forms, and separate
  libraries. Some cite only in plain typed author-date form, with a reference
  list in each chapter and no reference-manager data at all. Checking a large book by hand can take manual library look-ups for
  hundreds of entries.
- **Pain points**: Adopting a new method means starting over. A tool that
  guesses what a short form means can attach a claim to the wrong source.
- **Desired outcome**: A pilot author takes over one existing chapter, resolves
  its references, and gets the same scripted results after stopping and
  resuming.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Intake | What did Stemma read from my files? | Non-destructive reading with a stated support level per input |
| PDF intake | What could Stemma not tell from my PDF? | Structure only by stated rules, no link across a doubtful join, and a list of what a PDF cannot show |
| Unverified graph | What does my manuscript rest on? | References, quotations, and claims as unverified records |
| Author-date citations | Which entry does each citation mean? | Reference lists, citation recognition, rule-based linking, and an account of every parenthesis with a year |
| Stemma copy | Do checks see what I cite? | Markers that keep each citation as typed, and checks that read them |
| First report | Where do I start? | Grouped findings and one choice for exact repeats |
| Resolution rounds | What do I do about each failure? | Author choices, rechecks, and resumable progress |
| Suggestions (M2) | What concepts and method does my work already use? | Suggestions with supporting passages, unreviewed until the author looks |

These objects differ:

| Object | Meaning |
|--------|---------|
| Original | The author's manuscript or library file; never changed by takeover |
| Stemma copy | The manuscript as Stemma holds it, in marked-up Markdown with citation and claim markers; fixes are written here |
| Embedded reference | Data held in a reference-manager field in the manuscript; still unverified |
| Typed footnote | A footnote written as plain text, including short forms |
| Full or partial reference | A recovered reference with all, or only some, identifying data |
| Round | One working pass through failing references |
| Choice | The author's decision to remove, repoint, or replace one reference |
| Reference list | A list of works under a references or bibliography heading in a manuscript file |
| Linked citation | An author-date citation that a fixed rule matched to exactly one list entry; not a verified one |
| Unresolved citation | Text read as a citation that no entry, or more than one, matches; it stays open |
| Left unlinked | A parenthesis with a year that takeover did not read as a citation, listed with its reason |
| Exact repeat | Reference entries whose text as found is identical |
| Seam | A place where a PDF reading joined or ended text without being able to vouch that it belongs together as shown |
| Unread page | A PDF page whose content is not converted: no text layer, or text drawn invisibly, as in a recognition layer |

## Task Model

N/A — the user stories name the tasks.

## Requirements

### Functional Requirements by Area

#### Intake (FR-71)

- INT-01. Takeover must read a Word manuscript, including its body text,
  headings, and tables. Word heading styles must guide the structure of the
  Stemma copy.
- INT-02. Takeover must read BibLaTeX libraries, CSL-JSON (Citation Style
  Language data) libraries, and RIS (a tagged reference format) libraries.
- INT-03. Takeover must leave every original unchanged.
- INT-04. Takeover must recover embedded reference-manager fields where they are
  present.
- INT-05. Support for an input must be promised only after tests on files saved
  by real tools pass. The product must state which inputs and producing tools are
  supported and which are untested.
- INT-06. Takeover must report content it could not read or interpret, with its
  location where known, and must not drop it silently.
- INT-07. Takeover must validate each input as untrusted and must treat its text
  as data and never as instructions.
- INT-08. A damaged or unreadable input must produce a named failure and must not
  leave a partial import presented as complete.
- INT-09. A manuscript may be several files, such as one for each chapter
  or appendix. Taking over a further file into the same project must add to it
  and must keep earlier records and choices.
- INT-10. Takeover must report every Word comment with its text and location.
- INT-11. A chapter must be taken over from one file. A file that repeats text
  already taken over must add nothing, and must name the earlier file, unless
  the author says it is a different text.

#### PDF intake (FR-95)

INT-03, INT-05 to INT-09, and INT-11 apply to PDF as to Word.

- PDF-01. Takeover must read a born-digital PDF manuscript with a text layer and
  must produce from it what it produces from a Word file: the same kinds of
  records, intake items, report, author-date account, and Stemma copy.
- PDF-02. Paragraphs, headings, footnotes and their markers, running heads, page
  numbers, and reading order must be set only by stated deterministic rules.
  No model may set them. What the rules cannot establish must be reported, and
  every removed line must be listed.
- PDF-03. Every piece of text read from a converted page must end as manuscript
  text, a note marker, or a listed removal.
- PDF-04. Takeover must not link a citation or read a reference entry across a
  place it cannot vouch for, such as a page break or a line-end hyphen that
  changes a name. Each such citation and entry must be listed with the reason.
- PDF-05. A reference list whose entries cannot be told apart, or that an unread
  page could affect, must link no citation it serves, and the report must say
  so.
- PDF-06. Takeover must report every comment annotation with its text and page,
  and must report form values, link addresses, and attachments without fetching
  or opening anything.
- PDF-07. Every report must state what a PDF cannot show, including whether it
  was made with tracked changes showing, comments printed on the page, hidden or
  struck text, tables, block quotations, and reference-manager data.
- PDF-08. A page with no text layer or with invisibly drawn text must not be
  converted and must be named. A file with no page that can be converted must
  fail by name and write nothing. Takeover must not run recognition.
- PDF-09. Each converted paragraph must keep the page and place of its lines in
  the original.

#### Unverified graph (FR-72)

- GRF-01. Takeover must build full and partial references, quotations, and claims
  into the graph.
- GRF-02. Every item takeover creates, including items from embedded fields
  and libraries, must start unverified, meaning not yet checked. It counts as
  open only through its own check results and support records (FEAT-007).
- GRF-03. Each created item must trace to where it was found in an original.
- GRF-04. A typed footnote that cannot be resolved with certainty must go to the
  author, with the candidates and the reason; the system must not guess.
- GRF-05. A resolution made without the author must come from a deterministic
  rule, not from a model's judgment.
- GRF-06. A partial reference must keep missing data as missing; takeover must
  not fill it in unrecorded.
- GRF-07. A recovered reference with no source file must be reported as
  unchecked (FR-9).
- GRF-08. A claim takeover extracts must take effect at once, marked
  unreviewed (FR-23).
- GRF-09. The author must be able to review extracted claims in batches, each
  claim shown with its original passage, and to edit or retire any one, whenever
  they choose. Review must not change a check result, and no review may be
  required to continue.
- GRF-10. Takeover must carry the whole original reference list forward as
  sources listed for the bibliography, so that an entry cited nowhere is
  reported until the author removes it or dismisses the finding (FR-15). An
  entry it cannot bind with certainty must go to the author, and the report must
  say when no list was found.

#### Reference lists and author-date citations (FR-92)

- ADC-01. Takeover must find each reference list or bibliography section by its
  heading. (In a PDF, PDF-05 also applies.)
- ADC-02. For each entry it must read the authors, the year, and any year
  suffix, whether the year follows the authors or stands near the end of the
  entry, and must keep the entry as found. An entry it cannot read must be
  listed.
- ADC-03. Takeover must find author-date citations in body text and notes,
  including groups separated by semicolons, several years for one author, and
  narrative forms such as "Smith (1999)".
- ADC-04. Lead-ins such as "cf.", "see", and "based on" must be kept as
  prefixes, and page numbers and page ranges as typed page locators.
- ADC-05. A citation must be matched first against its own chapter's list, on
  every author named, the year, and any suffix. A form with "et al." and a form
  naming one author are different citations.
- ADC-06. Takeover must link a citation only when exactly one entry matches.
  Otherwise it must report it as unresolved, with the candidates, for the
  author. A model's judgment must never link a citation.
- ADC-07. A range of dates must not become a citation.
- ADC-08. Every parenthesis that holds a year must be linked, reported as
  unresolved, or listed as left unlinked with its location and the reason. The
  list must stay in the project files.

#### Stemma copy and checks (FR-73, FR-92)

- CPY-01. The Stemma copy must write each citation read from author-date text as
  a citation marker with its page locator and prefix, and the project must keep
  each one's original text and position.
- CPY-02. The citation-key, held-source, quotation, page, figure, and
  uncited-entry checks must read the Stemma copy. A listed entry that a linked
  citation names must not be reported as uncited.

#### First report (FR-93)

- RPT-01. The takeover report and the first check report must show findings and
  open takeover items that share a cause once, with a count, the places affected,
  and a next step.
- RPT-02. The author must be able to settle every exact repeat of a reference
  entry with one choice. Takeover must not merge repeats by itself.
- RPT-03. Grouping must not hide a finding or change a result.

#### Resolution rounds (FR-73)

- RND-01. The system must present failing references for the author to work
  through in rounds, which are never required before other work.
- RND-02. The author must be able to stop a round and resume it later, keeping
  completed choices.
- RND-03. For each failing reference, the author must be able to remove it,
  repoint it, or replace it. The assistant may explain and propose; it must not
  choose.
- RND-04. Every choice must be rechecked together with the records that depend
  on it.
- RND-09. A claim that a removal leaves without a citation must be reported.
  The product must not suggest that the claim is then supported.
- RND-06. Each choice and its recheck result must remain in the project files.
- RND-07. A round must never change a scripted result or record an annotation
  the author did not ask for; FEAT-007 owns results and annotations.
- RND-08. Fixes must be written to a Stemma copy of the manuscript, in the
  Markdown of FR-35, never to the original files. Layout the markup does not
  define must be reported by takeover, not dropped silently.

#### Construct and methodology suggestions (FR-82, M2)

- SUG-01. For a taken-over project, the system must suggest constructs and a
  research methodology, each with its supporting passages.
- SUG-02. A suggestion must take effect at once, marked unreviewed, and the
  author must be able to revise or retire it.

### Non-Functional Requirements

- **Integrity**: After takeover and any number of rounds, 100% of originals have
  the same content hash as before.
- **Reliability**: Two takeovers of the same originals into empty projects with
  the same tool versions differ in 0 scripted check results. Stopping and
  resuming changes 0 scripted results for unchanged records.
- **Recovery accuracy**: On each supported input's seeded real-file test set,
  takeover reports 0 uncertain footnotes as resolved to a wrong source. On a
  hand-checked answer list, it links 0 author-date citations to a wrong entry.
  Both targets apply to PDF as to Word.
- **Accounting**: 100% of the parentheses that hold a year in a seeded
  manuscript are linked, unresolved, or listed with a reason.
- **Security**: A seeded hostile input causes 0 executed code, 0 writes outside
  the project, and 0 actions taken from instructions in its text.
- **Offline**: Intake and rechecks that use saved data run with no network.
- **Performance** (assumption, pending the product owner): Intake of one
  synthetic chapter with 200 footnotes and a 1,000-entry library completes within
  60 seconds on the development machine.

## User Stories

- [US-099 — Take over a Word manuscript without changing it](../user-stories/US-099-take-over-a-word-manuscript.md)
- [US-100 — Bring in reference libraries](../user-stories/US-100-bring-in-reference-libraries.md)
- [US-101 — Review the unverified graph and uncertain footnotes](../user-stories/US-101-review-unverified-graph.md)
- [US-102 — Remove, repoint, or replace a failing reference](../user-stories/US-102-remove-repoint-or-replace.md)
- [US-103 — Stop and resume resolution rounds](../user-stories/US-103-stop-and-resume-rounds.md)
- [US-106 — Review suggested constructs and methodology](../user-stories/US-106-review-suggested-constructs.md)
- [US-113 — Link author-date citations to the chapter's reference list](../user-stories/US-113-link-author-date-citations.md)
- [US-114 — Work through a usable first report](../user-stories/US-114-use-the-first-report.md)
- [US-116 — Take over a PDF chapter](../user-stories/US-116-take-over-a-pdf-chapter.md)

## Edge Cases and Error Handling

- **Tracked changes in the manuscript**: Deleted text must not appear as current
  content; the report states how tracked changes were treated.
- **Embedded data that disagrees with the visible citation or a library**: Both
  values are kept and shown; takeover does not pick one silently.
- **Duplicate library entries**: They are reported for the author and not merged
  silently.
- **Takeover run again on the same project**: Existing author choices are not
  overwritten (assumption).
- **Original changed between rounds**: The system reports the difference and
  does not apply it silently.
- **Manuscript with no footnotes or fields**: Takeover reports what it found,
  including that it found no references; this is not a pass.
- **Chapter with no reference list**: Its author-date citations are unresolved,
  and the report says no list was found.
- **Solo and co-authored works by one name in one year**: Each citation form
  matches only an entry with those authors.
- **An unread entry that could be the one cited**: The citation stays
  unresolved even when another entry matches.
- **Citation inside a table**: Until the open question is answered, it is listed
  as left unlinked with that reason. A PDF does not show which text is a table,
  so there this reason cannot be given (PDF-07).
- **PDF made with tracked changes showing**: Deleted text cannot be told from
  current text. Every PDF report says so; the Word file is the remedy.
- **Reference entry split across PDF pages**: The part after the break could
  read as a work by fewer authors, so the entry is unread.
- **Word and PDF of one chapter**: The second file adds nothing unless the author
  says it is a different text.

## Success Metrics

- **Pilot completion**: One existing chapter is taken over and checked by a pilot
  author (PRD hypothesis; pilot study).

## Constraints and Assumptions

- The Stemma copy's files, markers, and takeover output are defined by
  CONTRACT-006 (ADR-009).
- **Risk**: after a reference is removed, the claim it supported can stand
  without a source in a finished book; the report is the only warning.
- The pilot build order is: Word reader; reference-list reader; author-date
  recognition and linking; Stemma copy and its reader; checks that read the
  copy; usable first report. Later steps depend on earlier ones. The PDF reader
  steps run beside these and no Word step waits for them (SD-015).
- Product owner's decisions on PDF (2026-11-27): a PDF gets a full takeover; the
  first reader is designed for single-column drafts; scanned pages and invisible
  recognition layers are not converted; each chapter is taken over from one
  file.
- **Risk**: a PDF reading can lose or reorder text in ways its rules do not
  detect, and a clean-looking report does not prove the reading is right.
- Reading is not verifying: linking a citation says which entry it names.
  Checking its quotation or page still needs a copy of the cited work.
- The repository is public. Tests copy the patterns found in real manuscripts
  using invented text. Runs on an author's own chapters, and their answer lists,
  stay private and are not committed.
- Pilot acceptance starts with a few chapters chosen to exercise different
  problems: a cited work missing from its list, a second reference-entry layout,
  and look-alike citations.
- Delivery step M1. Takeover uses record files and a disposable index; it does
  not wait for the graph engine or explorer.
- Library round trips are FEAT-003 behavior (FR-13). Governing records for a
  taken-over project are FEAT-001 behavior (FR-1, M2; standing rules M1).
- Excerpts sent to a hosted model during takeover follow FR-61 (FEAT-002).
  Rights can be recorded at takeover, because they decide what a reviewer
  package may hold; none are required, and they do not limit model use.
- A missing source file cannot be dismissed (FR-32), so a reference without one
  stays open until a copy is added or the reference is removed or replaced.
- Assumption (PRD): FR-82 arrives in M2 with the construct register.
- **Risk**: No file saved by Word, Zotero, EndNote, or another reference manager
  has been tested. No publisher PDF or scan has been tested.
- **Unverified**: On hand-built fixtures on one macOS machine, a prototype
  recovered all footnotes and embedded Zotero and EndNote references. On typed
  footnotes it resolved 9 of 10 resolvable ibid. and short forms with none
  wrong. It did not notice German "a.a.O." forms or author-date citations. The
  same agent wrote fixtures and code.
- **Unverified**: A throwaway script, not Stemma, was run on one private set of
  drafts that cite in author-date form. Matching only the first author's family
  name and the first year against each file's own list, it found exactly one
  entry for most of the parts it could read as author and year. No match was
  checked for correctness, and narrative and other forms were not counted.
- **Unverified**: Field formats for other reference managers come from research
  reading and were not tested.

## Dependencies

- **Other features**: FEAT-002, FEAT-003, FEAT-005, and FEAT-007 (required).
  FEAT-001 supplies the standing rules; FEAT-008 builds the pilot's basic PDF;
  FEAT-010 provides the takeover mode; FEAT-011 stores the records.
- **External services**: The tools that save the authors' manuscripts and
  libraries. Record, report, and command surfaces belong in Contracts.
- **PRD requirements**: FR-71, FR-72, FR-73, FR-92, FR-93, FR-95 (P0, M1); FR-82
  (P0, M2).

## Out of Scope

- LaTeX manuscript intake.
- Recognition of scanned pages, and converting a recognition layer.
- Two-column pages, typeset proofs, and published pages as designed inputs. They
  are read by the same rules, with more reported.
- Using a PDF only to show where a Word chapter's sentences sit on pages, and
  replacing a chapter taken over from one file with another file.
- Capturing and converting sources (FEAT-002).
- Check definitions, support checks, and annotations (FEAT-007).
- Legacy library export (FEAT-003).
- Rewriting the manuscript's prose without the author's choice.
- Promising support for an input that has only passed synthetic fixtures.

## Open Questions

- [ ] Which producing tools and versions must the pilot's inputs cover? Blocks
  INT-05 test sets; product owner with the pilot author.
- [ ] Are the pilot author's current files structured like the earlier copies the
  author-date rules were drawn from? Product owner with the pilot author.
- [ ] The PRD's open questions on tables, the second reference-entry layout,
  repeated entries, working markers, left-unlinked parentheses, the pilot
  PDF's citation style, and the five questions on PDF intake (figure pages,
  list layout, pilot timing, producing programs, moving to Word) apply to this
  feature.

