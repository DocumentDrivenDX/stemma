---
ddx:
  id: stemma.adr-006
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
---

# ADR-006: Build an arras-compatible graph engine off the pilot path

## Problem

The graph needs queries and a service for arras, the DocumentDrivenDX graph
application. The family has no local graph engine in TypeScript.

## Decision

We will build a graph engine compatible with arras, in TypeScript on Bun and
SQLite, as a family contribution. Its first scope is the data reads that arras's
static browser needs, with no writes; writes and wider server compatibility come
later. Its database is rebuildable from the record files. The graph generated
for the browser is not committed and is rebuilt when needed; the plain record
files in the repository are official. The first pilot does not wait for it and uses record files with a
disposable index.

## Why We Chose This

### Over a generated graph file and disposable index only
That meets the measured pilot queries with less work, but leaves the family
without a local engine.

### Over a first engine with writes and the full arras server interface
It is much more work than the reads the explorer needs first.

### Over a thin read-only backend with no engine of its own
It would give fresher views and leave the family without the engine that later
adds writes and wider server compatibility.

### Over building the engine before the pilot
It would delay author feedback on checks and takeover.

## Consequences

**Good**: The family gains a local engine, the pilot is not blocked, and the
repository holds no generated graph that can go stale or conflict on merge.

**Trade-offs**: A large body of work, and a later switch from the disposable
index. Current contracts of Truss (a DocumentDrivenDX storage engine) require
PostgreSQL tables, so the engine may be a separate component. arras restricts
keys, link properties, and relationship end types, which the design must resolve.
A checkout holds no ready browser graph; it has to be rebuilt first.

**Drift signals to watch**: A write that exists only in the database; a pilot
feature blocked on the engine.

## Assumptions

- The reads arras's static browser needs form a bounded interface: if they
  cannot be served without wider server behavior, the first scope grows.
