---
ddx:
  id: FEAT-012
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.feature-registry
---

# Feature Specification: FEAT-012 — Explorer and typeset preview

**Feature ID**: FEAT-012
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 12. Explorer and typeset preview
**Covered PRD Requirements**: FR-64, FR-65, FR-76
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

The explorer lets an author see the evidence graph and the typeset book
together. It builds on arras, the DocumentDrivenDX graph application, to browse
and search records (FR-64). It links typeset sentences to claims and evidence
(FR-65) and runs in a browser as TypeScript (FR-76).

## Ideal Future State

An author opens the explorer from their own computer, as one file with no server,
or from a server that Stemma runs on that computer for them (ADR-012). They
find any record, read it, and see how it connects to others, including in a
connected-graph view that handles more than arras shows today. From a sentence
on a typeset page they reach its claim, note, passage, and source, and they
return to the sentence. After an edit, the agent rebuilds the preview, they reload it, and the preview pages show the new text. The explorer marks
what is unverified, and says when a preview page differs from print.

## Problem Statement

- **Current situation**: arras browses records one at a time. A feasibility test
  found that its console graph view draws at most 150 nodes, and its stock static
  build does not open from a local file.
- **Pain points**: An author cannot see a book-scale evidence graph, or get from
  a sentence on a page to what supports it.
- **Desired outcome**: Every linked sentence leads to its evidence and back, in
  an explorer that works from one file with no backend, and can also be served on
  the author's own computer so that a large project's sources all open.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Record exploration | What is in my evidence? | Browse and search records |
| Source view | What does the source say where I cite it? | Show a citation's quotation highlighted in its source text |
| Manuscript browser | What stands behind this note in my report? | Read the report and open each quotation, note citation, and bibliography entry in its source |
| Connected-graph view | How does it connect? | A larger view, contributed to arras |
| Typeset pages | What supports this sentence? | Typeset pages with links in both directions |
| Live preview | How will my edit look? | Typst compiled in the browser |
| Browser delivery | Can I open it anywhere? | A TypeScript bundle that needs no backend |
| Local server | Can I open every source of a large project, and see my latest records? | Serve the explorer on the author's own computer, safely and never stale |

These page outputs differ:

| Output | Meaning |
|--------|---------|
| Build output | A draft or camera-ready PDF from the native Typst build (FEAT-008) |
| Preview page | A page the browser compiles from the manuscript data in the last rebuild; never a build output |
| Record view | The explorer's view of one record and its links |

## Task Model

N/A — the user stories name the tasks.

## Requirements

### Functional Requirements by Area

#### Record exploration (FR-64)

- EXP-01. The explorer must be built on arras and must let the user browse the
  graph record by record, following links in both directions.
- EXP-02. The explorer must let the user search records.
- EXP-03. Search must match text across diacritics using the folding that
  FEAT-011 owns.
- EXP-04. A record view must show which claims, links, and support records are
  unverified, missing, or stale. It must present a support result as a recorded
  model judgment and never as verification.

#### Source view (FR-64; text prepared for a model also obeys FR-61)

- SRC-01. From a citation record or a passage, the author must be able to see the
  citing sentence where one is recorded, the cited work and the work it is part
  of, the quotation in the text of its source page with the printed page label
  and how that label was established, in the explorer and through the command
  line. The command line must also take a quotation of an assembled report
  (CONTRACT-006 I).
- SRC-02. A quotation must be highlighted only when the passage's address still
  gives exactly the words the passage copied, from a source file in effect whose
  source is the passage's source. For a citation, its recorded quotation, locator,
  and cited work must also agree with the passage. Otherwise nothing is
  highlighted, and the view says which of these failed or that there is no
  passage. A highlight that could be wrong must not be shown.
- SRC-03. The view must say that the words are converted or recognized text and
  not a reading of the page, and show the recorded method, quality, comparisons,
  and current reviews as records, never as proof. A model's review may appear
  only as a flag.
- SRC-04. The view must name the original as the source file records it (its
  form, files by digest, addresses it was obtained from, or where it is held) and
  must not show a local path. Viewing must fetch nothing. The command line says
  whether a file with the recorded digest is held in the project or its cache.
  Opening an original is not part of this requirement.

#### Manuscript browser (FR-64; disclosure also obeys FR-61)

The first manuscript is the report that `build report` assembles (CONTRACT-006
I). A Stemma copy of a manuscript (CONTRACT-006 A to H) is not browsed yet.

- MAN-01. From a visible control, the author must be able to read the report in
  the explorer: its headings, text, quotations, numbered notes with their
  citations and comments, and bibliography. It must be the manuscript as the
  export read it, from the report directory the export names, and the page must
  say that it is not the printed PDF and that originals are not opened yet.
- MAN-02. Clicking a quotation, or the citation of a note, must show the cited
  source with the quoted words highlighted in its source text, under SRC-02 to
  SRC-04 and by the same source view. A quotation over several passages lists
  each. A citation of a quotation that records no passage opens the source and
  highlights nothing.
- MAN-03. Clicking a bibliography entry must show the source with every place
  the report cites it, each openable. Quotations of it given without a citation
  of their own are listed apart.
- MAN-04. Every link must come from the data the report builder itself used. No
  link, citation, or highlight may be made by matching text.
- MAN-05. A quotation that cannot be built as `build report` would build it must
  be shown as broken, with why, without its text and without a highlight, and the
  rest of the report must stay readable. `build report` itself still fails.
- MAN-06. The manuscript data must obey the author export's disclosure rules:
  no local path, nothing that rests on a record the export leaves out, and a
  warning where its text holds what looks like a coordinate. A change to a report
  input must make the export stale.
- MAN-07. On a narrow screen the source must be shown over the text being read,
  not after it, and be closable.

#### Connected-graph view (FR-64)

- GRV-01. The explorer must show a connected-graph view larger than arras offers
  today.
- GRV-02. The view must be contributed to arras before the explorer relies on
  it, and the explorer must not rely on a private fork (ADR-008).
- GRV-03. A user must be able to open a record from the graph view.
- GRV-04. When the view shows only part of the graph, it must say so.

#### Typeset pages (FR-65)

- TPG-01. The explorer must show the typeset pages.
- TPG-02. The explorer must move from a linked sentence to its claim, and from
  the claim to its evidence.
- TPG-03. The explorer must move from evidence and its claim back to each linked
  sentence.
- TPG-04. A sentence with no linked claim must not be shown as supported.

#### Live preview (FR-65)

- PRV-01. The explorer must compile Typst in the browser to make preview pages,
  using the sentence links and conversion of CONTRACT-006.
- PRV-06. After the author edits, the agent must rebuild the offline preview and
  tell the author to reload it. The reloaded page must compile the rebuilt text.
  An open page is not required to update by itself.
- PRV-02. citeproc-js must format preview citations before layout (ADR-005).
- PRV-03. The explorer must flag preview pages that differ from print, and must
  say when it cannot tell whether they match.
- PRV-04. A preview page must be identified as a preview. It must not count as a
  camera-ready or reviewer output or satisfy a build check.
- PRV-05. When compilation fails or the browser blocks it, the explorer must say
  so and must not present older pages as current.

#### Browser delivery (FR-76)

- BRW-01. All exploration and rendering code the project writes must be
  TypeScript bundled to run in a browser.
- BRW-02. The explorer must ship as a bundle that needs no backend, with
  navigation that works from a local file (ADR-008). The same explorer may also
  be served by Stemma on the author's computer (ADR-012, SRV-01 to SRV-07);
  that does not change the offline file.
- BRW-06. The explorer's browser graph must be generated from the record files,
  must not be committed to the repository, and must be rebuilt when needed, including before a fresh clone is browsed.
- BRW-03. Viewing the offline explorer must send no network request. Viewing the
  served explorer must send requests only to its own server on the same
  computer, and that server must send none.
- BRW-04. The explorer must display record and source text as data and must not
  execute markup or scripts found in it.
- BRW-05. The explorer must supply the offline explorer file for the reviewer
  package from whatever data FEAT-009 passes after removing restricted and
  copyrighted material.

#### Local server (FR-64; ADR-012)

- SRV-01. One command must serve the explorer to a browser on the same computer,
  from the record files, writing nothing in the project, and must open the
  browser. The agent must be able to run it for the author without the secret
  that guards it reaching the agent's transcript or any process argument.
- SRV-02. Every source view and the manuscript view must be given on request,
  with no size cap that leaves out text.
- SRV-03. Browsing and search must answer as the offline explorer does, through
  arras's own static client, with the same stated search limits.
- SRV-04. Data older than the record files must never be presented as current.
  While the server rebuilds after a change, the page must say so and show no
  earlier data.
- SRV-05. Only the page the command opened must be able to read the project:
  CONTRACT-005 M's rules against other web pages, other local ports, other users
  of the computer, and malformed, oversize, or slow requests must hold, and what
  they do not defend against must be stated.
- SRV-06. The server must listen on the loopback address only, make no outbound
  request, let no request name a file, and stop when interrupted or after an
  hour without use.
- SRV-07. The installed plugin must run it with no further package or download
  beyond the pinned runtime.

### Non-Functional Requirements

- **Accessibility**: Explorer views, graph view, and page navigation meet WCAG
  (Web Content Accessibility Guidelines) 2.2 level AA. Automated axe-core runs
  report 0 violations; keyboard and screen-reader behavior is checked by hand.
- **Accessibility alternatives**: 100% of page images have a text alternative.
  Every node and link in the graph view is also reachable as text.
- **Security**: 0 network requests while viewing the offline file, and 0 to any
  other host while viewing the served page; 0 executed scripts from a seeded
  hostile record.
- **Verification**: At least one core flow runs in a real browser against the
  built bundle opened from a local file.
- **Scale** (assumption, pending the product owner): On a synthetic graph of
  10,000 records, the bundle opens within 5 seconds (unverified assumption) and a record view opens
  within 1 second on the test machine. The graph view renders a connected set of
  more than 150 nodes.

## User Stories

- [US-090 — Browse and search the evidence](../user-stories/US-090-browse-and-search-evidence.md)
- [US-091 — See a large connected graph](../user-stories/US-091-see-a-large-connected-graph.md)
- [US-092 — Trace a sentence to its evidence and back](../user-stories/US-092-trace-a-sentence-to-evidence.md)
- [US-093 — Preview typeset pages while editing](../user-stories/US-093-preview-pages-while-editing.md)
- [US-094 — Open the explorer as a local browser bundle](../user-stories/US-094-open-explorer-from-local-file.md)
- [US-116 — See a citation in its source](../user-stories/US-116-see-a-citation-in-its-source.md)
- [US-118 — Read the report and open its sources](../user-stories/US-118-read-the-report-and-open-its-sources.md)
- [US-119 — Browse through the local server](../user-stories/US-119-browse-through-the-local-server.md)

## Edge Cases and Error Handling

- **Graph too large for the view**: The user can narrow it; omitted content is
  stated.
- **Cited text changed, missing, or disagreeing**: No highlight; the view names
  the state (SRC-02).
- **Source text with bidirectional or control characters**: Each piece of text is
  isolated from its neighbours and such characters are shown visibly.
- **Stale explorer data**: When records changed after the explorer data was
  generated and the explorer can tell, it says so; otherwise it shows when the
  data was generated. The served explorer can tell (SRV-04).
- **One sentence with several claims, or one claim in several sentences**: Every
  link is reachable.
- **Sentence split across lines, pages, or a footnote**: Each part leads to the
  same claim.
- **Right-to-left or non-Latin text**: Display is unverified until tested.

## Success Metrics

N/A — requirement verification covers this feature.

## Constraints and Assumptions

- Delivery step M3. M1 and M2 do not depend on the explorer.
- ADR-008 governs the arras contribution and the bundle; ADR-012 adds the local
  server. ADR-008's override of the `react-vite` concern removes backend routes
  and server routing. Explorer
  styling uses Tailwind alongside arras styles, per the HELIX React guideline.
- The `typesetting-fidelity` concern pins Typst, citeproc-js, fonts, and
  packages for print and preview.
- **Risk**: arras may not accept the larger view, or may take longer than
  planned; the explorer's schedule depends on it.
- The preview reads the manuscript Markdown of CONTRACT-006 (ADR-009).
- Edits reach the offline explorer only through a rebuild and reload (ADR-008);
  the served explorer rebuilds itself (SRV-04). Until then an open page shows earlier text, so it shows when its data was built.
- **Risk, not spiked**: Browser Typst compilation was not tried. Research read
  that the compiler is large, that its packaged release lagged the native Typst
  version, and that host or arras security policies may block it. The PRD asks
  that M3 design test it first, with citation formatting.
- **Unverified**: On one macOS machine in headless Chromium, synthetic tests
  built a single-file explorer that opened from a local file. Sentence links
  worked both ways for 43 sentences under two conditions. The preview build
  flattened nested links. Hanging punctuation had to be switched off, or the
  linked build differed from print. Other browsers, systems, and desktop hosts
  are untested.
- **Unverified**: arras search did not match across diacritics, and typeset SVG
  (Scalable Vector Graphics) pages carry no selectable or screen-reader text
  without an added text layer.

## Dependencies

- **Other features**: FEAT-008 and FEAT-011 (required). FEAT-013 shows maps
  inside the explorer. FEAT-009 packages the offline explorer file. FEAT-005 and
  FEAT-007 own claim, note, and result meaning.
- **External services**: arras, Typst with a browser compiler, citeproc-js. The
  explorer data and sentence-link interfaces belong in Contracts.
- **PRD requirements**: FR-64, FR-65, FR-76 (P0, M3).

## Out of Scope

- Argument and geographic map content (FEAT-013).
- Opening or highlighting an original or page image, search beyond the arras
  limits, and an MCP surface: later stages of ADR-012, not yet specified.
- Browsing a Stemma copy of a manuscript, and clicking inside a PDF.
- Print output, watermarks, and build reports (FEAT-007, FEAT-008).
- Reviewer package contents and removal rules (FEAT-009).
- Reviewer comment behavior (FR-79, FEAT-009 COM-01 to COM-04). The offline
  explorer built here is where a reviewer attaches and saves them.
- Editing records in the explorer.
- Hosting the explorer as a web service.

## Open Questions


- [ ] What graph size must the larger view handle? Blocks GRV-01 acceptance and
  the arras contribution; product owner.
- [ ] Does the reviewer's offline explorer include typeset pages or live
  preview, and which source text? Blocks BRW-05; product owner.

