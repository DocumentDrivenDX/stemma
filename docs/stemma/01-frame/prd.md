---
ddx:
  id: stemma.prd
  type: prd
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.product-vision
kind: product
---

# Product Requirements Document

## Summary

Stemma is a Claude plugin that helps people research technical subjects, such as
databases, protocols, programming languages, systems, standards, and software,
and create academically rigorous research reports and books about them with AI
assistance. Their sources are documentation for a particular release, release
notes, specifications and standards, papers and preprints, source code and
repositories, and engineering write-ups. The plugin is the product: its command
line, and later its graph engine and explorer, exist to support it, and
installing the plugin is the only installation a person does. It keeps a
project's sources, passages, notes, claims, research constructs, methodology, and
places as an evidence graph in plain files. It checks citations with scripts
while the author works, takes over existing manuscripts, and typesets with Typst.
AI-written prose is allowed. Stemma reports what it finds and explains it. It
never stops the author from writing or building: every build completes with a
report, and is called checked clean only when nothing is open. What an AI
proposes takes effect at once, marked unreviewed, and review happens when the
author chooses. Stemma's records show what was checked; they are not
forgery-proof. The design starts with the AI-fluent technologist-researcher, the
first market. It also serves humanities scholars, cautious authors, and
researchers in other fields. Stemma is for material that may be sent to a
language model.

## What Stemma Does

Stemma keeps an unbroken chain from each original source to a citation to a
supported thesis, and lets a person verify every link:

upstream record (address, retrieval time, hashes) → source files (digests,
converter versions) → passage address and digests → citation record → claim →
sentence in the output → footnote.

Every link is deterministic and checkable from the repository. The only
non-deterministic step is writing the thesis, its support, and the discussion.
Stemma aims for that writing to be built from verified sources and set out so
that a reader can easily check them, with detailed footnotes that quote the
sources verbatim. Choosing which passages matter is judgment and is recorded as
such. The quoted text, locator, citation, and footnote are mechanical: a script
copies them from the records and source files. No model types or regenerates
quotation text.

Technical sources often have no pages, change between releases, and move or
disappear. For them the chain also has to say which version was read, where the
original can be found again, and where in it a reader should look. FR-98 to
FR-108 state this.

## Core Pipeline

Stemma's product is one pipeline that Claude drives for the author. Each stage
works from what the one before it saved in the author's repository.

1. **Capture** upstream sources: from a documentation site, publisher, library,
   or archive by the access route it documents for automated use, or as files the
   author supplies, each with a
   record of its address, retrieval time, content hashes, and identifiers. A
   refused fetch is not worked around; the author supplies the file.
2. **Convert and reverify**: each original becomes Markdown source files with
   bibliographic metadata, and the checks that apply are set up and run:
   structure, digests, page maps, comparison with the original when it is
   present, and metadata against what the copy says and against saved catalogue
   lookups.
3. **Research**: identify the research questions and capture the relevant
   references from the source files, each tied to a stable passage address.
4. **Assemble** the research outputs, with the context for each output built from
   fully supported references.

The author asks in plain words; the stages run without the author setting up
checks.

## Governing Principle: Verification

- Use a deterministic check wherever one is possible.
- Where none is possible, make the step re-runnable and re-checkable: several
  independent checks and comparisons, whose results are recorded and run again
  when inputs or tool versions change.
- A person can add a verification at any time. It is never a gate. Every review
  is tracked: who, when, what it covered, against which original and content
  digest, what it found, and any correction. It goes stale when the reviewed
  content changes.
- Prefer processes whose failures are recognizable transcription errors, such as
  a PDF text layer or a recognition engine, over generative ones. A language
  model does not produce or silently correct source text; it may flag a
  suspected error for review.
- The aim is to confine errors to ones that checks and reviews can find, and to
  tie research to output by building each output's context from fully supported
  references.

## Problem and Goals

### Problem

A technologist who researches a technical subject works from documentation,
release notes, specifications, papers, code, and engineers' accounts. A link in a
draft does not say which release or commit was read or what it said then, and an
unpaged page gives a reader no place to look.

AI assistants speed up literature search, note-taking, and drafting, and they
also invent references, attach real titles to the wrong authors, produce page
numbers outside a source's extent, fabricate quotations, and credit ideas to the
nearest plausible author. Authors who use AI openly catch these errors with
hand-built registers and chapter-by-chapter audits, and verifying a book-length
bibliography takes manual library look-ups. Scholars who lack that discipline either avoid AI or accept the risk.

### Goals

1. Let a technologist research a technical subject from the sources it has, and
   write an academically rigorous report or book about it in which each citation
   leads to the version that was read and to a place a reader can find.
2. Let an author use AI for research and composition at full speed, without
   being stopped, and see every citation that fails or cannot complete a check,
   explained in plain language, in the report of every build.
3. Keep the author in control of interpretation, structure, and disclosure.
4. Keep one source of truth from sources through notes, claims, and chapters to
   a typeset report or book.
5. Let an author start from a new project or from an existing manuscript.
6. Serve users with different levels of AI experience and different fields.

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Outputs with an open finding that are labelled checked clean | 0 | Check report written by the build |
| Findings without evidence, a reason they matter, and a suggested action | 0 | Report schema test and pilot review |
| Known error classes caught by the scripted checks | Every class in FR-29 detected on a seeded test set (hypothesis until measured on real files) | Regression suite of seeded errors |
| Pilot completion | One existing chapter taken over and checked by a pilot author (hypothesis) | Pilot study |
| Citations of a versioned technical source that do not say which version was read | 0 (hypothesis; needs FR-99) | A seeded technical report, and a pilot's |
| Cited places a reader cannot find in the original | 0 where the original shows a page, section, heading, or line (hypothesis; needs FR-100 and FR-101) | A hand check of a seeded technical report against its originals |
| Takeover citations linked to the wrong source (FR-92) | 0 | A hand-checked answer list for synthetic files, and a private one for the pilot's chapters |
| Time on manual citation checking | Reduced against the author's own baseline (hypothesis) | Self-reported before and after |
| Rebuild from the project files | A clone of the project that holds the same source files, with the same tool versions, gets the same scripted check results (hypothesis) | Release test on each supported system |
| Support-check accuracy (FR-52) | False-accept and false-reject rates published; no minimum is set until they are known | A labelled set with seeded errors and a pilot-author sample, run by hand because project automation makes no paid model calls (ADR-007) |

### Non-Goals

- Replacing the author's judgment. Interpretation, argument, and the decision to
  scrap a chapter stay with the author.
- Guaranteeing that a cited source is correct or well chosen. The checks compare
  a citation with a source file and passage. A support record states a model's
  judgment about whether the passage supports the claim.
- Proving that no record was altered. An agent or person who can edit the
  project files can change review marks, annotations, and support verdicts. Scripted checks are
  recomputed at build; model verdicts are not.
- Preventing a report or book with open findings from being published. The report and its
  label are the control.
- Proving that every assertion was checked. Text with no claim and no citation
  is not checked.
- Requiring authors to run continuous integration (CI) or a commit hook.
- Producing PDF/X files (the print-exchange standards).
- Supporting arbitrary layout in the manuscript beyond the defined features.
- Offering, in the first version, a mode that prevents the agent from writing
  manuscript text. Authors whose publisher bars AI-written text cannot rely on
  Stemma to enforce that rule.
- Promising full function in chat or cloud sessions.
- Controlling which sources reach a hosted model. Any source in a project may be
  sent. When material may not be sent, the whole process has to run on a local
  model.
- Supporting local models in the first version. Using one is an unsupported
  experiment: not blocked, not promised, and not tested.
- Exporting the manuscript to Word, LaTeX, or HTML in the first version.
- Promising right-to-left main text in the first version.
- Acting as a general writing assistant for non-scholarly text.
- Hosting or distributing sources. Source files live in the author's
  repository, and who can read it is the author's choice.
- Using a language model to produce or correct source text.
- Making extraction from scans and images the core of the product. Text-native
  sources come first; recognized text is supported, labelled, and checked.
- Training or fine-tuning models.

Deferred items are tracked in `docs/stemma/parking-lot.md`.

## Users and Scope

Personas differ in comfort with AI and in field. The first version is designed
around the AI-fluent technologist-researcher, the first market. Humanities
scholars remain a served field. Defaults for other personas add guidance. Authors
write research reports and books. Some personas are described through books; that
their needs also hold for research reports is an untested assumption. No persona
has been tested with a pilot.

Two worked examples run the chain on real sources: technical research,
[PostgreSQL for web applications](../../../examples/postgres-web-apps/README.md),
and a historical argument,
[Darwin and coral reefs](../../../examples/coral-reefs/README.md). An AI model
made both, and no person has reviewed their records. They are evidence of what
the tools did on those sources, not of any user's need or success.

### Primary Persona: Priya, the technologist-researcher

**Role**: Researcher or engineer who investigates technical subjects, such as
databases, protocols, languages, distributed systems, or machine learning, and
writes research reports and books about them from documentation, release notes,
specifications and standards, papers and preprints, source code, engineering
write-ups, and talks.
**AI comfort**: Very high. Works in git, CI, and a terminal daily.
**Goals**: Reach a defensible answer to a technical question and publish it with
citations a skeptical reader can follow. Treat the manuscript like a codebase:
checks in CI, reproducible builds, scripted checks, extensible tooling.
**Pain Points**: Sources include preprints, standards, repositories, and web
pages that change or disappear. Many have no pages. A summary from an assistant
may mix what different releases say. Few tools handle these sources with
page-level rigor (assumption).
**Needs**: Support for non-traditional source types; pinned versions of changing
sources, such as documentation for a named release or a repository at a commit;
places a reader can find; code, configuration, and tables quoted exactly; several
places an original can be found, a private copy among them; hooks and CI
integration; and the ability to extend the checks. Neither a hook nor CI is ever
required (FR-31).

### Secondary Persona: Idris, the AI-fluent humanist

**Role**: Humanities scholar leading a multi-chapter book project with a large
existing corpus and a research collaborator.
**AI comfort**: High. Writes standing instructions, runs separate sessions for
research and drafting, and drafts much of the prose with AI under disclosure.
**Goals**: Move faster, keep rival readings in every chapter, and keep a dated
trail of changes and errata across many sessions and collaborators.
**Pain Points**: Hand-maintained registers drift, and earlier versions become
hard to trace. Citation errors pass a quick check and fail only on a close read.
**Needs**: Takeover of existing work, configurable roles and rules, registers
that update with the work, strict checks, and a disclosure appendix generated
from the record.

### Secondary Persona: Margit, the AI-cautious humanist

**Role**: Senior professor of history writing a monograph from a career-long
personal collection of articles, scans, and notes.
**AI comfort**: Low. Has tried a chat assistant and distrusts it.
**Goals**: Use AI to find missed literature, draft from her own notes, and cut
the clerical load of citations, without risking her reputation.
**Pain Points**: Cannot tell which AI references are real without checking each
one. Does not want to manage prompts, sessions, or scripts.
**Needs**: Plain-language commands, safe defaults, checks that run for her,
clear explanations of every failure, and a record she can show a publisher.

### Secondary Persona: Tomasz, the scholar outside the humanities

**Role**: Social scientist or life scientist writing a book from journal
articles, datasets, and fieldwork.
**AI comfort**: Moderate. Uses AI for coding and summaries, not for drafting.
**Goals**: Keep data and figures tied to claims, use the field's citation style,
and meet publisher and journal disclosure rules.
**Pain Points**: Heavy reliance on a reference manager and a word processor.
Fear of a method that breaks the existing workflow.
**Needs**: Import from and export to common reference formats, support for
datasets and figures as sources, and Word and LaTeX exchange with co-authors
(manuscript export is deferred past the first version).

### Secondary Persona: Noor, the reviewer or editor

**Role**: Peer reviewer, developmental editor, or publisher's production editor.
**AI comfort**: Varies.
**Goals**: Decide whether to trust an AI-assisted manuscript and give useful
feedback.
**Pain Points**: Cannot see how the AI was used or whether the references hold.
**Needs**: A package with the PDF, the check report and its evidence, and the
disclosure, which accepts comments tied to claims.

### User Segments

| User | Context | Needs | Evidence | Confidence | Status |
|------|---------|-------|----------|------------|--------|
| Technologist-researcher | Git, CI, terminal; changing sources | Pinned sources, places a reader can find, exact code quotation, extensible checks, CI | None | low | assumed |
| Humanities scholar, AI-cautious | Personal corpus, word processor, little scripting | Safe defaults, plain-language workflow, explained failures | Unpublished input | medium | assumed |
| Humanities scholar, AI-fluent | Large corpus, multiple AI sessions, collaborators | Roles, registers, strict checks, disclosure | Unpublished input from one project | medium | assumed |
| Scholar outside the humanities | Reference manager, Word or LaTeX, datasets | Reference interchange, dataset sources, style support | None | low | assumed |
| Reviewer or editor | Reads and audits, does not write | Check report with evidence, disclosure, comments tied to claims | Unpublished input | medium | assumed |

### User Needs

| Need | Importance | Evidence | Confidence | Status |
|------|------------|----------|------------|--------|
| Research technical subjects rigorously and write reports and books about them | high | Product decision | high | validated |
| Say which version of a changing technical source was read, and hold what it said | high | One worked example made by a model; no user | low | assumed |
| Let a reader find a cited place in a source that has no pages | high | One worked example made by a model; no user | low | assumed |
| Quote code, configuration, and tables exactly | high | A check of one conversion rule; no user | low | assumed |
| Record several places an original can be found, a private copy among them, with no copy in the repository | high | Product decision | high | validated |
| Work with a copy of a project that does not hold some source's text, and fetch that text again | medium | One worked example made by a model; no user | low | assumed |
| Use AI without fabricated or misattributed citations | high | Kansa, "Archaeology in the AI Era", *Internet Archaeology* 71 (2026); unpublished input | high | validated |
| Keep AI search limited to sources the author has chosen | high | Unpublished input | medium | assumed |
| Keep interpretation with the author | high | Unpublished input | medium | assumed |
| Hear rival readings from a separate pass with fresh context | high | Unpublished input | medium | assumed |
| Trace every change and correction | high | Unpublished input | medium | assumed |
| Work without an external reference manager | high | Product decision | high | validated |
| Typeset a camera-ready report or book from the same files | high | Product decision | high | validated |
| Disclose AI use accurately and cheaply | high | Kansa (2026); unpublished input | medium | validated |
| Include sources in multiple languages with fair coverage | medium | Unpublished input | medium | assumed |
| Respect permissions on unpublished data and community knowledge | medium | Kansa (2026); unpublished input | medium | assumed |

## Requirements

Priorities: **P0** is required for the first version. **P1** is planned and does
not block the first version. **P2** is deferred.

A requirement marked **Not built** has no implementation in the plugin; where
part of it exists, the mark says which. A requirement without the mark makes no
statement about what is built; [build
iterations](../04-build/build-iterations.md) tracks that.

Delivery order for P0 work: **M1** checks, takeover, and basic PDF typesetting,
which is the first pilot; **M2** the path from a new project to a camera-ready
PDF; **M3** the explorer and maps. M1 does not wait for the graph engine or the
arras graph view. The graph engine and ChatGPT support are both P1, and neither
delays the pilot or the first Claude release.

### Must Have (P0)

1. A graph of plain-file records for sources, citations, evidence, constructs,
   and places (subsystems 2, 3, 5, and 11).
2. Scripted checks and claim-support records that run in the agent and at every
   build, with every finding explained (subsystem 7).
3. Takeover of a Word or born-digital PDF manuscript and its reference
   libraries, with a basic PDF of the result (subsystems 15 and 8).
4. Project setup, research discovery, and composition from the claim ledger
   (subsystems 1, 4, and 6).
5. Typst output, audit, disclosure, and a reviewer package (subsystems 8 and 9).
6. A plugin installable for Claude desktop's local Code tab on macOS and Windows,
   with the scripted tools also running on Linux (subsystem 10).
7. Voice and style profiles (subsystem 14).
8. An explorer with linked typeset pages, an in-browser Typst preview, reviewer comments, and
   argument and geographic maps (subsystems 9, 12, and 13).
9. Research from technical sources: several locations for an original, pinned
   versions, repository files, places a reader can find, exact code and tables,
   a web page's own content, text not held in a copy, and technical citation
   forms (subsystems 2, 3, 7, and 8: FR-98 to FR-104 and FR-106 to FR-108).

### Should Have (P1)

1. A graph engine compatible with arras, first for the reads its static browser
   needs (subsystem 11).
2. Full function in ChatGPT and Codex local sessions.
3. Further governance records and image records.
4. Creating the records behind a report in one run (FR-105).

### Nice to Have (P2)

1. Citation styles beyond Chicago notes and bibliography.
2. Supported local open-weight model use for material that may not be sent to a
   hosted model.
3. Dataset and figure provenance beyond file hashes.
4. Several authors editing one corpus at the same time.
5. Word, LaTeX, and HTML export (FR-40), deferred past the first version.

## Functional Requirements

Each requirement carries its priority and, for P0, its delivery step.

### Subsystem: 1. Workspace and governance

- **FR-1** (P0, M2) — Starting a project captures the thesis, audience, scope, and citation style, and creates the standing rules, changelog and errata records, decision log, and registers. A taken-over project gets the same records once this requirement arrives; in M1, takeover needs only the standing rules of FR-2. Registers vary by persona only once persona defaults exist (FR-51, P1).
- **FR-60** (P0, M2) — Starting a project asks for the theoretical constructs and the research methodology alongside the thesis. Both are optional, and the author can add or revise them at any time. Checks and review steps that depend on them run only once they exist.
- **FR-2** (P0, M1) — The standing rules are plain text the assistant reads at the start of every session, and each rule has an identifier that checks and reports cite. Every project has them from M1, including one begun by takeover.
- **FR-3** (P1) — When a recorded decision changes, a check lists the documents that declare a dependency on it and have not been updated since.
- **FR-4** (P1) — Each document has a single canonical location, and a check detects two documents that declare the same identity.
- **FR-5** (P1) — The project records which AI roles exist, what each may read and write, and which checks each runs. The record is guidance and is not an access control.

### Subsystem: 2. Source corpus

- **FR-6** (P0, M1) — Capturing a source saves its whole text in the project as Markdown source files, in the format of CONTRACT-007, with the bibliographic identity the copy states (such as ISBN, DOI, library identifiers, and edition) and ties to the original: content hash and size of each original file, or a description of a paper or physical original and where it is held, and where and when it was acquired. An upstream record holds the address it came from, the retrieval time, hashes, and identifiers; FR-98 lets it list further locations. Binaries and paper originals are not stored in the repository.
- **FR-7** (P0, M1) — A source record may carry rights and permission fields, including unpublished-data and community-permission flags. They are optional metadata and gate nothing.
- **FR-8** (P0, M1) — A paged source maps its text to printed page labels page by page, and a source with no pages is located by its structure, such as chapter and paragraph; no page number is invented. Each page or section records its extraction method, tool and version, and quality.
- **FR-9** (P0, M1) — A cited source with no source file holding text cannot be checked: every report says so and shows the citation as unchecked, and such a finding cannot be dismissed. A source that exists only on paper or as page images becomes checkable through a transcription made by a recognition tool or a person.
- **FR-10** (P0, M1) — Changing or removing a source flags every note, claim, and citation that depends on it.
- **FR-84** (P0, M1) — Stemma converts text-native originals into source files: plain text, Project Gutenberg text, Markdown, HTML, EPUB, DOCX, and PDF with a text layer, from a library or supplied by the author. Conversion keeps the structure the original shows (headings, chapters, paragraphs, notes, quotations, tables, captions, figures, page markers) and a library's own metadata, keeps a library's boilerplate marked so that it never matches as source text, marks structure it cannot determine as undetermined, and gives the same files for the same original, options, and tool versions. Recognized text is labelled as such.
- **FR-85** (P0, M1) — Checks, excerpts, builds, and the explorer read the source files, so a clone that holds the same source files reproduces their results; FR-104 covers a copy that does not hold some text. Verifying a source file against its original, supplied by path and matched by hash, is optional.
- **FR-86** (P0, M1) — Stemma runs the capture, conversion, and reverification of a project's sources from one command, and sets up and runs every check that applies to what the project holds. A report lists only checks that apply to the project's contents.
- **FR-87** (P0, M1) — Scripted structure checks verify from the repository alone that each source file is complete and unchanged: parts in sequence with none missing against the original's page count, part digests, printed-label sequence anomalies, and paired note markers and notes. A quotation that spans a page break is matched across the pages, without running heads and notes between them, and a cited page or chapter is checked against where the quoted words are.
- **FR-88** (P0, M1) — Each comparison of source text, such as a fresh conversion of the original or a second text of the same work, is a recorded run with each page's agreement and the differing readings. It is run again when the text or the tools change.
- **FR-90** (P0, M1) — Whoever selects evidence gives a passage address or range; a command captures the passage and copies its exact text and its locator from the source file, leaving out running heads, folios, and boilerplate, keeping footnotes apart, and joining lines only by the approved quotation rules. A citation made from a passage takes its quotation and locator from it. Who selected it is recorded. A later change to the pages or sections it lies in, or a quotation or locator that differs from them, is reported.
- **FR-91** (P0, M2) — A built output's footnotes, and its endnotes (FR-96), are generated by script from the records: the full citation, the locator, the verbatim quotation, and the passage address.
- **FR-89** (P0, M1) — A person can record a review of source text at any time: who, when, what it covered (page, passage, quotations, page number, or source details), against which original and content digest, the outcome, and any corrections. A model's flag is recorded as such and never counts as a person's review. A review goes stale when the reviewed content changes. Stemma reports review coverage; recognized text that no one reviewed is a coverage figure, not a finding.
- **FR-94** (P0, M1) — A source is captured iteratively: capturing its original, mapping it to text, adding library details (identifiers and saved catalogue or DOI lookups), and tagging it (free or namespaced tags) are separate steps, each of which can be run again, and a source is usable after any of them. Each addition records who made it, when, and, where known, from where. A recorded value is never replaced unless the author asks, and a differing value is shown beside it. Adding details or tags changes no source file or passage address, requires no reconversion, and is not by itself a change that dependants are reported for; details not yet captured are never a finding. Sources can be listed by tag and stage, and each source's recorded history shown.
- **FR-61** (P0, M1) — What Stemma prepares for a hosted model holds only the excerpts a task needs. Stemma does not gate individual sources: any source in a project may be sent.
- **FR-98** (P0, M1) — One upstream record, for one original known by its hash, can list several locations for it: the publisher's or live address, web-archive snapshots, other archival copies, and a private copy the author keeps. A location is a reference; no copy at any location is stored in the repository. The recorded hash confirms that a copy has the same bytes. A location that gives other bytes, such as a re-rendered page or an archive's wrapper, is reported as differing and never treated as the same. Naming a private location writes no local absolute path and no secret into the repository. Fetching again, when the author asks, tries the locations in their listed order, falls through to the next when one cannot be reached, is refused, or differs, and reports what each gave. A refusal is not worked around (FR-6). **Not built.**
- **FR-99** (P0, M2) — A source that changes keeps which version was read, with the retrieval time and hash of FR-6: the release a documentation page describes, the revision or version of a specification, standard, or preprint, or the commit of a repository. The version is stated by the author or a capture plan, or read from the original or its address by a stated rule, and the record says which; it is never guessed. An address that moves, such as a "current" documentation address or a branch, pins no version by itself. A built citation shows the recorded version. A newer version is another original: it replaces nothing and moves no passage unless the author makes the change, which FR-10 then reports. A version not recorded is coverage, not a finding. **Not built**, apart from recording a version stated at capture (CONTRACT-007 C); no rule checks or reads one, and its appearance in every built citation is unverified.
- **FR-100** (P0, M2) — Source code and other text files from a repository are captured as sources. Each records the repository, the commit, and the file's path in it, with the hash of its bytes. Conversion keeps every line, its spacing, and its line number. A passage is addressed by a line range, and a script copies the lines and a locator that names them. Nothing from the repository is run. **Not built**: no capture records these, and no source is located by line.
- **FR-101** (P0, M2) — A source with no pages is cited by a place a reader can find in the original: the section number the document itself states, as specifications and standards do, or the section heading, with the original's own anchor where it has one, so that a link can open there. A paragraph is counted within that section, not over a whole web page. A script copies the locator from what the original shows and invents none; where it shows no section, the chapter or paragraph of FR-8 remains. Passage search finds headings and every other kind of block, matches regardless of case and on part of a word, and returns each match's address and locator; one step captures a range from a first place to a last. **Not built**: a web page without chapters is located by a paragraph number counted over the whole converted page. A built citation does label that number as a paragraph.
- **FR-102** (P0, M2) — Conversion keeps code blocks, command output, configuration, and tables as the original shows them: the line breaks, indentation, and spacing of preformatted text, and the rows, cells, and headings of a table, each marked as what it is. What cannot be kept is reported. A passage can take such a block whole or as lines or rows of it, and its text is copied without joining lines. **Not built** as stated: preformatted text in an HTML page is converted as an ordinary paragraph, with its line breaks and indentation collapsed; tables are kept as rows, and their fidelity is unverified.
- **FR-103** (P0, M2) — For a web page, conversion tells the page's own content from the rest of the site, such as navigation, sidebars, footers, lists of related posts, and banners, by stated rules from the page's markup. The rest is kept, marked, and never matched as source text, as a library's boilerplate is (FR-84). What the rules cannot settle stays source text, marked undetermined, and nothing is dropped. A change only to the rest of the site renumbers no place in the content and changes no passage. **Not built**: all of it is ordinary source text. That it can shift paragraph numbers between fetches is inferred, not observed.
- **FR-104** (P0, M1) — A copy of a project may hold a source's records and manifest and not its text. This is an ordinary state, *source text not held here*. Reports say so plainly, once for each source with what rests on it. What needs the text could not be checked: it is never reported as passing, and the absence is not reported as damage. It counts as could not check (FR-30), and a check of whether a built report that needs the text is current answers that it cannot tell. A part that is present and does not match its digest is still damage (FR-87). When the author asks, one command fetches the original from a recorded location (FR-98), or reads one the author supplies, converts it with the recorded settings, and writes the missing text only where it matches the manifest's part digests. Where fetched bytes differ from the recorded original, as when a page differs on each request, and the converted parts all match, Stemma says exactly that: the text is restored, and the fetched copy is not the recorded original. Where the parts do not match, nothing is written and the difference is reported. **Not built**: such a source is reported as damaged, with advice to restore it from git, and a failure for each missing part; `ingest --fetch` writes no text back; a quotation whose text is absent is reported as unreadable, not as changed.

### Subsystem: 3. Citation store

- **FR-11** (P0, M1) — Stemma records are the official bibliography: plain text owned by the project, one record per source. No external reference manager is needed to create, read, or build them.
- **FR-12** (P0, M1) — Records support the source types in the supported fields, including books, chapters, articles, theses, reports, archives, datasets, web pages, and code.
- **FR-13** (P0, M1) — Importing a BibLaTeX, CSL-JSON (Citation Style Language data), or RIS (a tagged reference format) library and exporting the same format keeps all of its information, including unrecognized fields and comments. Layout, field order, shortcuts, and comment positions may change. Exporting Stemma data to a legacy format may omit what that format cannot hold.
- **FR-14** (P0, M1) — In-text citations use stable keys with typed locators. The citation style is a project setting.
- **FR-15** (P0, M1) — Each entry in a built bibliography is meant to be cited in the text. The built bibliography is made from the sources the text cites, plus any source the project lists for inclusion; the corpus may hold other sources. A listed source that is cited nowhere is reported until it is cited, removed from the list, or dismissed with an annotation (FR-32). A taken-over project lists every entry of the original reference list (FR-72).
- **FR-106** (P0, M2) — Notes and bibliography have a form for each kind of technical source: software, source code at a commit, datasets, specifications and standards (requests for comments among them), preprints at a version, documentation for a named release, and web pages, including those whose author is an organization. A record holds what its form needs, such as a version, commit, document number, issuing body, status, or identifier, and citeproc-js formats it in the project's style. Forms are labelled unverified until examples are approved (FR-38). **Not built** as stated: records of many types exist (FR-12) and the formatter accepts them; no set of technical forms has been defined or compared with a style manual.

### Subsystem: 4. Research and discovery

- **FR-16** (P0, M2) — The assistant can search, within limits the author sets, and returns candidates marked as not yet decided by the author. A cited candidate is reported as unreviewed.
- **FR-17** (P0, M2) — Adding a candidate runs source acquisition and the corpus checks and records the search query. Admission is the author's decision, recorded when they choose to admit or reject it. No check result withholds it, and it does not require rights fields to be filled.
- **FR-18** (P1) — Searches and decisions are logged so that coverage can be reviewed, including by language, period, and region.
- **FR-19** (P0, M2) — The assistant can be directed to search the project's source files first and to report what the corpus does not contain.

### Subsystem: 5. Notes, claims, and constructs

- **FR-20** (P0, M1) — A reading note anchors each extract or paraphrase to a source and a locator, and the extract matches the source text. A passage keeps a stable address and the digests of the pages or sections it lies in, so an output can be tied exactly to it.
- **FR-21** (P0, M1) — A claim-ledger entry links a claim to one or more notes, with a confidence level and the reason the sources support it.
- **FR-22** (P0, M2) — A construct register holds each concept the work uses, with its definition and the chapters that use it. A construct taken from a source names that source. The author's own construct is marked as the author's and requires a definition. Author-stated constructs from FR-60 are entries in the same register. Scripts check references to constructs. The agent advises on inconsistent use of a construct or of the methodology; that advice is not a finding.
- **FR-23** (P0, M1) — Notes, claims, and constructs that the assistant proposes take effect at once, marked unreviewed. The author reviews or corrects them whenever they like, one at a time or in batches, and every report shows what is unreviewed. The author's own edits keep a reviewed item reviewed; a change made by the AI marks it unreviewed again. A review mark records what the author said and is not proof of who wrote it.
- **FR-80** (P0, M2) — The claim ledger records whether a linked note supports or opposes a claim, and records relations between claims, including support, objection, and rival reading, and which claim is the thesis.
- **FR-105** (P1) — The records behind a report can be created in one run, from a file that lists notes, claims, attestations, and citations, including the report's sentences with the passages each cites. Each record is validated, attributed to its actor, and marked unreviewed as usual (FR-23); quotations and locators are copied by script (FR-90). The run says which entries it did not write and why, and invents no confidence, reason, or link. **Not built**: records are added one at a time.

### Subsystem: 6. Composition

- **FR-24** (P0, M2) — The system derives an outline and chapter specifications from the thesis, audience, scope, ledger, and, when they exist, the constructs and research methodology. Drafting can use them at once; they are marked unreviewed until the author reviews them.
- **FR-25** (P0, M2) — Drafts are written from ledger entries. A drafted assertion that the author or assistant marks as needing a source carries a citation key and locator.
- **FR-26** (P1) — Each chapter can carry a section of alternative interpretations, drafted as adversarial counter-arguments.
- **FR-27** (P1) — The author can mark which passages were AI-drafted, human-written, or edited, and the record is kept per version.
- **FR-28** (P1) — Interpretive checkpoints ask for the author's input at points in a chapter, with a setting for how many apply; a fluent author may turn all of them off. A checkpoint never halts work; an unanswered one is reported.

### Subsystem: 7. Verification and reports

- **FR-29** (P0, M1) — Scripted checks detect each of these error classes, or report that they cannot check it:
  - citation key with no bibliography entry;
  - bibliography entry with no citation;
  - quotation absent from the source text, or not on the page or chapter cited;
  - locator outside the cited work's printed page range or other recorded extent;
  - author, title, year, or venue that disagrees with what the copy says or with a
    saved catalogue lookup;
  - identifier such as a DOI that does not resolve or resolves to a different
    work;
  - a quotation that duplicates the work's own argument;
  - a figure or statistic attributed to a source that does not contain it,
    where the text can be matched;
  - a construct credited to someone other than its registered originator.

  The construct-credit check arrives with the construct register (FR-22) in M2;
  the other classes are M1. A quotation or note extract passes only when it
  matches the source text apart from these harmless differences: white space and
  line breaks; soft hyphens; Latin presentation ligatures; Unicode canonical
  equivalence; straight and curly quotation marks of the same level; and a word
  split by a hyphen at a line end, which is joined. For preformatted text, FR-107
  narrows this list. The list is approved and untested. Any other near
  match is reported with both texts until it is fixed or the author dismisses it
  with an annotation (FR-32).
- **FR-30** (P0, M1) — Each scripted check reports pass, fail, or unverifiable
  with the evidence. No finding about a citation, claim, quotation, source,
  support record, bibliography, image, coordinate, or the working tree stops
  writing or any build. A finding is evidence that something is wrong, with
  something to do about it. It is open when it fails, or when a check that
  applies to what an output relies on could not run, and the author has not
  dismissed it. Reaching checked clean never requires a person's review,
  approval, or dismissal where the checks can account for what they see. What
  nothing shows or contradicts, including metadata not yet captured, is
  coverage: the report states it and asks nothing of anyone. A source is valid
  at every stage of capture. An output is called checked clean only when no
  finding is open. The label reflects checks only: unreviewed items do not count
  as open, and every report counts them separately. "Unverified" means only that
  something has not yet been checked; it is not open by itself. A report lists a
  check only when it applies to what the project holds; a check that applies and
  cannot be run counts as open. Source details (author, title, year, venue) that
  a copy's recognized title page text does not show are corroborated from
  independently recorded evidence, such as saved catalogue lookups; a
  contradiction is a finding. A person may also record what the title page or
  equivalent shows (FR-89), which is then shown as confirmed by the author, not
  verified. A mismatch stays reported until fixed or dismissed.
- **FR-31** (P0, M1) — Checks run inside the agent as the work changes, covering the
  changed records and the records that depend on them. Every build reruns every
  scripted check over the whole project. Neither a commit hook nor CI is
  required.
- **FR-32** (P0, M1) — The author may annotate any finding to explain it or to
  dismiss it, with a reason. An annotation is optional and permits nothing,
  because nothing is blocked. It is a dated record bound to the exact sentence
  and source, or, for a finding with no sentence, to the exact item and its
  current content; it ends when what it is bound to changes. Reports and the
  disclosure list it. A missing source file, an unreadable record, and
  uncommitted changes can be explained but not dismissed (assumption). The
  record states intent and is not forgery-proof.
- **FR-33** (P0, M1) — Checks run offline against the project's source files.
  Catalogue and identifier lookups use the network only when run explicitly, and
  their responses are saved in the repository with the query and date; the checks
  that read them run offline.
- **FR-34** (P0, M1) — Scripted checks are deterministic: the same inputs and tool
  versions give the same results, and a seeded-error test set verifies each
  check. A model judgment is never a scripted check result.
- **FR-74** (P0, M1) — Every finding says in plain language what is wrong or
  could not be checked, shows the evidence, says why it matters, and suggests
  what to do. The agent explains it, offers fixes, and acts on the author's
  choice when the author makes one, without making the author choose before
  other work continues. It reports a scripted result as the script gave it. An
  unexplained, repetitive, or unactionable finding is a Stemma defect.
- **FR-52** (P0, M1) — A claim-support check compares each claim with the source passage
  it cites and reports supported, partly supported, or unsupported, quoting the
  passage. It runs in a context separate from the one that drafted the claim, and
  it reports a claim that goes beyond, overstates, or reverses its source. Its
  accuracy is measured on a labelled set with seeded errors and on a
  pilot-author sample. The error rates are published, and any minimum is set
  afterwards.
- **FR-53** (P0, M1) — Missing, stale, partly supported, and unsupported claim
  support is reported, during work and in every build; it stops nothing. A cited
  claim is a claim in effect that is linked to manuscript text holding a
  citation. Reports also show a citation linked to no recorded claim, so that
  the author can link it; text linked to a retired claim; and a cited claim that
  reaches no source passage, as unsupported. A build checks that support records
  are present, current, and what they found. It does not call a model or rerun
  verdicts.
- **FR-54** (P0, M1) — A support record stores the model, the prompt version, the claim
  text, the passage, and the source hash. It becomes stale when the claim, the
  passage, or the source changes. A change to a manuscript sentence alone, with
  the recorded claim unchanged, leaves it current, so a sentence can come to say
  more than the judged claim and still pass.
- **FR-107** (P0, M1) — Scripted checks read technical sources and writing as what they are. The figure and statistic check of FR-29 does not take a software version, a section or standard number, or another identifier for a figure to find in the cited source; it does so by a stated rule, and the report says what it left out. In a quotation of preformatted text, line breaks, indentation, and spacing are not among the harmless differences of FR-29, apart from the style of line ending. Bibliographic details of a web page are corroborated from what the page states about itself, such as its heading, byline, and date, not from its navigation or a title shared by the whole site; a detail it does not show is coverage, and a contradiction is a finding (FR-30). **Not built.**

### Subsystem: 8. Typesetting and publishing

- **FR-35** (P0, M1 for the working copy and the features FR-83 uses; M2 for the full structure) — The manuscript working copy is marked-up Markdown with citation and claim markers, converted to Typst. Takeover first writes it in M1 (FR-73). Only defined layout features are supported. Manuscript content carries the structure needed for professional typesetting: sections, front and back matter, footnotes and endnotes, figures with their alternative text, tables, captions, cross-references, block quotes, and index entries.
- **FR-96** (P0, M1, and M2 where the footnote feature it follows is M2) — Endnotes are handled wherever footnotes are. Whatever Stemma reads, records, checks, shows, or typesets in a footnote, it does the same for an endnote: in Word and PDF takeover, the Stemma copy, binding and linking, every check, and every build. Each note keeps its kind, and nothing turns one kind into the other. In this document and its features, "note" means either. Where a form of endnote cannot be recognized, Stemma says so and drops no text.
- **FR-36** (P0, M2) — A build uses Typst to produce a camera-ready PDF with running heads, folios, a table of contents, a formatted bibliography, and an index. citeproc-js formats citations before Typst lays out the book.
- **FR-83** (P0, M1) — The pilot typesets a taken-over manuscript from the Stemma copy (FR-73) to a basic PDF with Typst, with citations and the bibliography formatted by citeproc-js. A watermarked draft or an unwatermarked basic PDF can be built whatever the findings, each with its report and label (FR-39). Neither is a print-ready book: the apparatus of FR-36 and the print output of FR-57 are not part of it.
- **FR-37** (P0, M2) — The first version builds left-to-right books that contain right-to-left quotations, including the multiple scripts and transliteration they use. Right-to-left main text is experimental: not promised.
- **FR-38** (P0, M2) — Style, trim size, fonts, and citation style are project settings with documented defaults. The first version ships three trim sizes: 6 x 9 in, 5.5 x 8.5 in, and A5. It guarantees Chicago notes and bibliography against examples approved by someone holding the style manual, and labels other styles unverified.
- **FR-39** (P0, M1 for the draft and basic PDF builds of FR-83; M2 otherwise) — Every draft, camera-ready, and reviewer build completes with a plain-language report of what is open and how many items are unreviewed, and is labelled checked clean only when no finding is open (FR-30). Only an ordinary tool failure, such as a compile error, stops output. A build records the commit, tool versions, and whether the project had uncommitted changes; for camera-ready and reviewer builds, uncommitted changes are reported as a finding. A draft carries a visible unverified watermark. Camera-ready pages carry no mark; the report states their status. An output with open findings is not presented as checked clean.
- **FR-108** (P0, M2) — A build prints a quotation of preformatted text or of a table as a block, in a note or in the body, with the passage's lines, indentation, rows, and cells, and sets code in a fixed-width face. It never reflows or retypes it. Where an output cannot keep the layout, the build says so and does not present the altered text as exact. **Not built.**
- **FR-40** (P2) — Deferred past the first version: the same source also builds a reviewer-friendly format for co-authors and publishers who need Word, LaTeX, or HTML.
- **FR-55** (P0, M2) — Raster images are placed without resampling. The build reports each image's effective resolution at its placed size and any image below the project's print threshold. TIFF and EPS images are converted by a recorded step before placement.
- **FR-56** (P0, M2) — Vector images stay vector in the output PDF, with fonts embedded or converted to outlines. A converted EPS image that cannot stay vector is reported.
- **FR-57** (P0, M2) — The build produces an ordinary print PDF with trim size and bleed area, and a separate archival PDF to the PDF/A standard, the first special PDF standard, for black-and-white or RGB books. The PDF carries the alternative text of FR-35, and the build reports figures that lack it. If the pinned typesetting tool cannot produce the PDF/A, for example from some placed figures or without alternative text (unverified), that is a limit of the tool: the build says so and still produces its other outputs. No output is claimed to conform to PDF/A or to be accessible unless that has been verified. An accessible PDF standard is not promised. The build does not produce PDF/X.
- **FR-58** (P1) — Each image has a record with its source, credit, rights, permission, caption, alternative text, and the figure identifier used in cross-references. A check reports an image that lacks credit or recorded permission.

### Subsystem: 9. Evolution, audit, and review

- **FR-41** (P1) — Each camera-ready or reviewer build is meant to have a dated changelog entry for its version; the report shows a missing one. Draft builds need none.
- **FR-42** (P1) — Errors found are recorded in an errata register with the date, cause, and fix.
- **FR-43** (P0, M2) — A chapter audit runs rival readings first and citation repair second, and marks each finding confirmed or suspected. Each rival reading is recorded as a claim related to the claim it answers (FR-80), in effect and marked unreviewed (FR-23).
- **FR-44** (P1) — A fresh-eyes review runs in a separate context from the one that drafted the chapter.
- **FR-45** (P0, M2) — The system generates an AI-use disclosure that states which models and rules were used, what the AI did, what remains unreviewed, how many findings are open, and which annotations explain or dismiss findings. It states that support verdicts were not rerun at build and that review marks and annotations are not forgery-proof. The disclosure is separate from the book's research methodology.
- **FR-46** (P0, M3) — A reviewer package holds the PDF, an offline explorer file, the check report, and the AI-use disclosure. It holds no source files unless the author asks to include them; source text quoted as evidence in the report is kept to short excerpts, and each result stays visible. How short has not been set. Rights fields change nothing in it. Structured restricted coordinates are left out of every item. Longer source text that cannot be removed from what is packaged, such as in the PDF, and stray restricted coordinates, such as one typed in prose, are reported with a warning. The package is still produced, so it can disclose a restricted site's position. Without the source files, a reviewer cannot rerun the checks.
- **FR-79** (P0, M3) — In the reviewer package's offline explorer, a reviewer attaches comments to claims and saves them to a file that the author imports. Importing changes no claim, check result, or annotation.
- **FR-97** (P1, M1 for the report of CONTRACT-006 I) — A report build writes an evidence ledger: for each sentence of the report's body and note comments, who is recorded as having written its words, what source evidence is tied to it, how far that evidence was compared with originals, and whether anyone judged that it supports the sentence, with totals that can be recomputed from the sentences. A record of who wrote a sentence counts only for the report version it was made for. The ledger also names every open check and every dismissed result, and counts the unreviewed records. Anything unrecorded is shown as unrecorded and never assumed human-written. It gives counts, never a probability or score of hallucination, and is meant for another tool, such as Innsigle, to sign.
- **FR-47** (P1) — When the thesis, a construct, the methodology, or evidence changes, a check lists the chapters, claims, and registers that need re-review.

### Subsystem: 10. Plugin, skill, and distribution

- **FR-48** (P0, M1) — Stemma ships as one public skill with modes. The modes cover starting a project, takeover, research, notes, outlining, drafting, voice and style, verification, building, audit, and review.
- **FR-49** (P0, M1) — The scripted checks and the build run from a command line without an AI. The command line is how the plugin and its tests use Stemma's functionality; it ships inside the plugin and is not installed or set up by hand. Every function of Stemma is available on the command line first, and a user interface supports the same functions for ease of use; no function exists only in an interface. A function arrives on the command line no later than in an interface.
- **FR-50** (P0, M1) — Stemma is published as `plugins/stemma` in the DocumentDrivenDX/plugins marketplace repository and installs from it with `claude plugin marketplace add DocumentDrivenDX/plugins` and `claude plugin install stemma@documentdrivendx`; Claude desktop installs it from the same marketplace, and an official directory listing comes later. Installing the plugin is the only installation step a person takes. The bundled command line is not committed to the Stemma repository; a release copies the built, versioned release tree into the marketplace repository. The first version promises full function only in the local Code tab of Claude desktop on macOS and Windows; it makes no desktop-app promise on Linux. Other sessions, including the Claude command-line tool, get no promise of local checks or builds. The command-line tool may serve as a test harness; its results do not verify the desktop app.
- **FR-77** (P1) — The marketplace plugin installs in ChatGPT desktop and gives full function in ChatGPT and Codex sessions that run on the author's computer.
- **FR-51** (P1) — Persona defaults control onboarding, explanation level, and number of checkpoints, and every default can be overridden. No default hides a finding or changes when an output is called checked clean.
- **FR-75** (P0, M1) — Deterministic scripts and tools run natively on macOS, Linux, and Windows, including on Linux without a desktop app; no required feature needs the Windows Subsystem for Linux (WSL) or Docker. The plugin uses one pinned version of the Bun runtime. The plugin and Claude obtain it, and any other tool the product needs, themselves: a pinned download, verified against a digest, kept in the plugin's own data directory, with no change to the system or a shell profile, no step for the author, and the host's permission prompts left in force. Every tool is pinned and recorded.
- **FR-78** (P0, M1) — The project's own tests show that the plugin installs and loads in each promised host, and that the scripted tools run on each supported system. A local script runs during development. The three supported systems are tested only for release tags, and those results are advisory and stop no work. A result from the Claude command-line tool does not count as a desktop observation.

### Subsystem: 11. Evidence graph and graph engine

- **FR-62** (P0, M1) — References and supporting data form one graph: sources, source files, upstream records, saved lookups, text reviews, comparison runs, passages, notes, claims, support records, constructs, methodology, places, chapters, searches, annotations, confirmations, admission decisions, takeover findings, the author's round choices, and imported reviewer comments. Each record is one plain JSON file whose structure is defined in UMF (the DocumentDrivenDX schema format); a source file is Markdown whose front matter is such a record, with one file for each page or section (CONTRACT-007). The files are the source of truth, and every index and graph database can be rebuilt from them.
- **FR-63** (P1) — A graph engine compatible with arras (the DocumentDrivenDX graph application), written in TypeScript on Bun and SQLite, serves the graph from a rebuildable database. Its first scope is the data reads that arras's static browser needs. Writes and wider server compatibility come later.

### Subsystem: 12. Explorer and typeset preview

- **FR-64** (P0, M3) — A visual explorer built on arras browses and searches the graph record by record, from a browser graph that is generated from the record files, not committed to the repository, and rebuilt when needed, and shows a connected-graph view larger than arras offers today. That view is contributed to arras before the explorer relies on it.
- **FR-65** (P0, M3) — The explorer shows the typeset pages, moves from a sentence to its claim and evidence and back, and compiles Typst in the browser to make preview pages. When the author edits, the agent rebuilds the offline preview and the author reloads it; the reloaded page compiles the rebuilt text. An open page does not update by itself.
- **FR-76** (P0, M3) — All exploration and rendering code the project writes is TypeScript bundled to run in a browser.

### Subsystem: 13. Argument and geographic maps

- **FR-66** (P0, M3) — A view-only argument map, scoped to a chapter or branch, projects claims, supporting and opposing evidence, rival readings, thesis, and constructs from the graph, using the relations of FR-80, and marks which links are unverified. Rival readings come from claim records, such as those an audit records (FR-43); the map does not require FR-26.
- **FR-81** (P0, M3) — The project records places: their names, location assertions that each trace to a source and state their uncertainty, and which sites are restricted. A place is public unless marked restricted, so the position of a site nobody marked is shown and exported. The restriction mark applies to a location. Place names, gazetteer identifiers, relations such as near, another public location, and prose can still disclose a restricted site.
- **FR-67** (P0, M3) — A view-only geographic map projects the places connected to the evidence from the graph. Each location assertion traces to a source and shows its uncertainty.
- **FR-68** (P0, M3) — Exact coordinates of restricted sites are kept outside the repository. The agent may read them when a task needs them, which sends them to its model. Maps and exports built from place records show nothing or a broad area for them. A release scan reports stray coordinates, such as one typed in prose. The report is a warning, so an output can disclose a restricted site's position. A place not marked restricted is treated as public.

### Subsystem: 14. Voice and style

- **FR-69** (P0, M2) — Stemma ships voice and style profiles, a neutral academic one plus a few humanities variants, and an author can extend them. Voice and style profiles are separate from the citation style.
- **FR-70** (P0, M2) — The author can amend a profile by providing examples of the target output taken from their own writing. A proposed change takes effect at once, marked unreviewed, and the author can revise or retire it. The examples behind a change are saved with the project. A profile never changes a quotation or what a claim asserts.

### Subsystem: 15. Takeover of existing projects

- **FR-71** (P0, M1) — Takeover reads a Word manuscript and BibLaTeX, CSL-JSON, and RIS libraries without changing the originals, recovering embedded reference-manager fields where present. A manuscript may be one Word file or several, such as one for each chapter or appendix, taken over into one project. Takeover reads body text, headings, and tables, reports every Word comment, and drops nothing silently. Support for an input is promised only after tests on files saved by real tools pass. A chapter that has no Word file can be taken over from PDF (FR-95).
- **FR-95** (P0, M1) — Takeover also reads a born-digital PDF manuscript with a text layer, for a chapter that has no Word file, and produces what it produces from Word, including the Stemma copy. It is designed for single-column drafts. A PDF does not state most structure, so Stemma sets it only by a stated rule, reports what it cannot establish, links no citation and reads no reference entry across a place it cannot vouch for, and states what a PDF cannot show, such as tracked changes and reference-manager fields. Scanned pages and invisible recognition layers are not converted and are named; recognition is a separate decision. A chapter is taken over from one file: a file that repeats text already taken over adds nothing unless the author says it is a different text. Support is promised only as in FR-71.
- **FR-72** (P0, M1) — Takeover builds full and partial references, quotations, and claims into the graph as unverified. Typed footnotes that cannot be resolved with certainty are reported to the author. Extracted claims take effect at once, marked unreviewed (FR-23): the author reviews them when they like, in batches shown with their original passages, and can edit or retire any one. Review does not verify a claim. The whole original reference list carries forward as sources listed for the bibliography, so an entry that is cited nowhere is reported until the author removes it from the list or dismisses the finding (FR-15).
- **FR-73** (P0, M1) — The author can work through failing references in rounds that can stop and resume, choosing to remove, repoint, or replace each one. Rounds are never required before other work. Fixes are written to a Stemma copy of the manuscript, in the Markdown of FR-35; original files are never changed. The citation, source, quotation, page, figure, and listed-entry checks of FR-9 and FR-29 read that copy. Every choice is rechecked with the records that depend on it. A claim that a removal leaves without a citation is reported.
- **FR-82** (P0, M2) — For a taken-over project, Stemma suggests constructs and a research methodology, each with its supporting passages. A suggestion takes effect at once, marked unreviewed, and the author can revise or retire it.
- **FR-92** (P0, M1) — Takeover reads each reference list or bibliography in the manuscript, keeping every entry as found, and recognizes author-date citations typed as plain text. A fixed rule links a citation to an entry in the same chapter's list only when exactly one entry matches every author named, the year, and any year suffix. Otherwise the citation stays unresolved, with its candidates, for the author; a model's judgment never links one. Every parenthesis that holds a year is linked, reported as unresolved, or listed as left unlinked with its location and the reason. Linking a citation verifies nothing: checking a quotation or page still needs a copy of the cited work in the project.
- **FR-93** (P0, M1) — The first report on a taken-over manuscript is usable at the size of a book. Findings and open takeover items with one cause, such as one source not held, claims without support, or the same reference entry repeated in several chapters' lists, are shown once with a count, the places affected, and what to do. The author can settle exact repeats of a reference entry with one choice. Takeover merges none by itself, and grouping hides no finding and changes no result.

## Acceptance Test Sketches

| Requirement | Scenario | Input | Expected Output |
|-------------|----------|-------|-----------------|
| FR-1 | Start a project | Thesis, audience, scope, style | The governing records exist and hold the inputs |
| FR-60 | Skip constructs, then add one | A project with no constructs | Setup completes; construct checks run only after the construct is added |
| FR-2 | Start a session | A project with standing rules | The rules are loaded and a report can cite a rule identifier |
| FR-6 | Capture a source | A PDF with its address | Source files hold the whole text, hash and provenance are recorded, and no binary is in the repository |
| FR-7 | Record rights | A source with a community-permission flag | The flag is stored and changes no check, excerpt, or output |
| FR-8 | Convert a source with roman and arabic page labels | A PDF | Each page has its own file and label; method, tool version, and quality are recorded |
| FR-84 | Convert text-native sources | Plain, Gutenberg-style, Markdown, HTML, EPUB, DOCX, and PDF files, twice each | Structure and metadata are kept, boilerplate never matches, no page number is invented, and both runs give the same files |
| FR-85 | Check a clone | A clone with no originals | The same results as the first machine |
| FR-98 | List several locations | One original with a live address, an archive snapshot, and a private copy; the live address is down, the snapshot wraps the page, and the private copy is exact | The three are tried in order and each result is reported; the wrapped copy is reported as differing; the exact one is confirmed by hash; the repository holds no copy, local absolute path, or secret |
| FR-99 | Pin a version | A documentation page captured for one release, a "current" address with no stated version, then a newer release of the first page | The citation shows the first release; nothing is guessed for the second, shown as coverage; the newer page replaces nothing and moves no passage |
| FR-100 | Cite repository code | An invented source file at a commit, with a line range captured | The record holds repository, commit, path, and hash; the passage has the exact lines and a line locator; nothing is run |
| FR-101 | Find the cited place | An invented specification with numbered sections and a web page with headings, anchors, and a menu; a search for part of a heading in another case | Locators name the section or heading and a paragraph within it, with the anchor; the heading is found; one step captures a range; no section is invented |
| FR-102 | Keep code and tables | HTML, Markdown, and PDF files holding indented code, command output, and a table, each captured | Lines, indentation, rows, and cells match the original, or what was lost is reported |
| FR-103 | Fetch a page whose site changed | Two renderings of one page that differ only in menu, banner, and related posts | Content passages and their numbers are unchanged; the rest is kept, marked, and never matched; unsettled text is marked undetermined |
| FR-104 | Check a copy without a text | A copy lacking one source's parts, a built report quoting it, then a restore from an address whose bytes differ but convert to the same parts, and one that converts differently; a changed part | The source is reported once as not held, not as passing or damaged; the report check cannot tell; the first restore writes the text and says the bytes differ; the second writes nothing; the changed part is damage |
| FR-105 | Add records in one run | A file of notes, claims, attestations, and report sentences with passages, one entry invalid | The valid records are written, unreviewed, with copied quotations; the invalid entry is reported; nothing is invented |
| FR-106 | Format technical citations | Records for software, code at a commit, a dataset, a standard, a preprint version, release documentation, and an organization's web page | Each note and entry shows the details its form needs; the output is labelled unverified until approved |
| FR-107 | Read technical text | A sentence naming a version and a section number beside a wrong statistic; a code quotation with changed indentation; a web page with a site-wide title | Only the statistic is reported as an absent figure and what was left out is listed; the indentation change is reported; the page is corroborated from its own heading or reported as coverage |
| FR-108 | Build a code quotation | A report quoting indented code and a table | The Markdown, Typst, and PDF keep lines, indentation, rows, and cells, or the build says what it could not keep |
| FR-86 | Reverify from one command | A project with upstream records and the originals | Every applicable check runs; no check that does not apply is listed |
| FR-87 | Damage a source file | A deleted, reordered, and edited page; an unpaired note; a quotation across a page break | Each damage is reported with evidence; the quotation passes and its cited pages are checked |
| FR-88 | Compare text again | A fresh conversion and a second text of one page that differs | Each run records per-page agreement and both readings; a changed page makes the run stale |
| FR-89 | Review a page | A person reviews a page, which is then edited; a model flags another | The review shows who, when, scope, digest, and outcome, goes stale on the edit, and the flag is not counted as a person's review |
| FR-90 | Capture and cite a passage | An address range across a page break with a running head and a footnote | The exact text and locator are returned without them; the citation copies both; editing a page or the quotation is reported |
| FR-94 | Enrich a cited source | A captured, converted, and cited source, then identifiers, details, a differing lookup, and tags | Source files and passage addresses are byte for byte unchanged; the difference is shown and not applied; nothing opens from the additions |
| FR-96 | Keep endnotes | Invented Word and PDF chapters with numbered endnotes that hold a full reference, "Ibid.", and a wrong quotation | The copy keeps them as endnotes; the reference and "Ibid." bind as in footnotes; the quotation fails; the basic PDF prints them as endnotes |
| FR-91 | Build footnotes | A cited passage | The footnote holds the citation, locator, verbatim quotation, and address, all generated |
| FR-9, FR-39 | Cite a source with no source file | A record for a paper-only book with no transcription | The build completes; the report shows the citation unchecked; the finding cannot be dismissed; the output is not checked clean |
| FR-10 | Replace a source file | A new conversion for a cited source | Dependent notes, claims, and citations are flagged |
| FR-61 | Run a support check | A claim citing one page of a long source | Only the needed excerpt is prepared for the model |
| FR-11, FR-62 | Build with no reference manager installed | A project with records | The bibliography is read from one JSON file per record |
| FR-12 | Record varied sources | A book chapter, archive item, dataset, and web page | Each is stored with its type and fields |
| FR-13 | Round trip | A BibLaTeX library with an unknown field and a comment, imported and exported | All information is present; layout may differ |
| FR-14 | Cite a folio | A typed folio locator | The output labels it as a folio |
| FR-15 | Build with an uncited entry | A source listed for the bibliography and cited nowhere | The report names it and suggests citing, unlisting, or dismissing; the build completes |
| FR-16 | Search outside the corpus | A bounded query | Results are candidates, reported as unreviewed if cited |
| FR-17 | Admit a candidate | The author records an admission | Source, query, and decision are recorded and checked |
| FR-19 | Search the corpus first | A question the corpus does not answer | The report states what the corpus does not contain |
| FR-20 | Record a changed extract | An extract that differs from the source text | The check fails |
| FR-21 | Add a claim | A claim with no note | The entry is reported incomplete |
| FR-22 | Register a borrowed construct | A construct with no definition or source | The register check fails |
| FR-23, FR-72 | Use takeover claims at once | A batch of extracted claims; the author later edits one and retires one | All are usable at once and reported unreviewed; review state follows the author's later actions |
| FR-22 | Register an own construct | An author-marked construct with no definition | The register check fails; advice on inconsistent use is not a finding |
| FR-80 | Record opposition | One opposing note and one rival reading | Both relations are stored and distinct |
| FR-24 | Derive an outline with a methodology present | Thesis, ledger, methodology | Chapter specifications name them; drafting can use them at once, marked unreviewed |
| FR-25 | Draft a marked assertion | A marked assertion with no citation | The check reports it |
| FR-28 | Checkpoints | An unanswered checkpoint, then all checkpoints off | Work continues; the unanswered one is reported; none appears when off |
| FR-29 | Real title, wrong author | An entry whose author differs from the copy or the saved lookup | The check fails and shows both values |
| FR-29 | Impossible page | Locator "p. 412" on an article printed at pages 31 to 60 | The check fails and names the range |
| FR-29 | Invented quotation | A quotation absent from the source text | The check fails and reports the closest match |
| FR-29, FR-32 | Near match | A quotation differing by one word | It is reported with both texts until fixed or dismissed |
| FR-29 | Line-end hyphen | A quoted word that the source text splits with a hyphen at a line end | The two match |
| FR-30 | Details the title page text cannot show | A copy whose title page text omits the year, with and without an agreeing saved lookup | Nothing is open; the report says how the year was corroborated or that it was not; a seeded wrong year still fails |
| FR-31 | Skip nothing at build | A record edited outside the agent so that a quotation no longer matches | The build reruns the check and reports it |
| FR-32 | Change an annotated sentence | A dismissal, then an edit to its sentence | The annotation ends and the finding is open again |
| FR-32 | Annotate an uncited entry, then edit it | An annotation bound to the entry | It ends when the entry changes |
| FR-33 | Run checks offline | No network | Corpus checks run; resolver-dependent items report their cached date or unverifiable |
| FR-34 | Repeat a run | The same inputs and tool versions twice | Identical results |
| FR-74 | Fail a check during work | A wrong page typed in a session | The agent explains it with evidence, why it matters, and options, keeps the result as fail, and carries on |
| FR-52 | Overstated claim | "All sites show X" citing a passage about one site | The record reports partly supported and quotes the passage |
| FR-52 | Measure accuracy | A labelled set with seeded errors and a pilot-author sample | False-accept and false-reject rates are published |
| FR-53, FR-39 | Work, then build | A missing record, a citation with no claim, and a claim with no source passage | Each is reported during work and in the build report; the build completes |
| FR-54 | Stale record | The cited source is replaced after the check | The record is reported stale |
| FR-54 | Edit only the sentence | A cited sentence is strengthened; its recorded claim is unchanged | The record stays current |
| FR-35 | Build structured content | Front matter, notes, a figure, an index entry | Each appears in its place |
| FR-35 | Use an undefined layout feature | Markdown with a feature the markup does not define | It is reported, not silently converted |
| FR-83 | Typeset a pilot chapter | A taken-over chapter with one open finding, then none | Both builds complete; only the second is labelled checked clean |
| FR-37 | Quote right to left | A left-to-right chapter with an Arabic quotation | Direction and footnote markers are correct |
| FR-36 | Build a project | Records with no open findings | A PDF with bibliography, index, and Chicago notes |
| FR-38 | Choose a trim size and another style | A5 and a style outside the guaranteed set | The page is A5; output is labelled unverified |
| FR-39 | Build with a failure | A failing check | Draft and camera-ready outputs are written, with the finding in the report; neither is checked clean |
| FR-39 | Build with uncommitted changes | An uncommitted edit, then a draft and a camera-ready build | Both complete; the camera-ready report shows it as a finding |
| FR-30, FR-39 | Build with unreviewed items only | A taken-over chapter whose checks pass and whose claims are unreviewed | It is labelled checked clean, and the report counts the unreviewed items |
| FR-23 | Edit a reviewed claim | The author edits one reviewed claim; the AI edits another | The first stays reviewed; the second is marked unreviewed |
| FR-17 | Admit a source without rights fields | A failing check and empty rights fields | The author's admission is recorded |
| FR-55 | Low-resolution TIFF | A TIFF below the print threshold at its placed size | Conversion and effective resolution are reported; the build completes |
| FR-56 | Vector figure | An SVG map | It stays vector in the PDF |
| FR-57 | Request print output | A book with trim and bleed settings | A print PDF with those settings and a PDF/A or a stated tool limit; no PDF/X claim |
| FR-57, FR-58 | Report image gaps | A figure with no alternative text, credit, or permission | Each gap is reported |
| FR-41 | Build without an entry | A camera-ready build with no changelog entry | It completes and the report shows the missing entry |
| FR-43 | Audit a chapter | A chapter with one weak citation | Rival readings, then repairs, each finding marked; rival readings become unreviewed claims |
| FR-45 | Generate disclosure | A project with one dismissal and unreviewed items | The annotation, the unreviewed counts, and both stated limits appear |
| FR-46 | Package for review | A project with source files, a restricted coordinate typed in prose, and a failing quotation | The package holds the four items, no source file, short evidence excerpts, and a coordinate warning |
| FR-79 | Comment and import | A reviewer comments on a claim and saves the file | The author imports it; the comment is tied to the claim |
| FR-97 | Ledger of a report | A report with a quoted sentence, a cited sentence, an uncited one, a quotation typed by hand, and one sentence a person marked as theirs | Each sentence has its labels; only the marked one has a recorded writer, and none has once the report names another version; no support is shown as judged; the totals equal a recount |
| FR-48 | Use a mode | A takeover request | One skill routes it to takeover |
| FR-49 | Run without an AI; command line first | A command-line check and build through the plugin's launcher; one interface function and its command | Same scripted results as in the agent; the command does what the interface does, with the same result |
| FR-50 | Install from the marketplace | A clean profile and the DocumentDrivenDX marketplace | Installing the plugin delivers the command line, and it loads in a local Code tab session |
| FR-75 | Run the tools on each system | The same fixtures on macOS, Linux, and Windows, from a profile with no Bun | The plugin sets up its pinned Bun itself; same results natively |
| FR-78 | Tag a release | A release tag with one failing system | The report shows the failure and stops nothing automatically |
| FR-64 | Explore a large project | A graph beyond the size of the current arras view | The records are searchable and the larger view renders |
| FR-64 | Rebuild the browser graph | A changed record | The graph is regenerated from records; no generated graph is committed |
| FR-65 | Edit and follow a sentence | A changed sentence, then a rebuild and reload | The reloaded preview shows it, and the sentence opens its evidence and back |
| FR-76 | Inspect the explorer build | The explorer source and bundle | Project code is TypeScript and runs in a browser |
| FR-66 | Open a chapter argument map | Claims with support, objection, and an unverified link | All are distinguishable; the map offers no editing |
| FR-67 | Map a disputed place | Two sourced locations | Both appear with their sources and uncertainty |
| FR-68 | Release with a coordinate in prose | A restricted coordinate typed in a note | The release scan warns |
| FR-81 | Map an unmarked site | A sourced location not marked restricted | It is shown and exported |
| FR-69 | Extend a profile | A built-in voice profile | The extension applies and the built-in is unchanged |
| FR-70 | Amend from an example | A passage of the author's own writing | A change in effect, marked unreviewed, with the example saved |
| FR-71 | Take over a Word file | A manuscript saved by a real tool with embedded fields | References are recovered and the original is unchanged |
| FR-95 | Take over a PDF chapter | An invented PDF chapter with a running head, a footnote, a reference entry split across two pages that would otherwise read as a solo work, and a citation of that solo work; then a scan, and a Word file of the same chapter | The copy and records are written, every loss is listed, the split entry is unread and the citation is not linked; the scan is refused; the second file adds nothing unless the author says it is different |
| FR-72 | Take over a short-form note | An ambiguous short form | It is unverified and reported to the author |
| FR-72 | Carry the reference list | An original list with one uncited entry | The entry is listed and reported until removed or dismissed |
| FR-73 | Remove a failing reference | The author removes it and stops | The claim is reported as left without a citation, and the session resumes later |
| FR-73 | Apply a fix | A repointed reference | The Stemma copy changes; originals keep their hashes |
| FR-71 | Take over several files | Two synthetic chapter files with headings, a table, and comments | Both are in one project; headings and table text are read; every comment is reported |
| FR-73 | Check the copy | A taken-over chapter with a wrong quotation and an entry cited only in author-date form | The checks read the copy: the quotation fails, the entry is not reported uncited, and no check is left unrun for want of a reader |
| FR-92 | Tell look-alikes apart | Invented citations "(Adair 2017)" and "(Adair et al. 2017)" with one solo and one co-authored entry; a citation with no entry; "(1516–1850)" | Each look-alike links to its own entry; the third is reported unresolved; the range is listed as left unlinked; no link is wrong |
| FR-93 | Read a first report | Forty citations of one source with no copy, and one entry repeated in three chapters' lists | The missing copy is shown once with its count; one choice settles the three repeats |
| FR-82 | Suggest constructs | A taken-over chapter | Suggestions with passages, in effect and marked unreviewed |

## Technical Context

- **Language/Runtime**: TypeScript on Bun, one pinned version (feasibility tests
  used Bun 1.4.5). Exploration and rendering code is bundled for the browser.
- **Key Libraries**: Typst for layout (tests used 0.15.1) and citeproc-js for
  citation formatting. Any other tool is allowed when its version is pinned and
  recorded (ADR-004, ADR-005).
- **Source locations**: references held with upstream records (FR-98). No copy
  they point to is stored in the repository.
- **Data/Storage**: One JSON file per record in a git repository, with structure
  defined in UMF; every captured source as page-split or section-split Markdown
  source files in the repository (ADR-010); a manuscript working copy in
  marked-up Markdown (ADR-009); a generated browser graph that is not committed;
  rebuildable SQLite indexes (ADR-002, ADR-006). No binary or paper original is
  stored in the repository. Restricted coordinates stay outside the repository. A record-format migration runs only when the author
  asks, after listing the changes it will make.
- **Family tools**: UMF for record definitions, arras (tests used 0.8.1) for the
  explorer, and HELIX for building Stemma. Truss (a graph storage engine), Weft
  (a query compiler), and Ashlar (a table storage layer), all from
  DocumentDrivenDX, are candidates that may need porting. Reuse comes before new
  code.
- **APIs**: Optional resolvers for DOI (Digital Object Identifier) and
  bibliographic metadata, cached.
- **Platform Targets**: scripted tools on macOS, Linux, and native Windows;
  Claude desktop's local Code tab on macOS and Windows first, then ChatGPT and
  Codex local sessions. No desktop-app promise on Linux.

## Constraints, Assumptions, Dependencies

### Constraints

- **Technical**: Scripted checks are deterministic and run offline against the
  source files. No build step calls a model to decide a result.
- **Business**: Early users are individual scholars, so the system runs on a
  laptop without paid services beyond the AI assistant. The project's own test
  automation must not block progress or depend on paid runs.
- **Legal/Compliance**: The repository captures, under fair use, the whole body
  of research behind the output, so it holds full source texts, many under
  copyright, and may hold restricted data. Anyone who can read the repository can
  read its source files, so publishing the repository publishes them. Stemma is
  built for material that may be sent to a language model.

### Assumptions

- Authors can obtain a file, or hold the original, for every source they cite.
- Most sources, web documentation and repository files among them, come as
  text-native files or PDFs with a text layer. Pages drawn by script have not
  been examined.
- The priorities and delivery steps of FR-98 to FR-108 are assumptions; the
  product owner asked for technical research to be the focus and for several
  locations per original (FR-98), and has not ranked these requirements. FR-99 to
  FR-108 come from one worked example made by a model, a check of one conversion
  rule, and the technologist persona's assumed needs.
- The delivery order is unchanged: the first pilot is still M1.
- Converted or recognized text is good enough on the project's sources to match
  quotations.
- FR priorities and delivery steps follow the stated first-version scope and
  delivery order. The product owner has not ranked individual requirements.
- The following close gaps between requirements. The product owner has not
  confirmed them:
  - Delivery steps and priorities of FR-79 to FR-82; FR-29's construct-credit
    check and FR-82 arriving in M2.
  - FR-1's register timing and FR-2's M1 rules file for takeover.
  - The checks for FR-3, FR-4, FR-10, and FR-47 report like any other.
  - A could-not-check result counts as open (FR-30).
  - A missing source file, an unreadable record, and uncommitted changes can be
    explained but not dismissed (FR-32). "Missing source file" also covers one
    that cannot be read or fails its structure check.
  - The project can list a source for the built bibliography without citing it
    (FR-15).
  - A takeover claim is one that takeover extracted. "No source passage" means
    its evidence reaches none.
  - "Uncommitted changes" (FR-39) are any modified, staged, or untracked file in
    the project that git does not ignore. A project with no git commit has them.
  - Until the length of a "short" excerpt is set, packaging keeps no source
    text in the report or explorer data (FR-46).
  - An exact coordinate found inside a restricted place record is warned about
    like a stray one, and no output includes it.
  - A released version and a release build (FR-41) are camera-ready and reviewer
    builds.
  - Alternative text sits with the figure in the manuscript (FR-35), apart from
    the FR-58 image record.
  - Redaction of the packaged check report (FR-46); FR-79's rule that an import
    changes nothing else; FR-43's rival readings as unreviewed claims; the new
    record kinds in FR-62; "outlining" as a mode in FR-48.
  - The assistant may add place records, unreviewed (FR-81, FR-23). Anyone, the
    assistant included, may mark a location restricted, effective at once; only
    the author may make it public again.
  - Layout in an original that the manuscript markup does not define is reported
    by takeover, not carried over silently (FR-35, FR-71).
  - A reference list serves the chapters read from its own manuscript file. An entry
    in another list or in a library is shown as a candidate and never linked
    (FR-92).
  - A parenthesis that takeover leaves unlinked is listed and saved but is not a
    finding, so it does not affect the checked-clean label (FR-92).
  - Until the question on tables is answered, citations in tables are listed as
    left unlinked (FR-92).

### Dependencies

- Claude desktop's local Code tab running scripts on the author's computer.
- arras acceptance of a larger graph view (FR-64).
- HELIX for specifying and designing Stemma itself, not as a runtime dependency.

## Risks

Feasibility tests ran on one macOS machine with synthetic material. Linux,
Windows, desktop apps, and files saved by real tools are untested.

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| An agent or person alters a review mark, annotation, or support verdict without detection | Medium | High | State the limit in the disclosure; recompute every scripted check at build; keep records in git history |
| Text extraction or recognition fails on scans, old print, or non-Latin scripts | High | High | Record extraction quality; test recognition on pilot sources before M1 ends |
| Browser Typst compilation is too large, lags the native Typst version, or is blocked by a host or arras security policy | High | High | Test it first in M3 design, including citation formatting in the preview; previews also depend on a rebuild and reload after each edit |
| The arras graph view or the graph engine takes longer than planned | High | Medium | M1 and M2 use plain files and a disposable index |
| citeproc-js license terms (CPAL or AGPL) do not fit distribution with an MIT plugin | Medium | High | Get a license review before the pilot bundles it (FR-83) |
| citeproc-js output misses some Chicago note forms | Medium | Medium | Approve an example set against the manual and report unsupported forms |
| Support verdicts are wrong or vary between runs | Medium | High | Record inputs and verdicts, report every unsupported or partly supported finding, and measure against seeded overstated claims |
| A manuscript sentence is strengthened while its recorded claim is unchanged, and the support record stays current | Medium | High | State the limit; the record judges the claim, not the printed sentence |
| A removed reference leaves a claim with no source in a finished report or book | Medium | High | Report every such claim in each check report |
| A report, book, or package with open findings is produced and sent, because nothing blocks a build | High | High | Label every output; explain findings; state open and unreviewed counts in the disclosure; no block, by owner decision |
| Findings are so many or unclear that the author ignores the report | High | High | Treat unexplained or noisy findings as defects; group by cause; measure in the pilot |
| Unreviewed AI-proposed claims and constructs are used and read as the author's, including in an output labelled checked clean, since the label reflects checks only | High | High | Mark and count them in reports, record views, and the disclosure, beside the label |
| The agent reads exact restricted coordinates and they reach its model or new text | Medium | High | Read only when a task needs them; never write them into tracked files or outputs; the scan only warns |
| Joining a line-end hyphen lets a wrong quotation match, for example where the source's hyphen belongs to the word | Medium | Medium | Record how each quotation matched; test the approved list on pilot sources |
| Image problems (low resolution, missing alternative text, credit, or permission) reach a finished book | Medium | High | Report them in every build; the author checks the report before publishing |
| Claude desktop cannot install the plugin from the marketplace, or its sandbox blocks the first-use download | Medium | High | Install and first run observed in the desktop app before any support claim |
| Claude desktop on Linux is a beta limited to some distributions, so Linux authors may lack a desktop host (unverified) | Medium | Medium | Promise only the scripted tools on Linux; make no desktop-app promise there |
| Checks and Typst output differ across systems | Medium | High | Run the seeded set on all three systems for each release tag |
| A publisher bars AI-written text that Stemma helped draft | Medium | High | State that Stemma offers no mode that prevents agent writing; disclosure records AI use |
| Material whose license, permission, or community terms bar hosted processing is added to a project and sent to a model | Medium | High | Say in setup and documentation that any source in a project may be sent; local models are an unsupported experiment; rights flags do not block sending |
| Coordinates leak through prose or misclassified records into a draft, camera-ready book, or reviewer package; the scan only warns | Medium | High | Warn with the file and place, and state that a package or book can disclose a site; the author acts on the warning |
| A restricted site nobody marked is treated as public, so maps, exports, and packages disclose its position | Medium | High | State the default where places are recorded; the author marks restricted sites |
| A PDF layout rule divides or joins text wrongly, so that a citation or entry is lost, altered, or linked to the wrong work, or deleted text from a tracked-changes printout is read as current | High | High | Set structure only by stated rules; link nothing across a doubtful join; account for the text the library returns; state what a PDF cannot show; advise the Word file; label PDF support untested |
| An author-date rule links a citation to the wrong entry, for example where an entry the reader could not parse is the one meant | Medium | High | Link only on one full match; leave the citation unresolved when an unparsed entry could also fit; check against hand-made answer lists |
| A citation is read as an ordinary date and left unlinked, and a book is labelled checked clean | Medium | High | List every parenthesis with a year and its reason; state the count and this limit in the intake report; measure in the pilot |
| Right-to-left quotations, or experimental right-to-left main text, lay out wrongly | Medium | Medium | Test pilot scripts with the footnote-marker case; promise only quotations in left-to-right books |
| The author loses an original, so a source file can no longer be verified against it | Medium | Medium | The source file keeps the original's hash, description, and where it was obtained; checks of the text still run |
| A repository with full source texts is published | Medium | High | Say once that anyone who can read the repository can read its source files |
| A recognized text layer is wrong and a quotation matches it | High | High | Label recognized text; record comparisons and reviews; report review coverage; quote only after comparing with the page |
| A conversion assigns wrong structure | Medium | Medium | Assign a role only by a stated rule, record its basis, and mark the rest undetermined |
| A library refuses automated fetches | Medium | Low | Use only documented automated access; the author supplies the file |
| A technical page changes or disappears, and its recorded address no longer gives the cited text | High | High | Keep the text and hash; pin versions (FR-99); list several locations (FR-98) |
| A reader cannot find a cited place in a long page, so the citation cannot be checked in practice | High | High | Cite sections, headings, anchors, and lines (FR-100, FR-101); until built, say that a web page's paragraph number is Stemma's own count |
| Technical research becomes the focus on little evidence: one worked example made by a model, and no technologist asked | High | High | Mark these needs assumed; find a technologist pilot; keep the open question on the first pilot |

## Open Questions

- [ ] Is the first pilot still the takeover of an existing manuscript, now that
  technical research is the focus, or a new technical report? M1 is unchanged
  until answered; product owner.
- [ ] May an author's own experiment or benchmark, with its code and results, be
  cited as evidence, and how is it recorded? Product owner.
- [ ] Should a technical-writing voice profile ship beside the neutral academic
  one and the humanities variants (FR-69)? Product owner.
- [ ] Who approves the technical citation examples of FR-106? Product owner.
- [ ] Should Stemma build in a recognition engine for image-only and paper
  originals, and which one runs on all three systems? Until then their text is
  supplied from a tool the author runs or typed; design owner.
- [ ] Does the pilot's PDF need an author-date citation style? Only Chicago
  notes and bibliography is guaranteed (FR-38, FR-83), and a manuscript that
  cites in author-date form would be typeset with notes; product owner with the
  pilot author.
- [ ] Must takeover read reference entries that put the year near the end, or
  will the pilot's authors change them? FR-92's design reads both layouts until
  answered; product owner with the pilot author.
- [ ] Should an identical entry in two chapters' lists become one source without
  a choice? Until answered, nothing merges by itself (FR-93); product owner.
- [ ] How are citations in tables read, when table layout arrives after the
  pilot (FR-35)? Design owner.
- [ ] What do an author's own bracketed working markers, such as a note to
  verify a statement, mean? Takeover keeps them as typed, including one that
  ends a citation in brackets, which stays with that citation; should it also report
  them, or treat them as needing a source? Product owner with the pilot author.
- [ ] Should every check report count the parentheses left unlinked, or should
  an unsettled one affect the checked-clean label? Until answered, only the
  intake report and `rounds status` show them; product owner.
- [ ] A PDF page with no text, such as a full-page figure, cannot be told from a
  scanned page, so any reference list it could affect links nothing (FR-95).
  Should the author be able to say that such a page holds no text? Product
  owner.
- [ ] A reference list in a PDF that is not set with a hanging indent, or that
  later text follows with no heading Stemma finds, links nothing. Is that
  acceptable for the pilot's PDF files? Product owner with the pilot author.
- [ ] Does the pilot need PDF takeover, or may it follow the Word path? FR-95 is
  P0, M1 until answered, and no Word step waits for it. Product owner.
- [ ] Which programs made the PDF manuscripts that matter? Their files decide
  which support labels can be lifted. Product owner.
- [ ] May a chapter taken over from PDF later move to its Word file, keeping the
  author's choices? Not designed; product owner.
- [ ] How is a revised manuscript file recognized and taken further? Until
  answered, a changed file under an earlier file's name is reported and not
  applied, so two chapters in files of one name need the author to say they
  differ; a revision under a new name is refused as repeated text with no saved
  item; one that repeats too little is added as a further chapter; and no
  revision is ever applied (FR-71, FR-95). Product owner with the pilot author.
- [x] How is a quotation from a PDF chapter checked where a line-end hyphen was
  kept? Answered by the product owner, who does not need these hyphens held
  open: it passes if either reading matches, and the result says which
  (CONTRACT-003 I).
- [x] Must PDF takeover recognize endnotes? Answered by the product owner:
  everything includes endnotes (FR-96).
- [ ] Where does a build print endnotes: after each chapter or at the end of the
  book? After each chapter, numbered through the book, is assumed. Product owner.
- [ ] When the note style turns a citation in running text into a note, may a
  book have those as endnotes? A footnote is assumed. Product owner with the
  pilot author.
- [ ] Source conversion labels endnotes as notes for markup originals, but a PDF
  original's endnotes stay in its main text, where they can be quoted and are
  not marked as notes. FR-96 is not met there until a rule for published books
  is designed (CONTRACT-007 I). Design owner.
- [x] Which PDF text-extraction library do the checks use? Answered by the
  product owner: `pdfjs-dist`, pinned (SD-002).
- [ ] How long may a "short matching excerpt" of a copyrighted source be in a
  reviewer package? Blocks use of the allowance in FR-46; product owner.
- [ ] Must the work's own thesis claim reach a note, or is it exempt from the
  completeness check of FR-21? Affects the checked-clean label; product owner.
- [ ] Is a command-line or administrator install acceptable for ChatGPT desktop?
  Blocks FR-77; product owner after a hands-on test.
- [ ] Which typesetting requirements apply to a research report? FR-35 to
  FR-38, FR-57, and FR-83 were written for books: front and back matter, an
  index, trim sizes, and a manuscript arranged in chapters. Requirements that
  name chapters (such as FR-22, FR-24, and FR-43) need the matching answer for a
  report's structure. Until answered, they promise nothing specific for reports;
  product owner.

## Success Criteria

- Every check in FR-29 fails on its seeded error, passes on clean input, or
  reports unverifiable with the reason, and each finding is explained.
- The support check flags the seeded overstated, reversed, and unsupported
  claims in the test set, and every build reports them until resolved.
- A technical research report on versioned documentation, a specification,
  repository files, and papers builds so that every cited versioned source shows
  the version read, every cited place can be found in its original, and quoted
  code matches line for line.
- A pilot takes over an existing chapter, works through its references, gets the
  same scripted results after stopping and resuming, and builds a basic PDF of
  it whose label matches its report.
- On pilot chapters chosen to exercise different citation problems, the originals
  keep their hashes; every parenthesis with a year is linked, unresolved, or
  listed with a reason; a hand-checked answer list shows no citation linked to
  the wrong source; a cited work missing from its chapter's list is reported
  unresolved; two takeovers into empty projects give the same check results; and
  the intake report lists every comment, table, and other unconverted content.
- The support check's false-accept and false-reject rates are published.
- A new project completes setup, research, notes, drafting, verification, and a
  camera-ready build.
- A camera-ready build with a failing citation or evidence check completes, is
  not called checked clean, and explains the finding.
- A book with raster and vector figures builds to a PDF, and every resolution,
  font, and image-record problem is reported.
- The plugin installs in Claude desktop on macOS and Windows, and its scripted
  checks give matching results on macOS, Linux, and Windows.
