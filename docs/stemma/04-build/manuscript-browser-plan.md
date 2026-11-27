# Implementation plan: large projects and the manuscript browser (26 and 25)

Requirements and measurements: [build iterations](build-iterations.md),
iterations 25 and 26. Each stage is committed and mergeable on its own.

## Review amendments (binding; they override the stage text below)

**Order:** C (clickable manuscript, snapshot text, offline file), then A, then
B1 (specs, server, security, static executor, source views per ID), B2 (search
and paging beyond arras limits), B3 (originals, shown unhighlighted), B4 (MCP),
then D (highlighting on originals). A SQLite query engine is the later FEAT-011
P1 engine with its own conformance suite, not part of these stages.

**C.** `buildReport` returns less than assumed: no blocks or positions, no
bibliography entry IDs, and it throws on any changed passage. Refactor it to
produce per-block segments (text; quotation with its ID and passages; note
reference) and render `report.md` from them, byte-identical (tested). Return
entry IDs from `formatCitations`. Add a mode that collects errors, so one broken
quotation is shown as broken and not highlighted while the rest is readable.
`build report` itself keeps failing as now. State which report directories are
read. Render the needed Markdown subset (italics, links) into text elements. A
report quotation over several passages gets one view listing each passage.
Report quotations are `report.json` specs, not citation records.

**B1.** An HTTP client cannot answer arras's reads from SQL without writing a
GraphQL engine: `GraphBrowser` sends arbitrary `moduleQuery` GraphQL. Instead
the server runs arras's own static executor in Bun over the export's graph; the
page client forwards `moduleQuery` unchanged. The served data is the export
(with states and search text), so B depends on A. Freshness: a stat scan of
records, sources and manuscript, recomputing digests only on change; on change,
rebuild fully while the page says so, or answer `index_stale`. Measure rebuild.
Say that `GraphStore` is not implemented here.

**B2.** Stemma's own search answers only the search query, in arras's result
shape (a SQLite full-text index is allowed for it); larger pages come from the
client rewriting variables, measured.

**Security.** No cookie (cookies ignore ports). A one-time code in the first
address is exchanged for the secret, then invalidated; the secret lives in
`sessionStorage`, is sent as a header, and is compared in constant time. It
never appears in stdout, transcripts or process arguments; the MCP "open" tool
launches the browser itself and returns an address without it. Exact `Host`
check; POSTs need `application/json` and a custom header. Server template (not
the inlined offline one) with `default-src 'none'; script-src 'self';
worker-src 'self'; style-src` as needed; `frame-ancestors`, `object-src`,
`base-uri`, `form-action` all `'none'`. Specs to amend also: CONTRACT-005 I,
the security requirements ("no server") and the threat model (hostile page,
other local user, other local port, hostile PDF, injection through MCP). Tests
for each, plus oversize and slow requests.

**B3.** Look only in `.stemma/originals/<sha256>` and places the author names;
no symlinks (lstat, O_NOFOLLOW); serve the very bytes that were hashed; size
limit. `/original` is `application/octet-stream`, attachment, sandbox policy,
`Cross-Origin-Resource-Policy: same-origin`. Never use the browser's PDF viewer:
render with the pinned pdf.js from bytes, with eval, scripting and XFA off and
links inert; ship its browser build, worker and cmaps. Convert TIFF or say it is
not shown. Check that a snapshot part maps to a PDF page before showing it.

**B4.** Declare the MCP server in the plugin (the release tree and plugin tests
must include it); the spike confirms `${CLAUDE_PLUGIN_DATA}` is filled in. It
starts in every session, so until a tool is called it does nothing: no download,
listener or index; without Bun it says to run setup; nothing else writes to
stdout. The project is the session's, never a tool argument. HTTP starts lazily,
stops when idle, one per project, lock file without the secret. "Open" takes
only record IDs found in the index, never addresses; results are bounded (IDs,
labels, short excerpts); rights and coordinate rules apply to returned text.
The bundle keeps no unresolved import.

**D.** Highlight on an original only from the server re-extracting that page
with the same pinned pdf.js, and only when that page's text equals the snapshot
part.

**Since D.** The product owner decided that scanned pages show approximate,
labelled estimates (CONTRACT-005 M, "Estimates on scans"; ADR-012). This
replaces "never guess a region" below for scans only. Highlighting is unchanged.

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
