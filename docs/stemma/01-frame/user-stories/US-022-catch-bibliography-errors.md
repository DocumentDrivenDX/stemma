---
ddx:
  id: US-022
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-022: Catch broken links between text and bibliography

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-01
**PRD Requirements**: FR-29
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to find citations with no bibliography entry and entries with no citation
**So that** I can fix both before anyone reads the book.

## Context

A citation key that resolves to nothing can be an invented reference. This is the first FR-29 error class pair and works from project files alone.

## Walkthrough

1. Margit asks Stemma to check a chapter and bibliography.
2. The scripted check compares keys and entries.
3. Stemma reports an unknown key and an uncited entry with their locations.
4. Margit corrects both and the rerun passes.

## Acceptance Criteria

- [ ] **US-022-AC1** — Given a citation whose key has no bibliography entry, when the check runs, then it fails and shows the key and location.
- [ ] **US-022-AC2** — Given a source listed for the built bibliography and cited nowhere, when the check runs, then it fails and names the entry.
- [ ] **US-022-AC3** — Given text the check cannot read for citations, when the check runs, then it reports unverifiable and not pass.

## Edge Cases

- **Two records share a key**: The citation is ambiguous and does not pass.
- **No bibliography exists yet**: Cited keys fail; the report does not say the chapter passed.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Missing entry | US-022-AC1 | Text cites ghost2020; no such record | Check | Fail: ghost2020 and its location |
| Uncited | US-022-AC2 | Entry orphan1990 listed and uncited | Check | Fail: orphan1990 |
| Unreadable | US-022-AC3 | Chapter file that cannot be parsed | Check | Unverifiable with reason |

## Dependencies

- **Stories**: US-013, US-016.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-01
- **PRD Requirements**: FR-29
- **External**: Manuscript citation syntax and result shape belong to Contract artifacts.

## Out of Scope

- How builds report uncited entries (US-017).
- Metadata comparison (US-023).
