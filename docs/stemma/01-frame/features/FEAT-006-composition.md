---
ddx:
  id: FEAT-006
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
---

# Feature Specification: FEAT-006 — Composition

**Feature ID**: FEAT-006
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 6. Composition
**Covered PRD Requirements**: FR-24, FR-25, FR-26 (P1), FR-27 (P1), FR-28 (P1)
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Composition turns the author's inputs and claim ledger into an outline,
chapter specifications, and manuscript text. It covers PRD FR-24 to FR-28. The
P0 requirements, outline derivation and drafting from the ledger, are in
delivery step M2.

## Ideal Future State

The author sees a proposed book structure that shows which inputs shaped it,
and changes it whenever they like. Drafting works from the claim ledger, so that a
sentence marked as needing a source arrives with a citation the checks can test,
or is reported as lacking one. The author can ask for rival readings, record who
wrote what, and is asked where their own interpretation matters.

## Problem Statement

- **Current situation**: Authors prompt an assistant with loose context and
  paste the prose into a manuscript.
- **Pain points**: Drafts assert more than the sources support or carry invented
  citations, structure drifts from the thesis, and the author later cannot say
  which passages the AI wrote.
- **Desired outcome**: Drafting works from the plan and ledger without waiting, shows what in them is unreviewed, and uses only recorded
  ledger entries, and every marked assertion either has a key and locator or is
  reported.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Planning | What is the shape of this book? | Derive an outline and chapter specifications |
| Drafting | Write this from what I can support | Draft from ledger entries and carry citations |
| Interpretation | What argues against me, and what must I decide? | Rival readings and interpretive checkpoints |
| Authorship record | Who wrote this passage? | Keep authorship marks per version |

## Domain Objects

| Object | Meaning |
|--------|---------|
| Outline | The ordered structure of the book |
| Chapter specification | What one chapter must argue and use, including the inputs it relies on |
| Draft | Manuscript text. Its sentences are not claims until recorded as such (FEAT-005) |
| Alternative-interpretations section | Optional chapter content with adversarial counter-arguments (FR-26). It differs from the rival-readings pass of a chapter audit (FR-43, FEAT-009), which produces findings |
| Plan review | The author's optional, dated review mark on the plan |
| Interpretive checkpoint | A point that asks for the author's own input; it never halts work |
| Authorship mark | A declaration that a passage was AI-drafted, human-written, or edited |

## Requirements

### Functional Requirements by Area

#### Planning

- **PLAN-01** (FR-24). The system must derive an outline and chapter
  specifications from the thesis, audience, scope, and ledger.
- **PLAN-02** (FR-24). When constructs or a research methodology exist, the
  derivation must use them and the chapter specifications must name them. Their
  absence must not block derivation.
- **PLAN-03** (FR-24). Drafting must be able to use an outline and chapter
  specification at once; they are marked unreviewed until the author reviews
  them. The author may edit them at any time.
- **PLAN-04** (FR-24). A later change to a plan takes effect at once, marked
  unreviewed, and the earlier version stays in the history.

#### Drafting

- **DRFT-01** (FR-25). Drafts must be written from ledger entries in effect, and
  the assistant must say which of them are unreviewed.
- **DRFT-02** (FR-25). A drafted assertion that the author or assistant marks as
  needing a source must carry a citation key and a typed locator.
- **DRFT-03** (FR-25). A marked assertion without both must be reported. When no
  ledger entry supports requested text, the assistant must say so and must not
  invent a source, locator, or quotation.

#### Interpretation (P1)

- **ALT-01** (FR-26). The author must be able to give any chapter a section of
  alternative interpretations drafted as adversarial counter-arguments. Its
  sourced assertions follow DRFT-01 to DRFT-03.
- **CHK-01** (FR-28). At an interpretive checkpoint the system must ask for the
  author's input and must not halt work. An unanswered checkpoint is reported,
  and an assistant's answer does not count as the author's.
- **CHK-02** (FR-28). A setting must control how many checkpoints apply, and a
  fluent author may turn all of them off (FR-51).

#### Authorship record (P1)

- **AUTH-01** (FR-27). The author must be able to mark passages as AI-drafted,
  human-written, or edited.
- **AUTH-02** (FR-27). Marks must be kept per version, so an earlier version's
  marks remain readable after later edits. Unmarked text must show as unmarked.
  For an assembled report, a version is the one its `report.json` names, and a
  mark applies sentence by sentence to that version only (CONTRACT-006 J).

### Non-Functional Requirements

- **Rights**: Drafting sends a hosted model only the excerpts the task needs
  (FR-61); no source is held back individually.
- **Reliability**: Reporting of marked assertions that lack a key or locator
  gives identical results on repeated runs over the same inputs and versions.
- **Performance**, **Security**, **Scalability**: N/A beyond the project
  concerns; the PRD sets no target.

## User Stories

- [US-044 — Use and review a derived outline](../user-stories/US-044-review-outline-and-chapter-specifications.md)
- [US-045 — Draft a section from the claim ledger](../user-stories/US-045-draft-from-the-claim-ledger.md)
- [US-046 — Add a section of alternative interpretations](../user-stories/US-046-draft-rival-interpretations.md)
- [US-047 — Mark who wrote each passage](../user-stories/US-047-mark-passage-authorship.md)
- [US-048 — Answer interpretive checkpoints](../user-stories/US-048-answer-interpretive-checkpoints.md)

## Edge Cases and Error Handling

- **Empty or thin ledger**: Planning may propose a structure and must show which
  chapters lack supporting entries. It must not manufacture claims to fill them.
- **Opposing ledger entries**: The draft or specification keeps the
  disagreement visible; the assistant does not settle it.
- **Source changed after drafting**: Dependent claims and citations are flagged
  (FR-10, FEAT-002); composition does not clear the flags.
- **Draft that uses a construct inconsistently**: The agent may advise; the
  advice is not a finding (FR-22).
- **Draft that overstates its claim**: Drafting does not certify support. The
  FEAT-007 check, run in a separate context, reports it.
- **Voice profile set**: It shapes wording only and never changes a quotation or
  what a claim asserts (FEAT-014).
- **Marked passage later edited**: The mark of the new version is not inferred
  from the old one as still human-written or AI-drafted (assumption).

## Constraints and Assumptions

- Drafts are written in the marked-up Markdown of CONTRACT-006 (ADR-009),
  including its citation, claim, and needs-a-source markers.
- Concerns: `citation-integrity` (drafting keeps the chain from text to source
  source), `ai-disclosure` (drafting records model, prompt version, and role),
  `rights-and-permissions` (excerpts only), `security-owasp` (notes and source
  text are data, never instructions), `deterministic-checks` (model output is
  saved before a script reads it), and `honest-assurance` (authorship marks and
  review marks are declarations; Stemma does not detect AI authorship).
- AI-written prose is allowed. The first version has no mode that prevents the
  agent from writing manuscript text.
- Marking what needs a source relies on the author or assistant. An unmarked
  assertion is not caught by DRFT-03.
- Unverified: drafting quality and a model's reliability in marking assertions
  were not tested.

## Dependencies

- **Other features**: FEAT-001 (inputs, rules, constructs, methodology),
  FEAT-005 (notes, ledger, construct register), FEAT-011 (records); optional
  FEAT-014 (voice profiles). FEAT-007 checks drafted text; FEAT-009 reads
  authorship marks for disclosure.
- **External services**: the hosted model of the author's assistant session.
- **PRD requirements**: FR-24 to FR-28.

## Out of Scope

- Claim-support verdicts and reports (FEAT-007).
- Chapter audits and fresh-eyes review (FEAT-009).
- Typeset structure and output (FEAT-008).
- A publisher-compliance mode that stops the agent writing prose.
- Automated detection of AI-written text.

## Open Questions

- [ ] Where in a chapter's progress do checkpoints fall? Blocks FR-28 design;
  product owner.
- [ ] What counts as a version of a book manuscript for authorship marks?
  Blocks FR-27 design for chapters; design owner. For assembled reports it is
  settled: the owner chose the version `report.json` names, with sentence
  matching (2026-11-27, CONTRACT-006 J).
