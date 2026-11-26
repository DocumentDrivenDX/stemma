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

# US-009: Read stored text by printed page

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: TXT-01, TXT-02, TXT-03
**PRD Requirements**: FR-8
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to look up what a stored source says on a printed page number
**So that** a page I cite leads to the same words I would see in the printed work.

## Context

Printed page numbers often differ from positions in a file, and front matter uses its own numbering. Quote and locator checks depend on this mapping and on knowing how good the extraction is.

## Walkthrough

1. Margit admits a PDF with roman-numbered front matter and an article body starting at page 31.
2. Stemma extracts the text and maps it to printed labels.
3. Stemma records the tool, version, and extraction quality, and shows any unmapped pages.
4. Margit opens printed page 41 and sees that page's stored text.

## Acceptance Criteria

- [ ] **US-009-AC1** — Given a stored PDF with roman and arabic printed labels, when text is extracted, then text is retrievable by each printed label.
- [ ] **US-009-AC2** — Given an extraction, when it is saved, then it records the extraction tool, its version, and the extraction quality.
- [ ] **US-009-AC3** — Given a page whose printed label cannot be established, when text is extracted, then the page is marked unmapped and given no label inferred silently from file position.
- [ ] **US-009-AC4** — Given a scanned or non-Latin-script source whose text is weak or absent, when extraction finishes, then its recorded quality shows that and no text-dependent item reports pass on missing text.

## Edge Cases

- **Damaged or encrypted file**: Extraction reports failure and saves no text.
- **The same file is extracted again with a new tool version**: The new version is recorded and dependents of the earlier text are re-checked, not silently re-anchored.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Mapped | US-009-AC1 | Synthetic PDF with pages ix-xii and 31-60 | Look up "x" and "41" | Text of those printed pages is returned |
| Recorded | US-009-AC2 | Same PDF | Read the extraction record | Tool, version, and quality present |
| Unmapped | US-009-AC3 | Synthetic plate with no printed number | Extract | Page marked unmapped |
| Weak text | US-009-AC4 | Synthetic image-only page | Extract and check a quotation on it | Quality recorded; quotation result unverifiable |

## Dependencies

- **Stories**: US-007.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: TXT-01, TXT-02, TXT-03
- **PRD Requirements**: FR-8
- **External**: Pinned PDF text-extraction and recognition tools are open PRD questions. Behavior on real publisher PDFs, scans, and non-Latin scripts is unverified.

## Out of Scope

- Choosing the recognition engine.
- Quotation and locator checks (US-024).
