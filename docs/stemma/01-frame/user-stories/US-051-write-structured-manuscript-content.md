---
ddx:
  id: US-051
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-051: Write structured book content

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: STR-01, STR-02, STR-05
**PRD Requirements**: FR-35
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to write my book with its full scholarly apparatus in the project files
**So that** each element appears in its proper place in the typeset book without rework in another tool.

## Context

A monograph needs more than headings and paragraphs. Margit needs front matter, notes, figures, and an index expressed once.

## Walkthrough

1. Margit writes chapters with front and back matter, footnotes, endnotes, a figure with a caption, a table, a cross-reference, a block quote, and index entries.
2. Margit builds a draft.
3. Each element appears in its place.
4. Margit breaks one cross-reference, and the next build names it.

## Acceptance Criteria

- [ ] **US-051-AC1** — Given content with sections, front and back matter, footnotes, endnotes, figures, tables, captions, cross-references, block quotes, and index entries, when it is built, then each element appears in its place.
- [ ] **US-051-AC2** — Given an unresolved cross-reference or a structure that cannot be typeset, when a build runs, then it is reported with its location and no content is dropped silently.
- [ ] **US-051-AC3** — Given a figure in the manuscript, when its content is written, then its alternative text can be recorded with it and reaches the build.
- [ ] **US-051-AC4** — Given the manuscript working copy in marked-up Markdown with citation and claim markers, when it is built, then it is converted to Typst, and a layout feature the markup does not define is reported and not converted silently.

## Edge Cases

- **Index terms with diacritics**: They sort by a defined order and are not pushed after Z.
- **Per-chapter endnotes**: Numbering restarts only when so configured.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| All elements | US-051-AC1 | One fixture chapter with all eleven element kinds | Build | All present in place |
| Broken reference | US-051-AC2 | Reference to missing figure 'fig-harbor' | Build | Reports the reference and location |
| Alt text | US-051-AC3 | One figure with alternative text | Build | The text is carried into the PDF |
| Markdown | US-051-AC4 | Marked citations and claims plus one undefined feature | Build | Markers handled; undefined feature reported |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: STR-01, STR-02, STR-05
- **PRD Requirements**: FR-35
- **External**: Typst. Interface surface belongs in Contract artifacts.

## Out of Scope

- Right-to-left and mixed-script layout (US-053).
- The P1 image record (US-060).
- Citation formatting (US-052).
