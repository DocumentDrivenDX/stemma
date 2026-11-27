---
ddx:
  id: US-014
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-003
    - stemma.prd
---

# US-014: Record sources of many types

**Feature**: FEAT-003 — Citation store
**Feature Requirements**: REC-03
**PRD Requirements**: FR-12
**Priority**: P0

## Story

**As a** Priya, the technologist-researcher,
**I want** to record books, papers, specifications, web pages, datasets, and code as sources
**So that** each cited item in a technical book has a record that keeps what identifies it.

## Context

Priya's sources include material that changes or disappears. Each type needs its own identifying information, such as a version, an access date, a containing work, or an archive location.

## Walkthrough

1. Priya adds a book chapter, an archive item, a dataset, and a web page.
2. Stemma records each with its type and fields.
3. Priya reads the records back.
4. Each keeps its type and the information entered.

## Acceptance Criteria

- [ ] **US-014-AC1** — Given a book chapter, archive item, dataset, and web page, when each is recorded, then each record keeps its type and the type's entered fields.
- [ ] **US-014-AC2** — Given each listed source type (book, chapter, article, thesis, report, archive, dataset, web page, code), when a fixture record of it is saved, then it is accepted as that type.

## Edge Cases

- **Type outside the list**: All entered information is kept and the type is reported as unrecognized.
- **A web page changed after capture**: The captured source file, not the live page, is what is cited.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Mixed types | US-014-AC1 | Chapter with containing book and pages 31-60; archive item with repository and shelfmark; dataset with version 2.1; web page with access date 2026-03-04 | Record and read back | Types and values unchanged |
| All types | US-014-AC2 | One synthetic fixture per listed type | Save | All nine accepted |

## Dependencies

- **Stories**: US-013.
- **Feature Spec**: FEAT-003 — Citation store
- **Feature Requirements**: REC-03
- **PRD Requirements**: FR-12
- **External**: Field sets per type belong to Contract artifacts. Types outside the nine listed are not defined here.

## Out of Scope

- Dataset derivation provenance.
- Image records (FR-58).
