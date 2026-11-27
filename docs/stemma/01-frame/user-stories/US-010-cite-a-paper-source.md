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

# US-010: Cite a paper-only source through a transcription

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: CIT-01, CIT-02
**PRD Requirements**: FR-9
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to cite a book I hold only on paper, with text I typed or had a recognition tool make
**So that** my paper collection can be checked in the same way as digital sources

## Context

A source with no source file cannot be checked, and every report says so. A paper or image-only source enters as a transcription, labelled as recognized or typed text.

## Walkthrough

1. Margit cites a paper-only book, and the report shows the citation as unchecked.
2. She keeps writing and later supplies a transcription of the pages she cites, saying what the book is and where it is held.
3. Stemma writes source files with page labels and marks the coverage as partial.
4. The next check reads them.

## Acceptance Criteria

- [ ] **US-010-AC1** — Given a bibliography record with no source file, when a citation of it is checked or built, then the result is not a pass, the report says why it matters and how to fix it, and the build completes without being labelled checked clean.
- [ ] **US-010-AC2** — Given a transcription of a paper original with a description and where it is held, when the citation is checked, then the missing-text finding is gone and other checks run against it.
- [ ] **US-010-AC3** — Given a transcription made by a recognition tool, when it is shown, then it is labelled as recognized text naming the tool.
- [ ] **US-010-AC4** — Given a citation of a source with no source file, when the author asks to dismiss the finding, then Stemma records an explanation if wanted, does not dismiss it, and says why.

## Edge Cases

- **The transcription omits the cited page**: The citation cannot pass its text-dependent checks.
- **The transcription is wrong**: A match shows agreement with that text only; reviews and comparisons show what has been verified.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| No text | US-010-AC1 | Record "Ellery, Parish Rolls, 1911" with no source file | Check | Not pass; unchecked citation explained |
| Transcribed | US-010-AC2 | Typed pages 12-14 of the paper original | Check | Locator and quotation checks run |
| Recognized | US-010-AC3 | Recognized text from a scan, tool named | Show coverage | Labelled recognized; no page reviewed |
| Not dismissible | US-010-AC4 | First record | Ask to dismiss with a reason | Explanation saved on request; finding stays open |

## Dependencies

- **Stories**: US-007, US-009.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: CIT-01, CIT-02
- **PRD Requirements**: FR-9
- **External**: The author runs any recognition tool; Stemma builds none in. A missing source file cannot be dismissed (FR-32).

## Out of Scope

- Operating a scanner.
- A built-in recognition engine.
