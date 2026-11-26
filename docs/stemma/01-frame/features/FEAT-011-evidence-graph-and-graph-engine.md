---
ddx:
  id: FEAT-011
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.feature-registry
---

# Feature Specification: FEAT-011 — Evidence graph and graph engine

**Feature ID**: FEAT-011
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 11. Evidence graph and graph engine
**Covered PRD Requirements**: FR-62, FR-63
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

This feature defines how a project's references and supporting data form one
graph of plain record files (FR-62), and the engine that later serves that graph
(FR-63, P1). Other features own what each record means. This feature owns record
structure, loading, and everything derived from the files.

## Ideal Future State

An author or collaborator can read and compare any record as a plain file. They
can follow links from a chapter to a claim, a note, a passage, and a source.
Deleting every index or database loses nothing, and rebuilding from the files
gives the same graph on another computer. A broken record is named and
explained, and the graph never silently drops or merges it. When the engine
arrives, arras reads the same graph from a database that can be rebuilt.

## Problem Statement

- **Current situation**: Authors keep hand-built registers beside a reference
  library, notes, and manuscript. Legacy bibliography formats cannot hold
  passages, claims, constructs, places, or their links.
- **Pain points**: Registers drift. A fact held only in a tool's database cannot
  be compared, merged, or outlive the tool.
- **Desired outcome**: Every fact in the graph is in a record file, and every
  derived view traces to those files.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Records | What is in my project, and can I read it? | One plain file per record, with a defined structure |
| Loading and integrity | Is the graph sound? | Named failures for invalid, duplicate, and dangling records |
| Derived indexes | Can I query it without a second source of truth? | Rebuildable indexes that never answer from stale records unnoticed |
| Graph engine (P1) | Can a graph application serve it? | A rebuildable database compatible with arras |

These objects differ:

| Object | Meaning |
|--------|---------|
| Record | One item in the graph, held as one plain JSON (JavaScript Object Notation) file; the source of truth |
| Record definition | The structure of a record type, written in UMF (the DocumentDrivenDX schema format) |
| Disposable index | A derived query store that features use before the engine exists |
| Engine database | The derived store the graph engine serves from |
| Graph export | A derived file in a form that arras (the DocumentDrivenDX graph application) reads |

## Task Model

N/A — authors reach records through other features; the stories trace the tasks.

## Requirements

### Functional Requirements by Area

#### Records (FR-62)

- REC-01. The graph must hold sources, passages, notes, claims, support records,
  constructs, methodology, places, chapters, searches, annotations, confirmations, admission
  decisions, takeover findings, the author's round choices, and imported reviewer
  comments, together with the project's references.
- REC-02. Each record must be one plain JSON file whose structure is defined in
  UMF.
- REC-03. Each record must have an identity, and a link must resolve to exactly
  one record by identity.
- REC-04. The system must serialize the same record content the same way every
  time and must reject a file with duplicate keys.
- REC-05. Record file names must be safe on case-insensitive file systems and on
  Windows.
- REC-06. Line endings and text normalization used before hashing must be
  defined. Normalization must not change meaning, and values preserved from
  legacy files must stay unchanged.
- REC-07. A change of record format must be applied by a versioned, repeatable
  migration.

#### Loading and integrity (FR-62)

- INT-01. Loading must report each record that does not match its definition,
  naming the file and the reason.
- INT-02. Loading must report duplicate identities and links that resolve to no
  record, and must not merge or drop either silently.
- INT-03. A graph with a load failure must not be presented as complete.
- INT-04. Record validation must catch the cases the graph's consumers reject;
  acceptance by a UMF validator alone is not enough (ADR-002).

#### Derived indexes (FR-62)

- IDX-07. A graph generated for the browser must not be committed to the
  repository, and must be rebuildable from the record files when needed. A fresh clone holds none, so it must be rebuilt before browsing (CONTRACT-005).
- IDX-01. Every index and graph database must be rebuildable from the record
  files alone.
- IDX-02. A fact must never exist only in an index or database, and no write may
  reach one before, or without, its record file.
- IDX-03. The system must detect records changed after an index was built before
  it answers a query from that index.
- IDX-04. Two rebuilds from the same records and tool versions must give the
  same canonical text dump; database bytes need not match.
- IDX-05. Search across names and text must use a Stemma-owned, versioned text
  folding for diacritics and scripts.
- IDX-06. Until the graph engine exists, features must be able to read the graph
  through a disposable index.

#### Graph engine (FR-63, P1)

- ENG-01. The system must provide a graph engine compatible with arras, written
  in TypeScript on Bun and SQLite.
- ENG-05. The engine's first scope must be the data reads that arras's static
  browser needs. It need not accept writes; writes and wider server
  compatibility come later.
- ENG-02. The engine must serve the graph from a database that can be rebuilt
  from the record files.
- ENG-03. For the same records, the engine must return the same graph content as
  a direct load of the record files.
- ENG-04. No first-version P0 feature may depend on the engine, and its work delays neither the pilot nor the first Claude release.

### Non-Functional Requirements

- **Reliability**: Two rebuilds from the same fixtures give 0 differences in the
  canonical dump. The same holds across macOS, Linux, and Windows once each is
  observed.
- **Integrity**: In a seeded set of invalid, duplicate, dangling, and
  conflict-marked records, loading reports every seeded item.
- **Security**: Loading treats record and imported text as data; a seeded record
  containing instructions or markup causes 0 executed instructions or scripts.
- **Performance** (assumption, pending the product owner): On a synthetic graph
  of 25,000 records, a full rebuild of the disposable index takes 5
  seconds or less on the development machine (unverified assumption), and each evidence-chain query under 100
  milliseconds.

## User Stories

- [US-087 — Follow the evidence graph in plain record files](../user-stories/US-087-follow-the-evidence-graph.md)
- [US-088 — Rebuild indexes from record files](../user-stories/US-088-rebuild-indexes-from-record-files.md)
- [US-089 — Serve the graph through the engine](../user-stories/US-089-serve-the-graph-through-the-engine.md)

## Edge Cases and Error Handling

- **Merge conflict markers in a record**: Loading names the file as unreadable
  and asks the author to resolve it.
- **Two file names that differ only by letter case**: The system rejects them on
  every system.
- **Record type or field unknown to this version**: Loading reports it and keeps
  the file unchanged.
- **Interrupted rebuild**: The partial index is not used.
- **Restricted value**: A record refers to the outside store and never holds the
  value or a hash that allows guessing it (FEAT-013).

## Success Metrics

N/A — requirement verification covers this feature.

## Constraints and Assumptions

- ADR-002 makes record files canonical; ADR-006 places the engine off the pilot
  path. The `plain-file-graph` concern governs storage.
- Legacy bibliography formats are imports and exports (FEAT-003).
- The manuscript working copy is Markdown defined by CONTRACT-006 (ADR-009),
  not a record. Claim links from manuscript text are read from it.
- Delivery order: records, loading, and disposable index are part of M1. FR-63
  is P1 and blocks no first-version feature.
- **Unverified**: A prototype indexer rebuilt 25,000 synthetic records on one
  macOS machine with identical canonical dumps. The same test found that SQLite
  versions differ between runtimes, and that Bun on macOS uses the system SQLite.
- **Unverified**: A UMF validator accepted two broken definitions that the arras
  loader rejected. arras also restricted field names, keys, link properties, and
  relationship end types, and merged duplicate links without a report.
- **Risk**: UMF may be unable to express a record type (ADR-002 assumption).
- **Risk**: If the static browser's reads cannot be served without wider server
  behavior, the first engine scope grows (ADR-006 assumption).

## Dependencies

- **Other features**: None. FEAT-001 to FEAT-009 and FEAT-012 to FEAT-015 store
  or read records. FEAT-013 owns restricted-location rules.
- **External services**: UMF, arras, Bun, SQLite. Record formats, graph export,
  and engine interfaces belong in Contracts.
- **PRD requirements**: FR-62 (P0, M1), FR-63 (P1).

## Out of Scope

- The meaning, review state, and checks of each record type.
- Legacy bibliography conversion (FEAT-003).
- Storage of large source files (FEAT-002) and binary storage (FR-59).
- Explorer views (FEAT-012) and maps (FEAT-013).
- Several authors editing one corpus at the same time (PRD P2).
- Claiming conformance to Truss, a DocumentDrivenDX storage engine.

## Open Questions

None for scope. Which reads arras's static browser needs is set by the engine
Contract and checked by its conformance cases.
