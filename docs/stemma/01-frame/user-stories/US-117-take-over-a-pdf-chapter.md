---
ddx:
  id: US-117
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-117: Take over a PDF chapter

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, PDF-08, PDF-09, INT-03, INT-05, INT-06, INT-07, INT-08, INT-11, ADC-06, ADC-08
**PRD Requirements**: FR-95
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities
**I want** to give Stemma a PDF of a chapter whose Word file I no longer have
**So that** I can check its references and keep working on it, knowing exactly what Stemma could not tell from the PDF.

## Context

A PDF places characters on pages. It does not say where paragraphs, notes, or tables are, whether a printed line was deleted under tracked changes, or what a reference manager once stored. A page break or a running head inside a reference entry can leave a part that reads as another work. A missed link costs the author a minute; a wrong one attaches a claim to the wrong source. The rules are CONTRACT-003 I.

## Walkthrough

1. Tomasz starts takeover on a PDF chapter exported from his word processor.
2. Stemma reads the text layer and writes the Stemma copy, records, and report.
3. The report states what a PDF cannot show, names any page it did not read, and lists removed lines and every citation and entry it would not vouch for.
4. Tomasz confirms the original is unchanged and works through the list when he likes.

## Acceptance Criteria

Every test file is invented and built by script.

- [ ] **US-117-AC1** — Given a single-column PDF chapter with a heading, body paragraphs, one footnote with a raised marker, and a hanging-indent reference list, when takeover runs, then records, a Stemma copy, and an author-date account are produced, the footnote follows the paragraph that cites it, each paragraph keeps its page and line places, and the original's hash is unchanged.
- [ ] **US-117-AC2** — Given a repeating running head and a run of page numbers on four pages, when takeover runs, then none is in the text, and each removed line is listed with its page and rule.
- [ ] **US-117-AC3** — Given a reference entry whose first authors end one page and whose last author and year start the next, and a citation of that last author alone, when takeover runs, then the entry is unread and the citation is not linked, even when another entry reads as a solo work by that author in that year.
- [ ] **US-117-AC4** — Given a narrative citation whose joined names are divided from the bracket by a page break, or that starts a paragraph whose predecessor breaks off mid-sentence, when takeover runs, then it is left unlinked with `uncertain_layout`.
- [ ] **US-117-AC5** — Given line-end hyphens inside an entry's family name, inside a cited name, and inside an entry's title, when takeover runs, then the entry with the divided name is unread, the citation is left unlinked with `uncertain_layout`, the title hyphen blocks nothing, and every hyphen stays in the text.
- [ ] **US-117-AC6** — Given a reference list with only space between entries, or one followed with no heading Stemma finds by a prose paragraph of at least five lines, when takeover runs, then no citation that list serves is linked, each is `list_incomplete` or already unresolved without a list, the lines are examined as text, and the report says that no entry was carried forward and why.
- [ ] **US-117-AC7** — Given a page with side-by-side text, a smaller foot line no marker pairs, and a raised marker nothing pairs, when takeover runs, then each is reported, and no citation across the resulting seams is linked.
- [ ] **US-117-AC8** — Given a PDF with a comment annotation, a filled form field, a link, and an attachment, when takeover runs, then the comment is an intake item with its text and page, the others are reported, and nothing is fetched, opened, or run.
- [ ] **US-117-AC9** — Given any PDF, when the report is read, then it states every limit in CONTRACT-003 I under what a PDF cannot show, and labels the input untested for its producer.
- [ ] **US-117-AC10** — Given a PDF whose pages are all images, or all invisible text over images, when takeover runs, then it fails with `pdf_no_text` and writes nothing; given one such page among typed pages, the page is named, the report calls the import partial, and no citation served by a list that page could affect is linked.
- [ ] **US-117-AC11** — Given an encrypted, truncated, or over-limit PDF, when takeover runs, then the named failure results and nothing is written.
- [ ] **US-117-AC12** — Given text pieces on converted pages, when takeover runs, then each ends as paragraph text, a note marker, or a listed removal; and a year in brackets that a paragraph break divided appears as an `unpaired_bracket` item.
- [ ] **US-117-AC13** — Given a chapter already taken over from Word, when a PDF of the same chapter is taken over, then nothing is written and the Word file is named; with `--separate` it proceeds and records that statement. The same holds with the formats in the other order.
- [ ] **US-117-AC14** — Given the same PDF and tool versions, when takeover runs into two empty projects, then the text, links, reported items, and check results are the same, with no model call.

## Edge Cases

- **Tracked changes printed in the PDF**: Stemma cannot tell. The report always says so.
- **Citation inside a table**: A PDF does not show tables, so a citation on one line can be linked, and text across cells is not.
- **Several chapters in one PDF**: Each list serves the text before it, as in Word. Where Stemma does not find the next chapter's heading, running prose usually makes the list not separable.
- **Word H rules**: A Word manuscript's results do not change.

## Test Scenarios

All text is invented. Files are built by `tests/pdf.ts`, extended where a scenario needs an annotation, an image, or invisible text.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Whole chapter | US-117-AC1 | 3 pages, 1 heading, 1 footnote, 4 entries with hanging indent, 5 citations | Take over; hash before and after | 4 entries read, expected links, footnote placed, places kept, hashes equal |
| Furniture | US-117-AC2 | "Coral drafts" at the top and a number at the foot of 4 pages | Take over | 8 removals listed; none in text |
| Split entry | US-117-AC3 | "Adair, A., and" ends page 2; "Brel, B. 2017. Title." starts page 3, indented; another entry "Brel, B. 2017"; "(Brel 2017)" | Take over | Split entry unread; citation unresolved, not linked |
| Split names | US-117-AC4 | "Adair and" ends a page; "Corso (2001)" starts the next; an entry for Corso alone | Take over | Left unlinked, `uncertain_layout` |
| Hyphens | US-117-AC5 | "Mont-" / "rose" in an entry name and a citation; "reef-" / "building" in a title | Take over | Name entry unread; citation unlinked; title entry read |
| No hanging indent | US-117-AC6 | Spaced entries; then a hanging list followed by 5 lines of prose | Take over | Nothing linked by either; reason stated |
| Doubtful layout | US-117-AC7 | Two text columns of 3 lines; unpaired foot line; unpaired marker | Take over | 3 reports; no link across a seam |
| Extras | US-117-AC8 | One of each annotation and an attachment | Take over | All reported; no request made |
| Statement | US-117-AC9 | Any invented PDF | Take over | All limits and `untested` present |
| Scans | US-117-AC10 | All-image; all-invisible; one image page inside a list | Take over | Two failures writing nothing; one partial import that links nothing from that list |
| Damage | US-117-AC11 | Encrypted, truncated, 2,001 pages | Take over | Named failures; project unchanged |
| Account | US-117-AC12 | Seeded piece count; "(Adair" and "2017)" in separate paragraphs by a heading | Take over | Counts balance; `unpaired_bracket` listed |
| Two forms | US-117-AC13 | Invented DOCX and PDF with the same prose | Take over both, in each order | Second refused; `--separate` proceeds |
| Repeat run | US-117-AC14 | Same PDF | Take over twice | Same results |

## Dependencies

- **Stories**: US-099, US-113.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: PDF-01 to PDF-09, INT-03, INT-05 to INT-08, INT-11, ADC-06, ADC-08
- **PRD Requirements**: FR-95
- **External**: PDFs saved by named programs and versions, for support tests; they must be openly licensed or made from invented text. The reading rules are CONTRACT-003 I.

## Out of Scope

- Recognizing scanned pages, or converting a recognition layer.
- Two-column or typeset layouts as designed inputs.
- Replacing a PDF chapter with its Word file.
- Showing original pages in the browser; this story only keeps the places.
