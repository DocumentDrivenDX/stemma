---
ddx:
  id: US-107
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-107: Typeset the taken-over chapter in the pilot

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: PIL-01, PIL-03, PIL-04
**PRD Requirements**: FR-83
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to get a basic PDF of the chapter I took over
**So that** I can read my fixed text and its citations on pages during the pilot.

## Context

Delivery step M1. A watermarked draft and an unwatermarked basic PDF can both be built at any time, each with its report. Neither is print-ready. citeproc-js needs a license review before it is bundled, and nothing here has been tested on real files.

## Walkthrough

1. Idris resolves some references in a taken-over chapter, leaving one failing.
2. Idris builds the PDF.
3. Stemma typesets the Stemma copy with notes and a bibliography.
4. The draft carries the unverified watermark; the basic PDF has none and is labelled as having open findings until the failure is fixed.

## Acceptance Criteria

- [ ] **US-107-AC1** — Given a taken-over chapter, when the pilot build runs, then it produces a PDF with Typst from the Stemma copy.
- [ ] **US-107-AC2** — Given cited references, when the PDF is built, then citeproc-js formats the citations and bibliography in Chicago notes and bibliography, labelled unverified until the approved example set exists.
- [ ] **US-107-AC4** — Given an open finding in M1, when a PDF is requested, then both the watermarked draft and the unwatermarked basic PDF can be built, each with its report, and neither is labelled checked clean.
- [ ] **US-107-AC5** — Given nothing open, when the basic PDF is requested, then it is built without a watermark and labelled checked clean.

## Edge Cases

- **Construct the markup does not define**: It is reported, not silently converted.
- **Typst cannot lay out the content**: The location and cause are reported and no older PDF is presented as current.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Build | US-107-AC1 | Synthetic taken-over chapter | Build | PDF from the Stemma copy; originals unchanged |
| Citations | US-107-AC2 | 3 notes and 2 sources | Build | Formatted notes and bibliography |
| Open finding | US-107-AC4 | 1 failing quotation | Request each build | Both built; finding reported; not checked clean |
| Clean | US-107-AC5 | Nothing open | Build the basic PDF | No watermark; checked clean |

## Dependencies

- **Stories**: US-099, US-102.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: PIL-01, PIL-03, PIL-04
- **PRD Requirements**: FR-83
- **External**: Typst and citeproc-js at pinned versions.

## Out of Scope

- Running heads, table of contents, index, and print output (US-052, US-059).
- A print-ready book and a reviewer build.
