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

Delivery is in stages. The server (`stemma browse`, CONTRACT-005 M) comes first.
Search beyond the arras limits, originals, highlighting on originals, and MCP are
later stages, each specified before it is built. None of them is built by this
decision alone.

## Why We Chose This

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

**Drift signals to watch**: A rule weakened to make something work; a server that
answers from data older than the record files; a request path that reaches the
file system; any outbound request; a second implementation of arras behaviour.

## Concern Impact

- **Override / deviation**: ADR-008's override of the `react-vite` backend routes
  still holds: the server has a fixed set of routes, no REST resource model, and
  no history routing. The `mcp-server` concern becomes relevant when the MCP
  stage is designed.
