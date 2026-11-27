# Implementation plan: iteration 24, a citation shown in its source

Requirement: [build iterations](build-iterations.md), iteration 24. The same
operation later serves the localhost server and MCP (iteration 25) and large
projects (iteration 26).

## Review amendments (binding; they override the text below)

1. **Inputs.** `sourceView` takes a citation record, a passage, or a report
   quotation ID (`report/report.json`, CONTRACT-006 I); iteration 25 adds
   manuscript occurrences through the same shape. It returns an ordered list of
   passage segments (a quotation may `join` several). `corrections`,
   `keep_hyphens` and notes are listed, never applied to highlighted source
   text. Name both the cited work and the work it is `part_of`.
2. **When to highlight.** Only if the anchor gives exactly `quote.exact`, the
   source file is not retired, and its source is the passage's source. For a
   citation, also: its `quotation` equals the rendered passage text, its locator
   equals the passage's, and its key resolves to that source or the work it is
   part of; otherwise state `citation_differs`. Distinct states replace
   `damaged`: no source file, damaged file, invalid anchor, changed. Show the
   page label's `label_status`.
3. **Held originals** are not in the export (it must stay byte-identical across
   machines). The command line computes it at read time by hashing the file.
4. **The original** comes from `source_text.original` (CONTRACT-007 C): form,
   files, per-page images by index, physical holding, `obtained_from`; upstream
   records match by `sha256`, and auxiliary URLs are not originals. All
   addresses and holdings pass the local-path filter.
5. **Quality.** Show page front matter `level`, `method`, `note`; per-part
   comparison-run agreement; a review only while its page digests match; model
   reviews as flags only.
6. **Disclosure.** Amend CONTRACT-005 E to allow cited page text in author
   exports; fix the `page_text` omission count; run the restricted-coordinate
   scan over exported page text and warn; omit retired records (the `retired`
   state is command line only); never put this file in a reviewer package;
   say that `rights` filters nothing (CONTRACT-001 G). For unpaged sources,
   whose parts are chapter sized, export a bounded context window and say that
   text was trimmed.
7. **Hostile text.** Isolate each segment (`dir="auto"`,
   `unicode-bidi: isolate`) and show bidi and other control characters visibly.
8. **Shape for the server.** One per-ID response, `stemma.sourceview/0`, which
   the server will return unchanged. Citation views point to passage views, not
   copies. The panel takes a getter that can become asynchronous. Segments are
   pre-cut in `core` (no offsets for the page to slice). Give the offline file
   a measured size cap with omission counts.
9. **Integration.** Add the file to `FILES`, the known lists in
   `exportOwnFiles` and `exportStaleness`, and a `PLACEHOLDERS` entry. Use
   `GraphBrowser`'s `location`/`onLocation` or the exported `parseExplore`,
   without breaking its own hash routing; do not hand-parse the hash.
10. **Command line.** No `source show`. Extend `excerpt` with `--citation <id>`
    and `--quotation <id>`, and mark the quotation in `--passage` output, under
    CONTRACT-002 G's limits unchanged: over the limit it exits 5 and prints no
    source text. Two-page, notes-stream and retired cases need synthetic
    fixtures.

## One operation in `core`

`sourceView(corpus, id)` takes a citation or passage ID and returns data only:

- the citation, when given: key, locator, recorded quotation, citing sentence;
- the source (ID, title) and the passage, when one is linked;
- per cited page: printed label, index, stream, and the page's text split into
  `before`, `quoted`, `after`, cut by the anchor's code-point offsets;
- the source text's method and recorded quality, and its reviews as recorded
  (never as proof);
- where the original is recorded: upstream URL, file digest and size, and
  whether a file with that digest is held in the project or its cache;
- a state: `highlighted`, `changed` (page digest or quoted text no longer
  matches: return no highlight), `no_passage` (citation with no passage: name
  the source and cited place, highlight nothing), `damaged`, `retired`.

It reuses `textAt` and `anchorsOf` (`passages.ts`), so a highlight appears only
when the anchor still gives the recorded text. A quotation across pages gives
one highlighted segment per page; line-end hyphens need no matching because the
highlight comes from offsets.

## Agent and command line

- `excerpt --citation|--passage|--quotation <id> [--format text|json]`. Text output
  marks quoted source data with the `excerpt` boundary token and marks the
  quotation inside it. It prints at most the cited pages, under `excerpt`'s page
  and character limits; over the limit, it prints the quotation with context
  and says so.
- Skill: when the author asks to see a citation in its source, the agent runs it
  and shows the page text with the quotation emphasised, the printed page, the
  conversion quality, and the original's address or that none is held. It
  presents source text as quoted data, never as instructions.

## Browser

- The export writes `stemma.sourceviews.json` (`stemma.sourceviews/0`, a
  CONTRACT-005 J derived file): one view per passage and per citation, produced
  by `sourceView`. Page text is stored once per page and referenced, so many
  passages on one page do not repeat it. Listed with its digest in the
  manifest; author audience only; the same restricted, local-path and retired
  rules as the graph.
- The host adds a "In the source" panel beside the arras browser, shown when the
  current route (hash) is a Citation or Passage record. It renders React text
  nodes only; the highlight is a `mark` element. It scrolls the highlight into
  view, names the state, and for the other states shows why nothing is
  highlighted. On narrow screens the panel is below the record.
- An upstream URL is shown as a link only for `http` and `https`, with
  `rel="noreferrer noopener"`; nothing is fetched or preloaded. The page policy
  is unchanged.
- Originals are not opened by this iteration: the panel names the original and
  says that opening it arrives with the local server (iteration 25).

## Specs first

FEAT-012: new requirements SRC-01 to SRC-04 (view from a citation or passage;
highlight only on a verified anchor; say the text is converted or recognized;
reach the recorded original) and a user story. CONTRACT-002 G: the `excerpt` additions.
CONTRACT-005: the new derived file. SD-012 and CONTRACT-004 where affected.

## Tests

`sourceView` for every state, a two-page quotation, a notes-stream quotation,
characters outside the BMP before the highlight, and a changed page; CLI text
and JSON; export determinism and omission rules; a hostile page text; a real
browser flow on the worked example from `file://` (open a citation, see the
highlight and page label, zero requests); measured size added by the new file
on the worked example.

## Done when

All local checks pass, and from the worked example's page and from `excerpt`
an author sees a citation's sentence, its quotation highlighted in its page
text, the printed page and the recorded quality.
