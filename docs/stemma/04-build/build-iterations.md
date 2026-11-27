# Build iterations through the evidence graph browser

From a code audit of `origin/main` at e9f1d29 (plugin 0.0.9) on 2026-11-26.
Each iteration lands as its own commit with tests. "Held" iterations overlap
work in progress elsewhere and wait until it reaches `main`.

| # | Iteration | Specs | Needs | State |
|---|---|---|---|---|
| 1 | Checks read the manuscript | FR-14, 15, 29, 35 (reader) | — | Takeover session; the manuscript reader is on main, checks do not use it yet |
| 2 | Note and claim rules; `reviewed`/`unreviewed` | FR-20, 21, 23 | — | Open |
| 3 | Legacy exchange: BibLaTeX, CSL-JSON, RIS | FR-13 | — | Takeover session; import codecs on main (0.0.15), no commands, no export after edits or across formats |
| 4 | Citation formatter | ADR-005 | — | On main |
| 5 | Basic PDF build | FR-83, 39, 35 | 1, 4 | Report build on main; draft, camera-ready and reviewer builds not |
| 6 | Takeover intake | FR-71, 92 | 3 | Takeover session; Word reader and matcher fixes on main, not yet used by the command line; no records or libraries |
| 7 | Unverified graph and Stemma copy | FR-72, 73 | 1, 6 | Takeover session; after 1 and 6 |
| 8 | Rounds and first report | FR-73, 93 | 7 | Takeover session; after 7 |
| 9 | Claim support records | FR-52 to 54 | 1, 2 | Held |
| 10 | Runtime hardening and in-agent check trigger | FR-31, 75, 78 | — | Open; hosted runs stay advisory (ADR-007) |
| 11 | Graph export and record browser | FR-62, 64 | — | On main; search limits remain (iteration 26) |
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
| 25 | Manuscript browser: from a reference to the highlighted source | FEAT-012, FR-65 (to be specified) | 24, 1, 4 | Requested; needs 24 and 26 |
| 26 | Large projects: thousands of sources | FEAT-011 (FR-63), FEAT-012 | 11; before 25 | Requested; measuring |
| 27 | Import DOCX and PDF manuscripts, end to end | FEAT-015, FR-71 to 73 (PDF to be specified) | 1, 6, 7 | Requested; takeover session accepted it, specs first |

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
- Decided by the product owner: the browser may run a server on localhost and
  expose itself as an MCP (Model Context Protocol) server. The server reaches
  the originals; the agent uses the MCP side, for example to open the browser at
  a citation (iteration 24 uses the same operations). Fetching a remote original
  stays a separate action the author asks for.
- Record the decision first: an ADR, and changes to ADR-008, BRW-02, BRW-03,
  FEAT-012's scope and CONTRACT-005, which say no backend and no network
  request. Assumption to confirm: the single offline file remains for reviewer
  packages (FR-46), with the text snapshot fallback.
- Server rules to design and test: listen on the loopback address only; refuse
  other Host and Origin values (DNS rebinding); require a per-run secret; read
  only; serve only the project's files and originals matched by digest, never a
  path taken from a request; make no outbound request.
- To test: how the supported hosts start the MCP server from the plugin, which
  ships one bundled command line, and how long the localhost server lives.
- Originals stay out of reviewer exports unless the rights rules allow them.
## Iteration 26: large projects

Requirement from the product owner: significant projects have thousands of
sources, and the browser must not be limited to a few dozen. FEAT-012's scale
assumption of 10,000 records is too small: the 14-source worked example already
exports hundreds of entries.

- Every record that matches a search is reachable, with the total shown, ranked
  and paged. No type is left unsearched. Every link of a record is reachable.
  The record browser's current limits (20 searched types, 50 results, also per
  type) do not meet this.
- Design target to confirm: 5,000 sources with their passages, notes, claims,
  citations and source text.
- Expected direction, to test: the localhost server (iteration 25) answers
  searches and reads from a rebuildable SQLite index (the FEAT-011 engine), and
  the page loads what it shows instead of holding the whole project. The single
  offline file states its own measured limit.
- Where arras itself imposes a limit, take the change to arras. No private fork.
- A synthetic large project is part of the tests, with measured export time,
  size, load time and search time.
## Iteration 27: import DOCX and PDF manuscripts

Requirement from the product owner: real book manuscripts in DOCX and in PDF can
be imported. The Word reader is on main but no command uses it. FEAT-015 puts
PDF-only manuscript intake out of scope; this requirement reverses that.

- Specify first: change FEAT-015, FR-71, SD-015 and CONTRACT-003 for PDF
  manuscripts.
- One command takes a DOCX or PDF manuscript, in one file or several, to the
  Stemma copy with its references, quotations and claims, unverified (with
  iterations 6 and 7), and the skill drives it. Originals are never changed.
- Both formats give the same neutral document, so matching, records and the
  copy do not depend on the format.
- PDF: recover body text, headings, tables, footnotes, endnotes, reference
  lists, page labels and comments. Handle columns, running heads, line-end
  hyphens and paragraphs split across pages. Whatever cannot be recovered with
  certainty is reported, never guessed or silently dropped. Reuse the PDF
  reader in `packages/extract` where it fits.
- A PDF with no text layer is reported. Recognition (OCR) of a scanned
  manuscript is a separate decision.
- Keep each imported sentence's position in its original file, so the manuscript
  browser (iteration 25) can show it there.
- Tests use invented manuscripts. Acceptance also runs on the product owner's
  real manuscripts, read where they are; nothing from them enters the
  repository.

## Not completable by an agent alone

- License reviews: citeproc-js, the Chicago CSL style, bundled browser code.
- Product-owner decisions listed as open questions in the PRD and in FEAT-008,
  FEAT-012, FEAT-013 and FEAT-015, including report versus book typesetting,
  the reviewer excerpt limit, and the graph size the larger view must handle.
- The arras contribution for the larger graph view.
- Real author data: pilot chapters, libraries, hand-checked answer lists.
- Human checks: desktop installs, print review of PDFs, accessibility by hand.
