---
ddx:
  id: stemma.adr-008
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# ADR-008: Contribute a larger graph view to arras before the explorer uses it

## Problem

The explorer builds on arras, the DocumentDrivenDX graph application. arras
browses records and ships a React interface, but its connected-graph view is
small, and its stock static build does not open from a local file.

## Decision

We will build the explorer on arras and contribute a larger connected-graph view
to arras before the explorer relies on it. The explorer ships as a bundle that
needs no backend. Its graph data is generated from the record files, is not
committed to the repository, and is rebuilt when needed. After an edit the agent
rebuilds the offline preview and the author reloads it; the reloaded page
compiles Typst in the browser.

## Why We Chose This

### Over a Stemma-only graph canvas
A view in arras serves the whole family.

### Over record browsing with focused views only
It leaves the explorer without a view of the connected evidence graph at book
scale.

## Consequences

**Good**: One graph interface across the family.

**Trade-offs**: The explorer's schedule depends on arras accepting the view. M1
and M2 do not depend on it. With no backend, an open preview does not follow
edits, and a rebuild and reload are needed.

**Drift signals to watch**: A private fork of the arras view; a pilot feature
blocked on the explorer.

## Concern Impact

- **Override / deviation**: `react-vite` backend `/api` routes, server-state
  library, and history routing do not apply to an offline bundle with no
  backend; routing must work from a local file. `concerns.md` lists the
  override.
