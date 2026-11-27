---
ddx:
  id: US-110
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-110: Convert a text-native source and reverify it

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: CNV-01, CNV-02, CNV-03, CNV-04, CNV-05, STR-01, STR-02, STR-03, PIP-01, PIP-02
**PRD Requirements**: FR-84, FR-85, FR-86, FR-87
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to capture library and born-digital sources and have every applicable check set up and run by one command
**So that** I can trust that the text my citations rest on is complete, ordered, and described correctly without setting up checks myself.

## Context

Most sources arrive as text-native files or PDFs with a text layer. Their structure is what makes completeness and page claims checkable.

## Walkthrough

1. Idris asks Claude to capture the sources for a chapter.
2. Claude captures them, converts them, makes catalogue lookups, and runs the checks with one command.
3. The report lists only checks that apply, with each remaining finding explained.
4. On a clone without the originals, the same checks give the same results.

## Acceptance Criteria

- [ ] **US-110-AC1** — Given plain, Gutenberg-style, Markdown, HTML, EPUB, DOCX, and PDF files, when each is converted twice, then structure and stated metadata are kept, library boilerplate never matches a quotation, and both runs give the same files.
- [ ] **US-110-AC2** — Given a source file with a missing, reordered, edited, or unlisted page, when checks run, then each is reported with evidence.
- [ ] **US-110-AC3** — Given a quotation that spans a page break with a running head and a footnote between its halves, when checked, then it matches, and a citation of only one of the pages is reported.
- [ ] **US-110-AC4** — Given a project with upstream records, when the one command runs, then conversion is compared with the originals, lookups are saved, and no check that does not apply is listed.
- [ ] **US-110-AC5** — Given a clone without the originals, when checks run, then the results equal those of the first machine.

## Edge Cases

- **Structure a converter cannot determine**: It is marked undetermined, never guessed.
- **An original is unavailable**: Checks run; coverage shows no comparison with the original.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Formats | US-110-AC1 | One synthetic file of each format | Convert twice | Same files; structure and metadata kept |
| Damage | US-110-AC2 | Delete, reorder, and edit pages | Check | Each reported |
| Across pages | US-110-AC3 | Synthetic two-page quotation | Check | Match; wrong page reported |
| Pipeline | US-110-AC4 | Project with upstream records and originals | Run ingest | Comparisons and lookups saved; only applicable checks listed |
| Clone | US-110-AC5 | Copy without originals | Check | Same results |

## Dependencies

- **Stories**: US-007, US-009.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: CNV-01, CNV-02, CNV-03, CNV-04, CNV-05, STR-01, STR-02, STR-03, PIP-01, PIP-02
- **PRD Requirements**: FR-84, FR-85, FR-86, FR-87
- **External**: Source file format (CONTRACT-007). Catalogue services are reached only by explicit commands.

## Out of Scope

- Research questions and argument (stages 3 and 4).
