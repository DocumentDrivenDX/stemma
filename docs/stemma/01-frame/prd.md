---
ddx:
  id: stemma.prd
  authoring:
    home: repo
  depends_on:
    - stemma.product-vision
kind: product
---

# Product Requirements Document

## Summary

Stemma is a plugin and toolchain for academic researchers who write books
with AI assistance. It provides governed project documents, a closed corpus of
admitted sources, a built-in citation store, scripted verification with commit
gates, workflows for research, drafting, audit, and review, and a typesetting
pipeline that produces a camera-ready PDF. AI-written prose is allowed.
Fabricated or unverifiable sources are not: a commit that adds a citation the
checks cannot verify is refused. The first users are humanities scholars; the
design also serves technologists and researchers in other fields.

## Problem and Goals

### Problem

AI assistants speed up literature search, note-taking, and drafting, and they
also invent references, attach real titles to the wrong authors, produce page
numbers outside a source's extent, fabricate quotations, and credit ideas to the
nearest plausible author. Catching these errors by hand is slow, and manual
library look-ups do not scale to a book's bibliography.
Scholars who lack that discipline either avoid AI or accept the risk.

### Goals

1. Let an author use AI for research and composition at full speed while
   making fabricated and unverifiable citations impossible to commit.
2. Keep the author in control of interpretation, structure, and disclosure.
3. Provide one repository and one source of truth from sources through notes,
   claims, and chapters to a typeset book.
4. Serve users with different levels of AI experience and different fields.

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Unverifiable citations in a passing build | 0 | Gate results on every commit and release build |
| Known error classes caught by the checks | Every class in FR-29 detected on a seeded test corpus | Regression suite of seeded errors |
| Pilot completion | One chapter completed per persona (hypothesis) | Pilot study with named authors |
| Time on manual citation checking | Reduced against the author's own baseline (hypothesis) | Self-reported before and after |
| Clean-checkout reproduction | A reviewer reproduces check results and the PDF | Fresh clone on CI |

### Non-Goals

- Replacing the author's judgment. Interpretation, argument, and the decision to
  scrap a chapter stay with the author.
- Guaranteeing that a cited source is correct or well-chosen. The gates prove
  that a citation matches a real, stored source and passage, and that the
  passage was checked against the claim it supports. They do not judge whether
  the source is authoritative or the argument is sound.
- Acting as a general writing assistant for non-scholarly text.
- Hosting or distributing copyrighted sources. The store is private to the
  project.
- Training or fine-tuning models.

Deferred items are tracked in `docs/stemma/parking-lot.md`.

## Users and Scope

Personas differ in comfort with AI and in field. Stemma ships defaults for
each, so a cautious author gets guardrails and a fluent one gets control.

### Primary Persona: Margit, the AI-cautious humanist

**Role**: Senior professor of history writing a monograph from a career-long
personal collection of articles, scans, and notes.
**AI comfort**: Low. Has tried a chat assistant and distrusts it.
**Goals**: Use AI to find missed literature, draft from her own notes, and cut
the clerical load of citations, without risking her reputation.
**Pain Points**: Cannot tell which AI references are real without checking each
one. Does not want to manage prompts, sessions, or scripts.
**Needs**: Plain-language commands, safe defaults, checks that run for her,
clear explanations of every failure, and a record she can show a publisher.

### Primary Persona: Idris, the AI-fluent humanist

**Role**: Humanities scholar leading a multi-chapter book with a large existing
corpus.
**AI comfort**: High. Writes standing instructions, runs separate sessions for
research and drafting, and drafts with AI under disclosure.
**Goals**: Move faster, keep rival readings in every chapter, and keep a dated
trail of changes and errata across many sessions.
**Pain Points**: Hand-maintained registers drift. Versions become hard to trace.
Citation errors pass a quick check and fail only on a close read.
**Needs**: Configurable roles and rules, registers that update with the work,
strict gates, and a disclosure appendix generated from the record.

### Secondary Persona: Priya, the technologist-researcher

**Role**: Researcher writing a book on a technical subject, such as distributed
systems or machine learning, from papers, specifications, code, and talks.
**AI comfort**: Very high. Works in git, CI, and a terminal daily.
**Goals**: Treat the manuscript like a codebase: gates in CI, reproducible
builds, scripted checks, extensible tooling.
**Pain Points**: Sources include preprints, standards, repositories, and web
pages that change or disappear. Few tools handle them with page-level rigor.
**Needs**: Support for non-traditional source types, pinned versions of changing
sources, hooks and CI integration, and the ability to extend the checks.

### Secondary Persona: Tomasz, the scholar outside the humanities

**Role**: Social scientist or life scientist writing a book from journal
articles, datasets, and fieldwork.
**AI comfort**: Moderate. Uses AI for coding and summaries, not for drafting.
**Goals**: Keep data and figures tied to claims, use the field's citation style,
and meet publisher and journal disclosure rules.
**Pain Points**: Heavy reliance on a reference manager and a word processor.
Fear of a method that breaks the existing workflow.
**Needs**: Import from and export to common reference formats, support for
datasets and figures as sources, and Word and LaTeX exchange with co-authors.

### Secondary Persona: Noor, the reviewer or editor

**Role**: Peer reviewer, developmental editor, or publisher's production editor.
**AI comfort**: Varies.
**Goals**: Decide whether to trust an AI-assisted manuscript and give useful
feedback.
**Pain Points**: Cannot see how the AI was used or whether the references hold.
**Needs**: A package that re-runs the checks, shows the disclosure, and
accepts comments tied to claims and passages.

### User Segments

| User | Context | Needs | Evidence | Confidence | Status |
|------|---------|-------|----------|------------|--------|
| Humanities scholar, AI-cautious | Personal corpus, word processor, little scripting | Safe defaults, plain-language workflow, explained failures | None published | low | assumed |
| Humanities scholar, AI-fluent | Large corpus, multiple AI sessions, collaborators | Roles, registers, strict gates, disclosure | None published | low | assumed |
| Technologist-researcher | Git, CI, terminal; changing sources | Pinned sources, extensible checks, CI | None published | low | assumed |
| Scholar outside the humanities | Reference manager, Word or LaTeX, datasets | Reference interchange, dataset sources, style support | None published | low | assumed |
| Reviewer or editor | Reads and audits, does not write | Reproducible checks, disclosure, tied comments | None published | low | assumed |

### User Needs

| Need | Importance | Evidence | Confidence | Status |
|------|------------|----------|------------|--------|
| Use AI without fabricated or misattributed citations | high | Unpublished input | low | assumed |
| Keep AI search limited to sources the author has chosen | high | Unpublished input | low | assumed |
| Keep interpretation with the author | high | Unpublished input | low | assumed |
| Hear rival readings from a separate pass with fresh context | high | Unpublished input | low | assumed |
| Trace every change and correction | high | Unpublished input | low | assumed |
| Work without an external reference manager | high | Unpublished input | low | assumed |
| Typeset a camera-ready book from the same files | high | Unpublished input | low | assumed |
| Disclose AI use accurately and cheaply | high | Unpublished input | low | assumed |
| Include sources in multiple languages with fair coverage | medium | Unpublished input | low | assumed |
| Respect permissions on unpublished data and community knowledge | medium | Unpublished input | low | assumed |

## Requirements

### Must Have (P0)

1. Workspace, governance documents, and AI roles (Subsystems 1 and 10).
2. Corpus with provenance, and a citation store independent of external tools
   (Subsystems 2 and 3).
3. Notes, claim ledger, and construct register anchored to passages
   (Subsystem 5).
4. Deterministic verification with enforced commit gates (Subsystem 7).
5. Research discovery with candidate admission (Subsystem 4).
6. Composition from verified claims (Subsystem 6).
7. Typesetting to a camera-ready PDF (Subsystem 8).
8. Audit, review, evolution, and disclosure (Subsystem 9).

### Should Have (P1)

1. Import and export of common reference formats.
2. Index generation and name-authority checks.
3. Reviewer package with comments tied to claims.
4. Pinned versions for changing web and code sources.
5. Persona-based defaults and onboarding.

### Nice to Have (P2)

1. Support for additional citation styles beyond the v1 set.
2. Local open-weight model support for sensitive corpora.
3. Dataset and figure provenance beyond file hashes.
4. Collaboration across several authors on one corpus.

## Functional Requirements

### Subsystem: 1. Workspace and governance

- **FR-1** — Initializing a project creates the standing-rules file, the
  changelog and errata records, the decision log, and the registers for the
  chosen persona defaults.
- **FR-2** — The standing rules are plain text the assistant reads at the start of
  every session, and each rule has an identifier that checks and reports cite.
- **FR-3** — A decision recorded in one governance document propagates to the
  related documents in the same change, and a check flags documents that lag.
- **FR-4** — Each document has a single canonical location, and a check detects
  duplicate or stale copies.
- **FR-5** — The project records which AI roles exist, what each may read and
  write, and which checks each must pass.

### Subsystem: 2. Source corpus

- **FR-6** — Adding a source to the corpus stores the file, a content hash, and
  provenance: where it came from, when, which version, and by whom admitted.
- **FR-7** — Each source record carries rights and permission fields, including
  unpublished-data and community-permission flags, and checks report
  conflicts.
- **FR-8** — Each stored source has extracted text with page mapping, and
  extraction quality is recorded, including for scanned and non-Latin-script
  material.
- **FR-9** — A source without a stored copy cannot be cited. Sources that exist
  only on paper become citable through a stored scan or photographed pages.
- **FR-10** — Changing or removing a source flags every note, claim, and
  citation that depends on it.

### Subsystem: 3. Citation store

- **FR-11** — The bibliography is a plain-text store owned by the project, with
  one record per source, and no external reference manager is needed to
  create, read, or build it.
- **FR-12** — Records support the source types in the supported fields, including
  books, chapters, articles, theses, reports, archives, datasets, web pages,
  and code.
- **FR-13** — The store imports and exports common reference formats, and the
  round trip is lossless for fields the store supports.
- **FR-14** — In-text citations use stable keys with optional locators, and
  citation style is a project setting.
- **FR-15** — Each bibliography entry must be cited in the text or removed.

### Subsystem: 4. Research and discovery

- **FR-16** — The assistant can search, within limits the author sets, and returns
  candidates that carry no citation standing until admitted.
- **FR-17** — Admitting a candidate runs source acquisition and the corpus
  checks, and records the search query and decision.
- **FR-18** — Searches and decisions are logged so that coverage can be reviewed,
  including by language, period, and region.
- **FR-19** — The assistant can be directed to search the admitted corpus first
  and to report what the corpus does not contain.

### Subsystem: 5. Notes, claims, and constructs

- **FR-20** — A reading note anchors each extract or paraphrase to a source and a
  locator, and the extract matches the stored text.
- **FR-21** — A claim-ledger entry links a claim to one or more notes, with a
  confidence level and the reason the sources support it.
- **FR-22** — A construct register ties each concept the book uses to its
  originating source and to the chapters that use it.
- **FR-23** — The assistant may propose notes, claims, and constructs; they take
  effect only after the author accepts them.

### Subsystem: 6. Composition

- **FR-24** — The author states the thesis, audience, and scope. The system
  derives an outline and chapter specifications from them and from the ledger.
- **FR-25** — Drafts are written from ledger entries. Every assertion that needs a
  source carries a citation key and locator.
- **FR-26** — Each chapter has a section for alternative interpretations, drafted
  as adversarial counter-arguments.
- **FR-27** — The author can mark which passages were AI-drafted, human-written,
  or edited, and the record is kept per version.
- **FR-28** — Interpretive checkpoints require the author's input before a chapter
  advances, with a setting for how many checkpoints apply.

### Subsystem: 7. Verification and gates

- **FR-29** — Scripted checks detect each of these error classes:
  - citation key with no bibliography entry;
  - bibliography entry with no citation;
  - quotation absent from the stored source text;
  - locator outside the source's page extent;
  - author, title, year, or venue that disagrees with source metadata or a
    resolver result;
  - identifier such as a DOI that does not resolve or resolves to a different
    work;
  - a quotation that duplicates the book's own argument;
  - a figure or statistic attributed to a source that does not contain it,
    where the text can be matched;
  - a construct credited to someone other than its registered originator.
- **FR-30** — Each check reports pass, fail, or unverifiable with the evidence,
  and unverifiable results block unless the author records a reasoned
  exception.
- **FR-31** — A commit gate runs the checks that apply to the changed files and
  refuses the commit when they fail. A CI gate repeats them.
- **FR-32** — A gate cannot be bypassed silently: an exception is a recorded,
  dated, reasoned entry in the project record and is reported in the
  disclosure.
- **FR-33** — Checks run offline against the stored corpus. Checks that need a
  network resolver are separate, and their results are cached with the
  query and date.
- **FR-34** — Checks are deterministic: the same inputs give the same results,
  and a seeded-error test corpus verifies each check.
- **FR-52** — A claim-support check compares each claim with the stored passage it
  cites and reports supported, partly supported, or unsupported, quoting the
  passage. It runs in a context separate from the one that drafted the claim,
  and it reports a claim that goes beyond, overstates, or reverses its source.
- **FR-53** — The gate requires a current support-check record for every cited
  claim in the changed text, and requires each partly supported or unsupported
  finding to be fixed, or to carry a reasoned exception from the author. The
  gate verifies the record deterministically (present, current, resolved); it
  does not call a model.
- **FR-54** — A support-check record stores the model, the prompt version, the
  claim text, the passage, and the source hash. The record becomes stale and
  blocks when the claim, the passage, or the source changes.

### Subsystem: 8. Typesetting and publishing

- **FR-35** — The on-disk format carries the structure needed for professional
  typesetting: sections, front and back matter, footnotes and endnotes,
  figures, tables, captions, cross-references, block quotes, and index
  entries.
- **FR-36** — A build produces a camera-ready PDF with running heads, folios, a
  table of contents, a formatted bibliography, and an index.
- **FR-37** — The build supports multiple scripts and writing directions, including
  right-to-left text and transliteration.
- **FR-38** — Style, trim size, fonts, and the citation style are project settings
  with documented defaults.
- **FR-39** — The build refuses to run when the verification gates fail, and records
  the commit it built from.
- **FR-40** — The same source also builds a reviewer-friendly format for
  co-authors and publishers who need Word, LaTeX, or HTML.
- **FR-55** — Raster images (such as TIFF, PNG, and JPEG) are stored at original
  resolution and placed without resampling. The build reports each image's
  effective resolution at its placed size and fails when it is below the
  project's print threshold.
- **FR-56** — Vector images (such as SVG, PDF, and EPS) stay vector in the output
  PDF, with fonts embedded or converted to outlines.
- **FR-57** — The build supports the color handling a printer requires, including
  grayscale and CMYK output, embedded color profiles, bleed and trim, and a
  preflight report. The build can write a PDF/X file where the project asks
  for one.
- **FR-58** — Each image has a record with its source, credit, rights, permission,
  caption, alternative text, and the figure identifier used in
  cross-references. A check fails when an image lacks credit or recorded
  permission.
- **FR-59** — Large binary files are stored by content hash in the corpus store
  or git LFS, the repository records their hashes, and a clean checkout
  can restore them.

### Subsystem: 9. Evolution, audit, and review

- **FR-41** — Every rendered or released version has a dated changelog entry, and
  the build refuses without one.
- **FR-42** — Errors found are recorded in an errata register with the date,
  cause, and fix.
- **FR-43** — A chapter audit runs rival readings first and citation repair
  second, and marks each finding confirmed or suspected.
- **FR-44** — A fresh-eyes review runs in a separate context from the one that
  drafted the chapter.
- **FR-45** — The system generates a methodological disclosure that states which
  models and rules were used, what the AI did, and which exceptions were
  granted.
- **FR-46** — A reviewer package bundles the manuscript, bibliography, corpus
  manifest, check results, and disclosure, so a reviewer can reproduce the
  checks and attach comments to claims.
- **FR-47** — When the argument or evidence changes, a check lists the chapters,
  claims, and registers that need re-review.

### Subsystem: 10. Plugin and skill

- **FR-48** — Stemma ships as one public skill with modes. The modes cover
  starting a project, research, notes, drafting, verification, building,
  audit, and review.
- **FR-49** — The checks and the build run from a command line without an AI,
  so a gate does not depend on a model.
- **FR-50** — The plugin works with Claude Code and with other agent runtimes that
  read the project's files, and degrades to the command-line checks when a
  runtime lacks the skill.
- **FR-51** — Persona defaults control onboarding, explanation level, number of
  checkpoints, and gate strictness, and every default can be overridden.

## Acceptance Test Sketches

| Requirement | Scenario | Input | Expected Output |
|-------------|----------|-------|-----------------|
| FR-29 | Real title, wrong author | Citation whose entry has a real title but a different author from the stored source | Check fails with the field and both values |
| FR-29 | Impossible page | Locator "p. 412" on a 30-page article | Check fails; evidence names the extent |
| FR-29 | Invented quotation | Quoted sentence not in the source's extracted text | Check fails and reports the closest match |
| FR-9, FR-30 | Candidate with no stored copy | Citation key for an admitted-but-empty record | Gate refuses the commit |
| FR-31 | Bypass attempt | Commit with `--no-verify` | CI gate fails; exception log shows no entry |
| FR-32 | Reasoned exception | Author records an exception for a paper-only source with a scan pending | Commit passes; disclosure lists the exception |
| FR-52, FR-53 | Overstated claim | Claim "all sites show X" citing a passage about one site | Support check reports partly supported; gate refuses until fixed or excepted |
| FR-54 | Stale record | Cited source file replaced after the support check | Record marked stale; gate refuses |
| FR-55 | Low-resolution image | 600 px wide JPEG placed at 6 in | Build fails with effective resolution 100 ppi against the 300 ppi threshold |
| FR-56 | Vector figure | SVG map placed in a chapter | PDF keeps the figure as vector paths with embedded fonts |
| FR-36 | Build | Passing repository | Camera-ready PDF with bibliography, index, and the commit identifier |
| FR-39 | Build on failure | Repository with a failing check | No PDF; the build reports the failed checks |
| FR-13 | Round trip | Import of a reference export, then export | Supported fields identical |
| FR-46 | Reviewer reproduction | Fresh clone with the package | Same check results as the author's |

## Technical Context

Stack and format decisions are open and need ADRs.

- **Language/Runtime**: Open. Scripted checks and the build must run without an
  AI and be portable across Linux, macOS, and Windows.
- **Key Libraries**: Open. Candidates include a Pandoc-style pipeline, LaTeX or
  Typst for typesetting, CSL for citation styles, and OCR and PDF text
  extraction libraries.
- **Data/Storage**: Plain text files in a git repository, with large source
  files held in the project's corpus store. Citation data in a
  CSL-JSON-compatible form is a likely default.
- **APIs**: Optional resolvers for DOI and bibliographic metadata, cached.
- **Platform Targets**: Linux, macOS, and Windows; Claude Code first.

## Constraints, Assumptions, Dependencies

### Constraints

- **Technical**: Checks must be deterministic and runnable offline against the
  corpus. The gate must not need a model.
- **Business**: Early users are individual scholars, so the system must run on a
  laptop without paid services beyond the AI assistant.
- **Legal/Compliance**: Stored sources are often copyrighted and some data is
  restricted. The corpus is private to the project, and rights flags are
  enforced in the build and the reviewer package.

### Assumptions

- Authors can obtain a stored copy of every source they cite, or a scan of it.
- Text extraction is good enough on the project's sources to match quotations,
  or the author accepts a recorded exception.
- Authors accept stricter gates in return for AI speed.

### Dependencies

- An AI assistant runtime that can read project files and run commands.
- HELIX for specifying and designing Stemma itself, not as a runtime dependency.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Text extraction fails on scans, old print, or non-Latin scripts, blocking valid citations | High | High | Record extraction quality, support manual transcription as a stored artifact, and allow reasoned exceptions |
| Strict gates frustrate cautious users | Medium | High | Persona defaults, plain-language failure explanations, and a guided exception path |
| Checks pass but the source does not support the claim | Medium | High | State the non-goal plainly, run the rival-readings audit, and keep interpretation checkpoints with the author |
| Typesetting scope delays the verification core | Medium | Medium | Ship verification first and build against an existing typesetting engine |
| Corpus rights and privacy leak through a reviewer package | Low | High | Enforce rights flags in package generation and test them |
| Dependence on one AI vendor | Medium | Medium | Keep gates and the build model-free and files-based |
| Support-check verdicts are wrong or vary between runs | Medium | High | Record inputs and verdicts, require the author's resolution of findings, run the check in a separate context, and measure against a seeded set of overstated claims |
| Large image sets bloat the repository | Medium | Medium | Hash-addressed binary store with checkout restore (FR-59) |

## Open Questions

- [ ] Plain-text format and typesetting engine (Pandoc with LaTeX, Typst, or
  another) — blocks the on-disk format ADR, ask the product owner.
- [ ] Source types with no digital copy: is a scan the only route to citable
  status? — blocks FR-9 detail, ask the product owner.
- [ ] Support-check design: how a model-based verdict is measured and how an
  author's acceptance is recorded — blocks FR-52 to FR-54, ask the product
  owner.
- [ ] Print color and preflight: required PDF/X variant and color profiles —
  blocks FR-57, ask the production editor persona.
- [ ] Binary storage: git LFS or a separate hash-addressed store — blocks FR-59.
- [ ] Which citation styles and trim sizes ship in v1 — blocks FR-38.
- [ ] One skill with modes, or sibling skills — blocks the skill ADR.
- [ ] Reviewer comment format and exchange — blocks FR-46.

## Success Criteria

- Every check in FR-29 fails on its seeded error and passes on clean input.
- The support check flags the seeded overstated, reversed, and unsupported
  claims in the test set, and the gate refuses them until resolved.
- A book with high-resolution raster and vector figures builds to a PDF that
  passes the resolution and font checks.
- A project built from the persona defaults completes init, research, notes,
  drafting, verification, and a PDF build with the gates enforced.
- A fresh clone of a passing repository reproduces the check results and the PDF.
- A commit that adds an unverifiable citation is refused locally and in CI.
