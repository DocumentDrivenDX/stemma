---
ddx:
  id: US-024
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-024: Catch invented quotations and impossible locators

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-02, CHK-03, CHK-16, CHK-17
**PRD Requirements**: FR-29
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to find quotations that are not in my sources and page numbers outside the work
**So that** a fabricated quotation or page reaches me before it reaches a reader.

## Context

Fabricated quotations and impossible page numbers are core AI errors. Both checks compare with the source files and their printed page labels.

## Walkthrough

1. Margit checks a drafted chapter.
2. The script looks for each quotation in the source text and each locator in the recorded extent.
3. Stemma reports an absent quotation with the closest match and a page outside the article's range.
4. Margit corrects both and reruns the checks.

## Acceptance Criteria

- [ ] **US-024-AC1** — Given a quotation absent from the source text, when the check runs, then it fails and reports the closest match.
- [ ] **US-024-AC2** — Given a locator outside the cited work's printed page range, when the check runs, then it fails and names the range.
- [ ] **US-024-AC3** — Given a typed non-page locator outside the work's recorded extent, when the check runs, then it fails and shows the extent.
- [ ] **US-024-AC4** — Given missing text or no recorded extent, when the check cannot compare, then it reports unverifiable with the reason.
- [ ] **US-024-AC5** — Given a quotation that differs from the source text only by defined harmless differences, when the check runs, then it passes and records how it was compared.
- [ ] **US-024-AC6** — Given any other near match that is neither fixed nor dismissed, when any build runs, then it completes and reports both texts.
- [ ] **US-024-AC7** — Given a near match, when the author dismisses it, then the annotation holds both compared texts and ends when its sentence or source changes.
- [ ] **US-024-AC8** — Given source text that splits a word with a hyphen at a line end, when a quotation holds the joined word, then it passes and records that the join was applied.

## Edge Cases

- **Quotation spans a line or page break**: Matching rules must be defined and tested; an uncertain match is not silently passed.
- **Ellipses or bracketed edits**: They pass only if the defined harmless differences include them.
- **Translated quotation**: It is not string-verified against the original.
- **Hyphen that belongs to the word**: Joining it can pass a wrong quotation. This risk is stated; the recorded comparison lets the author look.
- **Roman and arabic page labels**: Locators compare with printed labels, not file positions.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Invented quote | US-024-AC1 | Quotation "all fields were abandoned"; source text has "some fields were abandoned" | Check | Fail with closest match |
| Impossible page | US-024-AC2 | "p. 412" for an article printed on pages 31-60 | Check | Fail naming 31-60 |
| Beyond extent | US-024-AC3 | Chapter 14 of a work recorded as 9 chapters | Check | Fail showing 9 chapters |
| Cannot compare | US-024-AC4 | Source with no extracted text and no extent | Check | Unverifiable with reason |
| Harmless | US-024-AC5 | A difference on the defined list | Check | Pass with comparison recorded |
| Near match | US-024-AC6 | One word differs | Build camera-ready | Completes; reported |
| Dismissal | US-024-AC7 | Same | Dismiss with reason | Both texts recorded with the annotation |
| Line-end hyphen | US-024-AC8 | Source text breaks `agri-` / `culture`; quotation has `agriculture` | Check | Pass with the join recorded |

## Dependencies

- **Stories**: US-009, US-016.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-02, CHK-03, CHK-16, CHK-17
- **PRD Requirements**: FR-29
- **External**: The list of harmless differences is owner-approved and untested (CONTRACT-002). Feasibility used synthetic text on one system; hyphenation and ellipsis probes passed wrongly in some cases.

## Out of Scope

- Judging whether a quotation is used fairly.
- Paraphrase support (US-032).
