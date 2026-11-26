---
ddx:
  id: US-097
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-013
---

# US-097: Keep restricted sites off maps and exports

**Feature**: FEAT-013 — Argument and geographic maps
**Feature Requirements**: LOC-01, LOC-02, LOC-03, LOC-04, LOC-08
**PRD Requirements**: FR-68
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to mark a site as restricted and use its evidence without publishing its position
**So that** no map or export I produce shows the exact coordinates.

## Context

An exact coordinate in a repository, bundle, or figure is itself a disclosure. Hiding it on screen is not enough. A place is public unless marked restricted, so a site nobody marks is disclosed. When to show nothing or a broad area is open.

## Walkthrough

1. Idris records a synthetic restricted site, with its exact coordinate in the outside store.
2. He opens the geographic map.
3. The site appears as nothing or a broad area.
4. He generates an export and finds no exact coordinate in its data.

## Acceptance Criteria

- [ ] **US-097-AC1** — Given a restricted site, when its records are saved through Stemma, then the exact coordinate is stored outside the repository.
- [ ] **US-097-AC2** — Given the same project, when the repository is searched, then no value or hash that allows the coordinate to be guessed is present.
- [ ] **US-097-AC3** — Given a restricted site, when a map is shown, then it shows nothing or a broad area.
- [ ] **US-097-AC4** — Given a restricted site, when an export is generated, then the exported data holds nothing or a broad area.
- [ ] **US-097-AC5** — Given map or export data files, when they are inspected, then the exact value is absent, not merely hidden on screen.
- [ ] **US-097-AC7** — Given a place not marked restricted, when a map or export is produced, then it is treated as public and shown, and Stemma says where places are recorded that an unmarked site's position will be shown and exported.

## Edge Cases

- **Outside store unavailable**: Maps and exports still show no exact restricted position.
- **Place name that reveals the site**: The product states that it may not detect this.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Storage | US-097-AC1 | Synthetic coordinate 0.12345, 0.67890 marked restricted | Save | Value only in outside store |
| Repository | US-097-AC2 | Same project | Search files and hashes | Nothing recoverable |
| Map | US-097-AC3 | Same site | View map | Nothing or broad area |
| Export | US-097-AC4 | Same site | Export | Nothing or broad area |
| Data | US-097-AC5 | Map data file | Search for `0.12345` | No match |
| Unmarked | US-097-AC7 | Place with coordinates, not marked restricted | Export | Position shown; the disclosure risk was stated where the place was recorded |

## Dependencies

- **Stories**: US-096.
- **Feature Spec**: FEAT-013
- **Feature Requirements**: LOC-01, LOC-02, LOC-03, LOC-04, LOC-08
- **PRD Requirements**: FR-68
- **External**: The outside store's location and access are open. Its interface belongs in a Contract.

## Out of Scope

- Scanning prose for stray values (US-098).
- Package failure rules (FEAT-009).
- Images, git history, and text already sent to a model.
