---
ddx:
  id: US-015
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-003
    - stemma.prd
---

# US-015: Exchange a legacy library without loss

**Feature**: FEAT-003 — Citation store
**Feature Requirements**: XCH-01, XCH-02, XCH-03, XCH-04
**PRD Requirements**: FR-13
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to import my reference library and export it again in the same format
**So that** I can keep exchanging references with co-authors without losing any information.

## Context

Tomasz relies on existing reference tooling and fears a one-way move. Same-format exchange keeps information while layout may change; other exports can lose what a format cannot hold. Libraries saved by real tools are untested.

## Walkthrough

1. Tomasz imports a BibLaTeX library with an unrecognized field and a comment.
2. Stemma reports how many entries it read and any it could not.
3. Tomasz exports to BibLaTeX.
4. The export holds the same information, including the unrecognized field and comment.

## Acceptance Criteria

- [ ] **US-015-AC1** — Given a BibLaTeX library with an unrecognized field and a comment, when it is imported and exported as BibLaTeX, then all information including both is present.
- [ ] **US-015-AC2** — Given a CSL-JSON library with an unrecognized field, when it is imported and exported as CSL-JSON, then all its information is present.
- [ ] **US-015-AC3** — Given a RIS library with an unrecognized tag and free-text notes, when it is imported and exported as RIS, then all its information is present.
- [ ] **US-015-AC4** — Given Stemma data a legacy format cannot hold, when it is exported to that format, then everything the format can hold is exported, a loss report names what was left out, and the Stemma records are unchanged.
- [ ] **US-015-AC5** — Given a library with an entry that cannot be read completely, when it is imported, then that entry is reported and none is dropped silently.
- [ ] **US-015-AC6** — Given a library containing a LaTeX macro that would run a command, when it is imported, then nothing in it is executed.

## Edge Cases

- **Imported key matches an existing key**: Stemma reports both and asks; it overwrites neither.
- **Original library file**: Import does not modify it.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| BibLaTeX | US-015-AC1 | Entry with field x-fieldcode = "AB12" and comment "check translator" | Import, export | Both present; layout may differ |
| CSL-JSON | US-015-AC2 | Item with member "x-shelf": "R4" and a note | Import, export | All members and values present |
| RIS | US-015-AC3 | Record with an unrecognized tag value "Z9" and two notes | Import, export | Tag value and both notes present |
| Lossy export | US-015-AC4 | Record with fields and a linked claim; export to RIS | Export | Holdable values present; loss report names the claim link; project records unchanged |
| Broken entry | US-015-AC5 | 3 entries; second has an unclosed brace | Import | Report names the affected entry; accounted total is 3 |
| Hostile macro | US-015-AC6 | Title containing a shell-escape macro | Import | Value kept as text; nothing runs |

## Dependencies

- **Stories**: US-013, US-014.
- **Feature Spec**: FEAT-003 — Citation store
- **Feature Requirements**: XCH-01, XCH-02, XCH-03, XCH-04
- **PRD Requirements**: FR-13
- **External**: Format versions, field mapping, and any loss report belong to Contract artifacts. Every legacy export produces a loss report (CONTRACT-003 E).

## Out of Scope

- Word manuscripts and embedded fields (FEAT-015).
- Cross-format lossless conversion.
- Byte-identical output.
