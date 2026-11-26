---
ddx:
  id: US-016
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-003
    - stemma.prd
---

# US-016: Cite with stable keys and typed locators

**Feature**: FEAT-003 — Citation store
**Feature Requirements**: KEY-01, KEY-02, KEY-03
**PRD Requirements**: FR-14
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to cite a source by a stable key and say whether my locator is a page, folio, chapter, or other place
**So that** each citation keeps pointing to the same work and is labelled correctly in the chosen style.

## Context

An untyped number can be read as a page when it is a folio or chapter. The style is a project setting, so citations carry meaning rather than formatting.

## Walkthrough

1. Idris cites a manuscript source by key with folio 12v.
2. Stemma resolves the key to one record and keeps the folio type.
3. Idris views the formatted citation under the project style.
4. The locator is labelled as a folio.

## Acceptance Criteria

- [ ] **US-016-AC1** — Given an in-text citation with a key, when it is resolved, then it identifies exactly one record and keeps doing so after other records are added.
- [ ] **US-016-AC2** — Given a folio locator, when the citation is stored and formatted, then it remains a folio and is not shown as a page.
- [ ] **US-016-AC3** — Given a project citation style, when the author changes it, then the in-text citations need no edit.

## Edge Cases

- **Locator with no type**: It is reported rather than silently assumed to be a page.
- **Unknown key**: It is reported (US-022).
- **Style outside the guaranteed set**: Output is labelled unverified (FR-38, FEAT-008).

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Stable | US-016-AC1 | Key hartwell2019terraces; add another Hartwell 2019 source | Resolve before and after | Same record both times |
| Folio | US-016-AC2 | Locator type folio, value "12v" | Format in project style | Labelled as a folio |
| Style setting | US-016-AC3 | Chapter with 3 citations | Change style setting | Citation text in source files unchanged |

## Dependencies

- **Stories**: US-013.
- **Feature Spec**: FEAT-003 — Citation store
- **Feature Requirements**: KEY-01, KEY-02, KEY-03
- **PRD Requirements**: FR-14
- **External**: Key and locator syntax belong to Contract artifacts. citeproc-js formatting of each Chicago note form is unverified; formatted output is delivered with FEAT-008.

## Out of Scope

- Approving Chicago example output (FR-38).
- Checking a locator against the source extent (US-024).
