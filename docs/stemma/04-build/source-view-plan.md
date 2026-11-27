# Implementation plan: iteration 24, a citation shown in its source

Requirement: [build iterations](build-iterations.md), iteration 24. The same
operation later serves the localhost server and MCP (iteration 25) and large
projects (iteration 26).

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

- `source show <citation id|passage id> [--format text|json]`. Text output
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
reach the recorded original) and a user story. CONTRACT-002: `source show`.
CONTRACT-005: the new derived file. SD-012 and CONTRACT-004 where affected.

## Tests

`sourceView` for every state, a two-page quotation, a notes-stream quotation,
characters outside the BMP before the highlight, and a changed page; CLI text
and JSON; export determinism and omission rules; a hostile page text; a real
browser flow on the worked example from `file://` (open a citation, see the
highlight and page label, zero requests); measured size added by the new file
on the worked example.

## Done when

All local checks pass, and from the worked example's page and from `source show`
an author sees a citation's sentence, its quotation highlighted in its page
text, the printed page and the recorded quality.
