---
ddx:
  id: FEAT-009
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.adr-003
---

# Feature Specification: FEAT-009 — Evolution, Audit, and Review

**Feature ID**: FEAT-009
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 9. Evolution, audit, and review
**Covered PRD Requirements**: FR-41 (P1), FR-42 (P1), FR-43, FR-44 (P1), FR-45, FR-46, FR-47 (P1), FR-79, FR-96 (P1)
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Evolution, audit, and review keeps the history of a book, reviews its chapters,
and tells others how it was made. It covers PRD FR-41 to FR-47, FR-79, and FR-96.
FR-43 and FR-45 are P0 in delivery step M2; FR-46 and FR-79 are P0 in M3; the
rest are P1. FR-96, the evidence ledger of a report, is P1 in M1.

## Ideal Future State

The author can say what changed in each version, which errors were corrected,
and what a change of thesis or evidence puts back in doubt. A chapter audit
challenges the argument before repairing citations. A publisher or reviewer
receives an accurate account of AI use and a package that opens offline, leaks
no source files unless the author includes them, and states what it cannot show.

## Problem Statement

- **Current situation**: Authors keep changelogs, errata registers, and audits
  by hand and write AI-use statements from memory.
- **Pain points**: Registers drift, good versions become untraceable, citation
  errors pass a quick check, and reviewers cannot tell how AI was used. Sharing
  evidence risks releasing restricted material or more source text than the author means to send.
- **Desired outcome**: Disclosure and packages are generated from project
  records, source files are left out and quoted text is shortened as they are built, and
  anything that cannot be removed is reported.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| History | What changed, what was wrong, what needs another look? | Changelog, errata, and re-review lists |
| Chapter review | Where is this chapter weak? | Audit and fresh-eyes review |
| Sentence evidence | What stands behind each sentence of my report? | The evidence ledger of a report |
| Release evidence | What can I tell and give a reviewer, and what comes back? | Disclosure, reviewer package, and reviewer comments |

## Domain Objects

| Object | Meaning |
|--------|---------|
| Changelog entry | A dated account of a version built camera-ready or for review |
| Erratum | A found error with date, cause, and fix |
| Re-review list | Chapters, claims, and registers affected by a change. It is a list, not a verdict |
| Chapter audit | Rival readings, then citation repair, producing marked findings |
| Fresh-eyes review | A review in a context separate from drafting. It is not the audit or the claim-support check (FEAT-007) |
| Audit finding | An issue marked confirmed or suspected. It is not a scripted check result |
| AI-use disclosure | A statement about the tool's AI use. It is not the book's research methodology |
| Check report | The build's record of check results |
| Evidence ledger | For each sentence of a report, what is recorded about its writer and its source evidence. It is not a measure of truth |
| Reviewer package | PDF, offline explorer file, check report, and disclosure, with source files left out unless asked |
| Comment file | A reviewer's comments, each tied to a claim, saved from the offline explorer for the author to import |

## Requirements

### Functional Requirements by Area

#### History

- **HST-01** (FR-41, P1). Each camera-ready or reviewer build is meant to have a
  dated changelog entry for its version.
- **HST-02** (FR-41, P1). The build report must show a missing or undated entry.
  Draft builds need none.
- **HST-03** (FR-42, P1). Errors found must be recorded in an errata register
  with date, cause, and fix. A cause or fix not yet known must show as open.
- **HST-04** (FR-47, P1). When the thesis, a construct, the methodology, or
  evidence changes, a check must list the chapters, claims, and registers that
  need re-review.

#### Chapter review

- **REV-01** (FR-43). A chapter audit must run rival readings first and citation
  repair second.
- **REV-02** (FR-43). Each finding must be marked confirmed or suspected.
- **REV-03** (FR-43). Audit repairs must be offered to the author. An audit must
  not change a scripted result, annotate a finding, or settle an
  interpretation.
- **REV-05** (FR-43). Each rival reading must be recorded as a claim related to
  the claim it answers (FR-80), in effect and marked unreviewed (FR-23).
- **REV-04** (FR-44, P1). A fresh-eyes review must run in a context separate
  from the one that drafted the chapter.

#### Release evidence

- **REL-01** (FR-45). The system must generate from project records an AI-use
  disclosure that states which models and rules were used, what the AI did, what
  remains unreviewed, how many findings are open, and which annotations explain
  or dismiss findings.
- **REL-02** (FR-45). The disclosure must state that support verdicts were not
  rerun at build and that review marks and annotations are not forgery-proof.
- **REL-03** (FR-45). The disclosure must be separate from the book's research
  methodology and must show unknown values as unknown.
- **REL-04** (FR-46). A reviewer package must hold the PDF, an offline explorer
  file, the check report, and the AI-use disclosure.
- **REL-05** (FR-46). Source files must be left out of the package unless the
  author asks to include them, and source text in generated parts must be kept
  to short excerpts; their length is not yet set. Rights fields change nothing.
- **REL-06** (FR-46). Long source text that the scan finds and Stemma cannot
  remove must be reported with a warning. It is an open finding until fixed or
  dismissed (FR-30); the package is still produced and is not called checked
  clean while the finding is open.
- **REL-12** (FR-46). Structured restricted coordinates must be left out of
  every item. A scan must warn of stray restricted coordinates it finds. The
  warning must say that the package can disclose a restricted site's position,
  and the warning inside the package must not say where. Like any finding, a
  stray coordinate is open until fixed or dismissed (FR-30).
- **REL-07** (FR-46). The package must not claim that a reviewer can rerun the
  checks from it alone.
- **REL-08** (FR-46). Source text quoted as evidence in the packaged check
  report must be shortened to the allowed excerpt, with each result still
  visible. This covers the report's sentence fields.

#### Evidence ledger

- **LED-01** (FR-96, P1). A report build must write, beside the report, a ledger
  of every sentence of the body and of note comments, with the labels of
  CONTRACT-006 J and totals computed from those sentences.
- **LED-02** (FR-96, P1). Who wrote a sentence's words must come only from an
  authorship record made for the report's version that holds that exact
  sentence, with who recorded it. With no such record, records of that version
  that disagree, or a report that names no version, it is `unrecorded`.
- **LED-03** (FR-96, P1). A quotation copied by script, words typed between
  quotation marks, a citation with no quotation in the sentence, and a sentence
  with neither must stay distinct. Support must show as `not_judged` while no
  support record can be read.
- **LED-04** (FR-96, P1). The ledger must name every open and unimplemented
  check and every dismissed result, count the unreviewed records and confirmed
  results beside its label, say what it does not cover, and hold no source or
  sentence text.

#### Reviewer comments

- **COM-01** (FR-79). In the package's offline explorer, a reviewer must be able
  to attach a comment to a claim.
- **COM-02** (FR-79). The reviewer must be able to save the comments to a file,
  with no server or network.
- **COM-03** (FR-79). The author must be able to import that file and see each
  comment with its claim.
- **COM-04** (FR-79). Importing must change no claim, check result, or
  annotation.

### Non-Functional Requirements

- **Rights**: On a seeded project, 0 source files not asked for, long seeded source passages, or restricted coordinates from structured records appear in the parts Stemma generates, including metadata; a seeded string in the PDF is reported.
- **Offline**: The explorer file opens with networking disabled and makes 0
  network requests.
- **Reliability**: With unchanged records and tool versions, repeated disclosure
  generation and re-review lists give the same content.
- **Accessibility**: The explorer meets the `a11y-wcag-aa` practices as owned by
  FEAT-012; no separate target applies here.
- **Performance** and **Scalability**: N/A. The PRD sets no target.

## User Stories

- [US-062 — Keep a dated changelog](../user-stories/US-062-keep-a-version-changelog.md)
- [US-063 — Record an erratum](../user-stories/US-063-record-errata.md)
- [US-064 — Audit a chapter](../user-stories/US-064-audit-a-chapter.md)
- [US-065 — Run a fresh-eyes review](../user-stories/US-065-run-a-fresh-eyes-review.md)
- [US-066 — Generate an AI-use disclosure](../user-stories/US-066-generate-ai-use-disclosure.md)
- [US-067 — Create a reviewer package](../user-stories/US-067-create-a-reviewer-package.md)
- [US-068 — List what needs re-review after a change](../user-stories/US-068-list-what-needs-re-review.md)
- [US-069 — Assess a manuscript from its reviewer package](../user-stories/US-069-assess-a-reviewer-package.md)
- [US-104 — Return comments tied to claims](../user-stories/US-104-return-comments-on-claims.md)
- [US-124 — Show what supports each sentence](../user-stories/US-124-show-what-supports-each-sentence.md)

## Edge Cases and Error Handling

- **No AI-use records for part of the history**, including taken-over text: The
  disclosure states the gap and does not call that text human-written.
- **Host does not expose a model identity**: It is recorded as unknown
  (assumption; what hosts expose is unverified).
- **Ended annotation**: It is not listed as applying to current text.
- **Check evidence quotes a source**: REL-08 applies.
- **Comment on a claim whose text has changed**: It is imported and shown as
  made on earlier text. A comment on an unknown claim is reported and not
  imported (CONTRACT-005).
- **Comments not yet saved to a file**: They can be lost, and the page says so.
- **Comment file**: It is untrusted input; its text is data and is never treated
  as instructions.
- **Source with unstated rights**: Its material is left out of the package
  (assumption, the conservative reading).
- **Unmarked place**: Treated as public (FR-68, FR-81), so a restricted site
  nobody marked is not removed from the package and its position is disclosed.
- **Coordinate typed in prose**: The scan warns and the package is still made,
  so it can disclose the site. A clean scan shows
  only that the scan found nothing; feasibility tests showed leaks through
  prose, misclassification, and place names.
- **Re-review list with missing dependency links**: It states that only recorded
  links were followed.

## Constraints and Assumptions

- Concerns: `ai-disclosure` (record model, prompt version, role, and annotations;
  generate from the record), `honest-assurance` (name what rests on a record
  alone; findings are not verification), `rights-and-permissions` (scan
  packages), `deterministic-checks` (re-review lists and scans are scripted;
  audit output is model output and is saved first), `citation-integrity`,
  `security-owasp`, and `cross-platform`.
- Assumption (PRD): a release build and a released version are the camera-ready
  and reviewer builds.
- Quotations that the author prints in the book remain in the PDF; permission to
  print them is the author's responsibility (assumption).
- The disclosure is only as complete as the records. Work done outside Stemma
  sessions is not observed.
- The offline explorer comes from FEAT-012. A single-file explorer opened from
  disk in one headless browser test; desktop viewers and other browsers are
  unverified.
- Unverified: whether a separate context can be established and shown in each
  host.

## Dependencies

- **Other features**: FEAT-007 (results, support records, annotations), FEAT-008
  (builds and build record), FEAT-012 (offline explorer). It reads FEAT-001
  registers and rules, FEAT-006 authorship marks when they exist (for the
  disclosure and the evidence ledger, which also reads FEAT-002 text reviews and
  FEAT-008 report assembly), and
    FEAT-013 FR-68 restricted-coordinate rules. Records, including imported
  comments, are held by FEAT-011. M2 work does not wait on FEAT-012.
- **External services**: the hosted model for audits and reviews.
- **PRD requirements**: FR-41 to FR-47, FR-79, FR-96; related FR-1, FR-10, FR-39.

## Out of Scope

- Meeting a particular publisher's disclosure form or policy.
- A reviewer rerunning checks from the package alone.
- Editing in the offline explorer.
- Signed or second-party approval.
- A hosted review service or comment server.
- Threaded discussion or replies sent back to a reviewer.

## Open Questions

- [ ] What makes an audit finding confirmed rather than suspected? Until
  decided, assume confirmed means reproduced by a scripted check or confirmed by
  the author. Product owner.
- [ ] How long may a short matching excerpt of a source be? Until
  set, the explorer and report keep none. Product owner.
