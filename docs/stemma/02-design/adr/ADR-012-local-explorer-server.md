---
ddx:
  id: stemma.adr-012
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-006
    - stemma.adr-008
---

# ADR-012: The explorer may run a server on localhost and expose itself over MCP

## Problem

The explorer was designed as one file with no backend. An export inlines all it
shows, so a large project's source text is cut to keep the file openable (at
5,000 synthetic sources most passages open without text), an open page cannot see
later edits, no page can open an original, and an agent has no way to ask the
explorer for a record or show one to the author.

## Decision

The product owner decided: "It can open a server running on localhost and expose
itself as an mcp."

We will give the explorer a second delivery: a server that the author's own
computer runs, listening on the loopback address only, started by a Stemma
command. It serves the same views as the export, from data it builds from the
record files, and the same arras interface over them. Later it exposes
read-only operations over the Model Context Protocol (MCP, a protocol through
which a program offers tools to an AI agent).

The single offline file stays, unchanged in behaviour, for reviewer packages and
for browsing without a server.

Delivery is in stages. The server (`stemma browse`, CONTRACT-005 M) comes first,
then search beyond the arras limits (M, "Search"), then originals shown
unhighlighted beside the text (M, "Originals"), then MCP (N, "Agents over MCP"
below). Highlighting on originals (M, "Highlighting on originals", and below)
comes last, specified before it was built. None of them is built by this
decision alone.

## Originals in the page

An original is a file from outside. It is never handed to the browser's own PDF
viewer, which would run it with the browser's features: the pinned pdf.js draws
one page of it on a canvas from bytes whose proof and digest have been checked.
The page's content security policy is not loosened for it. pdf.js can decode
JPEG 2000 and JBIG2 images, which scanned books use, with WebAssembly or with
JavaScript; WebAssembly would need `'wasm-unsafe-eval'`, so the JavaScript
decoders are used, which are slower, and embedded color profiles, which need
WebAssembly, are not applied. The worker and both decoders are loaded when the
page is, because a script asked for later could come from another program that
had taken the port. The character maps and fonts are data asked for later, so
they travel as signed calls with proved answers.

Whether a part of a source file is a page of its original is decided from the
record alone (CONTRACT-007 C). Where it is not established, no page is shown.

## Highlighting on originals

The product owner requires that clicking a reference opens the source material
with the text highlighted. CONTRACT-005 M, "Highlighting on originals", states
the rules. The decision is that a wrong box is worse than none.

- **The server, not the page, places boxes,** from the bytes whose digest it has
  checked, and only where the page it reads again has exactly the text of the
  source file's part. Matching text in the page's own text layer would find a
  likely place, which is a guess.
- **Equality is strict and of one page.** A comparison of the converter's three
  text streams would also have been defensible, but it needs the whole document
  converted again. The strict form refused 16 more of 5,022 real pages than the
  stream form, all two-column pages the converter reordered.
- **Positions come from the drawing operators.** pdf.js's text content gives one
  box for a run of text, which cannot place part of a line, and says nothing of
  whether the run is visible. The operators give each glyph and how it is painted.
  The reading of them is Stemma's own code over pdf.js's list, held to account by
  the cross-check with the text content and by tests that compare boxes with
  rendered pixels. Anything it does not know refuses the page.
- **No boxes on scans with a recognition layer.** Their positions are a
  recognition engine's estimates over an image, which nothing here can check
  against the image. This is the common case for scanned books: on the worked
  example, 12 of its 14 originals are such scans, so their pages are shown with no
  box. Reconsider only with a check that ties each box to the image, or if the
  product owner accepts boxes labelled as a recognition layer's estimates.
- **No page rendering in the server.** Comparing rendered pixels with and without
  the quoted words would prove visibility better, but needs a canvas in the
  server, which means a native module the plugin does not ship.

## Search in the server

The product owner requires that a project with thousands of sources is not
limited to a few dozen results: every match must be reachable, with a true total.
Stemma answers search itself, in the process that holds the snapshot, by reading
each entry's folded search text, and answers arras's own search query from the
same function. No arras code is changed.

A SQLite full-text index was allowed and was tried first. The pinned Bun's
`bun:sqlite` (SQLite 3.54.0) has FTS5 with a trigram tokenizer, which with case
sensitivity on found exactly the substrings that a scan found for words of 3 or
more code points, in Latin, Greek, Arabic, Japanese, and Thai test text. It
finds nothing for 1 or 2 code points, which short words and much Chinese and
Japanese need, and it fails on a text holding a NUL, so a scan would be needed
beside it. In the spike, over the 79,020 entries of a synthetic project of 5,000
sources (35 million characters, every value of each entry joined, which is more
than is searched; one macOS machine), a scan with ranking in TypeScript took 5 to
40 ms a search and had nothing to build. SQLite with an external-content trigram
index took 1.5 s and 82 MB more, and, counting and ranking in SQL, up to 250 ms a
search; a bare lookup of a rarer word took under 1 ms (2.6 s to build that
second form), but a broad search is not a bare lookup. So there is no index:
nothing derived is written to disk or can be stale. This is not the FEAT-011
engine, and it would be reconsidered for a project many times that size.

## Agents over MCP

The plugin declares one MCP server that the host starts over standard input and
output, through the plugin's one launcher, and CONTRACT-005 N states its rules.

- **The declaration is guarded.** A host that does not fill in the plugin's
  directories must run nothing: Codex 0.150.1 otherwise ran a script planted in
  the session's directory (CONTRACT-005 N).
- **The host starts it in every session**, so it does nothing until a tool is
  called, and its launcher never fetches Bun for it. Without Bun the launcher
  itself answers, in a few lines of shell, that setup has not run. A server that
  merely failed to start would show an error in every such session and tell the
  agent nothing.
- **The project is the session's**, which the host gives the process. A tool
  argument could be chosen by text the agent has read.
- **The secret never enters the agent's context.** `open` launches the browser
  itself and returns an address that opens nothing.
- **The tools read.** `stop` is added so that the agent can end a server the
  author thinks another program reached. It changes nothing in the project.
- **One server for a project**, so that an author is not left with several pages
  and ports. A second one is refused, not joined: joining would need a key
  passed between processes.


### Over a larger offline file only
Every byte an export shows is loaded by the page, so some cap always cuts text,
and the file holds all of it for whoever gets it.

### Over a Stemma-written query engine now
arras's page sends its own GraphQL queries. Running arras's own static executor
in the server answers them without a second implementation of arras. A SQLite
engine remains the later FEAT-011 engine, with its own conformance suite.

### Over a hosted service
Stemma has no accounts and sends the author's material nowhere.

### Page and server prove themselves to each other

A secret sent as a header, and any `200` believed, were not enough. When the
server stops, another program can take its port within a fraction of a second,
receive the secret from a page still open, and show it invented records as
current. So after the launch file, no request carries the code or the secret:
each signs the request with HMAC, and each answer proves that it holds the same
key, bound to that request (CONTRACT-005 M, "Proofs"). The exchange is signed in
the same way because a code sent in it would let another program that received it
answer with a key of its own and be believed from then on.

- Over TLS: a certificate the browser trusts for a loopback address would have to
  be added to the computer's trust store, and its private key kept.
- Over sending the secret and checking only the answers: the first call after a
  takeover would hand over the secret.
- Over a cookie or a token in each address: both are sent to whatever answers.

This does not cover the page's own script. A page asked for while another
program holds the port is that program's (CONTRACT-005 M, "What this does not
defend against").

The command also says when the code is redeemed, and the page says when the code
was already used, so that an author can tell that something else got in first.

## Consequences

**Good**: No size cap drops source text from a served page; an open page follows
the record files; later stages can reach originals and agents.

**Trade-offs**: A listening port is new attack surface: other web pages in the
author's browser, other users of the computer, and other programs on other ports
can reach it. CONTRACT-005 M, the security requirements, and the threat model
state the rules and what they do not defend against. A process running as the
author is not defended against, as it can already read the project. The server
holds the whole export in memory, and rebuilds it all after a change.

**Drift signals to watch**: A rule or the page's policy weakened to make
something work, drawing originals included; a page of an original chosen by
anything but CONTRACT-007 C; a server that
answers from data older than the record files; a request path that reaches the
file system; any outbound request; a second implementation of arras behaviour
beyond the search result's shape; a search that cuts results without saying so.

### MCP: a small protocol module over the official SDK

The server offers five tools over standard input and output: four request kinds
and one framing rule. Stemma writes that module itself, about 200 lines. Both
official SDKs bundle cleanly, but each would add third-party code that runs in
every session of every author with the plugin (TM-E-007), 530 to 805 KB of it
with code made at run time, for validation and transports these tools do not
use. The evidence is in CONTRACT-005, "Proof Status". This is reconsidered
if Stemma needs a remote transport, resources, or another part of the protocol
that is more than this.

## Concern Impact

- **Override / deviation**: ADR-008's override of the `react-vite` backend routes
  still holds: the server has a fixed set of routes, no REST resource model, and
  no history routing. The `mcp-server` concern is not selected: its practices
  assume a server that is deployed and operated. This one is a child of the
  author's session, offers read-only tools, and has its rules in CONTRACT-005 N.
