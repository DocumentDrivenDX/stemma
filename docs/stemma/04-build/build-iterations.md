# Build iterations through the evidence graph browser

From a code audit of `origin/main` at e9f1d29 (plugin 0.0.9) on 2026-11-26.
Each iteration lands as its own commit with tests. "Held" iterations overlap
work in progress elsewhere and wait until it reaches `main`.

| # | Iteration | Specs | Needs | State |
|---|---|---|---|---|
| 1 | Checks read the manuscript | FR-14, 15, 29, 35 (reader) | — | Held: takeover session's, after the unmerged manuscript reader |
| 2 | Note and claim rules; `reviewed`/`unreviewed` | FR-20, 21, 23 | — | Open |
| 3 | Legacy exchange: BibLaTeX, CSL-JSON, RIS | FR-13 | — | Takeover session; not started |
| 4 | Citation formatter | ADR-005 | — | Held: citations work |
| 5 | Basic PDF build | FR-83, 39, 35 | 1, 4 | Held: citations work |
| 6 | Takeover intake | FR-71, 92 | 3 | Takeover session; matcher on main, Word reader and matcher fixes in progress |
| 7 | Unverified graph and Stemma copy | FR-72, 73 | 1, 6 | Takeover session; after 1 and 6 |
| 8 | Rounds and first report | FR-73, 93 | 7 | Takeover session; after 7 |
| 9 | Claim support records | FR-52 to 54 | 1, 2 | Held |
| 10 | Runtime hardening and in-agent check trigger | FR-31, 75, 78 | — | Open; hosted runs stay advisory (ADR-007) |
| 11 | Graph export and record browser | FR-62, 64 | — | In progress |
| 12 | Project start | FR-1, 60 | — | Open |
| 13 | Constructs and claim relations | FR-22, 80 | 2 | Open |
| 14 | Research and admission | FR-16, 17, 19 | 3 | Open |
| 15 | Outline and drafting | FR-24, 25 | 12, 13 | Open |
| 16 | Voice profiles | FR-69, 70 | 12 | Open |
| 17 | Full typesetting (contents, images, right-to-left, PDF/A, footnotes) | FR-36 to 38, 55 to 57, 91 | 5 | Held; report and book scope undecided |
| 18 | Audit and AI-use disclosure | FR-43, 45 | 9, 13, 17 | Held |
| 19 | Takeover suggestions | FR-82 | 8, 13 | Held |
| 20 | Typeset pages and preview in the explorer | FR-65, 76 | 5, 11 | Held |
| 21 | Connected-graph view | FR-64 (ADR-008) | upstream arras | Needs an arras contribution |
| 22 | Places and maps | FR-81, 66 to 68 | 11, 13 | Open after 11, 13 |
| 23 | Reviewer package and comments | FR-46, 79 | 18, 20, 22 | Held |
| 24 | A citation shown in its source: agent and graph browser | FEAT-012, FR-61, FR-64 (to be specified) | 11 | Next after 11 |
| 25 | Manuscript browser: from a reference to the highlighted source | FEAT-012, FR-65 (to be specified) | 24, 1, 4 | Requested; needs the manuscript reader and citation formatter on main |

## Iteration 24: see a citation inline with its source

Requested by the product owner for both the agent and the graph browser. From a
citation (not only a passage ID): show the citing sentence where one is
recorded, the quotation highlighted within its source page's text with the
printed page label, that the text is converted or recognized and its recorded
quality, and the way to the original where one is recorded.

- Specify it in FEAT-012 and the contracts before building.
- Check the anchor's `page_sha256` before highlighting; on a mismatch, say so
  and highlight nothing. Handle quotations across line-end hyphens.
- Agent side: a command that starts from a citation ID, and the skill that uses
  it. `excerpt --passage` today shows surrounding text as separate blocks.
- Browser side: decide how much source text an author export carries (size,
  arras limits, restricted sources). Source text stays inert text. A link to an
  original is a link the author follows; viewing still sends no request.
- Page images need originals the project may not hold; say when there is none.
## Iteration 25: manuscript browser

Requested by the product owner. The author reads the completed manuscript and
clicks citation text or a bibliography entry to open the source material itself
with the cited text highlighted. It opens the original PDF or page images where
possible and falls back to the text snapshots in the repository.

- An in-text citation opens the cited place. A bibliography entry opens the
  source and lists every place the manuscript cites it.
- Order of preference: the original PDF or page images, then the repository's
  text snapshot. Say which one is shown, and why an original is not.
- Use an original only when its digest matches the recorded one. Originals may
  be absent from the repository and from a fresh clone.
- Highlighting on an original needs text positions. A PDF text layer can give
  them; a scan with no word positions cannot. Then show the page unhighlighted
  beside the highlighted snapshot text, and never guess a region.
- Never highlight text whose anchor no longer matches. A citation with no
  recorded quotation or page opens the source and highlights nothing.
- To design first: how a page opened from a local file reaches large originals
  (embedded, files beside the page, or a local server) without breaking the
  no-network rule (BRW-03) or the no-backend rule (BRW-02, ADR-008). A change
  to either rule is the product owner's decision. Fetching a remote original
  stays a separate action the author asks for.
- Originals stay out of reviewer exports unless the rights rules allow them.

## Not completable by an agent alone

- License reviews: citeproc-js, the Chicago CSL style, bundled browser code.
- Product-owner decisions listed as open questions in the PRD and in FEAT-008,
  FEAT-012, FEAT-013 and FEAT-015, including report versus book typesetting,
  the reviewer excerpt limit, and the graph size the larger view must handle.
- The arras contribution for the larger graph view.
- Real author data: pilot chapters, libraries, hand-checked answer lists.
- Human checks: desktop installs, print review of PDFs, accessibility by hand.
