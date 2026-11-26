---
ddx:
  id: US-052
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-052: Build the typeset book

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: BLD-01, BLD-02, BLD-05, BLD-06
**PRD Requirements**: FR-36
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to build a camera-ready PDF of my book with one action
**So that** I get a finished book with formatted citations and apparatus from the same files as my evidence.

## Context

One source of truth must reach the page. citeproc-js formats citations, then Typst lays out the book.

## Walkthrough

1. Idris works through the open findings as far as they choose.
2. Idris requests a camera-ready build.
3. The build reruns the checks.
4. citeproc-js formats citations and Typst lays out the book.
5. Idris receives a PDF with running heads, folios, contents, bibliography, and index, and a build record with the commit and tool versions.

## Acceptance Criteria

- [ ] **US-052-AC1** — Given a project whose manuscript can be typeset, when a camera-ready build runs, then a PDF is produced with running heads, folios, table of contents, formatted bibliography, and index.
- [ ] **US-052-AC2** — Given citations with typed locators, when the book is built, then the notes and bibliography come from citeproc-js output laid out by Typst.
- [ ] **US-052-AC3** — Given a successful camera-ready or reviewer build, when it finishes, then the commit and tool versions used are recorded.

## Edge Cases

- **Uncited bibliography entry**: The build report names it (FR-15, FEAT-003).
- **A pinned tool is missing or a different version**: The build says so and does not use the other version silently.
- **Offline machine**: The build downloads nothing.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Complete book | US-052-AC1 | 2-chapter fixture | Build camera-ready | PDF with all five apparatus items |
| Locator | US-052-AC2 | Citation with folio 12v | Build | Note shows a folio locator as formatted by citeproc-js |
| Record | US-052-AC3 | Fixture at a known commit | Build | Record lists that commit and Typst and citeproc-js versions |

## Dependencies

- **Stories**: US-051, US-055.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: BLD-01, BLD-02, BLD-05, BLD-06
- **PRD Requirements**: FR-36
- **External**: Typst, citeproc-js; FEAT-003, FEAT-007. Interface surface belongs in Contract artifacts.

## Out of Scope

- Guaranteed style examples (US-054).
- Print and bleed outputs (US-059).
