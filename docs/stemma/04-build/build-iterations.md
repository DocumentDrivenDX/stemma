# Build iterations through the evidence graph browser

From a code audit of `origin/main` at e9f1d29 (plugin 0.0.9) on 2026-11-26.
Each iteration lands as its own commit with tests. "Held" iterations overlap
work in progress elsewhere and wait until it reaches `main`.

| # | Iteration | Specs | Needs | State |
|---|---|---|---|---|
| 1 | Checks read the manuscript | FR-14, 15, 29, 35 (reader) | — | Held: unmerged manuscript reader |
| 2 | Note and claim rules; `reviewed`/`unreviewed` | FR-20, 21, 23 | — | Open |
| 3 | Legacy exchange: BibLaTeX, CSL-JSON, RIS | FR-13 | — | Open |
| 4 | Citation formatter | ADR-005 | — | Held: citations work |
| 5 | Basic PDF build | FR-83, 39, 35 | 1, 4 | Held: citations work |
| 6 | Takeover intake | FR-71, 92 | 3 | Held: reference-list matcher work |
| 7 | Unverified graph and Stemma copy | FR-72, 73 | 1, 6 | Held |
| 8 | Rounds and first report | FR-73, 93 | 7 | Held |
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

## Not completable by an agent alone

- License reviews: citeproc-js, the Chicago CSL style, bundled browser code.
- Product-owner decisions listed as open questions in the PRD and in FEAT-008,
  FEAT-012, FEAT-013 and FEAT-015, including report versus book typesetting,
  the reviewer excerpt limit, and the graph size the larger view must handle.
- The arras contribution for the larger graph view.
- Real author data: pilot chapters, libraries, hand-checked answer lists.
- Human checks: desktop installs, print review of PDFs, accessibility by hand.
