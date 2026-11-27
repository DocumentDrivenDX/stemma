---
ddx:
  id: FEAT-002
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.principles
    - stemma.concerns
    - FEAT-001
---

# Feature Specification: FEAT-002 — Source corpus

**Feature ID**: FEAT-002
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 2. Source corpus
**Covered PRD Requirements**: FR-6, FR-7, FR-8, FR-9, FR-10, FR-61, FR-84, FR-85, FR-86, FR-87, FR-88, FR-89, FR-90, FR-94, FR-98, FR-99, FR-100, FR-101, FR-102, FR-103, FR-104
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

The source corpus holds, in the author's repository, the whole text of every
source used to support the report or book, each tied to its original (PRD FR-6
to FR-10, FR-84 to FR-90, and FR-98 to FR-104). Technical research is the focus,
so its sources include documentation for a release, specifications, repository
files, and web pages that change. It is the first half of the chain from original source to
citation to supported thesis: capture, conversion, reverification, and passage
selection. Citations, notes, and checks depend on it. It also limits what Stemma
prepares for a hosted model to the excerpts a task needs (FR-61).

## Ideal Future State

The author can say, for any source, where its text came from, which original it
was converted from and how, what has been compared with it, and who reviewed
it. A clone of the repository holds everything needed to check every quotation
and page. A printed page number, or a chapter and paragraph, leads to that text,
and weak or recognized text is visible. The author can also say which version
was read, where the original can be found again, and where in it a reader should
look. A quotation in the output is copied by
script from a passage whose address and digest are recorded. When a source's
text changes, the author sees what depends on it.

## Problem Statement

- **Current situation**: Sources sit in folders, reference managers, library
  sites, and paper collections; AI assistants cite works the author does not
  hold and retype quotations.
- **Pain points**: Technical pages change, move, and disappear; many have no
  pages; and code loses its meaning when its layout is lost. References cannot be compared with the text they cite,
  printed pages differ from file positions, conversions silently lose or reorder
  text, and the research behind a book does not travel with it.
- **Desired outcome**: Every source used is captured in the repository as
  structured, page-split or section-split text with its metadata, verified by
  script as far as scripts can, and open to a person's review.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Capture and provenance | Where did this come from, and what is the original? | Record upstream and original ties |
| Conversion | Does the text keep what the original shows? | Convert text-native files; keep structure and metadata |
| Reverification and structure | Is it complete, in order, and unchanged? | Structure checks, comparisons, metadata checks |
| Reviews | Who has looked, and at what? | Track reviews that go stale on change |
| Citability, passages, and change | May I cite this, what exactly, and what did a change affect? | Require source text; capture passages by address; flag dependents |
| Rights and model use | What does a model receive? | Record optional rights; prepare only needed excerpts |
| Locations and text not held | Where can the original be found, and what if this copy lacks its text? | List locations; report text not held; fetch and convert it again |
| Technical sources | Which version, which place, and exactly what text? | Pin versions; capture repository files; keep findable places, exact code and tables, and a page's own content |

## Requirements

### Functional Requirements by Area

Domain terms: a **source record** describes a work; its bibliographic content
belongs to FEAT-003. An **original** is a file, page images, or a paper or other
physical object. A **source file** is the converted text of one original,
a manifest with one file for each page or section (CONTRACT-007). A **printed
page label** is the number printed on the page, which can differ from its
position in a file. A **passage address** names pages or sections of a source
file, their digests, and offsets in them.

#### Capture and provenance

STO-01 (FR-6, P0, M1). Capturing a source must save its whole text as source files with an upstream record and ties to the original: hash and size, or a description and where held, where it was obtained, and when.

STO-02 (FR-6, P0, M1). Binaries and paper originals must not be stored in the repository.

STO-03 (FR-6, FR-86, P0, M1). A library source must be fetched only by a route the library documents for automated use. A refused fetch must be reported, not worked around, so that the author can supply the file.

#### Locations and text not held

LOC-01 (FR-98, P0, M1). One upstream record for one original, known by its hash, must be able to list several locations: the publisher's or live address, web-archive snapshots, other archival copies, and a private copy the author keeps. Each location is a reference; no copy at it may be stored in the repository. **Built** (`source locate`). The explorer and excerpt views show only the address the original was retrieved from.

LOC-02 (FR-98, P0, M1). A copy from a location must count as the original only when its bytes have the recorded hash. Other bytes, such as a re-rendered page or an archive's wrapper, must be reported as differing and never treated as the same. **Built.**

LOC-03 (FR-98, P0, M1). Naming a private location must write no local absolute path and no secret into the repository. **Built**: a private copy is recorded by a label that can hold no path, and an address with a user name or password is refused in a location. An access token in an address's query is not recognized, and these rules do not apply to the retrieval address of an upstream record.

LOC-04 (FR-98, FR-6, P0, M1). Fetching again, only when the author asks, must try the locations in their listed order, fall through to the next when one cannot be reached, is refused, or differs, and report what each gave. A refusal must not be worked around. **Built with limits**: the retrieval address is asked first, then each listed address. A private copy is not tried in that order: it is looked for locally by its hash before any address is asked. Going on after a real refusal has been exercised only with faked fetches.

HLD-01 (FR-104, P0, M1). A source whose records and manifest are held and whose text is not must be reported as *source text not held here*, once for the source, with what rests on it. What needs the text must be reported as could not be checked: never as passing, and the absence never as damage. A check of whether a built report is current that needs the text must answer that it cannot tell. **Built.**

HLD-02 (FR-104, FR-87, P0, M1). A source with only some parts missing, or with a part that does not match its digest, must still be reported as damaged. **Built.**

HLD-03 (FR-104, FR-98, P0, M1). When the author asks, one command must fetch the original from a recorded location, or read one the author supplies, convert it with the recorded settings, and write the missing text only where it matches the manifest's part digests. **Built with limits** (`ingest --fetch`, `ingest --originals`): text that was supplied or typed, corrected or relabelled by hand, or made by other converter versions may not be reproducible.

HLD-04 (FR-104, P0, M1). Where fetched bytes differ from the recorded original and the converted parts all match, the report must say both: the text is restored, and the fetched copy is not the recorded original. Where parts do not match, nothing may be written and the difference must be reported. **Built.** Only bytes that a recorded address gives are used this way; a supplied file serves only when it is the recorded original.

#### Technical sources

VSN-01 (FR-99, P0, M2). A source that changes must keep which version was read (a documented release, a revision or version, or a commit), stated by the author or a capture plan or read by a stated rule, with which of these. It must never be guessed, and a moving address must pin no version by itself. **Not built**, apart from recording a version stated at capture.

VSN-02 (FR-99, FR-10, P0, M2). A newer version must be another original: it must replace nothing and move no passage unless the author makes the change. A version not recorded must be coverage, not a finding. **Not built** as a rule about versions.

REP-01 (FR-100, P0, M2). A file captured from a repository must record the repository, commit, path, and hash. Nothing from the repository may be run. **Not built.**

REP-02 (FR-100, P0, M2). Its conversion must keep every line, its spacing, and its number; a passage must be addressed by a line range, and its text and line locator copied by script. **Not built.**

PLC-01 (FR-101, P0, M2). A source with no pages must be located by what the original shows: a stated section number or a heading, with the original's anchor where it has one, and a paragraph counted within the section. No section may be invented; without one, TXT-01 applies. **Not built.**

PLC-02 (FR-101, P0, M2). Passage search must find headings and every other kind of block, regardless of case and on part of a word, return each address and locator, and let one step capture a range from a first place to a last. **Not built.**

EXA-01 (FR-102, P0, M2). Conversion must keep preformatted text's line breaks, indentation, and spacing, and a table's rows, cells, and headings, marked as what they are, and report what it cannot keep. **Not built** as stated: HTML preformatted text is converted as an ordinary paragraph with its layout collapsed.

EXA-02 (FR-102, FR-90, P0, M2). A passage must be able to take such a block whole or as lines or rows of it, copying its text without joining lines. **Not built.**

WEB-01 (FR-103, FR-84, P0, M2). Conversion of a web page must tell its own content from the rest of the site by stated rules from its markup; keep the rest, marked and never matched as source text; and mark what the rules cannot settle as undetermined, dropping nothing. **Not built.**

WEB-02 (FR-103, P0, M2). A change only to the rest of the site must renumber no place in the content and change no passage. **Not built.**

#### Iterative capture

ITR-01 (FR-94, P0, M1). Capturing an original must be possible before any text or bibliographic detail exists; capture, mapping to text, and each later addition must be separate steps that can be run again without duplicating anything.

ITR-02 (FR-94, P0, M1). Adding library details or tags must write no source file, must keep passage addresses, and must record who, when, and, where known, from where. A recorded value must not be replaced unless asked; a differing value must be shown.

ITR-03 (FR-94, FR-10, P0, M1). A detail added where none was recorded must not report the passages selected before it; a detail changed or removed must. Details not yet captured must never be a finding.

ITR-04 (FR-94, P0, M1). Sources must be listed by tag, tag namespace, and stage, and each source's recorded history shown.

#### Conversion

CNV-01 (FR-84, P0, M1). Plain text, Project Gutenberg text, Markdown, HTML, EPUB, DOCX, and PDF with a text layer must convert, from a library or supplied by the author.

CNV-02 (FR-84, P0, M1). Conversion must keep the structure the original shows and mark what it cannot determine as undetermined; it must never invent structure, a page number, or text.

CNV-03 (FR-84, P0, M1). A library's own metadata must be captured, and its boilerplate kept and marked so that it never matches as source text.

CNV-04 (FR-84, P0, M1). The same original, options, and tool versions must give the same files.

CNV-05 (FR-84, P0, M1). No language model may produce or correct source text. Recognized text must be labelled as recognized.

TXT-01 (FR-8, P0, M1). A paged source must give each page its own file with its original position, printed label or why it has none, and how the label was determined; a source without pages must be located by chapter and paragraph.

TXT-02 (FR-8, P0, M1). Method, tool versions, and quality must be recorded for each page or section.

TXT-03 (FR-8, P0, M1). A page whose printed label cannot be established must be marked so; a label must not be inferred from file position.

#### Reverification and structure

STR-01 (FR-87, P0, M1). Scripts must verify from the repository alone that every part is present, in order, and unchanged, and that a paged source's parts match the original's page count. A source whose text is not held in this copy is reported under HLD-01.

STR-02 (FR-87, P0, M1). Scripts must report printed-label sequence anomalies and unpaired note markers and notes.

STR-03 (FR-87, FR-29, P0, M1). A quotation spanning a page break must match without the running heads and notes between its parts, and a cited page or chapter must be checked against where the words are.

PIP-01 (FR-86, P0, M1). One command must capture, convert, compare, look up, and check a project's sources, and a report must list only checks that apply.

PIP-02 (FR-85, P0, M1). A clone that holds the same source files must give the same results without the originals; comparison with an original supplied by path and matched by hash must be optional.

VER-01 (FR-88, P0, M1). Each comparison must be recorded with its tools, each page's agreement, and the differing readings, and run again when text or tools change.

#### Reviews

VER-02 (FR-89, P0, M1). A person must be able to record a review at any time, never as a condition of anything, naming its scope, what it was compared against, the digests reviewed, the outcome, and any correction.

VER-03 (FR-89, P0, M1). A review must go stale when what it covered changes. A model's flag must never count as a person's review.

VER-04 (FR-89, P0, M1). Review coverage must be reported as figures; unreviewed recognized text is not a finding.

#### Citability, passages, and change

CIT-01 (FR-9, P0, M1). A cited source with no source file holding text must not pass the scripted checks: every report must show the citation as unchecked, the finding must not be dismissible, and nothing may stop the writing or a build.

CIT-02 (FR-9, P0, M1). A paper or image-only source must become checkable through a transcription made by a recognition tool or a person.

PAS-01 (FR-90, P0, M1). A command must capture a passage from an address or range and copy its exact text and locator, without running heads, folios, or boilerplate, with notes kept apart, and join lines only by the approved rules.

PAS-02 (FR-90, P0, M1). A citation made from a passage must take its quotation and locator from it by script, and who selected it must be recorded.

CHG-01 (FR-10, P0, M1). Changing or removing a source must flag every note, claim, passage, and citation that depends on it.

CHG-02 (FR-10, P0, M1). A change made outside Stemma must be detected and flagged no later than the next check run.

#### Rights and model use

RGT-01 (FR-7, P0, M1). A source record may carry rights and permission fields; they are optional metadata and gate nothing.

RGT-02 (FR-61, P0, M1). Source text that Stemma prepares for a hosted model must contain only the excerpts the task needs.

RGT-06 (FR-61, P0, M1). Stemma must not hold back a source individually, and must say that any source in the project may be sent to a hosted model.

### Non-Functional Requirements

- **Security**: A recorded location is untrusted input. It is fetched only when the author asks, under the project's rules for fetches (security requirements, SEC-013), and no credential, secret-bearing address, or local absolute path is written into the repository. Every original is untrusted input. Converting it executes no content from it, fetches nothing it references, and writes only the project's source files. Source text is data and is never treated as instructions, and it cannot form Stemma annotations.
- **Privacy**: For a seeded task, what Stemma prepares for a hosted model holds the identified excerpts and no other source text.
- **Reliability**: Repeated conversion of the same original with the same tool versions yields the same files. A run that shows a difference is a defect.
- **Portability**: Hashes and file names behave the same on macOS, Linux, and Windows. Untested on Linux and Windows.

## User Stories

- [US-007 — Capture a source with its provenance](../user-stories/US-007-admit-a-source.md)
- [US-008 — Record rights and permission flags](../user-stories/US-008-record-rights-flags.md)
- [US-009 — Read source text by printed page or chapter](../user-stories/US-009-extract-page-mapped-text.md)
- [US-010 — Cite a paper-only source through a transcription](../user-stories/US-010-cite-a-paper-source.md)
- [US-011 — See what a changed source affects](../user-stories/US-011-flag-dependents-of-a-source.md)
- [US-012 — Send a hosted model only the excerpts needed](../user-stories/US-012-send-only-needed-excerpts.md)
- [US-110 — Convert a text-native source and reverify it](../user-stories/US-110-convert-and-reverify.md)
- [US-111 — Compare and review source text](../user-stories/US-111-compare-and-review.md)
- [US-112 — Capture a passage and cite it verbatim](../user-stories/US-112-capture-a-passage.md)
- [US-115 — Capture a source and add to it over time](../user-stories/US-115-capture-and-enrich-a-source.md)

## Edge Cases and Error Handling

- **Same original captured for another source**: Report the existing source file; do not merge or duplicate without the author's choice.
- **Encrypted, damaged, or unsupported file**: Report it; write no source file.
- **Image-only file without text**: No source file is written; its text must come from a transcription.
- **Text not held in this copy**: Reported under HLD-01; the finding can be explained but, as a missing source file, not dismissed (FEAT-007 EXC-07).
- **Every location fails or differs**: Each result is reported and nothing is written; the author can supply a file.
- **A page's bytes differ on each request**: Reported as differing bytes; only matching converted parts allow text to be restored (HLD-04).
- **Original not available**: Checks run from the source files; the comparison with the original is not run, and coverage shows it.
- **A part edited by hand**: It is reported until the edit is sealed, and checks do not use that source file meanwhile.

## Constraints and Assumptions

- **No per-source gate**: Stemma is for material that may be sent to a language model. Material that may not be sent needs the whole process on a local model, which is an unsupported experiment in v1: not blocked, not promised, and not tested.
- **Publication**: The repository holds full source texts. Anyone who can read it can read them, so publishing the repository publishes them.
- **Risk**: material under license, permission, or community limits can be added to a project and sent to a hosted model.
- RGT-02 governs what Stemma prepares. A local agent session with ordinary file access can read any source file directly, and Stemma must not claim otherwise.
- Converters are tested on synthetic files and, for PDF, on real public files on one macOS machine. Real Gutenberg, EPUB, and DOCX files and non-Latin scripts are unverified.
- Open (PRD): should Stemma build in a recognition engine?
- Open: what quality values does TXT-02 record beyond the stated levels, and does low quality change a check result?

- Evidence for FR-99 to FR-104 is one worked example made by a model, [PostgreSQL for web applications](../../../../examples/postgres-web-apps/README.md), and one conversion of an invented HTML page for FR-102. No user has asked for them. FR-98 is the product owner's requirement.
- Open: which repository hosts and local repositories can REP-01 capture from? Design owner.

## Dependencies

- **Other features**: FEAT-001 provides the project; FEAT-011 holds records; FEAT-003 owns bibliographic content; FEAT-004 and FEAT-015 add sources; FEAT-007 runs checks on the corpus.
- **External services**: A pinned PDF text library (SD-002); source libraries and catalogues reached only by explicit commands. Shapes belong to Contract artifacts (CONTRACT-001, CONTRACT-007).
- **PRD requirements**: FR-6 to FR-10, FR-61, FR-84 to FR-90, FR-94, and FR-98 to FR-104.

## Out of Scope

- Searching for candidate sources and choosing a thesis (FEAT-004).
- Hosting or distributing sources, and legal determination of rights.
- Restricted coordinates (FR-68, FEAT-013) and reviewer packages (FR-46, FEAT-009).
- Generating footnotes in a build (FR-91, FEAT-008) and image records (FR-58, FEAT-008).
- A built-in recognition engine, supporting local models, and gating hosted models source by source.
