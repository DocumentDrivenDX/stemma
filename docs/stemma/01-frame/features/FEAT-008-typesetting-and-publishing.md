---
ddx:
  id: FEAT-008
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.adr-003
    - stemma.adr-005
---

# Feature Specification: FEAT-008 — Typesetting and Publishing

**Feature ID**: FEAT-008
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 8. Typesetting and publishing
**Covered PRD Requirements**: FR-35, FR-36, FR-37, FR-38, FR-39, FR-40 (P2), FR-55, FR-56, FR-57, FR-58 (P1), FR-83, FR-91, FR-96, FR-108
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Typesetting and publishing builds a book from the same project files that hold
its evidence. It covers PRD FR-35 to FR-40, FR-55 to FR-58, FR-83, and FR-91. The
basic pilot PDF (FR-83) is in delivery step M1; the other P0 requirements are
in M2.

## Ideal Future State

The author builds a draft or camera-ready book at any time. Each build
completes with formatted notes, bibliography, and index, records what produced
it, and says in plain language what is open. Image and print problems are named with the file, the measured value, and
the fix. The author knows which output properties are guaranteed and which are
unverified.

## Problem Statement

- **Current situation**: Authors write in a word processor, format citations
  separately, and typeset in another tool or hand the files to a publisher.
- **Pain points**: Manuscript, references, and pages drift apart. Citation
  failures reach finished copies, and low-resolution or rasterized figures are
  found late.
- **Desired outcome**: Every build completes with its report, is called checked
  clean only when nothing is open, and names its inputs and tool versions.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Manuscript structure | Can my book's apparatus be expressed? | Carry the structure typesetting needs |
| Builds and settings | Can I see pages, and what is still open? | Build, configure, report, and label |
| Images | Will my figures print well? | Place, convert, check, and record images |
| Outputs | What can I hand to a printer or archive? | Print and PDF/A outputs; editable export is deferred |
| Footnotes | Can a reader check each quotation? | Generate footnotes with verbatim quotations from passage records |

## Domain Objects

| Object | Meaning |
|--------|---------|
| Draft build | Watermarked unverified; reports what is open |
| Camera-ready build | Release output of the book, without a watermark; reports what is open |
| Reviewer build | Release output for review. The reviewer package that wraps it belongs to FEAT-009 |
| Build record | The commit, tool versions, tree state, and label of a build |
| Image file | The bytes of a raster or vector figure |
| Image record | Source, credit, rights, permission, caption, alternative text, and figure identifier of an image (FR-58) |
| Print PDF | PDF with trim size and bleed for a printer. It is not PDF/X (a print-exchange standard) |
| PDF/A | A separate archival PDF; the first special PDF standard |

## Requirements

### Functional Requirements by Area

#### Manuscript structure

- **STR-01** (FR-35). Manuscript content must express sections, front and back
  matter, footnotes and endnotes, figures with their alternative text, tables,
  captions, cross-references, block quotes, and index entries.
- **STR-05** (FR-35). The manuscript working copy must be marked-up Markdown
  with citation and claim markers, converted to Typst. Only defined layout
  features are supported. CONTRACT-006 defines the markup (ADR-009), and M1
  needs it for the Stemma copy.
- **STR-02** (FR-35). A build must report an unresolved cross-reference or a
  structure it cannot typeset, and must not drop content silently.
- **STR-03** (FR-37). The build must typeset left-to-right books that contain
  right-to-left quotations, including the multiple scripts and transliteration
  they use.
- **STR-04** (FR-37). Right-to-left main text is experimental. The product must
  not promise it.

#### Pilot typesetting

- **PIL-01** (FR-83, M1). The pilot must typeset a taken-over manuscript from
  the Stemma copy to a basic PDF with Typst, with citations and the bibliography
  formatted by citeproc-js in Chicago notes and bibliography, printing the
  manuscript's footnotes as footnotes and its endnotes as endnotes (FR-96),
  labelled
  unverified until the approved example set exists. BLD-01's apparatus and
  OUT-01 and OUT-02 are not part of it.
- **PIL-03** (FR-83, M1). The pilot must be able to build an unwatermarked basic
  PDF and a watermarked draft whatever the findings.
- **PIL-04** (FR-83, M1). Each pilot build must come with its report and label,
  must record the commit, tool versions, and tree state as BLD-06 states, and
  must not be presented as checked clean while findings are open.

#### Builds and settings

- **BLD-01** (FR-36). A build must use Typst to produce a camera-ready PDF with
  running heads, folios, table of contents, formatted bibliography, and index.
- **BLD-02** (FR-36). citeproc-js must format citations before Typst lays out
  the book.
- **BLD-03** (FR-38). Style, trim size, fonts, and citation style must be
  project settings with documented defaults.
- **BLD-04** (FR-38). Chicago notes and bibliography must be guaranteed against
  examples approved by someone holding the style manual. Output in any other
  style must be labelled unverified.
- **BLD-05** (FR-39). Every draft, camera-ready, and reviewer build must complete
  whatever the findings, with a plain-language report. Only an ordinary tool
  failure, such as a compile error, may stop output.
- **BLD-06** (FR-39). Every build must record the commit if any, tool versions,
  whether the project had uncommitted changes, and the label. Uncommitted
  changes must be reported as a finding.
- **BLD-07** (FR-39). A draft must carry a visible unverified watermark. A
  camera-ready output carries no page mark; its report states its status. An
  output must be labelled checked clean only when no finding is open (FR-30).
- **BLD-08** (FR-38). The first version must ship the trim sizes 6 x 9 in,
  5.5 x 8.5 in, and A5.

#### Images

- **IMG-01** (FR-55). Raster images must be placed without resampling.
- **IMG-02** (FR-55). The build must report each raster image's effective
      resolution at its placed size, and any image below the project's print
  threshold.
- **IMG-03** (FR-55). TIFF and EPS (Encapsulated PostScript) images must be
  converted by a recorded step before placement. The originals stay unchanged.
- **IMG-04** (FR-56). Vector images must stay vector in the output PDF, with
  fonts embedded or converted to outlines.
- **IMG-05** (FR-56). A converted EPS image that cannot stay vector must be
  reported.
- **IMG-06** (FR-56). The build must report any other vector image whose
  content would be rasterized, dropped, or set in a substitute font.
- **IMG-09** (FR-55 to FR-58). Each finding about an image's resolution,
  alternative text, credit, permission, or vector form must appear in the build
  report with its evidence and a suggested action.
- **IMG-07** (FR-58, P1). Each image must have an image record.
- **IMG-08** (FR-58, P1). A check must report when an image lacks credit or
  recorded permission.

#### Outputs

- **OUT-01** (FR-57). The build must produce an ordinary print PDF with the
  configured trim size and bleed area.
- **OUT-02** (FR-57). For black-and-white or RGB books the build must also
  produce a separate archival PDF to the PDF/A standard.
- **OUT-03** (FR-57). It must not produce or claim PDF/X.
- **OUT-06** (FR-57). The PDF/A must carry the figures' alternative text
  (STR-01), and the build must report figures that lack it. If the pinned tool
  cannot produce the PDF/A (unverified), the build must say that this is a limit
  of the tool and still produce its other outputs. No output may be claimed to
  conform to PDF/A or to be accessible unless that has been verified.
- **OUT-04** (FR-40, P2, deferred past v1). The same source also builds a
  reviewer-friendly format for co-authors and publishers who need Word, LaTeX,
  or HTML. Which of these, and what each keeps, is decided when the work is taken
  up. These outputs obey BLD-05 and BLD-07
  (assumption).

#### Quoted code and tables

- **EXQ-01** (FR-108, FR-96, P0, M2). A build must print a quotation of
  preformatted text or of a table as a block, in a note or in the body, with the
  passage's lines, indentation, rows, and cells, and set code in a fixed-width
  face. It must not reflow or retype it. **Not built.**
- **EXQ-02** (FR-108, P0, M2). Where an output cannot keep the layout, the build
  must say so and must not present the altered text as exact. **Not built.**

#### Footnotes and the finished text

- **FTN-01** (FR-91, FR-96, P0, M2). A build must generate each footnote or
  endnote that cites a passage from the records: the full citation, the locator, the verbatim
  quotation copied from the source file, and no tool commentary. The passage
  address is kept in the build record, not printed.
- **FTN-02** (FR-91, P0, M2). The built text must read as ordinary scholarship:
  nothing about Stemma, records, checks, or verification status appears in its
  body or footnotes.
- A book's own image files are the author's; each image record names its file by
  path and hash, and a missing or mismatched file is reported.

### Non-Functional Requirements

- **Determinism**: A build calls no model (0 calls) and takes no result from a
  saved scripted check; every check is recomputed (FR-31).
- **Reliability**: With the project and pinned tools present, a build completes
  with the network disabled and downloads 0 packages or fonts.
- **Fidelity**: On a seeded font-gap fixture, 100% of substituted or missing
  fonts and glyphs are reported; none falls back silently.
- **Portability**: Local builds target macOS, Linux, and Windows, and each
  counts as supported only after an observed run (ADR-007 runs are advisory).
- **Performance**: N/A. The PRD sets no build-time target.

## User Stories

- [US-107 — Typeset the taken-over chapter in the pilot](../user-stories/US-107-typeset-the-pilot-chapter.md)
- [US-051 — Write structured book content](../user-stories/US-051-write-structured-manuscript-content.md)
- [US-052 — Build the typeset book](../user-stories/US-052-build-the-typeset-book.md)
- [US-053 — Typeset right-to-left quotations and multiple scripts](../user-stories/US-053-typeset-multiple-scripts.md)
- [US-054 — Set book layout and citation style](../user-stories/US-054-set-book-layout-and-style.md)
- [US-055 — Build a draft or camera-ready book at any time](../user-stories/US-055-build-draft-and-camera-ready.md)
- [US-056 — Send a co-author an editable format (deferred)](../user-stories/US-056-export-reviewer-friendly-formats.md)
- [US-057 — Place raster images at print quality](../user-stories/US-057-place-raster-images.md)
- [US-058 — Keep vector figures vector](../user-stories/US-058-keep-vector-figures-vector.md)
- [US-059 — Produce print and PDF/A outputs](../user-stories/US-059-produce-print-and-archival-pdfs.md)
- [US-060 — Record image credit and permission](../user-stories/US-060-record-image-credit-and-permission.md)

## Edge Cases and Error Handling

- **Content Typst cannot compile**: No check result stops a build. When no page
  can be laid out, the build reports the location and
  cause and does not present an older PDF as current (assumption).
- **Citation that cannot be formatted**: A draft shows it visibly and lists it;
  the build does not invent or hand-edit formatted text.
- **Low-resolution image**: Every build reports it.
- **TIFF or EPS conversion would lose color or depth**, or no pinned converter
  is available: The loss or missing tool is reported; nothing is substituted
  silently.
- **Vector figure the tool refuses under PDF/A**: The build names the
  standard and figure. This is a tool limit. The figure is not rasterized
  silently, and other outputs are still produced.
- **CMYK (cyan, magenta, yellow, black) book**: No PDF/A is promised.
- **Uncommitted changes**: The build completes, records the tree state, and
  reports it, because the commit alone would not identify the built files.

## Constraints and Assumptions

- Concerns: `typesetting-fidelity` (pin Typst, citeproc-js, fonts, and
  packages; check resolution, fonts, and bleed), `deterministic-checks`,
  `honest-assurance` (labels distinguish unverified styles; a checked-clean build
  does not claim that support verdicts were rerun), `cross-platform`,
  `rights-and-permissions` (image rights), `a11y-wcag-aa` (text
  alternatives), and `security-owasp` (manuscript content and images
  are untrusted parsed input).
- ADR-003 governs reporting without blocking; ADR-005 the layout and citation tools.
- **Risk**: no finding stops a build, so a low-resolution image, or one
  without alternative text, credit, or permission, can reach a finished book.
- Assumption: the alternative text in the manuscript (STR-01) is separate from
  the P1 image record that also lists alternative text.
- The pilot (PIL-01) needs Typst and citeproc-js in M1, so the license review
  comes before it.
- Assumption: until the approved example set exists, Chicago output is also
  labelled unverified.
- Risk: citeproc-js license terms need review before it is bundled.
- Risk: citeproc-js missed some Chicago note forms in a feasibility test whose
  expected strings were not checked against the manual.
- Unverified or limited, from tests on one macOS system: bleed produced a trim
  box and no bleed box, so do not promise a bleed box or crop marks. Typst
  rejected TIFF and EPS. Some SVG content vanished, fell back to other fonts, or
  was rasterized. Placed PDF figures were refused under the archival and
  accessible standards tried. Arabic text fell back silently when fonts were not
  supplied, and footnote markers sat on the wrong side after some right-to-left
  quotations without a workaround.
- Unverified: independent PDF/A or accessibility validation, printer
  acceptance, EPS conversion, Word export, right-to-left main text at book
  length, and Linux and Windows builds.

## Dependencies

- **Other features**: FEAT-015 (the Stemma copy the pilot typesets), FEAT-003 (bibliography, locators, uncited entries),
  FEAT-007 (results, report, and label), FEAT-011 (records). FEAT-009
  consumes the reviewer build and build record; FEAT-012 owns browser preview.
- **External services**: Typst, citeproc-js, and pinned converters; exact
  surfaces belong in Contract artifacts.
- **PRD requirements**: FR-35 to FR-40, FR-55 to FR-58, FR-83, FR-91, FR-96, FR-108; related FR-15, FR-30, FR-90, FR-102,
  FR-31, FR-53.

## Out of Scope

- PDF/X output and CMYK press conversion.
- Check logic, support records, and annotations (FEAT-007).
- Live browser preview and sentence-to-evidence links (FEAT-012).
- Release scanning for restricted coordinates (FEAT-013, FR-68).
- Guaranteed citation styles other than Chicago notes and bibliography.
- Image editing, redrawing, or upscaling.

## Open Questions

- [ ] What is the default print resolution threshold? Product owner.
- [ ] Which PDF/A part and conformance level does the second PDF target? Design
  owner.
- [ ] Which Chicago edition is guaranteed, and who approves the examples?
  Product owner.
