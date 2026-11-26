---
ddx:
  id: US-017
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-003
    - stemma.prd
---

# US-017: Find uncited bibliography entries

**Feature**: FEAT-003 — Citation store
**Feature Requirements**: BIB-01, BIB-02, BIB-03
**PRD Requirements**: FR-15
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to be told which listed bibliography entries the text never cites
**So that** I can decide what to do about each before I publish

## Context

Uncited bibliography entries are a recorded citation error. Margit's corpus can still hold many sources the book never cites. A taken-over project lists its whole original reference list.

## Walkthrough

1. Margit builds the book with one work listed for the bibliography and cited nowhere.
2. The build completes, and its report names the entry and suggests citing it, removing it from the list, or dismissing the finding.
3. Margit cites it or removes it from the list when she chooses.
4. The next report shows no uncited entry.

## Acceptance Criteria

- [ ] **US-017-AC1** — Given a source listed for the built bibliography, cited nowhere and not dismissed, when any build runs, then it completes and its report names the entry with suggested actions.
- [ ] **US-017-AC2** — Given every listed entry is cited, when a build runs, then this requirement produces no finding.
- [ ] **US-017-AC3** — Given a corpus source that is neither cited nor listed in the bibliography, when a build runs, then it produces no finding.
- [ ] **US-017-AC4** — Given an uncited entry the author has dismissed with an annotation, when a build runs, then the finding is listed as dismissed and not open, and when the entry's content changes, then it is open again.

## Edge Cases

- **Entry cited only in a footnote or caption**: It counts as cited when the footnote or caption is part of the built text.
- **Citation removed during revision**: The next check reports the entry as uncited.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Uncited | US-017-AC1 | Entries A and B listed; only A cited | Camera-ready build | Completes; B named; not checked clean |
| All cited | US-017-AC2 | Both cited | Build | No uncited-entry finding |
| Corpus only | US-017-AC3 | Corpus source C not listed | Build | No finding for C |
| Dismissed | US-017-AC4 | Entry B dismissed with a reason, then edited | Build before and after the edit | Dismissed, then open |

## Dependencies

- **Stories**: US-013, US-016, US-022, US-026.
- **Feature Spec**: FEAT-003 — Citation store
- **Feature Requirements**: BIB-01, BIB-02, BIB-03
- **PRD Requirements**: FR-15
- **External**: Delivery step M1, because takeover lists the original reference list (FR-72); building belongs to FEAT-008. Only a listed source can be an uncited entry (PRD assumption; CONTRACT-006).

## Out of Scope

- Further-reading lists, which no requirement defines.
- Layout of the printed bibliography.
