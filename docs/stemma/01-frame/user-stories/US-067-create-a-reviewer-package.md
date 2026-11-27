---
ddx:
  id: US-067
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-067: Create a reviewer package

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: REL-04, REL-05, REL-06, REL-07, REL-08, REL-12
**PRD Requirements**: FR-46
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to create a reviewer package for my book
**So that** a reviewer can assess it offline without receiving material I may not share.

## Context

Idris holds restricted site data, and his repository holds the full text of his sources. A package that discloses a site, or sends more than he means, cannot be recalled.

## Walkthrough

1. Idris requests a reviewer package.
2. The reviewer build completes with its report.
3. The system assembles the PDF, offline explorer file, check report, and disclosure, leaving source files out and shortening quoted source text in what it generates.
4. It scans the package for long source text and stray restricted coordinates.
5. Idris receives the package with any warnings and decides whether to send it.

## Acceptance Criteria

- [ ] **US-067-AC1** — Given a reviewer build, when packaging completes, then the package holds the PDF, offline explorer file, check report, and disclosure, whatever the findings.
- [ ] **US-067-AC2** — Given source files in the project and no request to include them, when the package is created, then no generated item holds them or long passages from them, whatever their rights fields.
- [ ] **US-067-AC3** — Given long source text the scan finds that cannot be removed, such as in the PDF, when the package is created, then it is reported with its location and a warning that the package can disclose it, and while that finding is open the package is not labelled checked clean.
- [ ] **US-067-AC5** — Given a finished package, when its statements are read, then none says the reviewer can rerun the checks from it.
- [ ] **US-067-AC6** — Given a check result whose evidence or sentence quotes source text, when the package is created, then the packaged report keeps at most a short excerpt of it and still shows the result.
- [ ] **US-067-AC7** — Given a stray restricted coordinate in the project, when the scan runs, then the author sees its location, the packaged warning says the package can disclose the site without saying where, and the package is produced.

## Edge Cases

- **Short excerpt**: A short excerpt may stay; until its length is set, none is kept.
- **Coordinate typed in a note**: A clean scan does not prove none remains.
- **Messages**: No shareable output prints the restricted value.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Contents | US-067-AC1 | Fixture with open findings | Package | 4 items |
| Left out | US-067-AC2 | 2 sources with seeded phrases, one flagged unpublished | Package | No source file and no long seeded passage in any generated item |
| Unremovable | US-067-AC3 | A long source passage in the manuscript | Package | Made; finding and warning; not checked clean |
| Claim | US-067-AC5 | Finished package | Read report and disclosure | No rerun claim |
| Shortened | US-067-AC6 | Near match quoting a source | Package | Result shown; quoted text shortened |
| Coordinate warning | US-067-AC7 | Synthetic restricted coordinate typed in prose | Package | Package made; warning without location inside it |

## Dependencies

- **Stories**: US-055, US-066.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: REL-04, REL-05, REL-06, REL-07, REL-08, REL-12
- **PRD Requirements**: FR-46
- **External**: FEAT-012 offline explorer; FEAT-013 restricted-location rules. Interface surface belongs in Contract artifacts.

## Out of Scope

- Reviewer comments (US-104).
- Rerunning checks from the package.
