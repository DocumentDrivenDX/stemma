---
ddx:
  id: US-121
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-121: See the original page beside the highlighted text

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: SRV-10, SRV-11
**PRD Requirements**: FR-64, FR-9
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** clicking a quotation, a citation, or a bibliography entry to show me the page of the original beside the highlighted words
**So that** I check the words against the scan or PDF itself, and not only against converted text.

## Context

The project holds converted text, never the originals (ADR-010). The author has
the originals on their own computer. The record ties each source file to them by
digest. An original is a file from outside, and a page shown for the wrong words
would mislead, so only a matching file and an established page are shown. Where
that cannot be done, the converted text is what remains. Marking words on the
original itself is US-123.

## Walkthrough

1. Margit asks to browse, and says where her originals are; the agent starts `browse --originals <folder>`.
2. In her report she clicks a quotation. The converted text is highlighted, and beside it the PDF page, or page image, is shown, saying either what is marked on it or that nothing is (US-123).
3. Where a file is missing or changed, or no page can be established, the page says which, and the text is still there.

## Acceptance Criteria

- [ ] **US-121-AC1** — Given a held PDF or page image of a passage's source, when she opens its source from the record panel, a manuscript quotation or note citation, or a bibliography entry, then the original page is shown beside the highlighted text, with a statement of what is marked on it, or that it is not highlighted.
- [ ] **US-121-AC2** — Given a source text whose parts are tied to no page of an original (CONTRACT-007 C), when its source is opened, then no page is shown and the reason is given; a PDF whose page count differs from the record shows no page.
- [ ] **US-121-AC3** — Given a missing, changed, oversize, or unsupported original, a physical one, or the offline file, then the page says which, and the text is shown.
- [ ] **US-121-AC4** — Given files outside the originals cache and the named places, links to a matching file, or a file swapped for another, then their bytes are not served.
- [ ] **US-121-AC5** — Given the server's refusal rules, a digest no source file records, or an answer whose proof is missing or wrong, then no byte of an original is given or used.
- [ ] **US-121-AC6** — Given a PDF with scripts, links, forms, and an attachment, when it is shown, then nothing runs, nothing is followed or fetched, and the page's content security policy is not violated or loosened.
- [ ] **US-121-AC7** — Given the installed plugin with no packages, then it serves what is needed to draw originals, with the licenses.

## Edge Cases

- **No `--originals`**: Only the project's cache is looked in; the page says how to name more places.
- **A named path that is a link or missing**: The command warns and does not look in it.
- **A TIFF page image**: Said not to be shown; it is not converted.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Shown | US-121-AC1 | Invented PDF and page image | Open each kind of source view | Page beside highlight |
| Mapping | US-121-AC2 | Transcription, wrong page count | Open | Reason; text |
| Reasons | US-121-AC3 | Each case | Open | Its reason; text |
| Places | US-121-AC4 | Links, swapped and changed files | Ask | Refused |
| Rules | US-121-AC5 | Crafted requests; changed answer | Send; open | Refused; nothing used |
| Hostile PDF | US-121-AC6 | Script, link, form, attachment | Open | Inert |
| Installed | US-121-AC7 | Plugin check | Run installed | Assets served |

## Dependencies

- **Stories**: US-116; US-118; US-119.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRV-10, SRV-11
- **PRD Requirements**: FR-64, FR-9
- **External**: pdf.js, at the pinned release.

## Out of Scope

- Marking words on the original (US-123), MCP, TIFF conversion, and originals in the offline file or a reviewer package.
