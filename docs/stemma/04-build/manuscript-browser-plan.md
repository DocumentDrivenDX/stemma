# Implementation plan: large projects and the manuscript browser (26 and 25)

Requirements and measurements: [build iterations](build-iterations.md),
iterations 25 and 26. Three stages, each committed and mergeable on its own.

## Stage A: export that scales

Profile record-state computation on the synthetic large project and make export
time and memory grow in proportion to the project (suspected: `coverageOf`
rescans records, `core/src/verification.ts`; unmatched quotations search too
much). No result may change: outputs for the worked example and fixtures stay
byte-identical. Keep the project generator as a developer script with a test
at a small size that fails on quadratic growth by counting work, not timing.
Target to report against: 5,000 sources under 60 s and 4 GB.

## Stage B: local server, index and MCP

Specs first: a new ADR for a localhost server with MCP; amend ADR-008, FEAT-012
(BRW-02, BRW-03, scope), CONTRACT-005 (H, I: the HTTP surface) and the
security documents. The offline single file stays, for reviewer packages and
for use without the server, with its stated limits.

- `stemma browse`: builds or refreshes a disposable SQLite index under
  `.stemma/` from the record files (the `GraphStore` port; never canonical;
  never answers stale), then serves the explorer.
- The page uses its own `ArrasClient` over HTTP, passed to `GraphBrowser`. It
  answers arras reads from the index: all searched types, full-text search with
  `search-fold`, ranked results with true totals, and every link. No arras
  fork. Where the arras interface cannot page or limits queries, return more
  where measurement shows the page stays usable, say when results are cut, and
  list the upstream changes needed (open nothing upstream).
- Source views are served per ID (`stemma.sourceview/0` unchanged), so no cap
  drops text.
- Originals: `/original/<sha256>` serves a file only if the digest is one a
  source text records and a file with that digest is found in the project or
  its originals cache; it is hashed before serving. The panel shows a PDF at
  the cited page, or the page image, beside the highlighted text; otherwise it
  says why not and shows the text. Highlighting on the original is only done
  where the PDF text layer places the exact quoted words unambiguously
  (pdf.js is already pinned); otherwise the page is shown unhighlighted. Never
  guess a region. No fetch from a recorded web address.
- Security: bind 127.0.0.1 only; check `Host` and `Origin`; a random per-run
  secret, delivered so it is not logged or sent to other sites, then held as an
  HttpOnly SameSite=Strict cookie; GET and the arras read POSTs only; no CORS;
  page policy `connect-src 'self'`; no outbound requests; no path from a
  request reaches the file system; originals served with `nosniff`, a fixed
  content type and a sandboxing policy; request size and time limits.
- MCP over stdio (`stemma mcp`), declared in the plugin so the host starts it
  through the existing launcher. Tools: open the browser at a record or
  citation (returns the URL), search records, get a source view, server status.
  All read-only. Results mark record and source text as quoted data. The HTTP
  server lives as long as the MCP process (or until `browse` is stopped).
  Spike first: that the plugin can declare and start it from the one bundled
  command line, that `bun:sqlite` has full-text search on the pinned Bun, and
  whether to use the official MCP SDK (pinned) or a small protocol module.

## Stage C: the manuscript browser

The first manuscript is a report built by `stemma build report`:
`buildReport` already knows each note's passages and each cited source. The
general Stemma-copy manuscript (the reader is on main) follows when takeover
writes records (iterations 1 and 7), through the same view shape.

- A derived `stemma.manuscript/0`: the report's blocks, each note with its
  citations, each citation and quotation with its passage IDs, and the
  bibliography with each entry's source ID and the places that cite it. It
  comes from the builder's own data, never from re-parsing the Markdown output
  and matching text.
- The page renders it as text elements (no HTML from the manuscript). Clicking
  a quotation or note citation opens the source view at the highlighted
  passage; clicking a bibliography entry opens the source with every citing
  place. A citation with no passage opens the source and highlights nothing.
- Say that this is the manuscript as the export read it, not the printed PDF;
  clicking inside the PDF is iteration 20.
- Available from the server, and in the offline file within its size cap.

## Tests and done

Tests accompany each stage: security tests for every server rule (wrong Host,
Origin, secret, method, path tricks, unknown digest, changed original), index
freshness and rebuild equality, search completeness on the synthetic large
project, MCP round trip against the built command line, and browser flows on
the worked example. Done when, on the worked example and a 5,000-source
project, an author can search to any record, click a manuscript citation or
bibliography entry, and see the highlighted passage, with the original where
held. Measured numbers are reported.
