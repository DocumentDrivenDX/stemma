---
ddx:
  id: US-118
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-118: Read the report and open its sources

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: MAN-01, MAN-02, MAN-03, MAN-04, MAN-05, MAN-06, MAN-07
**PRD Requirements**: FR-64, FR-61
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** to read my report and click a quotation, a note, or a bibliography entry
**So that** I can see in the source what each one rests on, without searching the records.

## Context

The author thinks in terms of her text, not of records. A link that leads to the
wrong words, or a mark on them, would be worse than none, so every link comes
from what the report was assembled from.

## Walkthrough

1. Margit opens the explorer and chooses the manuscript.
2. She reads the report. The page says that this is the manuscript as the export
   read it, not the printed PDF. Originals are shown only by the served explorer
   (US-121).
3. She clicks a quotation or a note's citation. The source appears beside the
   text, or over it on a narrow screen, with the words marked.
4. She clicks a bibliography entry, sees the source and every place the report
   cites it, and opens one.
5. Where a quotation no longer agrees with its source, she sees that it is broken
   and why, and reads the rest.

## Acceptance Criteria

- [ ] **US-118-AC1** — Given a built report, when Margit opens the manuscript from a visible control, then she reads its headings, text, notes, and bibliography, with the statement of what the page is.
- [ ] **US-118-AC2** — Given a quotation or a note citation, when she clicks it, then she sees its source with exactly the passages' words marked in the source text.
- [ ] **US-118-AC3** — Given a quotation that records no passage, when she opens its citation, then the source is named and nothing is marked.
- [ ] **US-118-AC4** — Given a bibliography entry, when she clicks it, then she sees the source and every note citation of it, a letter listed under its collection included, and can open each.
- [ ] **US-118-AC5** — Given a changed, missing, or disagreeing passage, when she reads the report, then that quotation is shown as broken with why, its text is not shown, nothing is marked for it, and the rest is readable; `build report` still fails.
- [ ] **US-118-AC6** — Given hostile or hidden characters in manuscript or source text, when she reads it, then it is shown as text with hidden characters visible, and the page sends no request.
- [ ] **US-118-AC7** — Given a local path, a retired record, or coordinate-shaped text in what the report uses, when the export is made, then the path and what rests on the retired record are left out, and the coordinate is warned about.
- [ ] **US-118-AC8** — Given a change to `report.json` or its template, when `graph status` runs, then the export is stale.
- [ ] **US-118-AC9** — Given a narrow screen, when she opens a quotation, then the source is shown on screen without scrolling past the text, and she can close it.

## Edge Cases

- **A letter printed in a collection**: The bibliography lists the collection; each place says which letter it cites.
- **A note with a comment only**: The comment is shown; it names no source and gives no link.
- **A work named only in the author's own words**: No link is made from text.
- **No report**: The page offers no manuscript.
- **A report that cannot be read**: The page says why.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Read | US-118-AC1 | Worked example, local file, offline | Open the manuscript | Report text and statement |
| Open | US-118-AC2 | Worked example | Click quotations and citations | Marks equal the passages' words |
| No passage | US-118-AC3 | A quotation listing no passage | Open its citation | Source named; no mark |
| Bibliography | US-118-AC4 | A printed letter and its volume | Click the entry | Every citing note listed and openable |
| Broken | US-118-AC5 | A page changed after capture | Export and read | One broken quotation; others open |
| Hostile | US-118-AC6 | Markup and bidirectional characters | Read | Inert text; no request |
| Disclosure | US-118-AC7 | Local path, retired source, coordinate | Export | Left out; warned |
| Stale | US-118-AC8 | Edited template | `graph status` | Stale |
| Narrow | US-118-AC9 | 390 px wide | Click a quotation | Source on screen |

## Dependencies

- **Stories**: US-114; US-116.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: MAN-01, MAN-02, MAN-03, MAN-04, MAN-05, MAN-06, MAN-07
- **PRD Requirements**: FR-64, FR-61
- **External**: None.

## Out of Scope

- Originals, page images, and the printed PDF.
- A Stemma copy of a manuscript.
- Judging whether a source supports a sentence.
