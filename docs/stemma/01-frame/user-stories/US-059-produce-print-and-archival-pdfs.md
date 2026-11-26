---
ddx:
  id: US-059
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-059: Produce print and PDF/A outputs

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: OUT-01, OUT-02, OUT-03, OUT-06
**PRD Requirements**: FR-57
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to get a print PDF with trim and bleed and a separate PDF/A
**So that** I can send the printer and the archive the file each needs without a false PDF/X claim

## Context

Tomasz's press asks for trim and bleed. Stemma produces an ordinary print PDF; PDF/X is out of scope.

## Walkthrough

1. Tomasz sets trim size and bleed for an RGB book.
2. Tomasz builds camera-ready.
3. The build produces a print PDF with those settings.
4. It produces a separate PDF/A, or says the tool could not.
5. Neither file or report claims PDF/X.

## Acceptance Criteria

- [ ] **US-059-AC1** — Given configured trim size and bleed, when the print PDF is built, then it has that trim size and bleed area.
- [ ] **US-059-AC2** — Given a black-and-white or RGB book, when camera-ready outputs are built, then a separate PDF/A is produced or a tool limit is stated.
- [ ] **US-059-AC3** — Given any build output, when its labels and reports are read, then none claims PDF/X.
- [ ] **US-059-AC5** — Given a figure with no alternative text, when the PDF/A is requested, then the figure is reported, any inability of the tool to produce that PDF is stated as a tool limit, other outputs are still produced, and no output is claimed to conform or be accessible without verification.

## Edge Cases

- **CMYK content**: No PDF/A is promised; the build says why.
- **Printer requires a bleed box or crop marks**: Not promised.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Bleed | US-059-AC1 | Trim 6 by 9 inches, bleed 0.125 inch | Build print | Trim box 6 by 9 inches with 0.125 inch bleed area |
| Second PDF | US-059-AC2 | RGB book | Build | Two distinct PDFs, or a stated tool limit |
| No claim | US-059-AC3 | Both PDFs | Inspect metadata and report | No PDF/X claim |
| Alt text missing | US-059-AC5 | One figure without alternative text | Request PDF/A | Figure reported; other outputs built; no unverified claim |

## Dependencies

- **Stories**: US-052.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: OUT-01, OUT-02, OUT-03, OUT-06
- **PRD Requirements**: FR-57
- **External**: Typst. Independent validators are not yet chosen.

## Out of Scope

- PDF/X and CMYK press conversion.
- Printer acceptance.
