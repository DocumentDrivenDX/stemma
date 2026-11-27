---
ddx:
  id: US-123
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-123: See the quoted words marked on the original

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: SRV-14
**PRD Requirements**: FR-64, FR-9
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** clicking a quotation or reference to show the quoted words marked on the original itself
**So that** I find and check them there without searching the page.

## Context

The product owner requires that clicking reference or bibliography text opens the
source material with the text highlighted, from original images or PDFs where
possible, and from the repository's text otherwise. A mark on the wrong words
would be believed, so a mark is drawn only where it can be shown to be right, and
otherwise the page says why not.

## Walkthrough

1. Margit clicks a quotation in her report, from a source whose original is a PDF with real text.
2. Beside the highlighted converted text, the page of the PDF has the same words marked, with a statement that the boxes are positions from the PDF's text layer.
3. She clicks a quotation from a scanned book. The page is shown with nothing marked, and says that the only positions are a recognition layer's over an image.

## Acceptance Criteria

- [ ] **US-123-AC1** — Given a passage on a PDF page whose text equals the source text's page and whose quoted glyphs are drawn plainly, when its source is opened, then boxes cover exactly the quoted words in the drawn page, and the page says what the boxes are and what was checked.
- [ ] **US-123-AC2** — Given a page whose re-read text differs in any character or order from the source file's part, or bytes that are not the recorded ones, then nothing is marked and the reason is given.
- [ ] **US-123-AC3** — Given rotated, vertical, or right-to-left text, a ligature, or a word split by a hyphen in the quotation, then nothing is marked and the reason is given.
- [ ] **US-123-AC4** — Given words drawn invisibly (a scan's recognition layer included), in white, transparently, too small, clipped, off the page, covered, over a painted background, overlapped by other text, or by drawing the server does not know, then nothing is marked and the reason is given.
- [ ] **US-123-AC5** — Given a page image, or the offline file, then nothing is marked and the text stays highlighted.
- [ ] **US-123-AC6** — Given the server's refusal rules, a hostile or slow PDF, or many requests, then the work is bounded, no rule or policy is loosened, and no box is drawn from an unproved answer.
- [ ] **US-123-AC7** — Given the installed plugin with no packages, then it places boxes.

## Edge Cases

- **A quotation over two pages**: Each page is decided on its own; one may be marked and the other not.
- **A two-column page the converter reordered**: Its text differs in order, so nothing is marked.
- **A footnote marker inside the quotation**: It is not part of the quoted words and is left unmarked.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Exact boxes | US-123-AC1 | Invented PDF; the same layout with only, and without, the quoted words | Open; compare pixels | All quoted ink inside boxes, no other ink |
| Text differs | US-123-AC2 | Changed word, reordered lines, corrected part | Ask | Reason; no box |
| Geometry | US-123-AC3 | Each case | Ask | Its reason; no box |
| Hidden | US-123-AC4 | Each case | Ask | Its reason; no box |
| No positions | US-123-AC5 | Page image; offline file | Open | Unmarked |
| Bounds | US-123-AC6 | Crafted calls; slow and crashing reader | Send | Refused or reason |
| Installed | US-123-AC7 | Plugin check | Ask | Boxes |

## Dependencies

- **Stories**: US-121.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRV-14
- **PRD Requirements**: FR-64, FR-9
- **External**: pdf.js, at the pinned release.

## Out of Scope

- Boxes from a recognition layer, on page images, or in the offline file; recognizing text in images; clicking inside the manuscript's PDF.
