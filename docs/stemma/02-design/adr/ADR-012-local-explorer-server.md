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
