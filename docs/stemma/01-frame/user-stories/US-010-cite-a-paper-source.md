---
ddx:
  id: US-010
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-010: Cite a paper-only source through a scan

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: CIT-01, CIT-02
**PRD Requirements**: FR-9
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to scan pages of a book I hold only on paper and cite it
**So that** my paper collection can be checked in the same way as digital sources

## Context

A source without a stored copy cannot be checked, and every report says so. A scan with machine-readable text is the only route for a paper source. Recognition quality is unverified.

## Walkthrough

1. Margit cites a paper-only book, and the report shows the citation as unchecked because no copy is stored.
2. Margit keeps writing and adds a scan with machine-readable text when she can.
3. Stemma stores it, maps the text to printed pages, and records quality.
4. The next check reads the stored text.

## Acceptance Criteria

- [ ] **US-010-AC1** — Given a bibliography record with no stored copy, when a citation of it is checked or built, then the result is not a pass, the report says why it matters and how to fix it, and the build completes without being labelled checked clean.
- [ ] **US-010-AC2** — Given a stored scan with machine-readable text, when the citation is checked, then the missing-copy finding is gone and other checks run against the scan's text.
- [ ] **US-010-AC3** — Given a stored scan with no machine-readable text, when the citation is checked, then the source does not count as checkable.
- [ ] **US-010-AC4** — Given a citation of a source with no stored copy, when the author asks to dismiss the finding, then Stemma records an explanation if wanted, does not dismiss it, and says why.

## Edge Cases

- **The scan omits the cited page**: The citation cannot pass its text-dependent checks.
- **Recognized text is wrong**: A match against it shows agreement with recognized text only; recorded quality is visible.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| No copy | US-010-AC1 | Record "Ellery, Parish Rolls, 1911" with no file | Check and build camera-ready | Not pass; unchecked citation explained; build completes, open findings |
| Scan added | US-010-AC2 | Synthetic scan of pages 12-14 with text | Check | No missing-copy finding; locator and quote checks run |
| Image only | US-010-AC3 | Synthetic image-only scan | Check | Not pass; reason names missing text |
| Not dismissible | US-010-AC4 | Same record | Ask to dismiss with a reason | Explanation saved on request; finding stays open |

## Dependencies

- **Stories**: US-007, US-009.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: CIT-01, CIT-02
- **PRD Requirements**: FR-9
- **External**: Recognition engine is open. A missing stored copy cannot be dismissed (FR-32).

## Out of Scope

- Operating a scanner.
- Selecting or tuning recognition.
