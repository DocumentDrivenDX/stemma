---
ddx:
  id: US-112
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-112: Capture a passage and cite it verbatim

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: PAS-01, PAS-02, CHG-01
**PRD Requirements**: FR-90
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to select evidence by its address and have the quotation and page copied for me
**So that** no quotation or page number in my book was typed from memory by a person or a model.

## Context

Choosing passages is judgment. Their text, locator, citation, and later footnote are mechanical.

## Walkthrough

1. Claude finds where words occur in a source and picks the passage that bears on the thesis.
2. It captures the passage by address; Stemma copies the exact text and locator and records who selected it.
3. A citation made from the passage takes both.
4. If the page changes, the passage and citation are reported.

## Acceptance Criteria

- [ ] **US-112-AC1** — Given an address range across a page break, when captured, then the text and locator are copied without running heads or footnotes, with the approved joins in the quotation.
- [ ] **US-112-AC2** — Given a citation made from a passage with a quotation typed beside it, when added, then it is refused; and a citation whose quotation or locator later differs from its passage is reported.
- [ ] **US-112-AC3** — Given a captured passage, when a page it lies on changes, then it is reported as changed, and a change elsewhere does not affect it.

## Edge Cases

- **Words occurring twice**: Each occurrence has its own address.
- **Words only in a footnote**: The passage address names the notes stream.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Range | US-112-AC1 | Two synthetic pages with a running head and note | Capture | Exact text, quotation, and "1-2" |
| Typed quotation | US-112-AC2 | Citation with passage and quotation | Add | Refused |
| Change | US-112-AC3 | Edit one page and seal | Check | That passage reported; others not |

## Dependencies

- **Stories**: US-009, US-016.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: PAS-01, PAS-02, CHG-01
- **PRD Requirements**: FR-90
- **External**: Passage addresses (CONTRACT-007 H).

## Out of Scope

- Footnote generation in builds (FR-91).
- Research questions and theses.
