---
ddx:
  id: stemma.adr-009
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
    - stemma.adr-005
---

# ADR-009: The manuscript working copy is marked-up Markdown

## Problem

Takeover writes fixes to a Stemma copy of the manuscript and never to the
original (FR-73), the pilot typesets that copy (FR-83), and later books are
written in it. Checks, the Typst build, and the browser preview must read the
same text, find each citation, quotation, and claim in it, and typeset the
structure the book needs (FR-35).

## Decision

We will keep the working copy as Markdown with explicit citation and claim
markers, convert it to Typst, and support only the layout features that
CONTRACT-006 defines.

## Why We Chose This

### Over writing the manuscript in Typst
Typst source can compute content, so checks could not reliably find citations
and quotations without running it.

### Over keeping the Word file as the working copy
Fixes would have to be written back into a complex format, and checks and layout
would depend on how each file was made.

### Over a structured JSON document
An author could not comfortably read or correct it, and text changes would be
hard to compare.

## Consequences

**Good**: Plain text that compares well in git, one reader for checks, build,
and preview, and no executable content in the manuscript.

**Trade-offs**: Stemma owns a Markdown dialect, its reader, and its Typst
converter. Word formatting and layout outside the defined features does not
carry over; takeover must report it. A layout the dialect cannot express needs a
new defined feature. Markers add visible syntax to the prose. Typst output
cannot be hand-adjusted.

**Drift signals to watch**: Raw Typst or HTML passed through; an edited
generated `.typ` file; a check that reads Typst output to find citations; a
second reader for the preview.

## Assumptions

- A defined feature set can carry a humanities chapter: a pilot chapter with
  structure it cannot express would invalidate this.
- Sentences and quotations can be located deterministically enough for
  annotations and checks: unstable results on pilot text would invalidate the
  CONTRACT-006 reading rules.

## Validation

**Result**: not tested
**Evidence**: No reader or converter for this markup exists. Feasibility tests
of citeproc-js with Typst used hand-prepared inputs on one system.

## Concern Impact

- **No concern impact**: The decision applies `typesetting-fidelity`,
  `deterministic-checks`, and `security-owasp` without changing them.
