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
**Covered PRD Requirements**: FR-71, FR-72, FR-73, FR-82
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Takeover brings an existing manuscript and its reference libraries into Stemma
without changing the originals (FR-71). It builds what it finds into the
evidence graph as unverified (FR-72) and lets the author resolve failing
references in rounds, writing fixes to a Stemma copy (FR-73). With the checks and
a basic PDF (FR-83, FEAT-008), it is the first pilot. In M2 it also suggests
constructs and methodology (FR-82).

## Ideal Future State

An author gives Stemma a half-referenced Word manuscript and their libraries.
The originals stay as they were. The author sees what was found, what was not
read, and what is uncertain, all unverified. As they add sources, checks
run, and the author decides for each failing reference whether to remove,
repoint, or replace it. They can stop at any point and resume later without
losing a decision.

## Problem Statement

- **Current situation**: Authors have manuscripts with embedded
  reference-manager fields, typed footnotes, short forms, and separate
  libraries. Checking a large book by hand can take manual library look-ups for
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
| Unverified graph | What does my manuscript rest on? | References, quotations, and claims as unverified records |
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

## Task Model

N/A — the user stories name the tasks.

## Requirements

### Functional Requirements by Area

#### Intake (FR-71)

- INT-01. Takeover must read a Word manuscript.
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
  takeover reports 0 uncertain footnotes as resolved to a wrong source.
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

## Success Metrics

- **Pilot completion**: One existing chapter is taken over and checked by a pilot
  author (PRD hypothesis; pilot study).

## Constraints and Assumptions

- The Stemma copy's files, markers, and takeover output are defined by
  CONTRACT-006 (ADR-009).
- **Risk**: after a reference is removed, the claim it supported can stand
  without a source in a finished book; the report is the only warning.
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
- **Unverified**: Field formats for other reference managers come from research
  reading and were not tested.

## Dependencies

- **Other features**: FEAT-002, FEAT-003, FEAT-005, and FEAT-007 (required).
  FEAT-001 supplies the standing rules; FEAT-008 builds the pilot's basic PDF;
  FEAT-010 provides the takeover mode; FEAT-011 stores the records.
- **External services**: The tools that save the authors' manuscripts and
  libraries. Record, report, and command surfaces belong in Contracts.
- **PRD requirements**: FR-71, FR-72, FR-73 (P0, M1); FR-82 (P0, M2).

## Out of Scope

- PDF-only or LaTeX manuscript intake.
- Capturing and converting sources (FEAT-002).
- Check definitions, support checks, and annotations (FEAT-007).
- Legacy library export (FEAT-003).
- Rewriting the manuscript's prose without the author's choice.
- Promising support for an input that has only passed synthetic fixtures.

## Open Questions

- [ ] Which producing tools and versions must the pilot's inputs cover? Blocks
  INT-05 test sets; product owner with the pilot author.

