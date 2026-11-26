---
ddx:
  id: US-098
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-013
---

# US-098: Scan for stray coordinates before release

**Feature**: FEAT-013 — Argument and geographic maps
**Feature Requirements**: LOC-05, LOC-06, LOC-09
**PRD Requirements**: FR-68
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to run a release scan that reports coordinates left in files and prose
**So that** I can remove stray coordinates before anything leaves my project.

## Context

In a feasibility test, restricted coordinates stayed out of structured fields but leaked when typed into prose. A scan finds only the forms it checks, so a clean result is not proof. A finding is a warning, so an output can disclose a site.

## Walkthrough

1. Idris types a synthetic restricted coordinate into a note.
2. He runs the release scan.
3. The scan reports the file and place of the coordinate and states what it checked.
4. He removes it and scans again.

## Acceptance Criteria

- [ ] **US-098-AC1** — Given a restricted coordinate typed in prose, when the release scan runs, then it reports the file and place.
- [ ] **US-098-AC2** — Given a seeded set using each coordinate form the scan states it checks, when the scan runs, then every seeded item is reported.
- [ ] **US-098-AC3** — Given any scan result, when Idris reads it, then it states the file kinds and coordinate forms checked.
- [ ] **US-098-AC4** — Given a scan with no finding, when he reads it, then it is not presented as proof that no location leaks.
- [ ] **US-098-AC5** — Given the same files and tool versions, when the scan runs twice, then the findings are identical.
- [ ] **US-098-AC6** — Given a stray-coordinate finding, when a camera-ready build, export, or package runs, then it completes, the author sees the file and place and that the output can disclose the site, a packaged copy of the warning does not give the place, and the output is not labelled checked clean while the finding is open.

## Edge Cases

- **File the scan cannot read**: It is listed as not checked.
- **Finding is a public coordinate**: It is still reported; Idris decides what to change.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Prose | US-098-AC1 | Note containing synthetic `0.12345, 0.67890` | Scan | File and place reported |
| Forms | US-098-AC2 | Seeded decimal and degree-minute-second values, as listed by the scan | Scan | All listed forms reported |
| Scope | US-098-AC3 | Any project | Scan | Checked kinds and forms stated |
| Clean | US-098-AC4 | No seeded values | Scan | No finding; limit stated |
| Repeat | US-098-AC5 | Same project | Scan twice | Identical findings |
| Warn only | US-098-AC6 | Coordinate typed in prose | Build camera-ready and package | Both made; warning shown |

## Dependencies

- **Stories**: US-097.
- **Feature Spec**: FEAT-013
- **Feature Requirements**: LOC-05, LOC-06, LOC-09
- **PRD Requirements**: FR-68
- **External**: FEAT-009 packaging uses restricted-coordinate detection. The scan's report belongs in a Contract.

## Out of Scope

- Detecting place names or images that imply a position.
- Preventing a build or package.
