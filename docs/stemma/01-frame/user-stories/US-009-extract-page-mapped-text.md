---
ddx:
  id: US-009
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-009: Read source text by printed page or chapter

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: TXT-01, TXT-02, TXT-03
**PRD Requirements**: FR-8
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to look up what a source says on a printed page, or in a chapter and paragraph when it has no pages
**So that** a place I cite leads to the same words I would see in the work.

## Context

Printed page numbers often differ from positions in a file, front matter uses its own numbering, and many text sources have no pages at all.

## Walkthrough

1. Margit captures a PDF with roman-numbered front matter and a body starting at page 31.
2. Stemma writes one file for each page with its label and how the label was determined.
3. Margit opens printed page 41 and sees that page's text, without its running head.
4. For a text with no pages, she finds a passage by chapter and paragraph.

## Acceptance Criteria

- [ ] **US-009-AC1** — Given a PDF with roman and arabic printed labels, when it is converted, then text is retrievable by each printed label.
- [ ] **US-009-AC2** — Given a converted source, when a part is read, then it records the method, tool versions, and quality.
- [ ] **US-009-AC3** — Given a page whose label cannot be established, when it is converted, then it is marked so and given no label from its file position.
- [ ] **US-009-AC4** — Given a source with no pages, when it is converted, then no page number is given to it, and chapter and paragraph locators work.

## Edge Cases

- **Damaged or encrypted file**: Conversion reports failure and writes nothing.
- **The same original converted again with a new tool version**: A new source file is written and what rested on the old one is flagged when it is retired.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Mapped | US-009-AC1 | Synthetic PDF with pages ix-xii and 31-60 | Look up "x" and "41" | Text of those printed pages is returned |
| Recorded | US-009-AC2 | Same PDF | Read a page file | Method, tool version, and quality present |
| Unlabelled | US-009-AC3 | Synthetic plate with no printed number | Convert | Page marked undetermined |
| Unpaged | US-009-AC4 | Synthetic text with two chapters | Convert and cite chapter 2 | No page numbers; the chapter locator is checked |

## Dependencies

- **Stories**: US-007.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: TXT-01, TXT-02, TXT-03
- **PRD Requirements**: FR-8
- **External**: The PDF text library is pinned (SD-002). Real publisher and library files beyond those tested are unverified.

## Out of Scope

- A built-in recognition engine.
- Quotation and locator checks (US-024).
