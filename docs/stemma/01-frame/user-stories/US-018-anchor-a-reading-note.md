---
ddx:
  id: US-018
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-005
    - stemma.prd
---

# US-018: Anchor a reading note to source text

**Feature**: FEAT-005 — Notes, claims, constructs
**Feature Requirements**: NOTE-01, NOTE-02, NOTE-03
**PRD Requirements**: FR-20
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to record an extract or paraphrase with its source and page
**So that** I can return to the passage and know my quoted words match the source text.

## Context

Margit drafts from their own notes. An extract that drifts from the source becomes an invented quotation later. A paraphrase can be anchored but not string-matched.

## Walkthrough

1. Margit selects a source and enters an extract from page 41.
2. Stemma saves the note with the source and locator.
3. Stemma compares the extract with the source text of that page.
4. Margit sees that it matches.

## Acceptance Criteria

- [ ] **US-018-AC1** — Given a captured source, when the author records an extract or paraphrase, then the note holds the source and a locator.
- [ ] **US-018-AC2** — Given an extract that differs from the source text at its anchor, when the check runs, then it does not pass and shows the extract and the source text.
- [ ] **US-018-AC3** — Given an extract present at its anchor, when the check runs, then it passes with the matched location as evidence.
- [ ] **US-018-AC4** — Given a paraphrase, when its anchor is checked, then no result reports its wording as matched to the source.
- [ ] **US-018-AC5** — Given an extract that is a near match beyond the defined harmless differences, when the check runs, then it is reported with both texts until the extract is fixed or the author dismisses the finding.

## Edge Cases

- **No extracted text for the page**: The extract result is unverifiable.
- **The wording occurs on another page only**: The anchored check does not pass; the other location may be shown as evidence.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Anchored | US-018-AC1 | Source hartwell2019terraces, page 41, extract "the lower terrace was ploughed" | Save | Source and locator stored |
| Changed extract | US-018-AC2 | Source "was ploughed"; extract "was never ploughed" | Run check | Fail with both texts |
| Match | US-018-AC3 | Exact source wording | Run check | Pass with location |
| Paraphrase | US-018-AC4 | Paraphrase on page 41 | Run check | Anchor result only |
| Near match | US-018-AC5 | Extract differing by one word | Check | Both texts shown; reported |

## Dependencies

- **Stories**: US-009, US-016.
- **Feature Spec**: FEAT-005 — Notes, claims, constructs
- **Feature Requirements**: NOTE-01, NOTE-02, NOTE-03
- **PRD Requirements**: FR-20
- **External**: The approved, untested list of harmless differences is in CONTRACT-002; any other near match is reported (US-024). Anchor shape belongs to Contract artifacts. Matching on real documents is unverified.

## Out of Scope

- Judging whether a paraphrase is faithful (US-032 judges claims).
- Manuscript quotation checks (US-024).
