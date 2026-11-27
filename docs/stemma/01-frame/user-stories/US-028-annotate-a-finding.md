---
ddx:
  id: US-028
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-028: Annotate a finding

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: EXC-01, EXC-02, EXC-03, EXC-04, EXC-05, EXC-06, EXC-07
**PRD Requirements**: FR-32
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to explain or dismiss a specific finding for one sentence and source, with my reason, when I choose
**So that** my report and disclosure say what I decided, and the note stops applying if the text or source changes

## Context

Annotations are optional and permit nothing, because nothing is blocked. The record states intent; an agent with file access could forge it, and Stemma says so.

## Walkthrough

1. Idris looks at an unverifiable quotation they compared with the page image.
2. Idris asks Stemma to dismiss it and gives the reason.
3. Stemma records the dated annotation bound to that sentence and source.
4. Reports list the finding as dismissed, with the reason.

## Acceptance Criteria

- [ ] **US-028-AC1** — Given a finding, when the author annotates it with a reason, then a dated record holds the reason, the effect, the exact sentence, and the source.
- [ ] **US-028-AC2** — Given findings the author has not annotated, when the assistant works or builds, then it records no annotation and asks for none before continuing.
- [ ] **US-028-AC3** — Given an annotated sentence, when it changes, then the annotation ends and the finding is open again.
- [ ] **US-028-AC4** — Given an annotated source, when it changes, then the annotation ends.
- [ ] **US-028-AC5** — Given an annotation record, when its age or date is the only reason offered, then it covers nothing beyond its bound sentence and source.
- [ ] **US-028-AC6** — Given current annotations, when reports and the disclosure list them, then all appear with the statement that they are not forgery-proof.
- [ ] **US-028-AC7** — Given a finding with no sentence, such as an uncited entry, when the author annotates it, then the record is bound to that exact item and its current content.
- [ ] **US-028-AC8** — Given such an annotation, when the item's content changes, then it ends and the finding is open again.
- [ ] **US-028-AC9** — Given a missing source file, an unreadable record, or uncommitted changes, when the author asks to dismiss the finding, then an explanation may be saved and the finding stays open.

## Edge Cases

- **Annotation without a reason**: It is invalid and covers nothing.
- **Identical sentence appears twice**: An annotation must not silently cover another occurrence; binding design must distinguish them.
- **Annotation edited by hand**: Stemma cannot prove who wrote it.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Annotate | US-028-AC1 | Reason "checked against page image"; 2026-05-10 | Dismiss | All values recorded |
| Author only | US-028-AC2 | Request to build | Assistant works | No annotation; build completes |
| Sentence changed | US-028-AC3 | Change one word | Check | Annotation ended; finding open |
| Source changed | US-028-AC4 | Source file replaced | Check | Annotation ended |
| Date no leniency | US-028-AC5 | New failure dated before an unrelated annotation | Check | New finding open |
| Listing | US-028-AC6 | 2 current annotations | Report and disclose | Both listed with the limit |
| Item bound | US-028-AC7 | Uncited entry | Dismiss with reason | Entry and its content recorded |
| Item changed | US-028-AC8 | Edit that entry | Check | Ended; open |
| Not dismissible | US-028-AC9 | Cited source with no source file | Dismiss | Not dismissed; reason stated |

## Dependencies

- **Stories**: US-026.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: EXC-01, EXC-02, EXC-03, EXC-04, EXC-05, EXC-06, EXC-07
- **PRD Requirements**: FR-32
- **External**: Annotation shape belongs to Contract artifacts. What counts as a source change is open. Which findings cannot be dismissed is an assumption (PRD FR-32). Disclosure text is FEAT-009 (FR-45).

## Out of Scope

- Signed approvals.
- Project-wide or blanket dismissals.
