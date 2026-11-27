---
ddx:
  id: stemma.adr-005
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# ADR-005: Typst lays out the book; citeproc-js formats citations

## Problem

Stemma needs camera-ready output with humanities footnotes, and the same layout
in a browser preview. Typst is a typesetting engine. Citation Style Language
(CSL) is a format for citation styles, and citeproc-js is a JavaScript
processor for it.

## Decision

We will typeset with Typst, with citeproc-js formatting citations before layout,
in both the print build and the browser preview. The manuscript working copy is
marked-up Markdown with citation and claim markers, converted to Typst. Only the
layout features the markup defines are supported (ADR-009). Print output is an
ordinary print PDF; PDF/A is the first special PDF standard, and there is no
PDF/X.

## Why We Chose This

### Over Typst's own citation engine
In tests it printed chapter, folio, and page-range locators wrongly and omitted
note back-references.

### Over Pandoc for citations
Pandoc is a separate program of about 190 MB under the GPL (GNU General Public
License). It did slightly better on line ranges.

### Over a LaTeX toolchain
Typst is the owner's default unless a strong reason appears. Research found none
for left-to-right books printed as ordinary PDF.

## Consequences

**Good**: A small citation library in the chosen language, and one layout engine
for print and preview.

**Trade-offs**: citeproc-js is licensed under CPAL (Common Public Attribution
License) or AGPL (GNU Affero General Public License) and needs a license review,
which has to precede the first pilot because the pilot builds a basic PDF
(FR-83).
Stemma maintains a Typst output adapter and a Markdown-to-Typst conversion, and
authors cannot use Typst layout that the markup does not define. A printer that requires PDF/X needs
another step. Typst offers no verified Word export; manuscript export is deferred past v1 (FR-40). Browser compilation adds size
and may be blocked by host or arras security policies. The PRD (FR-55 to FR-57)
states the resulting print and image scope.

**License review (2026-11-27)**: citeproc-js 2.4.63 (npm `citeproc`) declares
`CPAL-1.0 OR AGPL-1.0` in its package metadata; its notice offers CPAL version 1
or later, or AGPL version 3 or later. Stemma distributes it under CPAL-1.0,
unmodified and unminified in the bundled command line, with its notice, the
CPAL text, and a notice that the source is in the bundle and at its published
addresses. Neither the package nor its repository gives CPAL Exhibit B
Attribution Information, so CPAL 14(c) requires no display. The Chicago style
and en-US locale are CC BY-SA 3.0, bundled unchanged with their credits and the
license text. This is a reading of the license texts, not legal advice.

**Drift signals to watch**: Hand-edited citation output; a PDF/X claim; preview
pages that differ from print without a flag.

## Assumptions

- The browser compiler can match the pinned Typst version closely enough; a
  version gap that changes layout would invalidate the in-browser preview.

## Validation

**Result**: not tested
**Evidence**: Native feasibility tests ran on one system, without the style
manual for expected citations. Browser compilation was not tried.
