---
ddx:
  id: stemma.adr-004
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# ADR-004: TypeScript on Bun, with any other tool pinned and recorded

## Problem

Scripted tools must run on macOS, Linux, and Windows (FR-75). Research found no
script runtime that every plugin host guarantees. Exploration and rendering code
runs in a browser.

## Decision

We will write the project's code in TypeScript. Deterministic tools run on one
documented, pinned Bun version that authors install. Exploration and rendering
code is bundled for the browser. Another tool is allowed when its version is
pinned and recorded.

## Why We Chose This

### Over supporting Bun and Node
One runtime means one set of behaviors to test and support.

### Over Python
The browser code is TypeScript, and Python is not guaranteed on the hosts
either.

### Over a strict minimal-dependency rule
It would require writing a PDF text reader and a citation formatter.

## Consequences

**Good**: One language across checks and explorer; Bun runs TypeScript directly.

**Trade-offs**: Every author installs Bun. Hosts and sandboxes may not find it or
may block its installation. Bun can fetch a missing package while running, so
runs must disable that. On macOS, Bun uses the system SQLite, so pinning Bun does
not pin SQLite.

**Drift signals to watch**: A second runtime in author-facing steps; a run that
downloads a package; an unrecorded tool.

## Validation

**Result**: not tested
**Evidence**: A package-free indexer ran on one macOS system. Desktop hosts,
Linux, and Windows are untested.
