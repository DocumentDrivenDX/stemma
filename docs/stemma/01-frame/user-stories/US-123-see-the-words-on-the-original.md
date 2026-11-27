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
would be believed, so a highlight is drawn only where it can be shown to be
right. Most scanned books can never meet that. The product owner decided:
"Scanned pages should show approximate highlights if possible. We can refine the
mechanism for doing that over time." So a scan may show an estimate, which is
drawn differently and says that it is one. Otherwise the page says why nothing is
marked.

## Walkthrough

1. Margit clicks a quotation in her report, from a source whose original is a PDF with real text.
2. Beside the highlighted converted text, the page of the PDF has the same words marked, with a statement that the boxes are positions from the PDF's text layer.
3. She clicks a quotation from a scanned book. The page has dashed boxes around where the words probably are, and says that this is an approximate, estimated place from the scan's hidden recognition text, that nothing checks it, and to read the page.

## Acceptance Criteria

- [ ] **US-123-AC1** — Given a passage on a PDF page whose text equals the source text's page and whose quoted glyphs are drawn plainly, when its source is opened, then boxes cover exactly the quoted words in the drawn page, and the page says what the boxes are and what was checked.
- [ ] **US-123-AC2** — Given a page whose re-read text differs in any character or order from the source file's part, or bytes that are not the recorded ones, then no highlight is drawn and the reason is given. Other bytes give no estimate either.
- [ ] **US-123-AC3** — Given rotated, vertical, or right-to-left text, a ligature, or a word split by a hyphen in the quotation, then no highlight is drawn and, unless AC8 applies, the reason is given.
- [ ] **US-123-AC4** — Given words drawn invisibly (a scan's recognition layer included), in white, transparently, too small, clipped, off the page, covered, over a painted background, overlapped by other text, under an annotation that may be seen, set in a font named as one of symbols, or by drawing the server does not know, then no highlight is drawn and, unless AC8 applies, the reason is given.
- [ ] **US-123-AC5** — Given a page image, or the offline file, then nothing is marked and the text stays highlighted.
- [ ] **US-123-AC6** — Given the server's refusal rules, a hostile or slow PDF, or many requests, then the work is bounded in time, number, and memory, no rule or policy is loosened, and no box is drawn from an unproved answer.
- [ ] **US-123-AC7** — Given the installed plugin with no packages, then it places boxes.
- [ ] **US-123-AC8** — Given a passage on a scanned PDF page with invisible recognition text, then an estimate may be shown (CONTRACT-005 M, "Estimates on scans"): it differs from a highlight in shape as well as color, says in words that it is approximate and estimated, how it was derived, and that nothing checks the page says the words, and it is never given or counted as a highlight.
- [ ] **US-123-AC9** — Given a scan whose layer matches the words weakly, or in more than one place that the surrounding words do not settle, or has too few words to match, or no text layer; or a page that is not a scan; then no estimate is shown and the reason is given. Nothing is recognized in an image.

## Edge Cases

- **A quotation over two pages**: Each page is decided on its own; one may be marked and the other not.
- **A two-column page the converter reordered**: Its text differs in order, so nothing is highlighted.
- **A footnote marker inside the quotation**: It is not part of the quoted words and is left unmarked.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Exact boxes | US-123-AC1 | Invented PDF; the same layout with only, and without, the quoted words | Open; compare pixels | All quoted ink inside boxes, no other ink |
| Text differs | US-123-AC2 | Changed word, reordered lines, corrected part | Ask | Reason; no box |
| Geometry | US-123-AC3 | Each case | Ask | Its reason; no box |
| Hidden | US-123-AC4 | Each case | Ask | Its reason; no box |
| No positions | US-123-AC5 | Page image; offline file | Open | Unmarked |
| Bounds | US-123-AC6 | Crafted calls; slow and crashing reader; a small file that unpacks to gigabytes | Send | Refused or reason |
| Installed | US-123-AC7 | Plugin check | Ask | Boxes |
| Estimate | US-123-AC8 | Invented scans: plain, split by a hyphen, rotated, with a stamp, with corrected text | Ask; open | An estimate, labelled and dashed; no highlight |
| No estimate | US-123-AC9 | Invented weak, doubled, short, textless, and not-a-scan pages | Ask | Its reason; no box |

## Dependencies

- **Stories**: US-121.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRV-14
- **PRD Requirements**: FR-64, FR-9
- **External**: pdf.js, at the pinned release.

## Out of Scope

- Highlights from a recognition layer; any mark on page images or in the offline file; recognizing text in images; clicking inside the manuscript's PDF.
