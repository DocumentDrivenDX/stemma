---
ddx:
  id: US-094
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-094: Open the explorer as a local browser bundle

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: BRW-01, BRW-02, BRW-03, BRW-04, BRW-05, BRW-06
**PRD Requirements**: FR-76
**Priority**: P0

## Story

**As a** Priya, the technologist-researcher
**I want** to open the explorer bundle from a local file and inspect what it runs
**So that** I can use it offline with no server and see that project code is TypeScript running in the browser.

## Context

All exploration and rendering code the project writes is TypeScript bundled for the browser, and the explorer needs no backend (ADR-008). The stock arras static build did not open from a local file in a feasibility test. The same bundle form supplies the reviewer's offline file.

## Walkthrough

1. Priya generates the explorer for a synthetic project.
2. With the network disabled, they open it from a local file.
3. They navigate between records and pages.
4. They inspect the source and bundle.

## Acceptance Criteria

- [ ] **US-094-AC1** — Given the explorer source and bundle, when they are inspected, then exploration and rendering code written by the project is TypeScript bundled for the browser.
- [ ] **US-094-AC2** — Given no server and no network, when Priya opens the bundle from a local file in a real browser, then a core record flow works, including navigation.
- [ ] **US-094-AC3** — Given the bundle is in use, when its network activity is observed, then it sends no request.
- [ ] **US-094-AC4** — Given a record or source containing markup and script, when it is displayed, then it appears as text and nothing runs.
- [ ] **US-094-AC5** — Given data that FEAT-009 has filtered, when the offline explorer file is generated, then it contains only that data plus the explorer itself.
- [ ] **US-094-AC6** — Given a project whose records changed, when the explorer is generated again, then its graph is rebuilt from the record files, and no generated browser graph is committed to the repository.

## Edge Cases

- **Browser with no observed run**: It is described as untested.
- **Large project file**: The size and any load limit are stated.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Language | US-094-AC1 | Explorer source and build | Inspect | TypeScript bundled for browser |
| Local file | US-094-AC2 | Network off; local file | Open, search, open a record, go back | Flow works |
| No requests | US-094-AC3 | Network monitor | Use explorer | Zero requests |
| Hostile record | US-094-AC4 | Note text containing `<script>alert(1)</script>` | Display | Shown as text; no script runs |
| Filtered data | US-094-AC5 | Input without restricted source `s-9` | Generate offline file | No `s-9` content present |
| Generated graph | US-094-AC6 | New project; edit a record | Generate; inspect git status and graph | Graph reflects the edit; generated files not tracked |

## Dependencies

- **Stories**: US-090.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: BRW-01, BRW-02, BRW-03, BRW-04, BRW-05, BRW-06
- **PRD Requirements**: FR-76
- **External**: A web browser. FEAT-009 supplies filtered reviewer data.

## Out of Scope

- Rules for what is removed from a reviewer package (FEAT-009).
- Hosting the explorer.
