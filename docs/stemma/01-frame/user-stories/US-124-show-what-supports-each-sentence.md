---
ddx:
  id: US-124
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-124: Show what supports each sentence

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: LED-01, LED-02, LED-03, LED-04
**PRD Requirements**: FR-96
**Priority**: P1

## Story

**As** Idris, the AI-fluent humanist
**I want** each build to record what stands behind every sentence of my report,
and which sentences are mine
**So that** I can sign that record and show a reader how much rests on unchecked
model wording.

## Context

A quotation copied by script, a model's paraphrase beside it, and a sentence I
wrote are different things. A single percentage would hide that, and no tool
here can measure how much of a text is invented.

## Walkthrough

1. Idris builds the report. The build writes the report and its ledger.
2. The build says how many sentences hold a script-copied quotation, how many
   only a citation, how many neither, and for how many nobody is recorded as
   writer.
3. Idris records some sentences as written by them and builds again.
4. Idris gives the report and the ledger to Innsigle to sign.

## Acceptance Criteria

- [ ] **US-124-AC1** — Given a report, when it is built, then each body and comment sentence has a basis of `quotation`, `cited`, or `uncited`, and the totals equal a recount of the sentences.
- [ ] **US-124-AC2** — Given no authorship record, when it is built, then every sentence's writer is `unrecorded`; given a record that holds a sentence, only that sentence takes its value and who recorded it.
- [ ] **US-124-AC3** — Given two records that disagree on a sentence, when it is built, then its writer is `unrecorded`.
- [ ] **US-124-AC4** — Given words typed between double quotation marks, when it is built, then the sentence is marked as holding a typed quotation.
- [ ] **US-124-AC5** — Given a quoted passage with no text review, a model's flag, and a person's agreement, when it is built, then its comparison with the original reads `none_recorded`, `flagged`, and `person`.
- [ ] **US-124-AC6** — Given any sentence with a quotation or citation, when it is built, then its support reads `not_judged`.
- [ ] **US-124-AC7** — Given a ledger, when it is read, then it names the open and unimplemented checks, says what it does not cover, and holds no sentence or source text.
- [ ] **US-124-AC8** — Given a changed report or record that changes the ledger, when `build report --check` runs, then the ledger is reported out of date.

## Edge Cases

- **A mark that covers a paragraph**: Each sentence in it takes the mark.
- **A sentence edited after it was marked**: It is `unrecorded` again.
- **A model records that a person wrote a sentence**: The ledger shows that a model said so.
- **Single quotation marks**: Not read as quotations; the ledger says so.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Basis | US-124-AC1 | Worked example | Build | Labels; totals equal a recount |
| Writer | US-124-AC2, AC3 | None, one, and two disagreeing marks | Build | As stated |
| Typed | US-124-AC4 | A quotation typed in the template | Build | Marked |
| Compared | US-124-AC5, AC6 | No review, a model's flag, a person's agreement | Build | As stated |
| Honest | US-124-AC7 | Worked example | Read | Checks and limits; no text |
| Stale | US-124-AC8 | Edited template | `--check` | Ledger out of date |

## Dependencies

- **Stories**: US-047 (authorship of passages) records the writer; `record add` is enough until `authorship mark` exists.
- **Feature Spec**: FEAT-009
- **Feature Requirements**: LED-01, LED-02, LED-03, LED-04
- **PRD Requirements**: FR-96
- **External**: Innsigle signs and checks the ledger; the build does not need it.

## Out of Scope

- A score or probability of hallucination.
- Judging whether a source supports a sentence (FR-52).
- Signing, which Innsigle does.
- A manuscript in the Stemma copy.
